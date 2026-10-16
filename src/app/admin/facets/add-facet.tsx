"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * 新增一行查找表。
 *
 * 重名由服务端拦（`name` 上有唯一索引，不分启用停用），
 * 并且会把"已存在"和"已存在但停用"分开提示 —— 后者应该去启用它而不是新建一行。
 */
export function AddFacet({ facet }: { facet: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/facets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facet, name: trimmed }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? `新增失败（${res.status}）`);
        return;
      }
      setName("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "网络错误");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex items-start gap-2 border-t p-3">
      <div className="min-w-0 flex-1">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          data-testid="add-facet-input"
          placeholder="新增一行…"
          aria-label="新增查找表值"
          autoComplete="off"
        />
        {error ? (
          <p data-testid="add-facet-error" className="mt-1 text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>
      <Button type="submit" size="sm" disabled={busy || !name.trim()} data-testid="add-facet-submit">
        {busy ? "新增中…" : "新增"}
      </Button>
    </form>
  );
}
