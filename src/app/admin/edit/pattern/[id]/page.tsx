import Link from "next/link";
import { notFound } from "next/navigation";
import { PatternEditor } from "@/components/pattern-editor";
import { listFacetsForAdmin } from "@/lib/patterns-query";
import { FACETS } from "@/lib/facets";
import prisma from "@/lib/db";

/**
 * 改一条**已发布**的条目 —— **保存即生效，不进审核队列**（design.md §5.4）。
 *
 * 为什么不走 pending：审核的意义是挡住可能污染查找表的新内容，
 * 但管理员在 `/admin/facets` 本来就能直接改词汇表 —— 让编辑再走一道
 * "自己审自己"只是形式主义，代价却是改一个错别字要三步。
 *
 * 这一页**会**涉及暂存区：换掉的那张图先传到 `/pending/`，
 * 保存时由 `PUT` 搬进 `/patterns/`（见 lib/pattern-image-files.ts）。
 */

export const dynamic = "force-dynamic";

export default async function EditPatternPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patternId = parseInt(id, 10);
  if (isNaN(patternId)) notFound();

  const facetInclude = Object.fromEntries(
    FACETS.map((f) => [f.relation, { select: { [f.fk]: true } }]),
  );

  const [groups, p] = await Promise.all([
    listFacetsForAdmin(),
    prisma.pattern.findUnique({
      where: { id: patternId },
      include: {
        images: { orderBy: { sortOrder: "asc" }, select: { url: true, type: true } },
        ...facetInclude,
      },
    }),
  ]);
  if (!p) notFound();

  const row = p as unknown as Record<string, unknown>;
  const facets: Record<string, number[]> = {};
  for (const f of FACETS) {
    const links = (row[f.relation] ?? []) as Record<string, number>[];
    facets[f.key] = links.map((l) => l[f.fk]);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">编辑：{p.name}</h1>
        <Link href="/admin/patterns" className="text-sm text-muted-foreground hover:text-foreground">
          ← 返回列表
        </Link>
      </div>

      <p className="mb-6 rounded-lg border border-dashed px-4 py-2 text-sm text-muted-foreground">
        这是已发布的条目 —— <strong>保存即生效</strong>，不进审核队列。
      </p>

      <PatternEditor
        mode="pattern"
        groups={groups}
        patternId={p.id}
        initial={{
          name: p.name,
          description: p.description,
          culturalMeaning: p.culturalMeaning,
          source: p.source,
          sourceUrl: p.sourceUrl,
          status: p.status,
          facets,
          suggestedFacets: {},
          images: p.images,
        }}
      />
    </div>
  );
}
