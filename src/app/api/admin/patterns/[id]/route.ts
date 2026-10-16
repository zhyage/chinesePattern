import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/db";
import { validateParentId } from "@/lib/pattern-hierarchy";

async function getPatternId(params: Promise<{ id: string }>) {
  const { id } = await params;
  return parseInt(id);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = await getPatternId(params);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const body = await request.json();
    const { name, alternateName, dynasty, periodStart, periodEnd, region, ethnicGroup, category, medium, description, culturalMeaning, source, sourceUrl, status } = body;

    // parentId 未出现在 body 里 = 不改动层级；显式传 null = 提升为顶层
    const touchesParent = Object.prototype.hasOwnProperty.call(body, "parentId");
    let parentId: number | null | undefined;
    if (touchesParent) {
      const parent = await validateParentId(body.parentId, id);
      if (!parent.ok) {
        return NextResponse.json({ error: parent.error }, { status: parent.status });
      }
      parentId = parent.parentId;
    }

    const pattern = await prisma.pattern.update({
      where: { id },
      data: {
        name, alternateName, dynasty: dynasty || null, periodStart, periodEnd, region,
        ethnicGroup, category, medium, description, culturalMeaning, source, sourceUrl, status,
        ...(touchesParent ? { parentId } : {}),
      },
    });

    return NextResponse.json({ data: pattern });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "纹饰不存在" }, { status: 404 });
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = await getPatternId(params);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    // 有子项则拒绝删除。数据库层还有 ON DELETE RESTRICT 兜底（防并发），
    // 但先查一次才能给出可操作的 409，而不是泄漏原始约束错误。
    const target = await prisma.pattern.findUnique({
      where: { id },
      select: { id: true, _count: { select: { children: true } } },
    });
    if (!target) return NextResponse.json({ error: "纹饰不存在" }, { status: 404 });
    if (target._count.children > 0) {
      return NextResponse.json(
        {
          error: `该纹饰下还有 ${target._count.children} 个子项，请先删除或移走它们`,
          code: "HAS_CHILDREN",
        },
        { status: 409 },
      );
    }

    await prisma.pattern.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      // RESTRICT 兜底：上面的预检查与这里的删除之间有并发窗口
      if (e.code === "P2003") {
        return NextResponse.json({ error: "该纹饰下还有子项", code: "HAS_CHILDREN" }, { status: 409 });
      }
      if (e.code === "P2025") {
        return NextResponse.json({ error: "纹饰不存在" }, { status: 404 });
      }
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = await getPatternId(params);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const pattern = await prisma.pattern.findUnique({
      where: { id },
      include: {
        images: true,
        variations: true,
        tags: { include: { tag: true } },
        parent: { select: { id: true, name: true } },
        children: { select: { id: true, name: true }, orderBy: { id: "asc" } },
      },
    });
    if (!pattern) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ data: pattern });
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
