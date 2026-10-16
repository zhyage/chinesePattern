import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { normalizePendingInput } from "@/lib/pending-input";
import { listPending } from "@/lib/pending-query";

/**
 * 待审队列。
 *
 * 所有新增内容都走这里 —— 包括管理员自己建的（design.md §3.5）。
 * 通过后才落成真正的 pattern + 中间表记录。
 *
 * pending 里的分面值存 JSON 而不是外键，理由见 design.md §4.5：
 * 用户建议的新值（如"双喜纹"）本来就不在 motifs 表里，外键无从谈起。
 */

export async function GET(request: NextRequest) {
  try {
    const status = new URL(request.url).searchParams.get("status")?.trim() || "pending";
    return NextResponse.json({ data: await listPending(status) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const result = normalizePendingInput(body);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    const created = await prisma.pending.create({ data: result.data });
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
