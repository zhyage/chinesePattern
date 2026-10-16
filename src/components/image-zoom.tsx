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
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const imgRef = useRef<HTMLImageElement | null>(null);
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
      if (!body || !img || !img.width) {
        applyZoom(next);
        return;
      }

      const br = body.getBoundingClientRect();
      const ir = img.getBoundingClientRect();
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

  // 打开时回到点进来的那张
  useEffect(() => {
    if (open) {
      setKind(initialKind);
      setNatural(null);
      applyZoom(1);
    }
  }, [open, initialKind, applyZoom]);

  /**
   * 可用区域按 **视口** 算，不量滚动容器。
   * 量容器会形成回路：图放大 → 出现滚动条 → 容器变窄 → 重算"适应" → 图缩小 → …
   */
  const applyFit = useCallback(() => {
    if (!natural) return;
    applyZoom(
      fitZoom(
        window.innerWidth - PAD * 2,
        window.innerHeight - TOOLBAR - PAD * 2,
        natural.w,
        natural.h,
      ),
    );
  }, [natural, applyZoom]);

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

            <div className="ml-auto flex shrink-0 items-center gap-1">
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
            )}
          >
            {url ? (
              // w-max + min-w-full：小图时撑满容器好让 justify-center 居中，
              // 大图时跟着内容长宽，overflow-auto 才有东西可滚
              <div className="flex w-max min-w-full min-h-full items-center justify-center" style={{ padding: PAD }}>
                <img
                  ref={imgRef}
                  src={url}
                  alt={`${name}（${kind === "bitmap" ? "位图" : "矢量图"}）`}
                  draggable={false}
                  data-testid="zoom-image"
                  data-kind={kind}
                  data-zoom={zoom}
                  onLoad={(e) => {
                    const el = e.currentTarget;
                    if (el.naturalWidth && el.naturalHeight) {
                      setNatural({ w: el.naturalWidth, h: el.naturalHeight });
                    }
                  }}
                  // 这两个类都不能省，否则"放大"看起来就是没反应：
                  //   max-w-none  Tailwind preflight 给 img 设了 max-width:100%
                  //   shrink-0     img 是 flex 子项，默认会被压缩回容器宽度
                  className="max-w-none shrink-0"
                  style={natural ? { width: Math.round(natural.w * zoom) } : undefined}
                />
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
