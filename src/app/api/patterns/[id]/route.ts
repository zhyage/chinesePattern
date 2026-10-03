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
  };

  return NextResponse.json(result);
}
