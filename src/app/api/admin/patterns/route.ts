import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, alternateName, dynasty, periodStart, periodEnd, region, ethnicGroup, category, medium, description, culturalMeaning, source, sourceUrl, status } = body;

    if (!name || !dynasty || !category) {
      return NextResponse.json({ error: "name, dynasty, category 为必填字段" }, { status: 400 });
    }

    const pattern = await prisma.pattern.create({
      data: { name, alternateName, dynasty, periodStart, periodEnd, region, ethnicGroup, category, medium, description, culturalMeaning, source, sourceUrl, status: status || "draft" },
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
    const patterns = await prisma.pattern.findMany({
      orderBy: { createdAt: "desc" },
      include: { images: { take: 1 } },
    });
    const data = patterns.map((p) => ({
      id: p.id, name: p.name, dynasty: p.dynasty, category: p.category, status: p.status, medium: p.medium,
      thumbnail: p.images[0]?.url || null, createdAt: p.createdAt,
    }));
    return NextResponse.json({ data });
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
