import { NextResponse } from "next/server";
import { listFacets } from "@/lib/patterns-query";

/**
 * 六个分面维度的全部可选值 —— 客户端组件用。
 *
 * 每个值带 `count`（有多少条**已发布**的 pattern 在用），
 * 前端可据此把 0 条的选项置灰，避免"点了没结果"的空选项。
 */
export async function GET() {
  return NextResponse.json({ data: await listFacets() });
}
