import { notFound, redirect } from "next/navigation";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface ImageInfo {
  id: number; url: string; type: string; purpose: string | null; label: string | null; isPrimary: boolean;
}
interface Variation { id: number; variantName: string; dynasty: string; region: string | null; description: string | null; }
interface TagRel { tag: { id: number; name: string; type: string }; }
interface Relation { id: number; patternAId: number; patternBId: number; relationType: string; description: string | null; }

async function getPattern(id: string) {
  if (id === "new") return null;
  try {
    const res = await fetch(`${API}/api/patterns/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch { return null; }
}

async function savePattern(formData: FormData): Promise<void> {
  "use server";
  const id = formData.get("id");
  const name = formData.get("name") as string;
  if (!name) throw new Error("名称必填");

  const body = {
    name,
    alternateName: formData.get("alternateName"),
    // FormData.get 返回 string | null —— 空字符串统一转成 null，别用 as string 把 null 谎报成字符串
    dynasty: formData.get("dynasty") || null,
    periodStart: formData.get("periodStart"),
    periodEnd: formData.get("periodEnd"),
    region: formData.get("region"),
    ethnicGroup: formData.get("ethnicGroup"),
    category: formData.get("category") as string,
    medium: formData.get("medium"),
    description: formData.get("description"),
    culturalMeaning: formData.get("culturalMeaning"),
    source: formData.get("source"),
    sourceUrl: formData.get("sourceUrl"),
    status: formData.get("status") || "draft",
  };

  try {
    if (id && id !== "new") {
      await fetch(`${API}/api/admin/patterns/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      redirect(`/admin/edit/${id}`);
    } else {
      const res = await fetch(`${API}/api/admin/patterns`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const d = await res.json();
      if (d.data?.id) redirect(`/admin/edit/${d.data.id}`);
      throw new Error("创建失败");
    }
  } catch {
    throw new Error("保存失败");
  }
}

const categories = ["动物纹", "植物纹", "几何纹", "吉祥纹", "自然纹", "人物纹"];
const dynasties = ["商", "西周", "春秋", "战国", "汉", "唐", "宋", "明", "清"];

export default async function EditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pattern = await getPattern(id);
  const isNew = id === "new";
  const p = pattern || {};

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <Link href="/admin" className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">← 返回仪表盘</Link>
      <h1 className="text-2xl font-bold mb-6">{isNew ? "发布新纹饰" : `编辑: ${p.name || ""}`}</h1>

      <form action={savePattern} className="space-y-6">
        <input type="hidden" name="id" value={id} />

        {/* Basic info */}
        <section className="rounded-lg border p-4 space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase">基本信息</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">名称 *</label>
              <input name="name" defaultValue={(p as Record<string, unknown>).name as string || ""} required
                className="w-full px-3 py-2 border rounded-lg text-sm bg-background" />
            </div>
            <div>
              <label className="text-sm font-medium">别名</label>
              <input name="alternateName" defaultValue={(p as Record<string, unknown>).alternateName as string || ""}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-background" />
            </div>
            <div>
              {/* 朝代非必填 —— 粗粒度朝代可考，精细断代不做，拿不准就留空，不编造 */}
              <label className="text-sm font-medium">朝代</label>
              <select name="dynasty" defaultValue={(p as Record<string, unknown>).dynasty as string || ""}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-background">
                <option value="">未定</option>
                {dynasties.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">题材 *</label>
              <select name="category" defaultValue={(p as Record<string, unknown>).category as string || "动物纹"} required
                className="w-full px-3 py-2 border rounded-lg text-sm bg-background">
                {categories.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">年代始</label>
              <input name="periodStart" defaultValue={(p as Record<string, unknown>).periodStart as string || ""}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-background" placeholder="如：约公元前1600年" />
            </div>
            <div>
              <label className="text-sm font-medium">年代终</label>
              <input name="periodEnd" defaultValue={(p as Record<string, unknown>).periodEnd as string || ""}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-background" />
            </div>
            <div>
              <label className="text-sm font-medium">地域</label>
              <input name="region" defaultValue={(p as Record<string, unknown>).region as string || ""}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-background" />
            </div>
            <div>
              <label className="text-sm font-medium">民族</label>
              <input name="ethnicGroup" defaultValue={(p as Record<string, unknown>).ethnicGroup as string || ""}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-background" />
            </div>
            <div>
              <label className="text-sm font-medium">载体</label>
              <input name="medium" defaultValue={(p as Record<string, unknown>).medium as string || ""}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-background" placeholder="青铜器、玉器、织锦..." />
            </div>
            <div>
              <label className="text-sm font-medium">状态</label>
              <select name="status" defaultValue={(p as Record<string, unknown>).status as string || "draft"}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-background">
                <option value="draft">草稿</option>
                <option value="published">发布</option>
              </select>
            </div>
          </div>
        </section>

        {/* Description */}
        <section className="rounded-lg border p-4 space-y-4">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase">描述与文化含义</h2>
          <div>
            <label className="text-sm font-medium">描述</label>
            <textarea name="description" rows={4} defaultValue={(p as Record<string, unknown>).description as string || ""}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-background" />
          </div>
          <div>
            <label className="text-sm font-medium">文化含义</label>
            <textarea name="culturalMeaning" rows={4} defaultValue={(p as Record<string, unknown>).culturalMeaning as string || ""}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-background" />
          </div>
          <div>
            <label className="text-sm font-medium">出处</label>
            <input name="source" defaultValue={(p as Record<string, unknown>).source as string || ""}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-background" />
          </div>
          <div>
            <label className="text-sm font-medium">参考链接</label>
            <input name="sourceUrl" defaultValue={(p as Record<string, unknown>).sourceUrl as string || ""}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-background" placeholder="https://..." />
          </div>
        </section>

        {/* Image upload */}
        {!isNew && (
          <section className="rounded-lg border p-4 space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase">图片管理</h2>
            {(p as { images?: ImageInfo[] }).images?.map((img) => (
              <div key={img.id} className="flex items-center gap-3 text-sm">
                <div className="w-12 h-12 rounded bg-muted overflow-hidden shrink-0">
                  <img src={img.url} alt="" className="w-full h-full object-cover" />
                </div>
                <span className="text-xs text-muted-foreground">{img.type === "vector" ? "矢量图" : "位图"}{img.label ? ` · ${img.label}` : ""}</span>
                <span className="text-xs text-muted-foreground">{img.url}</span>
              </div>
            ))}
            {(p as { images?: ImageInfo[] }).images?.length === 0 && <p className="text-sm text-muted-foreground">暂无图片</p>}
          </section>
        )}

        {/* Save */}
        <div className="flex gap-3">
          <button type="submit" className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90">保存</button>
          {!isNew && (
            <Link href={`/patterns/${id}`} className="px-6 py-2 border rounded-lg text-sm hover:bg-accent">查看前台效果</Link>
          )}
        </div>
      </form>
    </div>
  );
}
