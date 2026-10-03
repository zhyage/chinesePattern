import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { patternAId, patternBId, relationType, description } = body;

    if (!patternAId || !patternBId || !relationType) {
      return NextResponse.json({ error: "patternAId, patternBId, relationType 为必填字段" }, { status: 400 });
    }

    const relation = await prisma.relation.create({
      data: { patternAId: parseInt(patternAId), patternBId: parseInt(patternBId), relationType, description },
    });

    return NextResponse.json({ data: relation }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = parseInt(searchParams.get("id") || "");
    if (!id) return NextResponse.json({ error: "id 必填" }, { status: 400 });

    await prisma.relation.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
