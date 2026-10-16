import { FACET_KEYS, parseIds, type FacetKey } from "@/lib/facets";

/**
 * 分面筛选的 URL 状态。
 *
 * 为什么状态放 URL 而不是 useState：
 *   - 服务端组件直接按 URL 查库，不需要客户端 JS 参与筛选
 *   - 后退键、刷新、分享链接 全都"自动"正确
 *   - 页面无 JS 也能用
 *
 * 已选值在 query 里的形式是 `motif=3,7`（逗号分隔），与 API 的参数格式一致，
 * 所以详情页跳到首页时不用做任何转换。
 */

export type SelectedFacets = Partial<Record<FacetKey, number[]>>;

/** 从 searchParams 读出六个维度的已选值，空维度不出现在结果里 */
export function readSelection(sp: URLSearchParams): SelectedFacets {
  const out: SelectedFacets = {};
  for (const key of FACET_KEYS) {
    const ids = parseIds(sp.get(key));
    if (ids.length) out[key] = ids;
  }
  return out;
}

/** 选中 / 取消选中某个值。返回新对象，不改原对象。 */
export function toggleValue(sel: SelectedFacets, key: FacetKey, id: number): SelectedFacets {
  const cur = sel[key] ?? [];
  const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  const out: SelectedFacets = { ...sel };
  if (next.length) out[key] = next;
  else delete out[key];
  return out;
}

export function selectedCount(sel: SelectedFacets): number {
  return Object.values(sel).reduce((n, ids) => n + ids.length, 0);
}

/** 清空某个维度；不传 key = 清空全部 */
export function clearSelection(sel: SelectedFacets, key?: FacetKey): SelectedFacets {
  if (!key) return {};
  const out = { ...sel };
  delete out[key];
  return out;
}

/**
 * 拼出 query string（不带 "?"）。
 *
 * `extra` 里值为 null/空 的键会被丢掉 —— 这样"回到第 1 页"就只是不传 page，
 * 不会留下 `page=` 这种空参数。
 */
export function buildQuery(
  sel: SelectedFacets,
  extra: Record<string, string | number | null | undefined> = {},
): string {
  const sp = new URLSearchParams();
  for (const key of FACET_KEYS) {
    const ids = sel[key];
    if (ids?.length) sp.set(key, ids.join(","));
  }
  for (const [k, v] of Object.entries(extra)) {
    if (v !== null && v !== undefined && v !== "") sp.set(k, String(v));
  }
  return sp.toString();
}

/** 带 "?" 的完整 href；无参数时就是 path 本身（避免出现孤零零的 "/?"） */
export function hrefWith(path: string, query: string): string {
  return query ? `${path}?${query}` : path;
}
