import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { FACETS, FACET_KEYS, type FacetKey } from "@/lib/facets";
import { facetDelegate } from "@/lib/facet-delegates";
import { listFacetsForAdmin } from "@/lib/patterns-query";

/**
 * 管理后台的查找表接口（design.md §5.5）。
 *
 * 和公开的 `/api/facets` 的区别：
 *   - 公开接口只给**可选**值（`active: true`）且只统计已发布的 pattern
 *   - 这里给**全部**值（含已停用），计数含**所有状态**的 pattern ——
 *     管理员要据此判断"这一行还有没有人在用"
 *
 * **没有 DELETE。** 停用是唯一的"删除"方式（§5.5）：硬删会级联删掉中间表记录，
 * 等于悄悄改动了所有引用它的 pattern 的分类。
 */

export async function GET() {
  try {
    return NextResponse.json({ data: await listFacetsForAdmin() });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }

  const b = (body ?? {}) as Record<string, unknown>;
  const facet = b.facet;

  if (typeof facet !== "string" || !FACET_KEYS.includes(facet as FacetKey)) {
    return NextResponse.json(
      { error: `facet 必须是 ${FACET_KEYS.join(" / ")} 之一` },
      { status: 400 },
    );
  }

  const name = typeof b.name === "string" ? b.name.trim() : "";
  if (!name) return NextResponse.json({ error: "name 为必填字段" }, { status: 400 });

  const model = FACETS.find((f) => f.key === facet)!.model;
  const delegate = facetDelegate(prisma, model);

  // name 上的唯一索引不分启用/停用，所以重名要在这里拦，并且说清是哪种情况
  const existing = (await delegate.findUnique({ where: { name }, select: { id: true, active: true } })) as
    | { id: number; active: boolean }
    | null;

  if (existing) {
    return NextResponse.json(
      {
        error: existing.active
          ? `「${name}」已存在`
          : `「${name}」已存在，但处于停用状态 —— 在列表里重新启用它，而不是新建一行`,
      },
      { status: 409 },
    );
  }

  const created = (await delegate.create({
    data: {
      name,
      description: (b.description as string)?.trim() || null,
      culturalMeaning: (b.culturalMeaning as string)?.trim() || null,
    },
    select: { id: true },
  })) as { id: number };

  return NextResponse.json({ success: true, id: created.id }, { status: 201 });
}
