import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

async function getStats() {
  try {
    const [reviewRes, patternsRes] = await Promise.all([
      fetch(`${API}/api/admin/review`, { cache: "no-store" }),
      fetch(`${API}/api/admin/patterns`, { cache: "no-store" }),
    ]);
    const review = await reviewRes.json();
    const patterns = await patternsRes.json();
    return {
      pending: review.total || 0,
      published: patterns.data?.filter((p: { status: string }) => p.status === "published").length || 0,
      draft: patterns.data?.filter((p: { status: string }) => p.status === "draft").length || 0,
      total: patterns.data?.length || 0,
    };
  } catch {
    return { pending: 0, published: 0, draft: 0, total: 0 };
  }
}

export default async function AdminPage() {
  const stats = await getStats();

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold">管理后台</h1>
        <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">← 返回前台</Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-xs text-muted-foreground">全部纹饰</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-2xl font-bold text-green-600">{stats.published}</div>
          <div className="text-xs text-muted-foreground">已发布</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-2xl font-bold text-amber-600">{stats.draft}</div>
          <div className="text-xs text-muted-foreground">草稿</div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-2xl font-bold text-blue-600">{stats.pending}</div>
          <div className="text-xs text-muted-foreground">待审核</div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">功能入口</h2>
        <div className="grid gap-3">
          <Link href="/admin/review" className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors">
            <div>
              <div className="font-medium">审核管理</div>
              <div className="text-sm text-muted-foreground">{stats.pending} 条待审核</div>
            </div>
            <span className="text-sm text-muted-foreground">→</span>
          </Link>
          <Link href="/admin/edit/new" className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors">
            <div>
              <div className="font-medium">发布新纹饰</div>
              <div className="text-sm text-muted-foreground">手动录入纹饰数据</div>
            </div>
            <span className="text-sm text-muted-foreground">→</span>
          </Link>
          <Link href="/admin/import" className="flex items-center justify-between p-4 rounded-lg border hover:bg-accent transition-colors">
            <div>
              <div className="font-medium">批量导入</div>
              <div className="text-sm text-muted-foreground">上传 SVG/图片或从 URL 拉取</div>
            </div>
            <span className="text-sm text-muted-foreground">→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
