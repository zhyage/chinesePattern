"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AdminFacetValue } from "@/lib/patterns-query";

/**
 * 查找表的一行（design.md §5.5）。
 *
 * 「停用」而不是删除，是因为**硬删会级联删掉中间表记录** ——
 * 等于悄悄改动了所有引用它的 pattern 的分类，而且不可见。
 * 停用只影响它在筛选器可选列表里的显示。
 *
 * 引用数（count）**含未发布条目** —— 管理员据此判断这一行还有没有人在用。
 */
export function FacetRow({ facet, value }: { facet: string; value: AdminFacetValue }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(value.name);
  const [description, setDescription] = useState(value.description ?? "");
  const [culturalMeaning, setCulturalMeaning] = useState(value.culturalMeaning ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function patch(data: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/facets/${facet}/${value.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? `保存失败（${res.status}）`);
        return false;
      }
      setEditing(false);
      router.refresh();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络错误");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setName(value.name);
    setDescription(value.description ?? "");
    setCulturalMeaning(value.culturalMeaning ?? "");
    setError(null);
    setEditing(false);
  }

  return (
    <li
      data-testid="facet-row"
      data-facet={facet}
      data-value-id={value.id}
      data-active={value.active ? "true" : "false"}
      className={`flex items-start gap-3 p-3 ${value.active ? "" : "opacity-60"}`}
    >
      <span className="w-8 shrink-0 pt-1 text-xs tabular-nums text-muted-foreground">{value.id}</span>

      {editing ? (
        <div className="min-w-0 flex-1 space-y-1.5">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            data-testid="facet-name-input"
            aria-label="名称"
            placeholder="名称"
          />
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            aria-label="说明"
            placeholder="说明（筛选器里的悬停提示）"
          />
          <Input
            value={culturalMeaning}
            onChange={(e) => setCulturalMeaning(e.target.value)}
            aria-label="文化含义"
            placeholder="文化含义"
          />
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
      ) : (
        <div className="min-w-0 flex-1 pt-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{value.name}</span>
            {!value.active ? (
              <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">已停用</span>
            ) : null}
          </div>
          {value.description ? (
            <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{value.description}</p>
          ) : null}
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
      )}

      <span
        className="shrink-0 pt-1 text-xs tabular-nums text-muted-foreground"
        title="引用它的纹饰条数（含草稿）"
      >
        {value.count} 条在用
      </span>

      <div className="flex shrink-0 gap-1">
        {editing ? (
          <>
            <Button
              size="sm"
              disabled={busy || !name.trim()}
              data-testid="facet-save"
              onClick={() => patch({ name, description, culturalMeaning })}
            >
              保存
            </Button>
            <Button size="sm" variant="outline" onClick={cancel} disabled={busy}>
              取消
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" variant="ghost" data-testid="facet-edit" onClick={() => setEditing(true)}>
              编辑
            </Button>
            <Button
              size="sm"
              variant="ghost"
              data-testid="facet-toggle"
              disabled={busy}
              onClick={() => patch({ active: !value.active })}
            >
              {value.active ? "停用" : "启用"}
            </Button>
          </>
        )}
      </div>
    </li>
  );
}
