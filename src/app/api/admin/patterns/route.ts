import { NextRequest, NextResponse } from "next/server";
import { listPatternsForAdmin } from "@/lib/patterns-query";

/**
 * 管理后台的纹饰列表（design.md §5.4 的 `/admin/patterns`）。
 *
 * 查询逻辑在 `@/lib/patterns-query`，和 `/admin/patterns` 页面**共用同一份**。
 *
 * 与公开的 `/api/patterns` 的区别：**不看 status** —— 管理员要看到草稿和被驳回的。
 *
 * 注意：新建不在这里。所有新建都走 `/api/admin/pending`（§3.5），
 * 编辑已发布条目走 `PUT /api/admin/patterns/[id]`，所以本文件没有 POST/PUT。
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    return NextResponse.json(await listPatternsForAdmin(searchParams));
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
