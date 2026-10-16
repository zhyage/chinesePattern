import Link from "next/link";

export interface PatternChildThumb {
  id: number;
  name: string;
  url: string | null;
}

interface PatternCardProps {
  id: number;
  name: string;
  /** 可空 —— 无法准确考证时留空，不显示该标签，不编造 */
  dynasty: string | null;
  category: string;
  thumbnail: string | null;
  /** 子项（式样）总数。0 或省略 = 单形态纹样，行为与加层级前一致 */
  childCount?: number;
  /** 封面网格用的子项缩略图，最多 4 个，由 API 按 id 升序返回 */
  childThumbnails?: PatternChildThumb[];
}

/**
 * 子项封面网格。
 *
 * 规则：格子数 = min(子项数, 4)，**不画空格子** —— 空格子会被读成"图片加载失败"，
 * 数量信息交给角标表达。
 *
 * 图片一律 object-cover（裁切填充），**不用 contain** —— 云雷纹·圆雷是 1036×221
 * （约 4.7:1）的宽条，contain 塞进方格里会变成一条细缝 + 大片留白。
 * 纹样是纹理，裁掉一部分不影响识别，反而像一块材质样本。
 *
 * 3 个时的排布（单行三格）是暂定 —— 等真有 3 个式样时用真数据再定。
 */
function ChildCoverGrid({ children: items }: { children: PatternChildThumb[] }) {
  const cells = items.slice(0, 4);
  // 1→1列  2→2列  3→3列  4→2列(自动折成 2×2)
  const cols = cells.length >= 4 ? 2 : cells.length;

  return (
    <div
      className="grid w-full h-full gap-[2px] bg-border"
      style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
    >
      {cells.map((c) => (
        <div key={c.id} className="bg-muted overflow-hidden">
          {c.url ? (
            <img
              src={c.url}
              alt={c.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function PatternCard({
  id,
  name,
  dynasty,
  category,
  thumbnail,
  childCount = 0,
  childThumbnails = [],
}: PatternCardProps) {
  const hasChildren = childCount > 0;
  // 只收有图的子项 —— 灰格子会被读成"图片加载失败"，而不是"这个式样还没配图"。
  // 数量信息由角标表达，格子只负责好看。
  const coverItems = childThumbnails.filter((c) => c.url).slice(0, 4);
  // 子项一张图都没有时退回单图路径
  const useGrid = hasChildren && coverItems.length > 0;

  return (
    <Link
      href={`/patterns/${id}`}
      className="group relative rounded-lg border bg-card overflow-hidden hover:shadow-md transition-all duration-200"
    >
      {/* 图片区域 */}
      <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden relative">
        {useGrid ? (
          <ChildCoverGrid>{coverItems}</ChildCoverGrid>
        ) : thumbnail ? (
          <img
            src={thumbnail}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <span className="text-muted-foreground text-xs">暂无图片</span>
        )}

        {hasChildren ? (
          <span className="absolute right-1.5 bottom-1.5 rounded-full bg-black/70 px-2 py-0.5 text-[11px] leading-tight text-white">
            {childCount} 种式样
          </span>
        ) : null}
      </div>

      {/* 文字信息 */}
      <div className="p-3">
        <h3 className="font-medium text-sm truncate">{name}</h3>
        <div className="flex items-center gap-2 mt-1">
          {dynasty ? (
            <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
              {dynasty}
            </span>
          ) : null}
          <span className="text-xs text-muted-foreground">{category}</span>
        </div>
      </div>

      {/* Hover 操作按钮 */}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-3">
        <span className="px-3 py-1.5 bg-white text-black rounded-md text-sm font-medium">
          查看详情
        </span>
        <span className="px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-sm font-medium">
          加入排版
        </span>
      </div>
    </Link>
  );
}
