import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const dynasty = searchParams.get("dynasty");
  const category = searchParams.get("category");
  const medium = searchParams.get("medium");
  const region = searchParams.get("region");
  const search = searchParams.get("search");
  // level=top（默认）只返回顶层条目；level=all 返回全部层级（含式样）。
  // 「类别」不是存储的属性，而是由"有没有子项"决定的行为 —— 所以这里过滤的是 parentId，
  // 而不是某个 kind 字段。想整体扁平化时，改这里的默认值即可（或传 level=all）。
  const level = searchParams.get("level") ?? "top";
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20")));

  // Build where clause —— 这个对象同时交给 findMany 和 count，两者必须同源，
  // 否则列表和分页总数会对不上。
  const where: Record<string, unknown> = { status: "published" };

  if (level !== "all") where.parentId = null;
  if (dynasty) where.dynasty = dynasty;
  if (category) where.category = category;
  if (medium) where.medium = medium;
  if (region) where.region = region;

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { alternateName: { contains: search } },
      { description: { contains: search } },
      { culturalMeaning: { contains: search } },
    ];
  }

  const [patterns, total] = await Promise.all([
    prisma.pattern.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        images: {
          where: { isPrimary: true },
          take: 1,
        },
        // 类别封面：取前 4 个子项的缩略图，按 id 升序（稳定）。
        // 卡片端渲染成网格，格子数 = min(子项数, 4)，不画空格子。
        children: {
          take: 4,
          orderBy: { id: "asc" },
          select: {
            id: true,
            name: true,
            images: { where: { isPrimary: true }, take: 1, select: { url: true } },
          },
        },
        _count: { select: { children: true } },
      },
    }),
    prisma.pattern.count({ where }),
  ]);

  // Attach thumbnail URL
  const result = patterns.map((p) => ({
    id: p.id,
    name: p.name,
    alternateName: p.alternateName,
    dynasty: p.dynasty,
    category: p.category,
    medium: p.medium,
    thumbnail: p.images[0]?.url ?? null,
    thumbnailType: p.images[0]?.type ?? null,
    createdAt: p.createdAt,
    /** 子项总数。0 = 单形态纹样（行为与加层级前一致） */
    childCount: p._count.children,
    /** 封面网格用的子项缩略图，最多 4 个 */
    childThumbnails: p.children.map((c) => ({
      id: c.id,
      name: c.name,
      url: c.images[0]?.url ?? null,
    })),
  }));

  return NextResponse.json({
    data: result,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
