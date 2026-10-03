import { notFound } from "next/navigation";
import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface Variation {
  id: number;
  variantName: string;
  dynasty: string;
  region: string | null;
  description: string | null;
  periodStart: string | null;
  periodEnd: string | null;
  images: { url: string; type: string; label: string | null }[];
}

async function getData(id: string) {
  try {
    const [patternRes, varsRes] = await Promise.all([
      fetch(`${API}/api/patterns/${id}`, { cache: "no-store" }),
      fetch(`${API}/api/patterns/${id}/variations`, { cache: "no-store" }),
    ]);
    if (!patternRes.ok) return null;
    const pattern = await patternRes.json();
    const vars = await varsRes.json();
    return { pattern, variations: vars.data || [] };
  } catch {
    return null;
  }
}

export default async function TimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await getData(id);
  if (!data) notFound();

  const { pattern, variations } = data;
  const allVariations = variations as Variation[];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <Link href={`/patterns/${id}`} className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4">
        ← 返回 {pattern.name}
      </Link>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b">
        <Link href={`/patterns/${id}`} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">详情</Link>
        <span className="px-4 py-2 text-sm font-medium border-b-2 border-primary">演变时间线</span>
      </div>

      <h1 className="text-xl font-bold mb-1">{pattern.name} · 演变时间线</h1>
      <p className="text-sm text-muted-foreground mb-8">
        从 {allVariations[0]?.dynasty || pattern.dynasty} 到 {allVariations[allVariations.length - 1]?.dynasty || pattern.dynasty} 的形态变化
      </p>

      {allVariations.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>暂无变种数据</p>
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-0 min-w-[600px]">
            {allVariations.map((v, i) => (
              <div key={v.id} className="flex-1 min-w-[180px]">
                {/* Timeline node */}
                <div className="flex items-center">
                  <div className="w-4 h-4 rounded-full bg-primary shrink-0 z-10" />
                  {i < allVariations.length - 1 && <div className="h-0.5 bg-border flex-1" />}
                </div>

                {/* Content card */}
                <div className="mt-3 mr-4 rounded-lg border bg-card overflow-hidden">
                  <div className="aspect-video bg-muted flex items-center justify-center">
                    {v.images[0] ? (
                      <img src={v.images[0].url} alt={v.variantName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-xs text-muted-foreground">暂无图片</div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="font-medium text-sm">{v.variantName}</div>
                    <div className="text-xs text-muted-foreground mt-1">{v.dynasty}{v.region ? ` · ${v.region}` : ""}</div>
                    {v.description && <div className="text-xs text-muted-foreground mt-2 line-clamp-3">{v.description}</div>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
