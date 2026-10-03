import Link from "next/link";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface Pattern {
  id: number;
  name: string;
  dynasty: string;
  category: string;
  thumbnail: string | null;
}

async function getPatterns(params: Record<string, string>): Promise<{ data: Pattern[]; total: number }> {
  try {
    const p = new URLSearchParams();
    if (params.dynasty) p.set("dynasty", params.dynasty);
    if (params.category) p.set("category", params.category);
    if (params.medium) p.set("medium", params.medium);
    if (params.search) p.set("search", params.search);
    p.set("pageSize", "50");
    const res = await fetch(`${API}/api/patterns?${p}`, { cache: "no-store" });
    if (!res.ok) return { data: [], total: 0 };
    return res.json();
  } catch { return { data: [], total: 0 }; }
}

async function getTags(): Promise<Record<string, { name: string }[]>> {
  try {
    const res = await fetch(`${API}/api/tags`, { cache: "no-store" });
    if (!res.ok) return {};
    return (await res.json()).grouped || {};
  } catch { return {}; }
}

export default async function PatternsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const sp = await searchParams;
  const dynasty = sp.dynasty || "";
  const category = sp.category || "";
  const medium = sp.medium || "";
  const search = sp.search || "";

  const [result, tagGroups] = await Promise.all([
    getPatterns({ dynasty, category, medium, search }),
    getTags(),
  ]);

  const { data: patterns, total } = result;
  const hasFilters = dynasty || category || medium || search;

  function q(filterKey: string, filterVal: string, remove = false): string {
    const p = new URLSearchParams();
    if (dynasty) p.set("dynasty", dynasty);
    if (category) p.set("category", category);
    if (medium) p.set("medium", medium);
    if (search) p.set("search", search);
    if (remove || p.get(filterKey) === filterVal) p.delete(filterKey);
    else p.set(filterKey, filterVal);
    return `/patterns?${p.toString()}`;
  }
  function clear(filterKey: string): string {
    const p = new URLSearchParams();
    if (dynasty && filterKey !== "dynasty") p.set("dynasty", dynasty);
    if (category && filterKey !== "category") p.set("category", category);
    if (medium && filterKey !== "medium") p.set("medium", medium);
    if (search && filterKey !== "search") p.set("search", search);
    return `/patterns?${p.toString()}`;
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Search */}
      <form action="/patterns" method="GET" className="mb-6">
        {dynasty && <input type="hidden" name="dynasty" value={dynasty} />}
        {category && <input type="hidden" name="category" value={category} />}
        {medium && <input type="hidden" name="medium" value={medium} />}
        <div className="flex gap-2">
          <input name="search" defaultValue={search} placeholder="搜索纹饰名称、描述..."
            className="flex-1 px-4 py-2 border rounded-lg text-sm bg-background" />
          <button type="submit" className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">搜索</button>
        </div>
      </form>

      <div className="flex gap-6">
        {/* Filter sidebar */}
        <aside className="w-48 shrink-0 hidden md:block">
          {hasFilters && (
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-muted-foreground">已筛选</span>
                <a href="/patterns" className="text-xs text-primary">清除</a>
              </div>
              <div className="flex flex-wrap gap-1">
                {dynasty && <a href={clear("dynasty")} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">{dynasty} ×</a>}
                {category && <a href={clear("category")} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">{category} ×</a>}
                {medium && <a href={clear("medium")} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">{medium} ×</a>}
                {search && <a href={clear("search")} className="inline-flex items-center gap-1 px-2 py-0.5 bg-primary/10 text-primary rounded text-xs">搜索: {search} ×</a>}
              </div>
            </div>
          )}

          {tagGroups["dynasty"] && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">朝代</h3>
              {tagGroups["dynasty"].map((t) => (
                <a key={t.name} href={dynasty === t.name ? "/patterns" : q("dynasty", t.name)}
                  className={`block text-sm px-2 py-1 rounded ${dynasty === t.name ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground"}`}>
                  {t.name}
                </a>
              ))}
            </div>
          )}
          {tagGroups["category"] && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">题材</h3>
              {tagGroups["category"].map((t) => (
                <a key={t.name} href={category === t.name ? "/patterns" : q("category", t.name)}
                  className={`block text-sm px-2 py-1 rounded ${category === t.name ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground"}`}>
                  {t.name}
                </a>
              ))}
            </div>
          )}
          {tagGroups["medium"] && (
            <div className="mb-6">
              <h3 className="text-xs font-semibold text-muted-foreground mb-2">载体</h3>
              {tagGroups["medium"].map((t) => (
                <a key={t.name} href={medium === t.name ? "/patterns" : q("medium", t.name)}
                  className={`block text-sm px-2 py-1 rounded ${medium === t.name ? "bg-primary/10 text-primary font-medium" : "hover:bg-muted text-muted-foreground"}`}>
                  {t.name}
                </a>
              ))}
            </div>
          )}
        </aside>

        {/* Pattern grid */}
        <div className="flex-1">
          <p className="text-sm text-muted-foreground mb-4">共 {total} 个纹饰</p>
          {patterns.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-muted-foreground mb-2">没有找到匹配的纹饰</p>
              <a href="/patterns" className="text-sm text-primary">清除筛选条件</a>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {patterns.map((p) => (
                <Link key={p.id} href={`/patterns/${p.id}`}
                  className="rounded-lg border bg-card overflow-hidden hover:shadow-md transition-all group">
                  <div className="aspect-square bg-muted overflow-hidden">
                    {p.thumbnail
                      ? <img src={p.thumbnail} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      : <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">暂无图片</div>}
                  </div>
                  <div className="p-3">
                    <div className="font-medium text-sm truncate">{p.name}</div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs bg-secondary text-secondary-foreground px-1.5 py-0.5 rounded">{p.dynasty}</span>
                      <span className="text-xs text-muted-foreground">{p.category}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
