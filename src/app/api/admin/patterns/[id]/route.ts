import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

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

    const pattern = await prisma.pattern.update({
      where: { id },
      data: { name, alternateName, dynasty, periodStart, periodEnd, region, ethnicGroup, category, medium, description, culturalMeaning, source, sourceUrl, status },
    });

    return NextResponse.json({ data: pattern });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const id = await getPatternId(params);
    if (isNaN(id)) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    await prisma.pattern.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
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
      include: { images: true, variations: true, tags: { include: { tag: true } } },
    });
    if (!pattern) return NextResponse.json({ error: "Not found" }, { status: 404 });

    return NextResponse.json({ data: pattern });
  } catch (e) {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
