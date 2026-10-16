import { notFound } from "next/navigation";
import Link from "next/link";
import { ImageViewer } from "@/components/image-viewer";
import { Badge } from "@/components/ui/badge";
import { getPatternById } from "@/lib/patterns-query";
import { FACETS } from "@/lib/facets";

/**
 * 纹饰详情 —— 扁平模型。
 *
 * 去掉的区块（层级/关联时代的遗留）：式样列表、关联图谱、变种、标签、
 * 「加入排版」按钮（等打版工具做出来再接）。
 *
 * 六个分面**地位平等**，都由 `FACETS` 配置渲染 —— 不手写六遍，也不给
 * 朝代/题材任何特殊待遇。每个 chip 点下去就是带着该筛选条件回首页。
 */

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pattern = await getPatternById(parseInt(id));
  return { title: pattern ? `${pattern.name} — 中国传统纹饰` : "纹饰不存在" };
}

export default async function PatternDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patternId = parseInt(id);
  if (isNaN(patternId)) notFound();

  const pattern = await getPatternById(patternId);
  if (!pattern) notFound();

  // DB 里 type 是自由字符串；查看器只认这两类，非 vector 一律按 bitmap 处理
  const images = pattern.images.map((img) => ({
    ...img,
    type: (img.type === "vector" ? "vector" : "bitmap") as "bitmap" | "vector",
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Link
        href="/"
        className="mb-4 inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        ← 返回浏览
      </Link>

      {pattern.status !== "published" ? (
        <p className="mb-4 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground">
          该条目状态为「{pattern.status}」，尚未正式发布，仅通过直接链接可见。
        </p>
      ) : null}

      <div className="mb-8 grid gap-6 md:grid-cols-2">
        <div>
          <ImageViewer images={images} name={pattern.name} />
        </div>

        <div>
          <h1 className="mb-4 text-2xl font-bold">{pattern.name}</h1>

          <div className="mb-6 space-y-2.5 text-sm">
            {FACETS.map((f) => {
              const values = pattern.facets[f.key] ?? [];
              if (values.length === 0) return null;
              return (
                <div key={f.key} className="flex gap-3">
                  <span className="w-10 shrink-0 text-muted-foreground">{f.label}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {values.map((v) => (
                      <Badge
                        key={v.id}
                        variant="secondary"
                        className="font-normal"
                        data-testid="facet-chip"
                        data-facet={f.key}
                        data-value-id={v.id}
                        title={v.description ?? undefined}
                        render={<Link href={`/?${f.key}=${v.id}`} />}
                      >
                        {v.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground">
            点击任一标签，回首页按该条件筛选
          </p>
        </div>
      </div>

      {pattern.description ? (
        <Section title="描述">
          <p className="text-sm leading-relaxed">{pattern.description}</p>
        </Section>
      ) : null}

      {pattern.culturalMeaning ? (
        <Section title="文化含义">
          <p className="text-sm leading-relaxed">{pattern.culturalMeaning}</p>
        </Section>
      ) : null}

      {pattern.source || pattern.sourceUrl ? (
        <Section title="出处">
          <p className="text-sm">
            {pattern.source}
            {pattern.sourceUrl ? (
              <>
                {pattern.source ? " " : ""}
                <a
                  href={pattern.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-primary hover:underline"
                >
                  {pattern.sourceUrl}
                </a>
              </>
            ) : null}
          </p>
        </Section>
      ) : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h2>
      {children}
    </section>
  );
}
