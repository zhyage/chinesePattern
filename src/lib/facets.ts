/**
 * 六个分面维度的定义。
 *
 * 六者在模型里**地位完全平等** —— 都是查找表 + 中间表、都是多对多、
 * 筛选逻辑一模一样。所以集中在这里定义一次，各处按这份配置循环处理，
 * 而不是把同一段代码抄六遍（抄六遍就意味着改一处漏五处）。
 *
 * ⚠️ category = 题材（动物纹/几何纹），motif = 母题（云雷纹/连珠纹）。
 *    两者是不同的维度，别混。见 design.md §11
 */

export const FACETS = [
  {
    /** query 参数名，也是 API 返回时的键名 */
    key: "dynasty",
    label: "朝代",
    /** Pattern 上的关系字段名 */
    relation: "dynasties",
    /** 中间表上的外键字段名 */
    fk: "dynastyId",
    /** 对应查找表在 prisma client 上的访问器名 */
    model: "dynasty",
    /** 中间表在 prisma client 上的访问器名 */
    junction: "patternDynasty",
  },
  {
    key: "region",
    label: "地域",
    relation: "regions",
    fk: "regionId",
    model: "region",
    junction: "patternRegion",
  },
  {
    key: "ethnicGroup",
    label: "民族",
    relation: "ethnicGroups",
    fk: "ethnicGroupId",
    model: "ethnicGroup",
    junction: "patternEthnicGroup",
  },
  {
    key: "category",
    label: "题材",
    relation: "categories",
    fk: "categoryId",
    model: "category",
    junction: "patternCategory",
  },
  {
    key: "motif",
    label: "母题",
    relation: "motifs",
    fk: "motifId",
    model: "motif",
    junction: "patternMotif",
  },
  {
    key: "medium",
    label: "载体",
    relation: "mediums",
    fk: "mediumId",
    model: "medium",
    junction: "patternMedium",
  },
] as const;

export type FacetKey = (typeof FACETS)[number]["key"];

export const FACET_KEYS = FACETS.map((f) => f.key) as readonly FacetKey[];

/** 把 "1,2,3" 或 ["1","2"] 解析成正整数数组，去重、剔除非法值 */
export function parseIds(raw: string | null | undefined): number[] {
  if (!raw) return [];
  const out = new Set<number>();
  for (const part of raw.split(",")) {
    const n = parseInt(part.trim(), 10);
    if (Number.isInteger(n) && n > 0) out.add(n);
  }
  return [...out];
}
