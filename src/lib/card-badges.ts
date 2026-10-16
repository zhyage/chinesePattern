import { FACETS } from "@/lib/facets";
import type { FacetMap } from "@/lib/patterns-query";

/**
 * 卡片上挂哪些分面标签。
 *
 * 规则：**按维度取，每个维度最多出 1 个**，最多 MAX_BADGES 个维度。
 *
 * 为什么是"每维 1 个"而不是"前 3 个值先到先得"：
 *   六个维度是多对多的，某一维**可以有多个值**。旧规则按值顺序取满 3 个就停，
 *   于是一个多值维度能把名额全吃光 —— 比如"商/周/春秋"三个朝代，会让
 *   **母题被挤掉**，而母题恰恰是"这是什么纹"最直接的说明。
 *   更糟的是它**不告诉你丢了**：看到「商」不会知道还有周和春秋，等于骗人。
 *   现在的做法把"有多个"变成可见的 `+N`，并把完整的值放进 title。
 *
 * 名字里已经含母题的条目（如「云雷纹·圆雷」）仍会重复挂一个母题标签 ——
 * 这是有意保留的：名字是用户自己填的，不保证含母题，卡片不该靠猜。
 */

/** 展示哪些维度、按什么优先级 —— 越靠前越能说明"这是什么" */
export const BADGE_ORDER = ["dynasty", "motif", "category", "medium", "region", "ethnicGroup"] as const;

export const MAX_BADGES = 3;

/** 维度键 → 中文标签，拼 title 用 */
const LABEL = new Map(FACETS.map((f) => [f.key as string, f.label]));

export interface CardBadge {
  /** 维度键，React key 与定位用 */
  key: string;
  /** 显示文字，多值时为 `商 +2` */
  text: string;
  /** 悬停提示，列出该维度的全部值 */
  title: string;
}

export function pickCardBadges(facets: FacetMap): CardBadge[] {
  const out: CardBadge[] = [];

  for (const key of BADGE_ORDER) {
    if (out.length >= MAX_BADGES) break;

    const values = facets[key] ?? [];
    if (values.length === 0) continue; // 该维为空则顺延，名额让给后面的维度

    const [first, ...rest] = values;
    const label = LABEL.get(key) ?? key;
    const all = values.map((v) => v.name).join("、");

    out.push({
      key,
      text: rest.length > 0 ? `${first.name} +${rest.length}` : first.name,
      title: `${label}：${all}`,
    });
  }

  return out;
}
