import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PatternListItem } from "@/lib/patterns-query";
import { pickCardBadges } from "@/lib/card-badges";

/**
 * 纹饰卡片 —— 扁平模型。
 *
 * 去掉了层级时代的全部概念（子项封面网格 / "N 种式样"角标 / 加入排版按钮）：
 * 现在一条 pattern 就是一个独立条目，没有父子。
 *
 * 图片一律 `object-cover`（裁切填充）—— 云雷纹是 1036×221（约 4.7:1）的宽条，
 * 用 contain 塞进方格里会变成一条细缝 + 大片留白。纹样是纹理，裁掉一部分
 * 不影响识别，反而像一块材质样本。
 *
 * 图上不放悬停遮罩按钮：整张卡片本来就是链接，再盖一层"查看详情"是多余的一步。
 * 悬停反馈交给阴影和图片轻微放大。
 */

// 挂哪些标签的规则在 `@/lib/card-badges` —— 抽出去是为了能 UT
//（多值维度挂 +N、维度为空时顺延 这些都是容易写错的边界）

export function PatternCard({ pattern }: { pattern: PatternListItem }) {
  const { id, name, description, thumbnail, facets } = pattern;

  const badges = pickCardBadges(facets);

  return (
    <Link
      href={`/patterns/${id}`}
      data-testid="pattern-card"
      data-pattern-id={id}
      className="group block focus-visible:outline-none"
    >
      <Card className="gap-0 py-0 transition-shadow duration-200 group-hover:shadow-md group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <div className="aspect-square bg-muted overflow-hidden flex items-center justify-center">
          {thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element -- SVG/位图混排，尺寸不定，不适合 next/image 的固定布局
            <img
              src={thumbnail}
              alt={name}
              loading="lazy"
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <span className="text-muted-foreground text-xs">暂无图片</span>
          )}
        </div>

        <div className="p-3 space-y-2">
          <h3 className="font-medium text-sm truncate" title={name}>
            {name}
          </h3>

          {badges.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {badges.map((b) => (
                <Badge key={b.key} variant="secondary" className="font-normal" title={b.title}>
                  {b.text}
                </Badge>
              ))}
            </div>
          ) : null}

          {description ? (
            <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{description}</p>
          ) : null}
        </div>
      </Card>
    </Link>
  );
}
