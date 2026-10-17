/**
 * 按分面键取 prisma 上对应的查找表访问器。
 *
 * 六张查找表结构**完全同构**（design.md §4.1），所以按配置循环处理，
 * 而不是把同一段代码抄六遍 —— 抄六遍就意味着改一处漏五处。
 *
 * `prisma` 和事务客户端 `tx` 都能传。
 *
 * 返回值刻意用宽松类型：六张表虽然同构，但 prisma client 给每张表生成的
 * 类型是各自独立的，写死成联合类型反而处处要断言。真正的类型安全由
 * 调用方对结果的解读负责（这里只保证"取到的是个能用的访问器"）。
 */

import { OTHER_VALUE } from "@/lib/facets";

export interface FacetDelegate {
  findMany(args?: unknown): Promise<unknown[]>;
  findUnique(args: unknown): Promise<unknown | null>;
  create(args: unknown): Promise<unknown>;
  update(args: unknown): Promise<unknown>;
  count(args?: unknown): Promise<number>;
  deleteMany(args: unknown): Promise<unknown>;
  createMany(args: unknown): Promise<unknown>;
}

/** 取该维度的「其它」行，不存在就建。返回 id。 */
export async function getOrCreateOther(client: unknown, model: string): Promise<number> {
  const delegate = facetDelegate(client, model);
  const found = (await delegate.findUnique({
    where: { name: OTHER_VALUE },
    select: { id: true },
  })) as { id: number } | null;
  if (found) return found.id;

  const created = (await delegate.create({
    data: { name: OTHER_VALUE },
    select: { id: true },
  })) as { id: number };
  return created.id;
}

/**
 * 把「其它」从一组 id 里剔掉 —— **只要这一组里还有别的具体值**。
 *
 * 「其它」的语义是「未分类」（design.md §2.4），所以：
 *   选了任何具体值 → 「其它」为假 → 必须去掉
 *   只有「其它」一个   → 合法（这才是未分类该有的样子）
 *
 * 为什么放在服务端而不是只靠编辑器：手工调 API 也能写库（当前无认证），
 * 而且历史 pending 里可能带着这种组合。
 *
 * 只在 `ids.length > 1` 时才查库 —— 常规路径（1 个值）零开销。
 */
export async function dropOtherIfHasConcrete(
  client: unknown,
  model: string,
  ids: number[],
): Promise<number[]> {
  if (ids.length <= 1) return ids;

  const rows = (await facetDelegate(client, model).findMany({
    where: { id: { in: ids } },
    select: { id: true, name: true },
  })) as { id: number; name: string }[];

  const otherIds = new Set(rows.filter((r) => r.name === OTHER_VALUE).map((r) => r.id));
  if (otherIds.size === 0) return ids;
  return ids.filter((id) => !otherIds.has(id));
}

export function facetDelegate(client: unknown, model: string): FacetDelegate {
  const d = (client as Record<string, unknown> | null)?.[model];
  // 不静默返回 undefined —— 配置写错时要立刻炸，而不是等到某个请求 500
  if (!d) throw new Error(`未知的查找表访问器：${model}`);
  return d as FacetDelegate;
}
