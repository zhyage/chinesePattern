import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { validateParentId } from "@/lib/pattern-hierarchy";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, alternateName, dynasty, periodStart, periodEnd, region, ethnicGroup, category, medium, description, culturalMeaning, source, sourceUrl, status } = body;

    // dynasty 不再是必填 —— 粗粒度朝代可考，精细断代不做，无法准确考证时留空，不编造
    if (!name || !category) {
      return NextResponse.json({ error: "name, category 为必填字段" }, { status: 400 });
    }

    const parent = await validateParentId(body.parentId, null);
    if (!parent.ok) {
      return NextResponse.json({ error: parent.error }, { status: parent.status });
    }

    const pattern = await prisma.pattern.create({
      data: {
        name, alternateName, dynasty: dynasty || null, periodStart, periodEnd, region,
        ethnicGroup, category, medium, description, culturalMeaning, source, sourceUrl,
        status: status || "draft",
        parentId: parent.parentId,
      },
    });

    // If tag names provided, create associations
    if (body.tags && Array.isArray(body.tags)) {
      for (const tagName of body.tags) {
        const tag = await prisma.tag.findFirst({ where: { name: tagName } });
        if (tag) {
          await prisma.patternTag.create({ data: { patternId: pattern.id, tagId: tag.id } });
        }
      }
    }

    return NextResponse.json({ data: pattern }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function GET() {
  try {
    // 管理后台看全部层级，不做 parentId 过滤
    const patterns = await prisma.pattern.findMany({
      orderBy: { createdAt: "desc" },
      include: { images: { take: 1 }, _count: { select: { children: true } } },
    });
    const data = patterns.map((p) => ({
      id: p.id, name: p.name, dynasty: p.dynasty, category: p.category, status: p.status, medium: p.medium,
      thumbnail: p.images[0]?.url || null, createdAt: p.createdAt,
      parentId: p.parentId, childCount: p._count.children,
    }));
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
