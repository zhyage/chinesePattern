import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const dynasty = searchParams.get("dynasty");
  const category = searchParams.get("category");
  const medium = searchParams.get("medium");
  const region = searchParams.get("region");
  const search = searchParams.get("search");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20")));

  // Build where clause
  const where: Record<string, unknown> = { status: "published" };

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
  }));

  return NextResponse.json({
    data: result,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}
