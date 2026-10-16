import { NextRequest, NextResponse } from "next/server";
import { getPatternById } from "@/lib/patterns-query";

/**
 * 单个纹饰详情。
 *
 * 扁平模型 —— 没有子项、没有变种、没有关联关系。
 * 返回这一条记录 + 它的六个分面（带说明文字，供前端做悬停提示）。
 */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const patternId = parseInt(id);
  if (isNaN(patternId)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  const pattern = await getPatternById(patternId);
  if (!pattern) {
    return NextResponse.json({ error: "纹饰不存在" }, { status: 404 });
  }

  return NextResponse.json(pattern);
}
