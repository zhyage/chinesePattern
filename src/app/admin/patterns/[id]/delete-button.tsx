"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * 删除条目 —— **要求手动输入名称才允许提交**（design.md §5.4）。
 *
 * 这不是"再点一次确定"那种走过场的确认：硬删会同时删掉图片文件，不可恢复。
 * 输入名称强制你确认删的是**哪一个**，而不是在列表里手滑点到哪一行。
 *
 * ⚠️ 服务端也会校验 `?confirm=<名称>` —— 只做客户端确认的话，它只是个减速带。
 */
export function DeleteButton({ id, name }: { id: number; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matched = typed === name;

  async function confirmDelete() {
    if (!matched) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/patterns/${id}?confirm=${encodeURIComponent(name)}`, {
        method: "DELETE",
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? `删除失败（${res.status}）`);
        return;
      }
      setOpen(false);
      // 删完刷新列表 —— 服务端组件会重新取数
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络错误");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setTyped("");
          setError(null);
        }
      }}
    >
      <Dialog.Trigger
        render={
          <Button
            variant="ghost"
            size="sm"
            data-testid="delete-pattern"
            data-pattern-id={id}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          />
        }
      >
        删除
      </Dialog.Trigger>

      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Popup
          data-testid="delete-dialog"
          className="fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-5 shadow-xl"
        >
          <Dialog.Title className="text-base font-semibold">删除「{name}」</Dialog.Title>
          <Dialog.Description className="mt-2 text-sm text-muted-foreground">
            这会**同时删掉它的图片文件**，且不可恢复。
          </Dialog.Description>

          <label className="mt-4 block text-sm">
            请输入名称以确认：
            <Input
              data-testid="delete-confirm-input"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={name}
              autoComplete="off"
              className="mt-1.5"
            />
          </label>

          {error ? (
            <p data-testid="delete-error" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          ) : null}

          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close render={<Button variant="outline" size="sm" />}>取消</Dialog.Close>
            <Button
              size="sm"
              variant="destructive"
              disabled={!matched || busy}
              onClick={confirmDelete}
              data-testid="delete-confirm"
            >
              {busy ? "删除中…" : "确认删除"}
            </Button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
