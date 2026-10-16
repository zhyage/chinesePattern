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

export interface FacetDelegate {
  findMany(args?: unknown): Promise<unknown[]>;
  findUnique(args: unknown): Promise<unknown | null>;
  create(args: unknown): Promise<unknown>;
  update(args: unknown): Promise<unknown>;
  count(args?: unknown): Promise<number>;
  deleteMany(args: unknown): Promise<unknown>;
  createMany(args: unknown): Promise<unknown>;
}

export function facetDelegate(client: unknown, model: string): FacetDelegate {
  const d = (client as Record<string, unknown> | null)?.[model];
  // 不静默返回 undefined —— 配置写错时要立刻炸，而不是等到某个请求 500
  if (!d) throw new Error(`未知的查找表访问器：${model}`);
  return d as FacetDelegate;
}
