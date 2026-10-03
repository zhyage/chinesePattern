// 交互组件：多页浏览，每页一套图（位图 + 可选矢量图）
// 原生 HTML + CSS 控制
"use client";

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
}

export function ImageViewer({ images }: ImageViewerProps) {
  const bitmapImages = images.filter((img) => img.type === "bitmap");
  const vectorImages = images.filter((img) => img.type === "vector");

  // Group into pages: page i has bitmapImages[i] + vectorImages[i]
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
      <div className="aspect-square bg-muted rounded-lg flex items-center justify-center text-muted-foreground text-sm">
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

      {/* Image display */}
      <div className="iv-imgs">
        {pages.map((pg) => (
          <div key={pg.idx}>
            {pg.bmp && (
              <div className={`iv-img iv-grp-${pg.idx}-bmp aspect-square bg-muted rounded-lg overflow-hidden relative`}>
                <img src={pg.bmp.url} alt="" className="w-full h-full object-contain" />
              </div>
            )}
            {pg.vec && (
              <div className={`iv-img iv-grp-${pg.idx}-vec aspect-square bg-muted rounded-lg overflow-hidden relative`}>
                <img src={pg.vec.url} alt="" className="w-full h-full object-contain" />
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
      </div>
    </div>
  );
}
