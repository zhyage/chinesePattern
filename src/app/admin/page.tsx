import Link from "next/link";
import { adminCounts } from "@/lib/patterns-query";

/**
 * 管理后台仪表盘（design.md §5.4）。
 *
 * ⚠️ 上一版这个页面调的是 `/api/admin/review` —— 那接口在阶段 2 就删了。
 *    它的 `Promise.all` + 裸 `catch {}` 让**一个 404 把四个数字全变成 0**，
 *    包括数据完全正常的那些，而且不报错、不提示。
 *    现在改成直接读库，并让错误照常抛出来（Next 会显示错误页，不会被误当成"数据是 0"）。
 */

// 读库的页面必须声明动态，否则 Next 会在构建时把它预渲染成静态页、数字被烤死
export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const c = await adminCounts();

  const cards = [
    { href: "/admin/pending", n: c.pending, label: "待审核", action: "审核", tone: "text-blue-600" },
    { href: "/admin/patterns", n: c.published, label: "已发布", action: "管理", tone: "text-green-600" },
    { href: "/admin/facets", n: c.facetValues, label: "查找表值", action: "维护", tone: "text-muted-foreground" },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* 常驻警告：这件事写在 design.md 里，但后台是在浏览器里用的 ——
          放在一定会看到的地方，才不会在部署那天被忘掉 */}
      <div
        data-testid="no-auth-warning"
        className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
      >
        <strong>未启用认证</strong> —— 所有管理接口都是公开的，请勿公网部署。
      </div>

      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-2xl font-bold">纹饰管理</h1>
        <Link href="/" className="text-sm text-muted-foreground transition-colors hover:text-foreground">
          ← 返回前台
        </Link>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            data-testid="admin-card"
            data-label={card.label}
            className="rounded-lg border bg-card p-4 transition-colors hover:bg-accent"
          >
            <div className={`text-3xl font-bold tabular-nums ${card.tone}`}>{card.n}</div>
            <div className="mt-1 flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">{card.label}</span>
              <span className="text-xs text-muted-foreground">{card.action} →</span>
            </div>
          </Link>
        ))}
      </div>

      {c.draft + c.rejected > 0 ? (
        <p className="mb-6 text-sm text-muted-foreground">
          另有{" "}
          {c.draft > 0 ? (
            <Link href="/admin/patterns?status=draft" className="text-primary hover:underline">
              草稿 {c.draft} 条
            </Link>
          ) : null}
          {c.draft > 0 && c.rejected > 0 ? "、" : null}
          {c.rejected > 0 ? (
            <Link href="/admin/patterns?status=rejected" className="text-primary hover:underline">
              已驳回 {c.rejected} 条
            </Link>
          ) : null}
        </p>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          常用入口
        </h2>
        <div className="grid gap-3">
          <Entry
            href="/admin/edit/new"
            title="新建纹饰"
            desc="填内容、传位图和矢量图 —— 提交后进审核队列"
          />
          <Entry
            href="/admin/pending"
            title="审核队列"
            desc={`${c.pending} 条待审`}
          />
          <Entry
            href="/admin/patterns"
            title="已发布条目"
            desc="搜索、编辑、删除"
          />
          <Entry
            href="/admin/facets"
            title="查找表维护"
            desc="六个维度的名称、说明、启用停用"
          />
        </div>
      </section>
    </div>
  );
}

function Entry({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-accent"
    >
      <div>
        <div className="font-medium">{title}</div>
        <div className="text-sm text-muted-foreground">{desc}</div>
      </div>
      <span className="text-sm text-muted-foreground">→</span>
    </Link>
  );
}
