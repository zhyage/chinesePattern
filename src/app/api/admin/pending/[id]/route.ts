import { NextRequest, NextResponse } from "next/server";
import { rm } from "node:fs/promises";
import prisma from "@/lib/db";
import { FACETS } from "@/lib/facets";
import { facetDelegate, getOrCreateOther, dropOtherIfHasConcrete } from "@/lib/facet-delegates";
import { validateImages, moveStagedImages } from "@/lib/pattern-image-files";
import { normalizePendingInput } from "@/lib/pending-input";
import { getPendingById } from "@/lib/pending-query";
import { resolvePendingFile } from "@/lib/pending-images";

/**
 * 审核一个待审件。
 *
 *   PATCH { action: "approve" }
 *   PATCH { action: "reject", note: "..." }
 *
 * 通过时的完整流程（design.md §3.5）：
 *   ① 把用户建议的新分面值**先插进对应的查找表**（如把"双喜纹"插进 motifs）
 *   ② 合并「已选中的 id」+「新建值的 id」
 *   ③ 某维度一个值都没有 → 挂该维度的「其它」行
 *   ④ 建 pattern + 六张中间表 + 图片记录（数据库部分放在一个事务里）
 *   ⑤ 把图片从 public/pending/ 移到 public/patterns/
 *   ⑥ 标记 pending 为 approved
 */


/**
 * 取分面值，不存在就创建。返回 id。
 *
 * 比对是 **trim + 全等**，刻意不做模糊匹配（design.md §5.4）：
 * 查找表不只当字典用，"云雷纹是什么"这段文字就存在 motif 的那一行上 ——
 * 猜错了会污染它，而污染是安静的、事后很难发现的。
 */
async function getOrCreateValue(modelKey: string, name: string): Promise<number> {
  const delegate = facetDelegate(prisma, modelKey);

  const existing = (await delegate.findUnique({
    where: { name },
    select: { id: true, active: true },
  })) as { id: number; active: boolean } | null;

  if (existing) {
    // ★ 命中一条**已停用**的行时，把它重新启用。
    //   原来这里直接复用 id 就走 —— 结果是条目挂着一个前台筛选器里看不到的值，
    //   而且审核页的黄框只说"会新建"，对这条静默复用只字不提。
    //   语义上也说得通：管理员点了"通过"，就是确认这个值要用。
    if (!existing.active) {
      await delegate.update({ where: { id: existing.id }, data: { active: true } });
    }
    return existing.id;
  }

  const created = (await delegate.create({ data: { name }, select: { id: true } })) as { id: number };
  return created.id;
}

/**
 * 单个待审件 —— 审核详情页用。
 *
 * 比列表多的是**把分面 id 解析成名字**：pending 里存的是 id 数组（§4.5），
 * 光有 id 没法在页面上显示"朝代：商 / 母题：双喜纹"。
 * 建议值本来就存名字，原样带出。
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const pendingId = parseInt(id, 10);
    if (isNaN(pendingId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const detail = await getPendingById(pendingId);
    if (!detail) return NextResponse.json({ error: "待审件不存在" }, { status: 404 });
    return NextResponse.json(detail);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * 改一条**未决**提交的内容（`/admin/edit/pending/[id]` 用它）。
 *
 * 与 PATCH 的分工：PATCH 是审核动作（通过 / 驳回），PUT 是改内容。
 * 两者混在一个方法里会让"action"变成一个大杂烩，而且校验规则完全不同。
 *
 * 只有 `status === "pending"` 的能改 —— 已通过/已驳回的改了没有意义，
 * 而且会让"审核记录"和"提交内容"对不上。
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const pendingId = parseInt(id, 10);
    if (isNaN(pendingId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const current = await prisma.pending.findUnique({ where: { id: pendingId }, select: { status: true } });
    if (!current) return NextResponse.json({ error: "待审件不存在" }, { status: 404 });
    if (current.status !== "pending") {
      return NextResponse.json(
        { error: `该件已是 ${current.status} 状态，不能再改内容` },
        { status: 409 },
      );
    }

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
    }

    // 与提交走同一套校验 —— 图片 URL 校验是安全边界，不能有第二份
    const result = normalizePendingInput(body);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

    const updated = await prisma.pending.update({ where: { id: pendingId }, data: result.data });
    return NextResponse.json({ data: { id: updated.id, name: updated.name } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const pendingId = parseInt(id);
    if (isNaN(pendingId)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const body = (await request.json()) as { action?: string; note?: string };
    const action = body.action;

    const pending = await prisma.pending.findUnique({ where: { id: pendingId } });
    if (!pending) return NextResponse.json({ error: "待审件不存在" }, { status: 404 });
    if (pending.status !== "pending") {
      return NextResponse.json({ error: `该件已是 ${pending.status} 状态，不能重复审核` }, { status: 409 });
    }

    // ── 驳回 ────────────────────────────────────────────────
    if (action === "reject") {
      const updated = await prisma.pending.update({
        where: { id: pendingId },
        data: { status: "rejected", reviewNote: body.note || null, reviewedAt: new Date() },
      });

      // 清掉暂存文件（design.md §5.4：「驳回 —— 不产生 pattern，清掉暂存文件」）。
      // 之前这里只改状态，文件一直留在 public/pending/ 里慢慢积垃圾。
      // best-effort：删除失败不影响驳回结果（状态已经落下去了）。
      const imgs = JSON.parse(pending.images) as { url: string }[];
      for (const img of imgs) {
        const abs = await resolvePendingFile(img.url);
        if (abs) {
          try {
            await rm(abs, { force: true });
          } catch (e) {
            console.error(`[驳回清理] 删除失败：${img.url}`, e);
          }
        }
      }

      return NextResponse.json({ data: updated });
    }

    if (action !== "approve") {
      return NextResponse.json({ error: 'action 必须是 "approve" 或 "reject"' }, { status: 400 });
    }

    // ── 通过 ────────────────────────────────────────────────
    const selected = JSON.parse(pending.facets) as Record<string, number[]>;
    const suggested = JSON.parse(pending.suggestedFacets) as Record<string, string[]>;
    const images = JSON.parse(pending.images) as { url: string; type: string }[];

    // ① 先建缺失的分面值
    const createdValues: Record<string, number[]> = {};
    for (const f of FACETS) {
      const names = suggested[f.key] ?? [];
      if (!names.length) continue;
      createdValues[f.key] = [];
      for (const name of names) {
        createdValues[f.key].push(await getOrCreateValue(f.model, name));
      }
    }

    // ②③ 每个维度算出最终要挂的 id 列表；空则挂「其它」
    const finalIds: Record<string, number[]> = {};
    for (const f of FACETS) {
      const ids = [...(selected[f.key] ?? []), ...(createdValues[f.key] ?? [])];
      const merged = ids.length ? [...new Set(ids)] : [await getOrCreateOther(prisma, f.model)];
      // 「其它」与同维具体值互斥（design.md §2.4）—— 提交端可能带着旧数据里
      // 「其它 + 苗族」这种组合进来，这里兜底去掉「其它」
      finalIds[f.key] = await dropOtherIfHasConcrete(prisma, f.model, merged);
    }

    // ⑤ 校验 + 搬图片。
    //    ★ 先**全部解析校验**，任何一个不合法就整体中止 —— 避免移到一半留下残局。
    //      校验内容包括：在 public/pending/ 之内、确实是文件（不是目录）、扩展名在白名单。
    //    这套逻辑与「编辑已发布条目」（PUT /api/admin/patterns/[id]）**共用一份**，
    //    见 src/lib/pattern-image-files.ts。
    const validated = await validateImages(images);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    const moved = await moveStagedImages(validated.images);

    // ④ 数据库部分放一个事务里
    const created = await prisma.$transaction(async (tx) => {
      const pattern = await tx.pattern.create({
        data: {
          name: pending.name,
          description: pending.description,
          culturalMeaning: pending.culturalMeaning,
          source: pending.source,
          sourceUrl: pending.sourceUrl,
          status: "published",
          images: { create: moved },
        },
      });

      for (const f of FACETS) {
        const delegate = (
          tx as unknown as Record<string, { createMany: (a: unknown) => Promise<unknown> }>
        )[f.junction];
        await delegate.createMany({
          data: finalIds[f.key].map((v) => ({ patternId: pattern.id, [f.fk]: v })),
        });
      }

      await tx.pending.update({
        where: { id: pendingId },
        data: { status: "approved", reviewNote: body.note || null, reviewedAt: new Date() },
      });

      return pattern;
    });

    return NextResponse.json({ data: { patternId: created.id, name: created.name } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
