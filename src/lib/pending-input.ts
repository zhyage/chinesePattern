import { FACET_KEYS, parseIds } from "@/lib/facets";
import { isValidPendingUrl } from "@/lib/pending-images";

/**
 * 待审提交体的规范化与校验。
 *
 * **提交（POST）和编辑未决件（PUT）共用这一份** —— 里面含图片 URL 校验，
 * 那是安全边界（见 `pending-images.ts`），绝不能有第二份实现。
 */

const OTHER_FALLBACK_HINT =
  "位图和矢量图都必须上传"; // design.md §4.4：原型阶段两张都要

export type NormalizeResult =
  | { ok: true; data: PendingWriteData }
  | { ok: false; error: string };

export interface PendingWriteData {
  name: string;
  description: string | null;
  culturalMeaning: string | null;
  source: string | null;
  sourceUrl: string | null;
  facets: string;
  suggestedFacets: string;
  images: string;
}

export function normalizePendingInput(body: Record<string, unknown>): NormalizeResult {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return { ok: false, error: "name 为必填字段" };

  // 已选中的分面值：{ motif: [1,2], category: [3] }
  const facets: Record<string, number[]> = {};
  const rawFacets = (body.facets ?? {}) as Record<string, unknown>;
  for (const key of FACET_KEYS) {
    const ids = parseIds(
      Array.isArray(rawFacets[key]) ? (rawFacets[key] as string[]).join(",") : (rawFacets[key] as string),
    );
    if (ids.length) facets[key] = ids;
  }

  // 建议的新分面值：{ motif: ["双喜纹"] }
  const suggestedFacets: Record<string, string[]> = {};
  const rawSuggested = (body.suggestedFacets ?? {}) as Record<string, unknown>;
  for (const key of FACET_KEYS) {
    const arr = rawSuggested[key];
    if (!Array.isArray(arr)) continue;
    // 同名去重（trim 之后）—— 重复的建议值在审核时会变成两行一样的查找表项
    const names = [...new Set(arr.map((s) => String(s).trim()).filter(Boolean))];
    if (names.length) suggestedFacets[key] = names;
  }

  // 图片：[{ url, type }]
  // ★ url 必须校验 —— 审核通过时会拿它去 rename()，不校验就是一个任意文件移动漏洞。
  //   见 lib/pending-images.ts
  const rawImages = Array.isArray(body.images) ? (body.images as Record<string, unknown>[]) : [];
  const images = rawImages
    .map((i) => ({
      url: typeof i.url === "string" ? i.url : "",
      type: i.type === "vector" ? "vector" : i.type === "bitmap" ? "bitmap" : "",
    }))
    .filter((i) => i.type);

  const badUrl = images.find((i) => !isValidPendingUrl(i.url as string));
  if (badUrl) {
    return { ok: false, error: `图片地址非法：${badUrl.url || "(空)"} —— 必须是 /pending/ 下的图片文件` };
  }

  const hasBitmap = images.some((i) => i.type === "bitmap");
  const hasVector = images.some((i) => i.type === "vector");
  if (!hasBitmap || !hasVector) return { ok: false, error: OTHER_FALLBACK_HINT };

  return {
    ok: true,
    data: {
      name,
      description: (body.description as string)?.trim() || null,
      culturalMeaning: (body.culturalMeaning as string)?.trim() || null,
      source: (body.source as string)?.trim() || null,
      sourceUrl: (body.sourceUrl as string)?.trim() || null,
      facets: JSON.stringify(facets),
      suggestedFacets: JSON.stringify(suggestedFacets),
      images: JSON.stringify(images),
    },
  };
}
