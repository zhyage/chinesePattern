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

  const variations = await prisma.variation.findMany({
    where: { patternId },
    include: { images: { orderBy: { sortOrder: "asc" } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ data: variations });
}
