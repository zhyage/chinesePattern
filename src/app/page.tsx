import Link from "next/link";
import { PatternCard } from "@/components/pattern-card";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

const dynasties = ["商", "西周", "春秋", "战国", "汉", "唐", "宋", "明", "清"];
const categories = ["动物纹", "植物纹", "几何纹", "吉祥纹", "自然纹"];

async function getPatterns() {
  try {
    const res = await fetch(`${API}/api/patterns?pageSize=6`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.data;
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const patterns = await getPatterns();

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Hero */}
      <section className="text-center py-12">
        <h1 className="text-3xl font-bold tracking-tight mb-3">
          中国传统纹饰博物馆
        </h1>
        <p className="text-muted-foreground mb-6 max-w-md mx-auto">
          探索千年纹样，了解纹饰背后的文化与历史
        </p>
        <Link
          href="/patterns"
          className="inline-block px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm hover:opacity-90 transition-opacity"
        >
          开始浏览
        </Link>
      </section>

      {/* 朝代入口 */}
      <section className="mb-10">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">按朝代浏览</h2>
        <div className="flex flex-wrap gap-2">
          {dynasties.map((d) => (
            <Link
              key={d}
              href={`/patterns?dynasty=${encodeURIComponent(d)}`}
              className="px-4 py-1.5 bg-secondary text-secondary-foreground rounded-full text-sm hover:bg-secondary/80 transition-colors"
            >
              {d}
            </Link>
          ))}
        </div>
      </section>

      {/* 题材入口 */}
      <section className="mb-12">
        <h2 className="text-sm font-medium text-muted-foreground mb-3">按题材浏览</h2>
        <div className="flex flex-wrap gap-2">
          {categories.map((c) => (
            <Link
              key={c}
              href={`/patterns?category=${encodeURIComponent(c)}`}
              className="px-4 py-1.5 bg-secondary text-secondary-foreground rounded-full text-sm hover:bg-secondary/80 transition-colors"
            >
              {c}
            </Link>
          ))}
        </div>
      </section>

      {/* 精选纹饰 */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">精选纹饰</h2>
          <Link href="/patterns" className="text-sm text-muted-foreground hover:text-foreground">
            查看全部 →
          </Link>
        </div>
        {patterns.length === 0 ? (
          <p className="text-muted-foreground text-sm">暂无纹饰数据</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {patterns.map((p: { id: number; name: string; dynasty: string; category: string; thumbnail: string | null }) => (
              <PatternCard
                key={p.id}
                id={p.id}
                name={p.name}
                dynasty={p.dynasty}
                category={p.category}
                thumbnail={p.thumbnail}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
