// 交互组件：多页浏览，每页一套图（位图 + 可选矢量图）
// 缩略切换用原生 HTML + CSS（radio + 兄弟选择器），点图放大用 ImageZoom
"use client";

import { useState } from "react";
import { ImageZoom } from "@/components/image-zoom";

interface ImageInfo {
  id: number;
  url: string;
  type: "bitmap" | "vector";
  purpose: string | null;
  label: string | null;
  isPrimary: boolean;
}

interface ImageViewerProps {
  images: ImageInfo[];
  /** 纹饰名称，给灯箱做无障碍标题用 */
  name?: string;
}

export function ImageViewer({ images, name = "纹饰" }: ImageViewerProps) {
  // 点开的是哪一页的哪一张。null = 灯箱关着。
  // 单独存一份而不去读 CSS 的选中态：radio 的 checked 属于 DOM，React 读不到，
  // 与其做双向同步，不如点哪张就记哪张 —— 行为完全一致，且只有一个真相来源。
  const [zoomAt, setZoomAt] = useState<{ page: number; kind: "bitmap" | "vector" } | null>(null);

  const bitmapImages = images.filter((img) => img.type === "bitmap");
  const vectorImages = images.filter((img) => img.type === "vector");

  // Group into pages: page i has bitmapImages[i] + vectorImages[i]
  //
  // ⚠️ 这里假设「位图与矢量按下标一一对应」。当前系统强制恰好 1+1
  // （见 pattern-image-files.ts 的 checkImageCounts），所以只有 1 页，
  // 下标配对退化成"唯一那张对唯一那张"，天然正确。
  // **将来允许 N 张时必须重做这段** —— 否则数量不等就会张冠李戴。
  const pageCount = Math.max(bitmapImages.length, vectorImages.length);
  const pages: { bmp: ImageInfo | null; vec: ImageInfo | null; idx: number }[] = [];
  for (let i = 0; i < pageCount; i++) {
    pages.push({
      bmp: bitmapImages[i] || null,
      vec: vectorImages[i] || null,
      idx: i,
    });
  }

  if (pageCount === 0) {
    return (
      <div className="flex h-64 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground">
        暂无图片
      </div>
    );
  }

  // Build all radio IDs: "pg-{i}-bmp" / "pg-{i}-vec" (use img.id or index as fallback)
  const allRadios: string[] = [];
  for (const pg of pages) {
    if (pg.bmp) allRadios.push(`pg-${pg.idx}-bmp`);
    if (pg.vec) allRadios.push(`pg-${pg.idx}-vec`);
  }
  const defaultRadio = allRadios[0];

  // CSS: show the checked image, highlight page dot + type toggle
  let css = ".iv-img { display: none; }\n";
  for (const r of allRadios) {
    css += `#${r}:checked ~ .iv-imgs .iv-grp-${r.replace("pg-", "").replace("-", "-")} { display: flex; }\n`;
  }

  css += ".pg-dot { opacity: 0.3; }\n";
  for (const pg of pages) {
    if (pg.bmp) css += `#pg-${pg.idx}-bmp:checked ~ .iv-ctrl .pg-${pg.idx} { opacity: 1; font-weight: 600; }\n`;
    if (pg.vec) css += `#pg-${pg.idx}-vec:checked ~ .iv-ctrl .pg-${pg.idx} { opacity: 1; font-weight: 600; }\n`;
  }

  css += ".type-btn { opacity: 0.4; }\n";
  for (const r of allRadios) {
    css += `#${r}:checked ~ .iv-ctrl .tp-${r} { opacity: 1; font-weight: 600; }\n`;
  }

  // Page-specific toggle containers: only the active page's toggles are shown
  for (const pg of pages) {
    if (pg.bmp) css += `#pg-${pg.idx}-bmp:checked ~ .iv-ctrl .tg-${pg.idx} { display: flex; }\n`;
    if (pg.vec) css += `#pg-${pg.idx}-vec:checked ~ .iv-ctrl .tg-${pg.idx} { display: flex; }\n`;
  }

  return (
    <div>
      <style>{css}</style>

      {/* Radio inputs */}
      {allRadios.map((r) => (
        <input key={r} type="radio" name="iv" id={r} className="hidden" defaultChecked={r === defaultRadio} />
      ))}

      {/* Image display
          与老写法的唯一区别：**容器不再锁死正方形**（原来是 aspect-square）。
          1036×221 的带子塞进正方形只能占中间一条，上下 73% 是灰底；
          现在框全宽、**高度跟着图走**，带子占 548×156 而不是 548×564。

          ⚠️ 试过让灰底框"收缩包裹成图片大小"（更彻底的贴合），**但那是死路**：
             框 width:fit-content + 图 max-width:100% 构成循环依赖
             （图问框多宽，框问图多宽），浏览器判成 0。
             位图和矢量图都是 SVG —— 而 SVG 在 <img> 里的 width:auto
             不走"内在尺寸"那套，循环解不开，实测**点矢量图后图片塌成 0×0**。
             容器查询（100cqw）也救不回来。四种写法实测只有下面这种三种图都活。

          尺寸的三个约束：
            w-full / h-auto  宽度铺满栏宽，高度按比例
            max-h-[70vh]     给竖条封顶，免得高到要一直滚
            object-scale-down 小图**不放大**（contain 会把 180×180 拉到 548×548 糊掉）
          min-h-48 是给很扁的带子留一点垫子，看着像装裱的卡纸。

          裁切填充（object-cover）留给列表缩略图 —— 网格必须对齐，那里裁切是对的。 */}
      <div className="iv-imgs">
        {pages.map((pg) => (
          <div key={pg.idx}>
            {pg.bmp && (
              /* 棋盘格底：透明区域（SVG 的留白）会露出灰白方格，
                 不透明的位图完全盖住它，所以对 JPG 没有视觉变化 */
              <div data-testid="viewer-frame" className={`iv-img iv-grp-${pg.idx}-bmp flex w-full items-center justify-center overflow-hidden rounded-lg bg-checkerboard p-2 min-h-48`}>
                <img
                  src={pg.bmp.url}
                  alt=""
                  data-testid="viewer-image"
                  data-kind="bitmap"
                  data-page={pg.idx}
                  onClick={() => setZoomAt({ page: pg.idx, kind: "bitmap" })}
                  title="点击放大查看细节"
                  className="h-auto max-h-[70vh] w-full cursor-zoom-in object-scale-down"
                />
              </div>
            )}
            {pg.vec && (
              /* 棋盘格底：透明区域（SVG 的留白）会露出灰白方格，
                 不透明的位图完全盖住它，所以对 JPG 没有视觉变化 */
              <div data-testid="viewer-frame" className={`iv-img iv-grp-${pg.idx}-vec flex w-full items-center justify-center overflow-hidden rounded-lg bg-checkerboard p-2 min-h-48`}>
                <img
                  src={pg.vec.url}
                  alt=""
                  data-testid="viewer-image"
                  data-kind="vector"
                  data-page={pg.idx}
                  onClick={() => setZoomAt({ page: pg.idx, kind: "vector" })}
                  title="点击放大查看细节"
                  className="h-auto max-h-[70vh] w-full cursor-zoom-in object-scale-down"
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="iv-ctrl mt-3 space-y-2">
        {/* Page dots */}
        {pageCount > 1 && (
          <div className="flex items-center justify-center gap-2">
            {pages.map((pg) => {
              // First available radio for this page
              const target = pg.bmp ? `pg-${pg.idx}-bmp` : `pg-${pg.idx}-vec`;
              return (
                <label key={pg.idx} htmlFor={target}
                  className={`pg-dot pg-${pg.idx} cursor-pointer w-7 h-7 flex items-center justify-center rounded-full bg-muted hover:bg-secondary text-xs transition-all`}>
                  {pg.idx + 1}
                </label>
              );
            })}
          </div>
        )}

        {/* Type toggles (per page, only active page shown) */}
        {pages.map((pg) => {
          const hasBmp = !!pg.bmp;
          const hasVec = !!pg.vec;
          if (!hasBmp && !hasVec) return null;
          return (
            <div key={pg.idx} className={`tg-${pg.idx} hidden items-center justify-center gap-2`}>
              {hasBmp && (
                <label htmlFor={`pg-${pg.idx}-bmp`}
                  className={`tp-pg-${pg.idx}-bmp type-btn cursor-pointer px-3 py-1.5 rounded text-xs bg-secondary text-secondary-foreground transition-all`}>
                  位图
                </label>
              )}
              {hasVec && (
                <label htmlFor={`pg-${pg.idx}-vec`}
                  className={`tp-pg-${pg.idx}-vec type-btn cursor-pointer px-3 py-1.5 rounded text-xs bg-secondary text-secondary-foreground transition-all`}>
                  矢量图
                </label>
              )}
            </div>
          );
        })}

        {/* 点图放大（全屏灯箱） */}
        {zoomAt ? (
          <ImageZoom
            open
            onOpenChange={(next) => {
              if (!next) setZoomAt(null);
            }}
            initialKind={zoomAt.kind}
            bitmapUrl={pages[zoomAt.page]?.bmp?.url ?? null}
            vectorUrl={pages[zoomAt.page]?.vec?.url ?? null}
            name={name}
          />
        ) : null}
      </div>
    </div>
  );
}
