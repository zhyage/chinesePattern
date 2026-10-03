import { notFound } from "next/navigation";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const relationTypeLabels: Record<string, string> = {
  evolves_to: "演变为",
  contains: "包含",
  variant_of: "互为变体",
  influences: "影响",
  same_theme: "共用题材",
};

interface Relation {
  id: number;
  pattern: { id: number; name: string; dynasty: string; category: string };
  relationType: string;
  description: string | null;
}

interface Tag {
  id: number;
  name: string;
  type: string;
}

async function getData(id: string) {
  try {
    const [patternRes, relRes] = await Promise.all([
      fetch(`${API}/api/patterns/${id}`, { cache: "no-store" }),
      fetch(`${API}/api/patterns/${id}/relations`, { cache: "no-store" }),
    ]);
    if (!patternRes.ok) return null;
    const pattern = await patternRes.json();
    const rels = await relRes.json();
    return { pattern, relations: rels.data || [] };
  } catch {
    return null;
  }
}

export default async function RelationsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getData(id);
  if (!data) notFound();

  const { pattern, relations } = data;
  const allRelations = relations as Relation[];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <Link href={`/patterns/${id}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        ← 返回 {pattern.name}
      </Link>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b">
        <Link href={`/patterns/${id}`} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">详情</Link>
        <span className="px-4 py-2 text-sm font-medium border-b-2 border-primary">关联图谱</span>
      </div>

      <h1 className="text-xl font-bold mb-1">{pattern.name} · 关联图谱</h1>
      <p className="text-sm text-muted-foreground mb-8">
        与 {pattern.name} 相关的纹饰
      </p>

      {allRelations.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>暂无关联纹饰</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Center node: current pattern */}
          <div className="flex justify-center mb-6">
            <div className="px-6 py-4 rounded-lg bg-primary/10 border border-primary/30 text-center">
              <div className="font-bold">{pattern.name}</div>
              <div className="text-xs text-muted-foreground">{pattern.dynasty} · {pattern.category}</div>
            </div>
          </div>

          {/* Connection lines indicator */}
          <div className="flex justify-center gap-1 mb-2">
            {allRelations.map((r) => (
              <div key={r.id} className="w-8 h-0.5 bg-border" />
            ))}
          </div>

          {/* Related patterns */}
          <div className="flex flex-wrap justify-center gap-4">
            {allRelations.map((r) => (
              <Link
                key={r.id}
                href={`/patterns/${r.pattern.id}`}
                className="group relative px-5 py-4 rounded-lg border bg-card hover:shadow-md transition-all text-center min-w-[140px]"
              >
                <div className="font-medium text-sm group-hover:text-primary transition-colors">{r.pattern.name}</div>
                <div className="text-xs text-muted-foreground mt-1">{r.pattern.dynasty} · {r.pattern.category}</div>
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary border border-primary/20 whitespace-nowrap">
                  {relationTypeLabels[r.relationType] || r.relationType}
                </div>
                {r.description && (
                  <div className="text-xs text-muted-foreground/70 mt-2">{r.description}</div>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
