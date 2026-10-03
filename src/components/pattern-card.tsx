import Link from "next/link";

interface PatternCardProps {
  id: number;
  name: string;
  dynasty: string;
  category: string;
  thumbnail: string | null;
}

export function PatternCard({ id, name, dynasty, category, thumbnail }: PatternCardProps) {
  return (
    <Link
      href={`/patterns/${id}`}
      className="group relative rounded-lg border bg-card overflow-hidden hover:shadow-md transition-all duration-200"
    >
      {/* 图片区域 */}
      <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <span className="text-muted-foreground text-xs">暂无图片</span>
        )}
      </div>

      {/* 文字信息 */}
      <div className="p-3">
        <h3 className="font-medium text-sm truncate">{name}</h3>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
            {dynasty}
          </span>
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
