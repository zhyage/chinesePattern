import Link from "next/link";
import { notFound } from "next/navigation";
import { FACETS } from "@/lib/facets";
import { getPendingById } from "@/lib/pending-query";
import { ReviewActions } from "./review-actions";

/**
 * 审核详情 —— **判断在这里做**（design.md §5.4）。
 *
 * 列表只是用来找的；真正要看清的是两张图和六个分面，
 * 所以这一页把它们全铺开，底部才放三个动作按钮。
 */

export const dynamic = "force-dynamic";

export default async function PendingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const pendingId = parseInt(id, 10);
  if (isNaN(pendingId)) notFound();

  const p = await getPendingById(pendingId);
  if (!p) notFound();

  const bitmap = p.images.find((i) => i.type === "bitmap");
  const vector = p.images.find((i) => i.type === "vector");
  const reviewed = p.status !== "pending";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">{p.name}</h1>
        <Link href="/admin/pending" className="text-sm text-muted-foreground hover:text-foreground">
          ← 返回队列
        </Link>
      </div>

      {reviewed ? (
        <p className="mb-6 rounded-lg border px-4 py-2 text-sm text-muted-foreground">
          这条已经是 <strong>{p.status}</strong> 状态
          {p.reviewNote ? ` —— 审核意见：${p.reviewNote}` : ""}，不能再审。
        </p>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        {[
          { label: "位图", url: bitmap?.url },
          { label: "矢量图", url: vector?.url },
        ].map((slot) => (
          <div key={slot.label}>
            <div className="mb-1 text-xs font-medium text-muted-foreground">{slot.label}</div>
            <div className="flex h-48 items-center justify-center overflow-hidden rounded-lg bg-muted p-2">
              {slot.url ? (
                // eslint-disable-next-line @next/next/no-img-element -- 素材是 SVG/位图混排
                <img
                  src={slot.url}
                  alt=""
                  data-testid="pending-image"
                  data-kind={slot.label}
                  className="h-full w-full object-scale-down"
                />
              ) : (
                <span className="text-xs text-muted-foreground">缺这张图</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <section className="mb-6 rounded-lg border p-4">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">分面</h2>
        <div className="space-y-2 text-sm">
          {FACETS.map((f) => {
            const picked = p.facets[f.key] ?? [];
            const suggested = p.suggestedFacets[f.key] ?? [];
            if (!picked.length && !suggested.length) return null;
            return (
              <div key={f.key} className="flex gap-3">
                <span className="w-10 shrink-0 text-muted-foreground">{f.label}</span>
                <div className="flex flex-wrap gap-1.5">
                  {picked.map((v) => (
                    <span key={v.id} className="rounded-full bg-secondary px-2 py-0.5 text-xs">
                      {v.name}
                    </span>
                  ))}
                  {/* 建议的新值要**显眼** —— 通过时它会变成查找表里的真实一行 */}
                  {suggested.map((n) => (
                    <span
                      key={n}
                      data-testid="pending-suggested"
                      className="rounded-full border border-dashed border-amber-500 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300"
                    >
                      {n} ·将新建
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {(p.description || p.culturalMeaning || p.source) && (
        <section className="mb-6 space-y-3 rounded-lg border p-4 text-sm">
          {p.description ? <Row label="描述" value={p.description} /> : null}
          {p.culturalMeaning ? <Row label="文化含义" value={p.culturalMeaning} /> : null}
          {p.source ? <Row label="出处" value={p.source} /> : null}
        </section>
      )}

      {!reviewed ? (
        <div className="border-t pt-4">
          <ReviewActions id={p.id} name={p.name} suggested={p.suggestedFacets} />
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-16 shrink-0 text-muted-foreground">{label}</span>
      <span className="leading-relaxed">{value}</span>
    </div>
  );
}
