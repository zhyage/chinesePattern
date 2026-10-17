"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Dialog } from "@base-ui/react/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * 审核三个动作：通过 / 编辑后通过 / 驳回（design.md §5.4）。
 *
 * 「通过」之前会**显式列出会被新建的查找表行** —— 那是这次审核真正要人拍板的东西，
 * 藏在后台自动做掉就等于没审。§5.4 的"建议值的落地"讲的就是这件事。
 */
export function ReviewActions({
  id,
  name,
  suggested,
  suggestedStatus,
}: {
  id: number;
  name: string;
  /** 形如 { motif: ["双喜纹"] }，通过时会被建进查找表 */
  suggested: Record<string, string[]>;
  /** 每个建议值的现状：新建 / 复用已停用的（要重新启用）/ 复用现成的 */
  suggestedStatus: Record<string, { name: string; exists: boolean; active: boolean }[]>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<null | "approve" | "reject">(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  // 分成三类，因为通过之后的结果完全不同：
  //   新建 / 重新启用（原来停用了，会变得可见）/ 复用现成的（什么都不会变）
  const all = Object.entries(suggestedStatus).flatMap(([k, items]) => items.map((i) => ({ facet: k, ...i })));
  const willCreate = all.filter((i) => !i.exists);
  const willReactivate = all.filter((i) => i.exists && !i.active);

  async function act(action: "approve" | "reject", reviewNote?: string) {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pending/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, note: reviewNote ?? "" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? `操作失败（${res.status}）`);
      setOpen(false);
      router.push("/admin/pending");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络错误");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {willCreate.length > 0 || willReactivate.length > 0 ? (
        <div
          data-testid="new-values-notice"
          className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
        >
          {willCreate.length > 0 ? (
            <div data-testid="will-create">
              通过会<strong>新建</strong>下列查找表行：
              <span className="ml-1 font-medium">{willCreate.map((v) => v.name).join("、")}</span>
            </div>
          ) : null}
          {willReactivate.length > 0 ? (
            <div data-testid="will-reactivate">
              通过会<strong>重新启用</strong>下列已停用的查找表行（它们会重新出现在前台筛选器里）：
              <span className="ml-1 font-medium">{willReactivate.map((v) => v.name).join("、")}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? (
        <p data-testid="review-error" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button data-testid="review-approve" disabled={busy !== null} onClick={() => act("approve")}>
          {busy === "approve" ? "通过中…" : "通过"}
        </Button>
        <Link
          href={`/admin/edit/pending/${id}`}
          data-testid="review-edit"
          className={buttonVariants({ variant: "outline" })}
        >
          编辑后通过
        </Link>

        <Dialog.Root
          open={open}
          onOpenChange={(n) => {
            setOpen(n);
            if (!n) setNote("");
          }}
        >
          <Dialog.Trigger
            render={
              <Button variant="ghost" data-testid="review-reject" disabled={busy !== null} />
            }
          >
            驳回
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50" />
            <Dialog.Popup
              data-testid="reject-dialog"
              className="fixed left-1/2 top-1/2 z-50 w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-background p-5 shadow-xl"
            >
              <Dialog.Title className="text-base font-semibold">驳回「{name}」</Dialog.Title>
              <Dialog.Description className="mt-2 text-sm text-muted-foreground">
                不会产生纹饰条目，暂存文件会被清掉。
              </Dialog.Description>
              <label className="mt-4 block text-sm">
                驳回原因：
                <Input
                  data-testid="reject-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="例如：名称与已有条目重复"
                  className="mt-1.5"
                />
              </label>
              <div className="mt-5 flex justify-end gap-2">
                <Dialog.Close render={<Button variant="outline" size="sm" />}>取消</Dialog.Close>
                <Button
                  size="sm"
                  variant="destructive"
                  data-testid="reject-confirm"
                  disabled={busy !== null}
                  onClick={() => act("reject", note)}
                >
                  {busy === "reject" ? "驳回中…" : "确认驳回"}
                </Button>
              </div>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </div>
  );
}
