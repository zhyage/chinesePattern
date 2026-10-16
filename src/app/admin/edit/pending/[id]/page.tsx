import Link from "next/link";
import { notFound } from "next/navigation";
import { PatternEditor } from "@/components/pattern-editor";
import { listFacetsForAdmin } from "@/lib/patterns-query";
import prisma from "@/lib/db";

/**
 * 改一条**未决**提交（design.md §5.4）。
 *
 * 保存回 pending（`PUT`），仍待审 —— 不会因为改过就直接落库。
 * 只有 `status === "pending"` 的能进来：已通过/已驳回的改了没有意义，
 * 而且会让"审核记录"和"提交内容"对不上。
 */

export const dynamic = "force-dynamic";

export default async function EditPendingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pendingId = parseInt(id, 10);
  if (isNaN(pendingId)) notFound();

  const [groups, p] = await Promise.all([
    listFacetsForAdmin(),
    prisma.pending.findUnique({ where: { id: pendingId } }),
  ]);
  if (!p || p.status !== "pending") notFound();

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">编辑待审件：{p.name}</h1>
        <Link href={`/admin/pending/${p.id}`} className="text-sm text-muted-foreground hover:text-foreground">
          ← 返回审核
        </Link>
      </div>

      <p className="mb-6 rounded-lg border border-dashed px-4 py-2 text-sm text-muted-foreground">
        改完仍留在审核队列里 —— 这里保存不会让它直接发布。
      </p>

      <PatternEditor
        mode="pending"
        groups={groups}
        pendingId={p.id}
        initial={{
          name: p.name,
          description: p.description,
          culturalMeaning: p.culturalMeaning,
          source: p.source,
          sourceUrl: p.sourceUrl,
          facets: JSON.parse(p.facets) as Record<string, number[]>,
          suggestedFacets: JSON.parse(p.suggestedFacets) as Record<string, string[]>,
          images: JSON.parse(p.images) as { url: string; type: string }[],
        }}
      />
    </div>
  );
}
