import Link from "next/link";
import { listPending } from "@/lib/pending-query";

/**
 * 审核队列（design.md §5.4）。
 *
 * 列表**只用来找**：缩略图、名称、时间、"有建议值"标记。
 * 判断在详情页做 —— 审核本来就要看清两张图和六个分面才能下结论，
 * 列表行内放个"通过"按钮等于闭着眼睛审。
 */

export const dynamic = "force-dynamic";

export default async function AdminPendingPage() {
  const items = await listPending("pending");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">审核队列</h1>
        <div className="flex gap-3 text-sm">
          <Link href="/admin/edit/new" className="text-primary hover:underline">
            ＋ 新建
          </Link>
          <Link href="/admin" className="text-muted-foreground hover:text-foreground">
            ← 返回
          </Link>
        </div>
      </div>

      <p className="mb-4 text-sm text-muted-foreground">
        待审 <span data-testid="pending-total" className="font-medium tabular-nums text-foreground">{items.length}</span> 条
      </p>

      {items.length === 0 ? (
        <div data-testid="pending-empty" className="rounded-lg border border-dashed py-16 text-center text-sm text-muted-foreground">
          队列是空的。
          <Link href="/admin/edit/new" className="ml-1 text-primary hover:underline">
            新建一条？
          </Link>
        </div>
      ) : (
        <ul className="divide-y rounded-lg border">
          {items.map((p) => (
            <li key={p.id}>
              <Link
                href={`/admin/pending/${p.id}`}
                data-testid="pending-row"
                data-pending-id={p.id}
                className="flex items-center gap-4 p-3 transition-colors hover:bg-accent"
              >
                <div className="h-12 w-12 shrink-0 overflow-hidden rounded bg-muted">
                  {p.thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element -- 素材是 SVG/位图混排
                    <img src={p.thumbnail} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{p.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(p.createdAt).toLocaleString("zh-CN", { hour12: false })}
                  </div>
                </div>

                {/* 有建议值 = 通过时会往查找表里插新行，是最需要人看一眼的情况 */}
                {p.hasSuggestions ? (
                  <span
                    data-testid="pending-suggestion-flag"
                    className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-200"
                    title="含有要新建的查找表值"
                  >
                    ⚑ 有建议值
                  </span>
                ) : null}

                <span className="shrink-0 text-sm text-muted-foreground">→</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
