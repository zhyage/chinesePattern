import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { FACETS, parseIds } from "@/lib/facets";
import { facetDelegate } from "@/lib/facet-delegates";
import {
  validateImages,
  moveStagedImages,
  deleteUnreferencedFiles,
} from "@/lib/pattern-image-files";

/** 管理后台：读取 / 编辑 / 删除**已落库**的纹饰 */

async function getId(params: Promise<{ id: string }>) {
  const { id } = await params;
  return parseInt(id);
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = await getId(params);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const facetInclude = Object.fromEntries(
      FACETS.map((f) => [f.relation, { include: { [f.model]: true } }]),
    );

    const p = await prisma.pattern.findUnique({
      where: { id },
      include: { images: { orderBy: { sortOrder: "asc" } }, ...facetInclude },
    });
    if (!p) return NextResponse.json({ error: "纹饰不存在" }, { status: 404 });

    const row = p as unknown as Record<string, unknown>;
    const facets: Record<string, { id: number; name: string }[]> = {};
    for (const f of FACETS) {
      const links = (row[f.relation] ?? []) as Record<string, { id: number; name: string }>[];
      facets[f.key] = links.map((l) => l[f.model]).filter(Boolean);
    }

    return NextResponse.json({
      id: p.id,
      name: p.name,
      description: p.description,
      culturalMeaning: p.culturalMeaning,
      source: p.source,
      sourceUrl: p.sourceUrl,
      status: p.status,
      images: p.images,
      facets,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * 编辑一条**已发布**的条目 —— 保存即生效，不进审核队列（design.md §5.4）。
 *
 * 处理顺序是刻意的：**先全部校验 → 再搬文件 → 再写库 → 提交后才删旧文件**。
 * 反过来（先写库）失败时，库里的 URL 会指向不存在的文件，对外就是破图；
 * 现在失败只留孤儿文件，浪费磁盘而已。
 */
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = await getId(params);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
    }

    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ error: "name 为必填字段" }, { status: 400 });

    const exists = await prisma.pattern.findUnique({ where: { id }, select: { id: true } });
    if (!exists) return NextResponse.json({ error: "纹饰不存在" }, { status: 404 });

    const facets = (body.facets ?? {}) as Record<string, unknown>;

    /**
     * status 单独处理：**没传就保持原值，绝不猜。**
     *
     * 原来这里写的是 `status: (body.status as string) || "draft"` ——
     * 于是"保存一次编辑"会把已发布的条目**悄悄下架**（draft 不在前台显示），
     * 而界面上又没有地方能改回来。破坏性的默认值比报错糟糕得多：
     * 报错当场就能发现，静默改状态要等到某天发现条目不见了。
     */
    const ALLOWED_STATUS = ["draft", "published", "rejected"];
    let nextStatus: string | undefined;
    if (body.status !== undefined) {
      if (typeof body.status !== "string" || !ALLOWED_STATUS.includes(body.status)) {
        return NextResponse.json(
          { error: `status 必须是 ${ALLOWED_STATUS.join(" / ")} 之一` },
          { status: 400 },
        );
      }
      nextStatus = body.status;
    }

    // ── ① 校验：分面 id 必须真实存在，图片必须合法 ──────────────
    //   这两项以前都不校验：坏 id 会撞外键报错返回 500，坏图片 URL 根本没人看。
    const parsedFacets: Record<string, number[]> = {};
    for (const f of FACETS) {
      const raw = facets[f.key];
      const ids = parseIds(Array.isArray(raw) ? raw.join(",") : (raw as string));
      if (!ids.length) continue; // 空 = 挂「其它」，无需校验

      const found = (await facetDelegate(prisma, f.model).findMany({
        where: { id: { in: ids } },
        select: { id: true },
      })) as { id: number }[];

      const missing = ids.filter((v) => !found.some((x) => x.id === v));
      if (missing.length) {
        return NextResponse.json(
          { error: `${f.label}里不存在这些值：${missing.join("、")}` },
          { status: 400 },
        );
      }
      parsedFacets[f.key] = ids;
    }

    const validated = await validateImages(body.images);
    if (!validated.ok) return NextResponse.json({ error: validated.error }, { status: 400 });

    // ── ② 搬文件（暂存区的搬进 patterns/，已有的原样留）────────
    const before = (await prisma.patternImage.findMany({
      where: { patternId: id },
      select: { url: true },
    })) as { url: string }[];

    const stored = await moveStagedImages(validated.images);

    // ── ③ 写库 ────────────────────────────────────────────
    await prisma.$transaction(async (tx) => {
      await tx.pattern.update({
        where: { id },
        data: {
          name,
          description: (body.description as string) || null,
          culturalMeaning: (body.culturalMeaning as string) || null,
          source: (body.source as string) || null,
          sourceUrl: (body.sourceUrl as string) || null,
          // 没传 status 就不动它（见上面那段注释）
          ...(nextStatus === undefined ? {} : { status: nextStatus }),
        },
      });

      // 分面整体替换：先清空该维度的关联，再按提交的值重建。
      // 某维度提交为空 = 挂「其它」。
      for (const f of FACETS) {
        const delegate = (
          tx as unknown as Record<string, {
            deleteMany: (a: unknown) => Promise<unknown>;
            createMany: (a: unknown) => Promise<unknown>;
            findUnique: (a: unknown) => Promise<{ id: number } | null>;
            create: (a: unknown) => Promise<{ id: number }>;
          }>
        )[f.junction];

        await delegate.deleteMany({ where: { patternId: id } });

        let finalIds = parsedFacets[f.key] ?? [];
        if (!finalIds.length) {
          // 兜底挂「其它」—— 该维度一个值都没选时
          const table = (tx as unknown as Record<string, {
            findUnique: (a: unknown) => Promise<{ id: number } | null>;
            create: (a: unknown) => Promise<{ id: number }>;
          }>)[f.model];
          const other =
            (await table.findUnique({ where: { name: "其它" }, select: { id: true } })) ??
            (await table.create({ data: { name: "其它" }, select: { id: true } }));
          finalIds = [other.id];
        }

        await delegate.createMany({
          data: finalIds.map((v) => ({ patternId: id, [f.fk]: v })),
        });
      }

      // 图片整套替换
      await tx.patternImage.deleteMany({ where: { patternId: id } });
      await tx.patternImage.createMany({
        data: stored.map((s) => ({ patternId: id, ...s })),
      });
    });

    // ── ④ 提交成功之后才清旧文件 ────────────────────────────
    //   必须放在事务之后：提前删的话事务一失败，库还指着已删掉的文件。
    //   不再被引用的才删（可能被别的 pattern 共用）。
    const keptUrls = new Set(stored.map((s) => s.url));
    await deleteUnreferencedFiles(before.map((b) => b.url).filter((u) => !keptUrls.has(u)));

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * 硬删一条条目（design.md §5.4）。
 *
 * **要求带着条目名称才能删**：`DELETE /api/admin/patterns/3?confirm=云雷纹·圆雷`。
 * 界面上那道"手动输入名称"的确认框如果只在客户端做，就只是个减速带 ——
 * 服务端也校验一次，它才是真正的闸门。
 *
 * 图片文件也真删（先确认没有别的行引用）。顺序不能反：
 * 必须先删数据库行，引用计数才会归零。
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = await getId(params);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const pattern = (await prisma.pattern.findUnique({
      where: { id },
      select: { id: true, name: true, images: { select: { url: true } } },
    })) as { id: number; name: string; images: { url: string }[] } | null;
    if (!pattern) return NextResponse.json({ error: "纹饰不存在" }, { status: 404 });

    const confirm = new URL(request.url).searchParams.get("confirm");
    if (confirm !== pattern.name) {
      return NextResponse.json(
        { error: `删除确认不匹配。要删「${pattern.name}」，请把名称原样传进 confirm 参数` },
        { status: 400 },
      );
    }

    // 六张中间表与 pattern_images 都是 onDelete: Cascade，会自动清掉
    await prisma.pattern.delete({ where: { id } });

    // 行删完之后再删文件 —— 这时引用计数才是准的
    await deleteUnreferencedFiles(pattern.images.map((i) => i.url));

    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
