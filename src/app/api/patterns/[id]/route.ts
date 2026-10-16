import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const patternId = parseInt(id);

  if (isNaN(patternId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const pattern = await prisma.pattern.findUnique({
    where: { id: patternId },
    include: {
      images: { orderBy: { sortOrder: "asc" } },
      variations: {
        include: { images: { orderBy: { sortOrder: "asc" } } },
        orderBy: { createdAt: "asc" },
      },
      tags: {
        include: { tag: true },
      },
      // 子项（式样）：有则在详情页渲染「式样」区块。空数组 = 单形态纹样，不渲染该区块。
      children: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          name: true,
          alternateName: true,
          dynasty: true,
          category: true,
          medium: true,
          images: { where: { isPrimary: true }, take: 1, select: { url: true, type: true } },
        },
      },
      // 父条目：有则在详情页显示面包屑
      parent: { select: { id: true, name: true } },
    },
  });

  if (!pattern) {
    return NextResponse.json({ error: "Pattern not found" }, { status: 404 });
  }

  // Get relations
  const relations = await prisma.relation.findMany({
    where: {
      OR: [{ patternAId: patternId }, { patternBId: patternId }],
    },
    include: {
      patternA: {
        select: { id: true, name: true, dynasty: true, category: true },
      },
      patternB: {
        select: { id: true, name: true, dynasty: true, category: true },
      },
    },
  });

  // Normalize relations so each entry has "pattern" and "relationType"
  const normalizedRelations = relations.map((r) => {
    const isReverse = r.patternBId === patternId;
    return {
      id: r.id,
      pattern: isReverse
        ? { id: r.patternA.id, name: r.patternA.name, dynasty: r.patternA.dynasty, category: r.patternA.category }
        : { id: r.patternB.id, name: r.patternB.name, dynasty: r.patternB.dynasty, category: r.patternB.category },
      relationType: r.relationType,
      description: r.description,
    };
  });

  const result = {
    id: pattern.id,
    name: pattern.name,
    alternateName: pattern.alternateName,
    dynasty: pattern.dynasty,
    periodStart: pattern.periodStart,
    periodEnd: pattern.periodEnd,
    region: pattern.region,
    ethnicGroup: pattern.ethnicGroup,
    category: pattern.category,
    medium: pattern.medium,
    description: pattern.description,
    culturalMeaning: pattern.culturalMeaning,
    source: pattern.source,
    sourceUrl: pattern.sourceUrl,
    images: pattern.images.map((img) => ({
      id: img.id,
      url: img.url,
      type: img.type,
      purpose: img.purpose,
      label: img.label,
      isPrimary: img.isPrimary,
    })),
    variations: pattern.variations.map((v) => ({
      id: v.id,
      variantName: v.variantName,
      dynasty: v.dynasty,
      region: v.region,
      description: v.description,
      periodStart: v.periodStart,
      periodEnd: v.periodEnd,
      images: v.images.map((img) => ({
        id: img.id,
        url: img.url,
        type: img.type,
        purpose: img.purpose,
        label: img.label,
      })),
    })),
    relations: normalizedRelations,
    tags: pattern.tags.map((pt) => ({
      id: pt.tag.id,
      name: pt.tag.name,
      type: pt.tag.type,
    })),
    /** 子项（式样）。空数组 = 单形态纹样 */
    children: pattern.children.map((c) => ({
      id: c.id,
      name: c.name,
      alternateName: c.alternateName,
      dynasty: c.dynasty,
      category: c.category,
      medium: c.medium,
      thumbnail: c.images[0]?.url ?? null,
      thumbnailType: c.images[0]?.type ?? null,
    })),
    /** 父条目，用于面包屑。null = 顶层 */
    parent: pattern.parent,
  };

  return NextResponse.json(result);
}
