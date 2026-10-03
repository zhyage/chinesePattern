import { notFound } from "next/navigation";
import Link from "next/link";
import { ImageViewer } from "@/components/image-viewer";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface ImageInfo {
  id: number;
  url: string;
  type: "bitmap" | "vector";
  purpose: string | null;
  label: string | null;
  isPrimary: boolean;
}

interface Variation {
  id: number;
  variantName: string;
  dynasty: string;
  region: string | null;
  description: string | null;
  images: ImageInfo[];
}

interface Relation {
  id: number;
  pattern: { id: number; name: string; dynasty: string; category: string };
  relationType: string;
  description: string | null;
}

interface DetailData {
  id: number;
  name: string;
  alternateName: string | null;
  dynasty: string;
  periodStart: string | null;
  periodEnd: string | null;
  region: string | null;
  ethnicGroup: string | null;
  category: string;
  medium: string | null;
  description: string | null;
  culturalMeaning: string | null;
  source: string | null;
  sourceUrl: string | null;
  images: ImageInfo[];
  variations: Variation[];
  relations: Relation[];
  tags: { id: number; name: string; type: string }[];
}

async function getPattern(id: string): Promise<DetailData | null> {
  try {
    const res = await fetch(`${API}/api/patterns/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

const relationTypeLabels: Record<string, string> = {
  evolves_to: "演变为",
  contains: "包含",
  variant_of: "互为变体",
  influences: "影响",
  same_theme: "共用题材",
};

export default async function PatternDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const pattern = await getPattern(id);
  if (!pattern) notFound();

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <Link href="/patterns" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        ← 返回浏览
      </Link>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b">
        <span className="px-4 py-2 text-sm font-medium border-b-2 border-primary">详情</span>
        <Link href={`/patterns/${pattern.id}/timeline`} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
          演变时间线
        </Link>
        <Link href={`/patterns/${pattern.id}/relations`} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">
          关联图谱
        </Link>
      </div>

      {/* Main: image + metadata */}
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div><ImageViewer images={pattern.images} /></div>
        <div>
          <h1 className="text-2xl font-bold mb-1">{pattern.name}</h1>
          {pattern.alternateName && <p className="text-sm text-muted-foreground mb-4">别名：{pattern.alternateName}</p>}

          <div className="space-y-2 text-sm mb-4">
            <Row label="朝代" value={pattern.dynasty} />
            {pattern.periodStart && <Row label="年代" value={`${pattern.periodStart} — ${pattern.periodEnd || ""}`} />}
            <Row label="题材" value={pattern.category} />
            <Row label="载体" value={pattern.medium} />
            {pattern.region && <Row label="地域" value={pattern.region} />}
            {pattern.ethnicGroup && <Row label="民族" value={pattern.ethnicGroup} />}
          </div>

          {pattern.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {pattern.tags.map((t) => (
                <Link key={t.id} href={`/patterns?${t.type}=${encodeURIComponent(t.name)}`}
                  className="px-2 py-0.5 bg-secondary text-secondary-foreground rounded text-xs hover:bg-secondary/80 transition-colors">
                  {t.name}
                </Link>
              ))}
            </div>
          )}

          <button className="w-full py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity">
            加入排版
          </button>
        </div>
      </div>

      {/* Description / Cultural meaning */}
      {(pattern.description || pattern.culturalMeaning) && (
        <section className="mb-8">
          {pattern.description && (
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">描述</h2>
              <p className="text-sm leading-relaxed">{pattern.description}</p>
            </div>
          )}
          {pattern.culturalMeaning && (
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">文化含义</h2>
              <p className="text-sm leading-relaxed">{pattern.culturalMeaning}</p>
            </div>
          )}
        </section>
      )}

      {pattern.source && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-2">出处</h2>
          <p className="text-sm">{pattern.source}</p>
        </section>
      )}

      {/* Variations with link */}
      {pattern.variations.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
            同一纹样的变种（{pattern.variations.length}）
          </h2>
          <div className="flex gap-4 overflow-x-auto pb-2">
            {pattern.variations.map((v) => (
              <div key={v.id} className="shrink-0 w-40 rounded-lg border bg-card overflow-hidden">
                <div className="aspect-square bg-muted flex items-center justify-center">
                  {v.images[0] ? (
                    <img src={v.images[0].url} alt={v.variantName} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-muted-foreground text-xs">暂无图片</span>
                  )}
                </div>
                <div className="p-2">
                  <p className="text-xs font-medium truncate">{v.variantName}</p>
                  <p className="text-xs text-muted-foreground">{v.dynasty}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <Link href={`/patterns/${pattern.id}/timeline`} className="text-xs text-primary hover:underline">
              查看完整时间线 →
            </Link>
          </div>
        </section>
      )}

      {/* Relations with link */}
      {pattern.relations.length > 0 && (
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">关联纹饰</h2>
          <p className="text-xs text-muted-foreground mb-3">这个纹饰与以下纹饰有关联</p>
          <div className="space-y-2">
            {pattern.relations.map((r) => (
              <Link key={r.id} href={`/patterns/${r.pattern.id}`}
                className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent transition-colors">
                <span className="text-sm font-medium">{r.pattern.name}</span>
                <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded">
                  {relationTypeLabels[r.relationType] || r.relationType}
                </span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {r.pattern.dynasty} · {r.pattern.category}
                </span>
              </Link>
            ))}
          </div>
          <div className="mt-3">
            <Link href={`/patterns/${pattern.id}/relations`} className="text-xs text-primary hover:underline">
              查看完整关联图谱 →
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex">
      <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
      <span>{value}</span>
    </div>
  );
}
