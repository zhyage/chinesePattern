import Link from "next/link";
import { PatternEditor } from "@/components/pattern-editor";
import { listFacetsForAdmin } from "@/lib/patterns-query";

/**
 * 新建纹饰 —— **提交后进审核队列，不直接落库**（design.md §5.4 的三条落库路径之一）。
 *
 * 新建之所以也要过审核（哪怕管理员自己建的）：新建会引入查找表里没有的
 * **新分面值**，而查找表是"云雷纹是什么"这类知识的载体，值得多看一眼。
 * 编辑已发布的条目则不走这条路 —— 那是修改既有事实，不是引入新词。
 */

export const dynamic = "force-dynamic";

export default async function NewPatternPage() {
  const groups = await listFacetsForAdmin();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">新建纹饰</h1>
        <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
          ← 返回
        </Link>
      </div>

      <p className="mb-6 rounded-lg border border-dashed px-4 py-2 text-sm text-muted-foreground">
        提交后进入审核队列，在 <Link href="/admin/pending" className="text-primary hover:underline">/admin/pending</Link> 通过后才正式发布。
      </p>

      <PatternEditor mode="new" groups={groups} />
    </div>
  );
}
