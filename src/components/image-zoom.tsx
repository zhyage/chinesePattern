"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { fitZoom, formatZoom, stepZoom, ZOOM_PRESETS } from "@/lib/zoom";
import { cn } from "@/lib/utils";

/**
 * 全屏看大图 + 缩放。
 *
 * **放大靠改渲染尺寸，不靠 CSS transform。** 这是关键：
 *   - `transform: scale(4)` 时浏览器可能先在原尺寸栅格化再拉伸 → SVG 会糊
 *   - `width: 1036*4 px` 会触发**在新尺寸重新栅格化** → SVG 始终锐利
 * 位图放到超过 100% 就是实打实的像素放大（扫描件的颗粒会显出来）——
 * 顶栏显示倍率就是为了让这件事可见。
 *
 * Dialog 用 Base UI 的：焦点陷阱、ESC 关闭、滚动锁定、焦点归还都不用自己写。
 */

/** 图片区四周留白（px） */
const PAD = 32;
/** 顶栏高度（px）—— 与下面的 py-2 + 按钮高度对应，用于算"适应屏幕"的可用区域 */
const TOOLBAR = 56;

interface ImageZoomProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 点哪张开的就显示哪张 */
  initialKind: "bitmap" | "vector";
  bitmapUrl: string | null;
  vectorUrl: string | null;
  /** 无障碍名称，如「云雷纹·圆雷」 */
  name: string;
}

export function ImageZoom({
  open,
  onOpenChange,
  initialKind,
  bitmapUrl,
  vectorUrl,
  name,
}: ImageZoomProps) {
  const [kind, setKind] = useState<"bitmap" | "vector">(initialKind);
  const [zoom, setZoomState] = useState(1);
  /** 0 / 90 / 180 / 270 */
  const [rotation, setRotation] = useState(0);
  const [dragging, setDragging] = useState(false);

  /**
   * 原始尺寸按 URL 缓存。
   *
   * 上色时元素**不是 `<img>`**（见下面 mask 的用法），拿不到 naturalWidth；
   * 而且从矢量图切到位图再切回来时，也需要立刻知道矢量图的尺寸。
   */
  const [naturals, setNaturals] = useState<Record<string, { w: number; h: number }>>({});

  /** 画布底色：`"checkerboard"`（默认）或一个纯色。 */
  const [backdrop, setBackdrop] = useState<string>("checkerboard");
  /** 矢量图的填充色；null = 保持 SVG 原样。只对 vector 生效。 */
  const [shapeColor, setShapeColor] = useState<string | null>(null);

  // 可能是 <img>，也可能是上色用的 mask <div> —— 两者共用这个 ref，
  // 因为「保持视野中心」只关心元素在屏幕上的盒子。
  const imgRef = useRef<HTMLElement | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ x: number; y: number; sl: number; st: number } | null>(null);
  const moved = useRef(false);

  /** 当前倍率。滚轮监听器是空依赖的 callback ref，读不到 state，得靠它 */
  const zoomRef = useRef(1);
  const applyZoom = useCallback((z: number) => {
    zoomRef.current = z;
    setZoomState(z);
  }, []);

  /**
   * 换倍率时**保持视野中心不动**。
   * 不这么做的话，从「适应」按 4× 会跳到图片左上角 —— 想看的正是中间那块，
   * 结果每次放大都要手动拖回去。
   * 记录"视口中心落在图片上的相对位置"，换完尺寸再滚回去。
   */
  const zoomTo = useCallback(
    (next: number) => {
      const body = bodyRef.current;
      const img = imgRef.current;
      if (!body || !img) {
        applyZoom(next);
        return;
      }

      const br = body.getBoundingClientRect();
      const ir = img.getBoundingClientRect();
      if (!ir.width || !ir.height) {
        applyZoom(next);
        return;
      }
      const fx = (br.left + body.clientWidth / 2 - ir.left) / ir.width;
      const fy = (br.top + body.clientHeight / 2 - ir.top) / ir.height;

      applyZoom(next);

      requestAnimationFrame(() => {
        const b = bodyRef.current;
        const i = imgRef.current;
        if (!b || !i) return;
        const b2 = b.getBoundingClientRect();
        const i2 = i.getBoundingClientRect();
        b.scrollLeft += i2.left + fx * i2.width - (b2.left + b.clientWidth / 2);
        b.scrollTop += i2.top + fy * i2.height - (b2.top + b.clientHeight / 2);
      });
    },
    [applyZoom],
  );

  const url = kind === "vector" ? vectorUrl : bitmapUrl;
  const natural = url ? (naturals[url] ?? null) : null;

  // 打开时回到点进来的那张。底色 / 图形色**不记忆**，每次打开都重置。
  useEffect(() => {
    if (open) {
      setKind(initialKind);
      applyZoom(1);
      setRotation(0);
      setBackdrop("checkerboard");
      setShapeColor(null);
    }
  }, [open, initialKind, applyZoom]);

  /** 记下每张图的原始尺寸 —— 上色时用的是 mask，没有 naturalWidth 可读。 */
  function onImgLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    const el = e.currentTarget;
    if (!el.naturalWidth || !el.naturalHeight) return;
    const key = el.getAttribute("src") ?? el.src;
    setNaturals((m) => ({ ...m, [key]: { w: el.naturalWidth, h: el.naturalHeight } }));
  }

  /**
   * 旋转 90° / 270° 时宽高互换 —— 必须换，不能只靠 `transform`。
   *
   * `transform: rotate()` **不改变布局盒**：图转了 90°，视觉上是 274×1074，
   * 但它在布局里仍占 1074×274 —— 容器的滚动区域按后者算，
   * 于是**转出来的那一截永远滚不到**。所以下面用一个按旋转后尺寸撑开的包裹盒。
   */
  const rot = ((rotation % 360) + 360) % 360;
  const swapped = rot === 90 || rot === 270;
  const fitW = natural ? (swapped ? natural.h : natural.w) : 0;
  const fitH = natural ? (swapped ? natural.w : natural.h) : 0;

  /**
   * 是否用 mask 重新上色 —— **只对矢量图**。
   * 位图没有「形状」可言，上色只会把整张图涂成一块，所以不提供。
   */
  const recolor = kind === "vector" && !!shapeColor && !!url;

  /**
   * 可用区域按 **视口** 算，不量滚动容器。
   * 量容器会形成回路：图放大 → 出现滚动条 → 容器变窄 → 重算"适应" → 图缩小 → …
   *
   * 旋转后自动重新适应：旋转是"换个方向看全貌"的动作，停在原来的倍率
   * 很可能让图整个超出视口。代价是丢掉放大倍率（再点一次即可）。
   */
  const applyFit = useCallback(() => {
    if (!natural) return;
    applyZoom(fitZoom(window.innerWidth - PAD * 2, window.innerHeight - TOOLBAR - PAD * 2, fitW, fitH));
  }, [natural, fitW, fitH, applyZoom]);

  useEffect(() => {
    if (!open || !natural) return;
    applyFit();
    window.addEventListener("resize", applyFit);
    return () => window.removeEventListener("resize", applyFit);
  }, [open, natural, applyFit]);

  /**
   * 滚轮缩放。用原生监听是因为 React 的 onWheel 是被动的，preventDefault 不生效，
   * 结果滚轮会一边缩放一边滚动页面。
   *
   * ⚠️ 这里**必须用 callback ref，不能用 useEffect + useRef**：
   *    Base UI 的 Dialog.Portal 是延迟挂载的，挂载时的那个 effect 跑起来
   *    `bodyRef.current` 还是 null，监听器根本挂不上（实测滚轮完全没反应）。
   *    callback ref 是节点真正进 DOM 时才调用的，还能返回清理函数（React 19）。
   */
  const attachWheel = useCallback(
    (el: HTMLDivElement | null) => {
      bodyRef.current = el; // 拖动平移也用它
      if (!el) return;
      const onWheel = (e: WheelEvent) => {
        if (!e.deltaY) return;
        e.preventDefault();
        zoomTo(stepZoom(zoomRef.current, e.deltaY < 0 ? 1 : -1));
      };
      el.addEventListener("wheel", onWheel, { passive: false });
      return () => el.removeEventListener("wheel", onWheel);
    },
    [zoomTo],
  );

  // 拖动平移。用 pointer 事件，鼠标和触摸是同一套。
  function onPointerDown(e: React.PointerEvent) {
    const body = bodyRef.current;
    if (!body) return;
    drag.current = { x: e.clientX, y: e.clientY, sl: body.scrollLeft, st: body.scrollTop };
    moved.current = false;
    body.setPointerCapture(e.pointerId);
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent) {
    const body = bodyRef.current;
    const d = drag.current;
    if (!body || !d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 3) moved.current = true;
    body.scrollLeft = d.sl - dx;
    body.scrollTop = d.st - dy;
  }

  function onPointerUp(e: React.PointerEvent) {
    drag.current = null;
    setDragging(false);
    bodyRef.current?.releasePointerCapture(e.pointerId);
  }

  /** 点空白处关闭；刚拖动过就不算 —— 否则拖完一松手就把灯箱关了 */
  function onBackgroundClick(e: React.MouseEvent) {
    if (moved.current) return;
    if (e.target === e.currentTarget) onOpenChange(false);
  }

  const canSwitch = !!bitmapUrl && !!vectorUrl;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        {/* 必须完全不透明：/90 时底下的页面文字会透上来，看图片细节时很干扰 */}
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black" />
        <Dialog.Popup
          data-testid="image-zoom"
          className="fixed inset-0 z-50 flex flex-col outline-none"
        >
          <Dialog.Title className="sr-only">{name} — 大图</Dialog.Title>

          {/* 顶栏 */}
          <div className="flex h-14 shrink-0 items-center gap-2 overflow-x-auto border-b border-white/15 px-3 text-white">
            {canSwitch ? (
              <div className="flex shrink-0 gap-1">
                {(["bitmap", "vector"] as const).map((k) => (
                  <Button
                    key={k}
                    size="sm"
                    variant="ghost"
                    aria-pressed={kind === k}
                    data-testid="zoom-kind"
                    data-kind={k}
                    onClick={() => setKind(k)}
                    className={cn(
                      "text-white hover:bg-white/15 hover:text-white",
                      kind === k && "bg-white/20 font-medium",
                    )}
                  >
                    {k === "bitmap" ? "位图" : "矢量图"}
                  </Button>
                ))}
              </div>
            ) : null}

            {/* 画布底色 / 矢量图填充色。都不记忆，关掉灯箱即回到默认。 */}
            <div className="flex shrink-0 items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                aria-pressed={backdrop === "checkerboard"}
                data-testid="bg-checkerboard"
                onClick={() => setBackdrop("checkerboard")}
                className={cn(
                  "text-white hover:bg-white/15 hover:text-white",
                  backdrop === "checkerboard" && "bg-white/20",
                )}
              >
                棋盘格
              </Button>
              <label className="flex items-center gap-1 text-xs text-white/80">
                背景
                <input
                  type="color"
                  aria-label="背景颜色"
                  data-testid="bg-color"
                  value={backdrop === "checkerboard" ? "#ffffff" : backdrop}
                  // 棋盘格状态下取色器显示白色。如果只靠 onChange，用户选白色时
                  // 值没有变化、事件不会触发 —— 看起来就是"点了没反应"。
                  // 点开取色器就切到纯色，这样任何颜色（包括白色）都能生效。
                  onClick={() => {
                    if (backdrop === "checkerboard") setBackdrop("#ffffff");
                  }}
                  onChange={(e) => setBackdrop(e.target.value)}
                  className="h-6 w-8 cursor-pointer rounded border border-white/30 bg-transparent p-0"
                />
              </label>

              {kind === "vector" ? (
                <>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-pressed={shapeColor === null}
                    data-testid="fg-original"
                    onClick={() => setShapeColor(null)}
                    className={cn(
                      "text-white hover:bg-white/15 hover:text-white",
                      shapeColor === null && "bg-white/20",
                    )}
                  >
                    原色
                  </Button>
                  <label className="flex items-center gap-1 text-xs text-white/80">
                    图形
                    <input
                      type="color"
                      aria-label="图形颜色"
                      data-testid="fg-color"
                      value={shapeColor ?? "#000000"}
                      // 同上：原色状态下显示黑色，选黑色不会触发 onChange
                      onClick={() => {
                        if (shapeColor === null) setShapeColor("#000000");
                      }}
                      onChange={(e) => setShapeColor(e.target.value)}
                      className="h-6 w-8 cursor-pointer rounded border border-white/30 bg-transparent p-0"
                    />
                  </label>
                </>
              ) : null}
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                aria-label="向左旋转 90 度"
                data-testid="rotate-left"
                onClick={() => setRotation((r) => (r + 270) % 360)}
                className="text-white hover:bg-white/15 hover:text-white"
              >
                ↺
              </Button>
              <Button
                size="sm"
                variant="ghost"
                aria-label="向右旋转 90 度"
                data-testid="rotate-right"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="text-white hover:bg-white/15 hover:text-white"
              >
                ↻
              </Button>

              <span className="mx-1 h-5 w-px bg-white/20" />

              <Button size="sm" variant="ghost" onClick={applyFit}
                className="text-white hover:bg-white/15 hover:text-white">
                适应
              </Button>
              <Button size="sm" variant="ghost" aria-label="缩小" data-testid="zoom-out"
                onClick={() => zoomTo(stepZoom(zoom, -1))}
                className="text-white hover:bg-white/15 hover:text-white">
                −
              </Button>
              <span
                data-testid="zoom-level"
                className="w-14 text-center text-sm tabular-nums text-white/90"
              >
                {formatZoom(zoom)}
              </span>
              <Button size="sm" variant="ghost" aria-label="放大" data-testid="zoom-in"
                onClick={() => zoomTo(stepZoom(zoom, 1))}
                className="text-white hover:bg-white/15 hover:text-white">
                +
              </Button>

              <span className="mx-1 h-5 w-px bg-white/20" />

              {ZOOM_PRESETS.map((z) => (
                <Button
                  key={z}
                  size="sm"
                  variant="ghost"
                  data-testid="zoom-preset"
                  data-zoom={z}
                  onClick={() => zoomTo(z)}
                  className={cn(
                    "text-white hover:bg-white/15 hover:text-white",
                    Math.abs(zoom - z) < 1e-6 && "bg-white/20 font-medium",
                  )}
                >
                  {z === 1 ? "1:1" : `${z}×`}
                </Button>
              ))}

              <Dialog.Close
                render={
                  <Button size="sm" variant="ghost" aria-label="关闭" data-testid="zoom-close"
                    className="ml-1 text-white hover:bg-white/15 hover:text-white" />
                }
              >
                ✕
              </Dialog.Close>
            </div>
          </div>

          {/* 图片区 */}
          <div
            ref={attachWheel}
            data-testid="zoom-body"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onClick={onBackgroundClick}
            className={cn(
              "flex-1 select-none overflow-auto",
              dragging ? "cursor-grabbing" : "cursor-grab",
              // 棋盘格是默认底色；选了纯色就换成 backgroundColor
              backdrop === "checkerboard" && "bg-checkerboard",
            )}
            style={backdrop === "checkerboard" ? undefined : { backgroundColor: backdrop }}
          >
            {url ? (
              // w-max + min-w-full：小图时撑满容器好让 justify-center 居中，
              // 大图时跟着内容长宽，overflow-auto 才有东西可滚
              <div className="flex w-max min-w-full min-h-full items-center justify-center" style={{ padding: PAD }}>
                {/* 包裹盒按**旋转后**的尺寸撑开。见上面 `swapped` 的注释：
                    transform 不影响布局盒，不撑开的话转出来的部分永远滚不到。
                    overflow-hidden 只裁掉"未旋转时溢出的布局盒"，旋转后刚好填满。 */}
                <div
                  className="relative flex shrink-0 items-center justify-center overflow-hidden"
                  style={natural ? { width: Math.round(fitW * zoom), height: Math.round(fitH * zoom) } : undefined}
                >
                {recolor && natural ? (
                  /**
                   * 换色用的是 **CSS mask**：把 SVG 当成镂空模板，只取它的 alpha 通道，
                   * 颜色由 background-color 决定。
                   *   - 不内联 SVG（不引入 XSS 面），也不改文件本身
                   *   - 代价：多色 SVG 会被压成**单色剪影**（当前素材都是单色描摹）
                   *   - maskSize 用 100% 100% 而不是 contain：盒子与 viewBox 同比例
                   */
                  <div
                    ref={(el) => {
                      imgRef.current = el;
                    }}
                    role="img"
                    aria-label={`${name}（矢量图）`}
                    data-testid="zoom-image"
                    data-kind={kind}
                    data-zoom={zoom}
                    data-rotation={rot}
                    className="max-w-none shrink-0"
                    style={{
                      width: Math.round(natural.w * zoom),
                      height: Math.round(natural.h * zoom),
                      backgroundColor: shapeColor ?? undefined,
                      maskImage: `url("${url}")`,
                      WebkitMaskImage: `url("${url}")`,
                      maskSize: "100% 100%",
                      WebkitMaskSize: "100% 100%",
                      maskRepeat: "no-repeat",
                      WebkitMaskRepeat: "no-repeat",
                      maskMode: "alpha",
                      transform: rot ? `rotate(${rot}deg)` : undefined,
                    }}
                  />
                ) : (
                  <img
                    ref={(el) => {
                      imgRef.current = el;
                    }}
                    src={url}
                    alt={`${name}（${kind === "bitmap" ? "位图" : "矢量图"}）`}
                    draggable={false}
                    data-testid="zoom-image"
                    data-kind={kind}
                    data-zoom={zoom}
                    data-rotation={rot}
                    onLoad={onImgLoad}
                    // 这两个类都不能省，否则"放大"看起来就是没反应：
                    //   max-w-none  Tailwind preflight 给 img 设了 max-width:100%
                    //   shrink-0     img 是 flex 子项，默认会被压缩回容器宽度
                    className="max-w-none shrink-0"
                    style={
                      natural
                        ? {
                            width: Math.round(natural.w * zoom),
                            transform: rot ? `rotate(${rot}deg)` : undefined,
                          }
                        : undefined
                    }
                  />
                )}
                </div>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-white/60">
                这张图不存在
              </div>
            )}
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
