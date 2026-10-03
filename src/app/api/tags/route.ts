import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET() {
  const tags = await prisma.tag.findMany({
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  // Group by type for easier frontend consumption
  const grouped: Record<string, { name: string; count?: number }[]> = {};
  for (const tag of tags) {
    if (!grouped[tag.type]) grouped[tag.type] = [];
    grouped[tag.type].push({ name: tag.name });
  }

  return NextResponse.json({ tags, grouped });
}
