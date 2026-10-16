"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * 纹饰编辑器 —— **三个入口共用同一个组件**（design.md §5.4）。
 *
 * 三者的字段完全一样，差别只在"存到哪"：
 *
 *   新建        POST /api/admin/pending          → 进审核队列
 *   改未决件    PUT  /api/admin/pending/[id]     → 原地更新，仍待审
 *   改已发布    PUT  /api/admin/patterns/[id]    → **保存即生效**
 *
 * 拆成三个组件必然漂移，所以这里靠 `mode` 分支，而不是复制三份。
 */

export interface EditorFacetGroup {
  key: string;
  label: string;
  values: { id: number; name: string; active: boolean }[];
}

export interface EditorInitial {
  name?: string;
  description?: string | null;
  culturalMeaning?: string | null;
  source?: string | null;
  sourceUrl?: string | null;
  /** 只在 `pattern` 模式下有意义 —— 新建/待审的状态由流程决定（通过即发布） */
  status?: string;
  facets?: Record<string, number[]>;
  suggestedFacets?: Record<string, string[]>;
  images?: { url: string; type: string }[];
}

interface Props {
  mode: "new" | "pending" | "pattern";
  groups: EditorFacetGroup[];
  initial?: EditorInitial;
  pendingId?: number;
  patternId?: number;
}

const OTHER = "其它";

export function PatternEditor({ mode, groups, initial, pendingId, patternId }: Props) {
  const router = useRouter();

  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [culturalMeaning, setCulturalMeaning] = useState(initial?.culturalMeaning ?? "");
  const [source, setSource] = useState(initial?.source ?? "");
  const [sourceUrl, setSourceUrl] = useState(initial?.sourceUrl ?? "");
  const [status, setStatus] = useState(initial?.status ?? "published");

  const [selected, setSelected] = useState<Record<string, number[]>>(initial?.facets ?? {});
  const [suggested, setSuggested] = useState<Record<string, string[]>>(initial?.suggestedFacets ?? {});

  const [bitmap, setBitmap] = useState<string | null>(
    initial?.images?.find((i) => i.type === "bitmap")?.url ?? null,
  );
  const [vector, setVector] = useState<string | null>(
    initial?.images?.find((i) => i.type === "vector")?.url ?? null,
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const ready = name.trim() && bitmap && vector;

  /**
   * 已停用的值**只在当前条目已经在用它时才显示**。
   * 全都显示的话，新建时会看到一堆停用项（停用就是为了别再选它们）；
   * 全都不显示的话，编辑一条引用了停用值的旧条目就无解了。
   */
  const keepIds = useRef(new Set(Object.values(initial?.facets ?? {}).flat())).current;
  const visibleGroups = groups.map((g) => ({
    ...g,
    values: g.values.filter((v) => v.active || keepIds.has(v.id)),
  }));

  function toggle(key: string, id: number) {
    setSelected((prev) => {
      const cur = prev[key] ?? [];
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      return { ...prev, [key]: next };
    });
  }

  function addSuggested(key: string, raw: string) {
    const v = raw.trim();
    if (!v) return;
    setSuggested((prev) => {
      const cur = prev[key] ?? [];
      if (cur.includes(v)) return prev;
      return { ...prev, [key]: [...cur, v] };
    });
  }

  /**
   * 已发布条目的保存路径：`PUT` 只接受**已存在**的分面 id，
   * 所以建议值要在这里先落成查找表行，再把 id 一起提交。
   * （走 pending 的两条路不用这么做 —— 新值由审核通过时创建，见 §5.4）
   */
  async function materializeSuggested(): Promise<Record<string, number[]>> {
    const out: Record<string, number[]> = {};
    for (const [key, names] of Object.entries(suggested)) {
      if (!names.length) continue;
      out[key] = [];
      for (const nm of names) {
        const res = await fetch("/api/admin/facets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ facet: key, name: nm }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? `新建分面值「${nm}」失败`);
        out[key].push(body.id);
      }
    }
    return out;
  }

  async function save() {
    if (!ready) return;
    setBusy(true);
    setError(null);

    try {
      if (mode === "pattern") {
        const created = await materializeSuggested();
        const facets: Record<string, number[]> = { ...selected };
        for (const [k, ids] of Object.entries(created)) {
          facets[k] = [...(facets[k] ?? []), ...ids];
        }

        const res = await fetch(`/api/admin/patterns/${patternId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name,
            description,
            culturalMeaning,
            source,
            sourceUrl,
            status,
            facets,
            images: [
              { url: bitmap, type: "bitmap", isPrimary: true, sortOrder: 0, label: "位图" },
              { url: vector, type: "vector", isPrimary: false, sortOrder: 1, label: "矢量图" },
            ],
          }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error ?? `保存失败（${res.status}）`);
        setSavedAt(new Date().toLocaleTimeString("zh-CN", { hour12: false }));
        setSuggested({}); // 新值已经落成真实行，不再算"建议"
        router.refresh();
        return;
      }

      const payload = {
        name,
        description,
        culturalMeaning,
        source,
        sourceUrl,
        facets: selected,
        suggestedFacets: suggested,
        images: [
          { url: bitmap, type: "bitmap" },
          { url: vector, type: "vector" },
        ],
      };

      const res =
        mode === "new"
          ? await fetch("/api/admin/pending", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            })
          : await fetch(`/api/admin/pending/${pendingId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `提交失败（${res.status}）`);

      // 新建 → 去队列看它；改未决件 → 留在原地
      if (mode === "new") router.push("/admin/pending");
      else {
        setSavedAt(new Date().toLocaleTimeString("zh-CN", { hour12: false }));
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络错误");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      {savedAt ? (
        <div data-testid="editor-saved" className="rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-200">
          已保存 · {savedAt}
        </div>
      ) : null}

      <Section title="基本信息">
        <Field label="名称" required>
          <Input data-testid="editor-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="描述">
          <Input data-testid="editor-description" value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Field label="文化含义">
          <Input
            data-testid="editor-cultural-meaning"
            value={culturalMeaning}
            onChange={(e) => setCulturalMeaning(e.target.value)}
          />
        </Field>
        <Field label="出处">
          <Input data-testid="editor-source" value={source} onChange={(e) => setSource(e.target.value)} />
        </Field>
        <Field label="出处链接">
          <Input data-testid="editor-source-url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
        </Field>

        {/* 状态只有"改已发布条目"才需要选 —— 新建和待审的状态由流程决定 */}
        {mode === "pattern" ? (
          <Field label="状态">
            <select
              data-testid="editor-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm"
            >
              <option value="published">published —— 前台可见</option>
              <option value="draft">draft —— 前台不可见</option>
              <option value="rejected">rejected —— 已驳回</option>
            </select>
          </Field>
        ) : null}
      </Section>

      <Section title="分面">
        <p className="mb-2 text-xs text-muted-foreground">
          一个都不选的维度会挂「{OTHER}」。查找表里没有的值，填在下面的输入框里新建。
        </p>
        {visibleGroups.map((g) => (
          <div key={g.key} data-testid="editor-facet-group" data-facet={g.key} className="border-t py-3 first:border-t-0">
            <div className="mb-2 text-sm font-medium">{g.label}</div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {g.values.map((v) => {
                const on = (selected[g.key] ?? []).includes(v.id);
                return (
                  <button
                    key={v.id}
                    type="button"
                    data-testid="editor-facet-option"
                    data-value-id={v.id}
                    data-checked={on ? "true" : "false"}
                    onClick={() => toggle(g.key, v.id)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-sm transition-colors",
                      on ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted",
                      // 已停用的值仍要能勾选 —— 编辑一条引用了它的旧条目时不该无解
                      !v.active && !on && "text-muted-foreground/60",
                    )}
                    title={v.active ? undefined : "已停用（仍可勾选，但不出现在前台筛选器里）"}
                  >
                    {v.name}
                    {!v.active ? " ·停用" : ""}
                  </button>
                );
              })}
            </div>

            {(suggested[g.key] ?? []).length ? (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {(suggested[g.key] ?? []).map((nm) => (
                  <span
                    key={nm}
                    data-testid="editor-suggested"
                    className="inline-flex items-center gap-1 rounded-full border border-dashed border-primary px-2.5 py-1 text-sm text-primary"
                  >
                    {nm} ·新
                    <button
                      type="button"
                      aria-label={`移除建议值 ${nm}`}
                      onClick={() =>
                        setSuggested((p) => ({ ...p, [g.key]: (p[g.key] ?? []).filter((x) => x !== nm) }))
                      }
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            ) : null}

            <NewValueInput onAdd={(v) => addSuggested(g.key, v)} label={g.label} />
          </div>
        ))}
      </Section>

      <Section title="图片">
        <p className="mb-2 text-xs text-muted-foreground">
          两张都必填。只接受上传，**不能填外部 URL** —— 那是一条路径穿越漏洞的入口。
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ImageSlot label="位图" kind="bitmap" value={bitmap} onChange={setBitmap} />
          <ImageSlot label="矢量图" kind="vector" value={vector} onChange={setVector} />
        </div>
      </Section>

      {error ? (
        <p data-testid="editor-error" className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <Button
          data-testid="editor-submit"
          disabled={!ready || busy}
          onClick={save}
          size="lg"
          className="min-w-32"
        >
          {busy ? "提交中…" : mode === "pattern" ? "保存" : "提交审核"}
        </Button>
        {!ready ? (
          <span className="text-xs text-muted-foreground">名称、位图、矢量图都填齐才能提交</span>
        ) : null}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border p-4">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="mb-2 flex items-center gap-3 text-sm">
      <span className="w-20 shrink-0 text-muted-foreground">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </span>
      {children}
    </label>
  );
}

function NewValueInput({ onAdd, label }: { onAdd: (v: string) => void; label: string }) {
  const [v, setV] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onAdd(v);
        setV("");
      }}
      className="flex gap-2"
    >
      <Input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={`＋ 新建${label}值…`}
        aria-label={`新建${label}值`}
        data-testid="editor-new-value"
        className="max-w-60"
        autoComplete="off"
      />
      <Button type="submit" size="sm" variant="outline" disabled={!v.trim()}>
        新建
      </Button>
    </form>
  );
}

function ImageSlot({
  label,
  kind,
  value,
  onChange,
}: {
  label: string;
  kind: "bitmap" | "vector";
  value: string | null;
  onChange: (url: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: fd });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `上传失败（${res.status}）`);
      onChange(body.data.url);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "上传失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      data-testid="image-slot"
      data-kind={kind}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) void upload(f);
      }}
      className={cn(
        "rounded-lg border-2 border-dashed p-3 transition-colors",
        dragOver ? "border-primary bg-primary/5" : "border-input",
      )}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">
          {label} <span className="text-destructive">*</span>
        </span>
        {value ? (
          <button
            type="button"
            data-testid="image-clear"
            className="text-xs text-muted-foreground hover:text-foreground"
            onClick={() => onChange(null)}
          >
            移除
          </button>
        ) : null}
      </div>

      <div className="flex h-28 items-center justify-center overflow-hidden rounded bg-muted">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element -- SVG/位图混排
          <img src={value} alt="" data-testid="image-preview" className="h-full w-full object-scale-down" />
        ) : (
          <span className="text-xs text-muted-foreground">{busy ? "上传中…" : "拖拽文件到这里，或点下面的按钮"}</span>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept=".svg,.png,.jpg,.jpeg,.webp"
        className="hidden"
        data-testid="image-file-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = "";
        }}
      />

      <div className="mt-2 flex items-center gap-2">
        <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => inputRef.current?.click()}>
          {value ? "替换" : "选择文件"}
        </Button>
        {value ? <span className="truncate text-xs text-muted-foreground">{value}</span> : null}
      </div>

      {err ? <p className="mt-1 text-xs text-destructive">{err}</p> : null}
    </div>
  );
}
