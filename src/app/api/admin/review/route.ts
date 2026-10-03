import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET() {
  try {
    const patterns = await prisma.pattern.findMany({
      where: { status: "draft" },
      orderBy: { createdAt: "desc" },
      include: { images: { take: 1 } },
    });
    const data = patterns.map((p) => ({
      id: p.id, name: p.name, dynasty: p.dynasty, category: p.category, medium: p.medium,
      status: p.status, thumbnail: p.images[0]?.url || null, source: p.source, createdAt: p.createdAt,
      hasBitmap: p.images.some((img) => img.type === "bitmap"),
      hasVector: p.images.some((img) => img.type === "vector"),
    }));
    return NextResponse.json({ data, total: data.length });
  } catch {
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status } = body;
    if (!id || !status) return NextResponse.json({ error: "id, status 必填" }, { status: 400 });

    await prisma.pattern.update({ where: { id: parseInt(id) }, data: { status } });
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
