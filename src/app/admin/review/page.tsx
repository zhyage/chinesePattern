import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface ReviewItem {
  id: number; name: string; dynasty: string; category: string; medium: string | null;
  status: string; thumbnail: string | null; source: string | null; createdAt: string;
  hasBitmap: boolean; hasVector: boolean;
}

async function getReviewItems(): Promise<ReviewItem[]> {
  try {
    const res = await fetch(`${API}/api/admin/review`, { cache: "no-store" });
    if (!res.ok) return [];
    const d = await res.json();
    return d.data || [];
  } catch { return []; }
}

export default async function ReviewPage() {
  const items = await getReviewItems();

  async function formAction(formData: FormData) {
    "use server";
    const id = formData.get("id");
    const status = formData.get("status");
    if (!id || !status) return;
    await fetch(`${API}/api/admin/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: parseInt(id as string), status }),
    });
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">← 返回仪表盘</Link>
      <h1 className="text-2xl font-bold mb-6">审核管理</h1>

      {items.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>暂无待审核的纹饰</p>
          <Link href="/admin/edit/new" className="text-sm text-primary hover:underline mt-2 inline-block">发布新纹饰</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-4 p-4 rounded-lg border bg-card">
              <div className="w-12 h-12 rounded bg-muted shrink-0 flex items-center justify-center overflow-hidden">
                {item.thumbnail ? <img src={item.thumbnail} alt="" className="w-full h-full object-cover" /> : <span className="text-xs text-muted-foreground">无图</span>}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{item.name}</div>
                <div className="text-xs text-muted-foreground">
                  {item.dynasty} · {item.category}{item.medium ? ` · ${item.medium}` : ""}
                </div>
                <div className="text-xs text-muted-foreground">
                  {item.hasBitmap ? "✅ 位图" : "❌ 位图"} {item.hasVector ? "✅ 矢量图" : "❌ 矢量图"}
                  {item.source ? ` · ${item.source}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link href={`/admin/edit/${item.id}`} className="px-3 py-1.5 text-xs rounded bg-secondary hover:bg-secondary/80 transition-colors">编辑</Link>
                <form action={formAction} className="inline">
                  <input type="hidden" name="id" value={item.id} />
                  <button type="submit" name="status" value="published" className="px-3 py-1.5 text-xs rounded bg-primary text-primary-foreground hover:opacity-90 transition-opacity">通过</button>
                </form>
                <form action={formAction} className="inline">
                  <input type="hidden" name="id" value={item.id} />
                  <button type="submit" name="status" value="rejected" className="px-3 py-1.5 text-xs rounded bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity">拒绝</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
