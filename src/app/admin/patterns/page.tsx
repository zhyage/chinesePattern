import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listPatternsForAdmin } from "@/lib/patterns-query";
import { hrefWith } from "@/lib/facet-url";
import { DeleteButton } from "./[id]/delete-button";

/**
 * 已发布条目列表（design.md §5.4）。
 *
 * 没有它，改一个错别字要靠猜 URL。
 * 数据直接从 lib 读 —— 和 `/api/admin/patterns` 共用同一份查询。
 */

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

const STATUS = [
  { value: "", label: "全部" },
  { value: "published", label: "已发布" },
  { value: "draft", label: "草稿" },
  { value: "rejected", label: "已驳回" },
] as const;

type SearchParams = Record<string, string | string[] | undefined>;

export default async function AdminPatternsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const raw = await searchParams;
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") sp.set(k, v);
  }

  const search = sp.get("search")?.trim() ?? "";
  const status = sp.get("status") ?? "";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);

  const result = await listPatternsForAdmin(
    new URLSearchParams({ search, status, page: String(page), pageSize: String(PAGE_SIZE) }),
  );

  const pageHref = (p: number) => {
    const q = new URLSearchParams();
    if (search) q.set("search", search);
    if (status) q.set("status", status);
    if (p > 1) q.set("page", String(p));
    return hrefWith("/admin/patterns", q.toString());
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">已发布条目</h1>
        <div className="flex gap-3 text-sm">
          <Link href="/admin/edit/new" className="text-primary hover:underline">
            ＋ 新建
          </Link>
          <Link href="/admin" className="text-muted-foreground hover:text-foreground">
            ← 返回
          </Link>
        </div>
      </div>

      {/* 搜索 + 状态筛选。普通 GET 表单，无 JS 也能用 */}
      <form action="/admin/patterns" method="get" className="mb-4 flex flex-wrap items-center gap-2">
        {status ? <input type="hidden" name="status" value={status} /> : null}
        <Input
          type="search"
          name="search"
          defaultValue={search}
          placeholder="搜索名称、描述"
          className="max-w-xs"
        />
        <Button type="submit" variant="secondary" size="sm">
          搜索
        </Button>

        <div className="ml-auto flex gap-1">
          {STATUS.map((s) => {
            const q = new URLSearchParams();
            if (search) q.set("search", search);
            if (s.value) q.set("status", s.value);
            return (
              <Link
                key={s.value || "all"}
                href={hrefWith("/admin/patterns", q.toString())}
                data-testid="status-tab"
                data-status={s.value}
                className={`rounded px-2.5 py-1 text-sm transition-colors ${
                  status === s.value ? "bg-secondary font-medium" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {s.label}
              </Link>
            );
          })}
        </div>
      </form>

      <p className="mb-3 text-sm text-muted-foreground">
        共 <span data-testid="admin-total" className="font-medium tabular-nums text-foreground">{result.total}</span> 条
      </p>

      {result.data.length === 0 ? (
        <div data-testid="admin-empty" className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
          没有符合条件的条目
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {result.data.map((p) => (
            <li key={p.id} data-testid="admin-row" data-pattern-id={p.id} className="flex items-center gap-4 p-3">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-muted">
                {p.thumbnail ? (
                  // eslint-disable-next-line @next/next/no-img-element -- 素材是 SVG/位图混排，尺寸不定
                  <img src={p.thumbnail} alt="" className="h-full w-full object-cover" />
                ) : null}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{p.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {summary(p.facets) || "（无分面）"}
                </div>
              </div>

              <Badge variant={p.status === "published" ? "secondary" : "outline"} className="shrink-0 font-normal">
                {p.status}
              </Badge>

              <div className="flex shrink-0 gap-1">
                {/* 导航用 Link + buttonVariants，**不用 <Button render={<Link/>}>**：
                    Base UI 的 Button 会往 <a> 上塞 role="button" tabindex="0"，
                    把链接的语义改掉（读屏软件会念成按钮，getByRole("link") 也找不到）。
                    样式照拿，语义保持是链接。 */}
                <Link
                  href={`/admin/edit/pattern/${p.id}`}
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  编辑
                </Link>
                <DeleteButton id={p.id} name={p.name} />
              </div>
            </li>
          ))}
        </ul>
      )}

      {result.totalPages > 1 ? (
        <nav className="mt-6 flex items-center justify-center gap-3">
          {result.page > 1 ? (
            <Link href={pageHref(result.page - 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              上一页
            </Link>
          ) : null}
          <span className="text-sm tabular-nums text-muted-foreground">
            {result.page} / {result.totalPages}
          </span>
          {result.page < result.totalPages ? (
            <Link href={pageHref(result.page + 1)} className={buttonVariants({ variant: "outline", size: "sm" })}>
              下一页
            </Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}

/** 分面摘要：按维度优先级取前几个名字拼一行 */
const ORDER = ["dynasty", "motif", "category", "medium", "region", "ethnicGroup"];
function summary(facets: Record<string, string[]>): string {
  const out: string[] = [];
  for (const k of ORDER) for (const n of facets[k] ?? []) if (out.length < 3) out.push(n);
  return out.join(" · ");
}
