import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { FACETS } from "@/lib/facets";
import { facetDelegate } from "@/lib/facet-delegates";

/**
 * 改一行查找表：名称 / 说明 / 文化含义 / 启用停用。
 *
 * 路径里带 `facet` 是因为 **id 只在各自的表里唯一** —— `/api/admin/facets/3`
 * 说不清是 dynasties 的 3 还是 motifs 的 3。
 *
 * 改名要过唯一索引：撞名返回 409，并且区分"已存在"和"已存在但停用"
 * （后者应该去启用它，而不是新建）。
 */

async function resolve(params: Promise<{ facet: string; id: string }>) {
  const { facet, id } = await params;
  const spec = FACETS.find((f) => f.key === facet);
  const numId = parseInt(id, 10);
  if (!spec) return { error: `未知的分面：${facet}`, status: 404 as const };
  if (!Number.isInteger(numId) || numId <= 0) return { error: "Invalid ID", status: 400 as const };
  return { spec, id: numId };
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ facet: string; id: string }> }) {
  const r = await resolve(params);
  if ("error" in r) return NextResponse.json({ error: r.error }, { status: r.status });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求体不是合法 JSON" }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;
  const delegate = facetDelegate(prisma, r.spec.model);

  const current = (await delegate.findUnique({
    where: { id: r.id },
    select: { id: true },
  })) as { id: number } | null;
  if (!current) return NextResponse.json({ error: "该行不存在" }, { status: 404 });

  const data: Record<string, unknown> = {};

  if (b.name !== undefined) {
    const name = typeof b.name === "string" ? b.name.trim() : "";
    if (!name) return NextResponse.json({ error: "name 不能为空" }, { status: 400 });

    const clash = (await delegate.findUnique({
      where: { name },
      select: { id: true },
    })) as { id: number } | null;
    if (clash && clash.id !== r.id) {
      return NextResponse.json({ error: `「${name}」已存在` }, { status: 409 });
    }
    data.name = name;
  }

  if (b.description !== undefined) {
    data.description = typeof b.description === "string" ? b.description.trim() || null : null;
  }
  if (b.culturalMeaning !== undefined) {
    data.culturalMeaning = typeof b.culturalMeaning === "string" ? b.culturalMeaning.trim() || null : null;
  }
  if (b.active !== undefined) {
    if (typeof b.active !== "boolean") {
      return NextResponse.json({ error: "active 必须是布尔值" }, { status: 400 });
    }
    data.active = b.active;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "没有要修改的字段" }, { status: 400 });
  }

  await delegate.update({ where: { id: r.id }, data });
  return NextResponse.json({ success: true });
}
