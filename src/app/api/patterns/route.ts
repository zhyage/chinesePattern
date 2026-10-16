import { NextRequest, NextResponse } from "next/server";
import { listPatterns } from "@/lib/patterns-query";

/**
 * 纹饰列表 —— 客户端组件用。
 *
 * 查询逻辑在 `@/lib/patterns-query`，和首页**共用同一份** ——
 * 页面不必再 HTTP 自调用（fetch 自己的 URL 在部署时很脆）。
 *
 * 筛选语义：
 *   同一维度内多个值 = OR   （朝代选「商+周」= 商或周）
 *   不同维度之间     = AND  （朝代选「商」且载体选「青铜器」）
 *   全部不选         = 不过滤
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  return NextResponse.json(await listPatterns(searchParams));
}
