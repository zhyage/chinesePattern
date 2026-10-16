import prisma from "@/lib/db";

/**
 * 纹样层级（parentId 自引用）的写入校验。
 *
 * 为什么必须有这个：`onDelete: Restrict` 能挡住"删除有子项的条目"，但**挡不住环**
 * —— SQLite 不会阻止 A→B→A 这种父子互指。环一旦形成，删除和上溯遍历都会出问题，
 * 而且没有任何报错。所以环的校验只能在写入路径上做。
 */

export type ParentCheck =
  | { ok: true; parentId: number | null }
  | { ok: false; status: number; error: string };

/**
 * 校验 parentId 是否可写。
 *
 * @param rawParentId 请求里的 parentId（可能是 null / undefined / 数字 / 字符串）
 * @param selfId      被编辑的条目自身 id；新建时传 null
 */
export async function validateParentId(
  rawParentId: unknown,
  selfId: number | null,
): Promise<ParentCheck> {
  // 空值 = 顶层条目，永远合法
  if (rawParentId === null || rawParentId === undefined || rawParentId === "") {
    return { ok: true, parentId: null };
  }

  const parentId = typeof rawParentId === "number" ? rawParentId : parseInt(String(rawParentId));
  if (isNaN(parentId)) {
    return { ok: false, status: 400, error: "parentId 不是合法数字" };
  }

  // 自己不能当自己的父级
  if (selfId !== null && parentId === selfId) {
    return { ok: false, status: 400, error: "parentId 不能指向自己" };
  }

  const parent = await prisma.pattern.findUnique({
    where: { id: parentId },
    select: { id: true },
  });
  if (!parent) {
    return { ok: false, status: 400, error: `父条目 ${parentId} 不存在` };
  }

  // 沿祖先链上溯，若遇到自己则说明会成环
  if (selfId !== null) {
    let cursor: number | null = parentId;
    const seen = new Set<number>(); // 兜底：即便库里已有环也不会死循环
    while (cursor !== null) {
      if (cursor === selfId) {
        return { ok: false, status: 400, error: "parentId 会形成循环引用" };
      }
      if (seen.has(cursor)) break;
      seen.add(cursor);

      const node: { parentId: number | null } | null = await prisma.pattern.findUnique({
        where: { id: cursor },
        select: { parentId: true },
      });
      cursor = node?.parentId ?? null;
    }
  }

  return { ok: true, parentId };
}
