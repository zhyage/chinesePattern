import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

async function getImportHistory() {
  try {
    const res = await fetch(`${API}/api/admin/patterns?pageSize=5`, { cache: "no-store" });
    if (!res.ok) return [];
    const d = await res.json();
    return (d.data || []).slice(0, 5).map((p: { id: number; name: string; createdAt: string; status: string }) => ({
      name: p.name,
      date: new Date(p.createdAt).toISOString().split("T")[0],
      status: p.status,
    }));
  } catch { return []; }
}

export default async function ImportPage() {
  const history = await getImportHistory();

  async function uploadFile(formData: FormData) {
    "use server";
    const file = formData.get("file") as File;
    if (!file) return;
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const { writeFile } = await import("fs/promises");
    const path = (await import("path")).join(process.cwd(), "public", "patterns", file.name);
    await writeFile(path, buffer);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">← 返回仪表盘</Link>
      <h1 className="text-2xl font-bold mb-6">批量导入</h1>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Manual upload */}
        <section className="rounded-lg border p-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase mb-4">上传文件</h2>
          <form action={uploadFile} className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-accent/50 transition-colors cursor-pointer">
              <input type="file" name="file" accept=".svg,.jpg,.jpeg,.png,.webp" required
                className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-secondary file:text-sm file:font-medium hover:file:bg-secondary/80" />
            </div>
            <button type="submit" className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">
              上传
            </button>
          </form>
          <div className="mt-4 text-xs text-muted-foreground">
            支持格式：SVG, JPG, PNG, WebP
          </div>
        </section>

        {/* URL batch import placeholder */}
        <section className="rounded-lg border p-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase mb-4">URL 批量拉取</h2>
          <p className="text-sm text-muted-foreground mb-4">输入文件 URL，每行一个。</p>
          <textarea rows={5} placeholder="https://example.com/pattern1.svg&#10;https://example.com/pattern2.jpg"
            className="w-full px-3 py-2 border rounded-lg text-sm bg-background" />
          <button disabled className="w-full py-2 bg-muted text-muted-foreground rounded-lg text-sm font-medium mt-3 cursor-not-allowed">
            功能开发中
          </button>
        </section>
      </div>

      {/* Recent imports */}
      <section className="mt-8">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase mb-3">最近导入</h2>
        {history.length === 0 ? (
          <p className="text-sm text-muted-foreground">暂无导入记录</p>
        ) : (
          <div className="space-y-2">
            {history.map((item: { name: string; date: string; status: string }, i: number) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border text-sm">
                <span>{item.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{item.date}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${item.status === "published" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                    {item.status === "published" ? "已发布" : "草稿"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
