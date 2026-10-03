import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET() {
  const dynasties = await prisma.period.findMany({
    orderBy: { periodStart: "asc" },
  });

  return NextResponse.json({ data: dynasties });
}
