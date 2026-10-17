import Link from "next/link";
import { PatternCard } from "@/components/pattern-card";
import { FacetFilter } from "@/components/facet-filter";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listPatterns, listFacets } from "@/lib/patterns-query";
import { buildQuery, hrefWith, readSelection, selectedCount, toggleValue, type SelectedFacets } from "@/lib/facet-url";
import type { FacetKey } from "@/lib/facets";

const PAGE_SIZE = 24;

type SearchParams = Record<string, string | string[] | undefined>;

/** Next 传进来的 searchParams 是 Promise，且值可能是数组（同名参数出现多次） */
function toURLSearchParams(raw: SearchParams): URLSearchParams {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") sp.set(k, v);
    else if (Array.isArray(v)) v.forEach((x) => sp.append(k, x));
  }
  return sp;
}

/**
 * 首页 = 浏览页（合并）。
 *
 * 之前首页是 hero + 两个写死的朝代/题材入口，浏览页才是真筛选 ——
 * 结果是首页上那些入口点进去能筛出来的东西，和真筛选器能筛的不是一套。
 * 合并后就一套筛选器，六个维度地位平等。
 *
 * 数据直接在服务端调 `@/lib/patterns-query`，不再 HTTP 自调用自己。
 */
export default async function HomePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const raw = await searchParams;
  const sp = toURLSearchParams(raw);

  const selected: SelectedFacets = readSelection(sp);
  const search = sp.get("search") ?? "";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1") || 1);

  const [result, groups] = await Promise.all([
    listPatterns(sp, { pageSizeDefault: PAGE_SIZE }),
    // 把已选值传进去：如果某个值已被停用但仍在筛选中（用户是从详情页 chip 点进来的），
    // 侧边栏必须带上它 —— 否则「已选条件」里只会显示一个裸 id
    listFacets({ includeIds: selected }),
  ]);

  // 名字查表，给"已选条件"标签用
  const nameOf = new Map<string, string>();
  for (const g of groups) for (const v of g.values) nameOf.set(`${g.key}:${v.id}`, v.name);

  const total = selectedCount(selected);
  const hasFilter = total > 0 || !!search;

  const pageHref = (p: number) => hrefWith("/", buildQuery(selected, { search, page: p === 1 ? null : p }));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">中国传统纹饰博物馆</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          按朝代、地域、民族、题材、母题、载体六个维度检索纹饰素材
        </p>
      </header>

      {/* 搜索 —— 普通 GET 表单，无 JS 也能用。已选分面用 hidden 带着，别搜一次就丢 */}
      <form action="/" method="get" className="mb-6 flex gap-2">
        {Object.entries(selected).map(([k, ids]) => (
          <input key={k} type="hidden" name={k} value={ids.join(",")} />
        ))}
        <Input
          type="search"
          name="search"
          defaultValue={search}
          placeholder="搜索纹饰名称、描述，或分面名称（如「云雷纹」「青铜器」）"
          className="max-w-md"
        />
        <Button type="submit" variant="secondary">
          搜索
        </Button>
      </form>

      {/* gap-8：gap-6 时侧栏的「清除」会和结果区的「共 N 个纹饰」挨太近，读起来像一行 */}
      <div className="flex flex-col gap-8 md:flex-row">
        {/* 筛选侧栏 */}
        <aside className="md:w-52 md:shrink-0">
          <div className="md:sticky md:top-20 md:max-h-[calc(100vh-6rem)] md:overflow-y-auto md:pr-2">
            <FacetFilter groups={groups} selected={selected} search={search} />
          </div>
        </aside>

        {/* 结果区 */}
        <main className="min-w-0 flex-1">
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-sm text-muted-foreground">
              共{" "}
              <span data-testid="result-total" className="font-medium text-foreground tabular-nums">
                {result.total}
              </span>{" "}
              个纹饰
            </span>

            {selectedCount(selected) > 0 ? (
              <div className="flex flex-wrap items-center gap-1.5">
                {Object.entries(selected).flatMap(([k, ids]) =>
                  ids.map((id) => (
                    <Badge
                      key={`${k}-${id}`}
                      variant="secondary"
                      className="font-normal"
                      data-testid="selected-chip"
                      data-facet={k}
                      data-value-id={id}
                      render={<Link href={hrefWith("/", buildQuery(toggleValue(selected, k as FacetKey, id), { search }))} />}
                    >
                      {nameOf.get(`${k}:${id}`) ?? id}
                      <span aria-hidden className="text-muted-foreground">×</span>
                    </Badge>
                  )),
                )}
                <Link
                  href={hrefWith("/", buildQuery({}, { search }))}
                  className="ml-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  全部清除
                </Link>
              </div>
            ) : null}
          </div>

          {result.data.length === 0 ? (
            <div data-testid="empty-state" className="rounded-lg border border-dashed py-16 text-center">
              <p className="text-sm text-muted-foreground">没有符合条件的纹饰</p>
              {hasFilter ? (
                <Link href="/" className="mt-2 inline-block text-sm text-primary hover:underline">
                  清除全部筛选
                </Link>
              ) : null}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {result.data.map((p) => (
                <PatternCard key={p.id} pattern={p} />
              ))}
            </div>
          )}

          {result.totalPages > 1 ? (
            <nav className="mt-8 flex items-center justify-center gap-3">
              {result.page > 1 ? (
                <Link href={pageHref(result.page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  上一页
                </Link>
              ) : null}
              <span className="text-sm text-muted-foreground tabular-nums">
                {result.page} / {result.totalPages}
              </span>
              {result.page < result.totalPages ? (
                <Link href={pageHref(result.page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  下一页
                </Link>
              ) : null}
            </nav>
          ) : null}
        </main>
      </div>
    </div>
  );
}
