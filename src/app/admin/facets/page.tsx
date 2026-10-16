import Link from "next/link";
import { listFacetsForAdmin } from "@/lib/patterns-query";
import { hrefWith } from "@/lib/facet-url";
import { FacetRow } from "./facet-row";
import { AddFacet } from "./add-facet";

/**
 * 查找表管理（design.md §5.5）。
 *
 * §3.5 规定"分面查找表只有管理员能增删改"，这一页就是那个出口。
 * 六个维度结构完全同构，所以分 tab 而不是写六份页面 —— tab 值走 URL
 * （`?facet=motif`），刷新和分享链接都自然正确。
 *
 * **没有删除。** 停用是唯一的"删除"方式，理由见 facet-row.tsx。
 */

export const dynamic = "force-dynamic";

export default async function AdminFacetsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const raw = await searchParams;
  const requested = typeof raw.facet === "string" ? raw.facet : "";

  const groups = await listFacetsForAdmin();
  const current = groups.find((g) => g.key === requested) ?? groups[0];
  const activeCount = current.values.filter((v) => v.active).length;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">查找表维护</h1>
        <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground">
          ← 返回
        </Link>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        这些行不只是字典 —— 「云雷纹是什么」这类说明文字就存在它们身上。
        <strong>删除做成「停用」</strong>：停用只是让它不再出现在筛选器的可选列表里，
        已有引用完全不受影响。
      </p>

      {/* 六个维度分 tab（走 URL，不用客户端状态） */}
      <nav className="mb-4 flex flex-wrap gap-1 border-b">
        {groups.map((g) => (
          <Link
            key={g.key}
            href={hrefWith("/admin/facets", `facet=${g.key}`)}
            data-testid="facet-tab"
            data-facet={g.key}
            data-current={g.key === current.key ? "true" : "false"}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition-colors ${
              g.key === current.key
                ? "border-primary font-medium"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {g.label}
            <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
              {g.values.filter((v) => v.active).length}
            </span>
          </Link>
        ))}
      </nav>

      <div className="mb-2 text-sm text-muted-foreground">
        「{current.label}」共 {current.values.length} 行（启用 {activeCount}）
      </div>

      <ul className="divide-y rounded-lg border">
        {current.values.map((v) => (
          <FacetRow key={v.id} facet={current.key} value={v} />
        ))}
        <AddFacet facet={current.key} />
      </ul>
    </div>
  );
}
