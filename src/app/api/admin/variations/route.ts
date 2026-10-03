import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { patternId, variantName, dynasty, region, description, periodStart, periodEnd } = body;

    if (!patternId || !variantName) {
      return NextResponse.json({ error: "patternId, variantName 为必填字段" }, { status: 400 });
    }

    const variation = await prisma.variation.create({
      data: { patternId: parseInt(patternId), variantName, dynasty, region, description, periodStart, periodEnd },
    });

    return NextResponse.json({ data: variation }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
