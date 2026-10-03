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

  const relations = await prisma.relation.findMany({
    where: {
      OR: [{ patternAId: patternId }, { patternBId: patternId }],
    },
    include: {
      patternA: { select: { id: true, name: true, dynasty: true } },
      patternB: { select: { id: true, name: true, dynasty: true } },
    },
  });

  // Normalize: always return the "other" pattern
  const data = relations.map((r) => {
    const isReverse = r.patternBId === patternId;
    const other = isReverse ? r.patternA : r.patternB;
    return {
      id: r.id,
      pattern: other,
      relationType: r.relationType,
      description: r.description,
    };
  });

  return NextResponse.json({ data });
}
