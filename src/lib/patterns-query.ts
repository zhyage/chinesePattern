import prisma from "@/lib/db";
import { FACETS, parseIds } from "@/lib/facets";
import { facetDelegate } from "@/lib/facet-delegates";

/**
 * 纹饰查询逻辑 —— **API 路由和页面共用同一份**。
 *
 * 为什么抽出来：服务端组件直接调 Prisma 比"HTTP 自调用"（fetch 自己的 /api/...）
 * 更快也更稳 —— 后者要求服务端知道自己的 URL，部署到 Vercel 时得配
 * NEXT_PUBLIC_API_URL，是个已知的坑。
 *
 * API 路由现在是这层的薄封装（保留是为了给客户端组件和管理后台用）。
 */

export interface FacetValue {
  id: number;
  name: string;
  description?: string | null;
  culturalMeaning?: string | null;
}

export type FacetMap = Record<string, FacetValue[]>;

export interface PatternListItem {
  id: number;
  name: string;
  description: string | null;
  thumbnail: string | null;
  thumbnailType: string | null;
  facets: FacetMap;
}

export interface PatternListResult {
  data: PatternListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 列表 + 六维筛选。
 *
 * 语义：同维多值 = OR，跨维 = AND，全不选 = 不过滤。
 * 只返回 status = published。
 */
export async function listPatterns(
  params: URLSearchParams,
  opts: { pageSizeDefault?: number } = {},
): Promise<PatternListResult> {
  const search = params.get("search");
  const page = Math.max(1, parseInt(params.get("page") ?? "1") || 1);
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(params.get("pageSize") ?? String(opts.pageSizeDefault ?? 24)) || 24),
  );

  // ★ 这个 where 同时交给 findMany 和 count —— 两者必须同源，
  //   否则列表条数和分页总数会对不上（有测试守着这一条）
  const where: Record<string, unknown> = { status: "published" };

  for (const f of FACETS) {
    const ids = parseIds(params.get(f.key));
    if (ids.length) where[f.relation] = { some: { [f.fk]: { in: ids } } };
  }

  if (search) {
    // 名称/描述/文化含义，外加六个维度的**值名**
    //（这样搜"云雷纹"能命中名字叫「圆雷」但母题是云雷纹的条目）
    where.OR = [
      { name: { contains: search } },
      { description: { contains: search } },
      { culturalMeaning: { contains: search } },
      ...FACETS.map((f) => ({
        [f.relation]: { some: { [f.model]: { name: { contains: search } } } },
      })),
    ];
  }

  const facetInclude = Object.fromEntries(
    FACETS.map((f) => [f.relation, { include: { [f.model]: { select: { id: true, name: true } } } }]),
  );

  const [rows, total] = await Promise.all([
    prisma.pattern.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { id: "asc" },
      include: {
        images: { where: { isPrimary: true }, take: 1, select: { url: true, type: true } },
        ...facetInclude,
      },
    }),
    prisma.pattern.count({ where }),
  ]);

  const data = rows.map((p) => {
    const row = p as unknown as Record<string, unknown> & {
      id: number;
      name: string;
      description: string | null;
      images: { url: string; type: string }[];
    };
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      thumbnail: row.images[0]?.url ?? null,
      thumbnailType: row.images[0]?.type ?? null,
      facets: pickFacets(row),
    };
  });

  return { data, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export interface PatternDetail {
  id: number;
  name: string;
  description: string | null;
  culturalMeaning: string | null;
  source: string | null;
  sourceUrl: string | null;
  status: string;
  images: Array<{
    id: number;
    url: string;
    type: string;
    purpose: string | null;
    label: string | null;
    isPrimary: boolean;
  }>;
  facets: FacetMap;
}

/** 单个纹饰详情。不存在返回 null。 */
export async function getPatternById(id: number): Promise<PatternDetail | null> {
  const facetInclude = Object.fromEntries(
    FACETS.map((f) => [
      f.relation,
      { include: { [f.model]: { select: { id: true, name: true, description: true, culturalMeaning: true } } } },
    ]),
  );

  const p = await prisma.pattern.findUnique({
    where: { id },
    include: { images: { orderBy: { sortOrder: "asc" } }, ...facetInclude },
  });
  if (!p) return null;

  const row = p as unknown as Record<string, unknown>;
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    culturalMeaning: p.culturalMeaning,
    source: p.source,
    sourceUrl: p.sourceUrl,
    status: p.status,
    images: row.images as PatternDetail["images"],
    facets: pickFacets(row),
  };
}

export interface FacetGroup {
  key: string;
  label: string;
  values: Array<FacetValue & { count: number }>;
}

/**
 * 六个分面的全部**可选**值（已停用的不出现）。
 * `count` = 有多少条**已发布** pattern 在用 —— 前端可据此把 0 条的选项置灰，
 * 避免"点了没结果"的空选项。
 *
 * ⚠️ 停用只影响这张列表。查询（`listPatterns` 的分面筛选）、搜索、
 *    详情页的分面 chip **都不看 `active`** —— 停用一个值不该让已有条目
 *    的链接失效，也不该让它从搜索结果里消失。见 design.md §5.5。
 */
export async function listFacets(): Promise<FacetGroup[]> {
  return Promise.all(
    FACETS.map(async (f) => {
      const delegate = (
        prisma as unknown as Record<string, { findMany: (a: unknown) => Promise<unknown[]> }>
      )[f.model];

      const rows = (await delegate.findMany({
        where: { active: true },
        orderBy: { id: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          culturalMeaning: true,
          _count: { select: { patterns: { where: { pattern: { status: "published" } } } } },
        },
      })) as Array<FacetValue & { _count: { patterns: number } }>;

      return {
        key: f.key,
        label: f.label,
        values: rows.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          culturalMeaning: r.culturalMeaning,
          count: r._count.patterns,
        })),
      };
    }),
  );
}

// ────────────────────────────────────────────────────────────
// 管理端查询（design.md §5.4）
//
// 和上面几个的区别：**不看 status**，管理员要看到草稿和被驳回的。
// 页面和接口共用这一份，理由同文件开头。
// ────────────────────────────────────────────────────────────

export interface AdminPatternListItem {
  id: number;
  name: string;
  status: string;
  thumbnail: string | null;
  /** 分面**名称**（不是 id）—— 列表里只要给人看一眼摘要 */
  facets: Record<string, string[]>;
}

export interface AdminPatternListResult {
  data: AdminPatternListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** 管理端的纹饰列表：搜索 + 状态筛选 + 分页 */
export async function listPatternsForAdmin(params: URLSearchParams): Promise<AdminPatternListResult> {
  const search = params.get("search")?.trim() ?? "";
  const status = params.get("status")?.trim() ?? "";
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(params.get("pageSize") ?? "20", 10) || 20));

  // findMany 和 count 必须同源，否则列表条数和分页总数会对不上
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { name: { contains: search } },
      { description: { contains: search } },
      { culturalMeaning: { contains: search } },
    ];
  }

  const facetInclude = Object.fromEntries(
    FACETS.map((f) => [f.relation, { include: { [f.model]: { select: { id: true, name: true } } } }]),
  );

  const [rows, total] = await Promise.all([
    prisma.pattern.findMany({
      where,
      orderBy: { id: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        images: { where: { isPrimary: true }, take: 1, select: { url: true } },
        ...facetInclude,
      },
    }),
    prisma.pattern.count({ where }),
  ]);

  const data = rows.map((p) => {
    const row = p as unknown as Record<string, unknown> & {
      id: number;
      name: string;
      status: string;
      images: { url: string }[];
    };
    const facets: Record<string, string[]> = {};
    for (const f of FACETS) {
      const links = (row[f.relation] ?? []) as Record<string, { name: string }>[];
      facets[f.key] = links.map((l) => l[f.model]?.name).filter(Boolean);
    }
    return {
      id: row.id,
      name: row.name,
      status: row.status,
      thumbnail: row.images[0]?.url ?? null,
      facets,
    };
  });

  return { data, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export interface AdminFacetValue extends FacetValue {
  active: boolean;
  /** 引用它的 pattern 数 —— **含所有状态**，管理员据此判断"这一行还有没有人在用" */
  count: number;
}

export interface AdminFacetGroup {
  key: string;
  label: string;
  values: AdminFacetValue[];
}

/**
 * 查找表管理页的数据（§5.5）。
 *
 * 和公开的 `listFacets()` 的两处关键差别：
 *   ① **包含已停用的行** —— 不然停用之后就没法再启用了
 *   ② 计数**含未发布的 pattern**
 */
export async function listFacetsForAdmin(): Promise<AdminFacetGroup[]> {
  return Promise.all(
    FACETS.map(async (f) => {
      const rows = (await facetDelegate(prisma, f.model).findMany({
        orderBy: { id: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          culturalMeaning: true,
          active: true,
          _count: { select: { patterns: true } },
        },
      })) as Array<FacetValue & { active: boolean; _count: { patterns: number } }>;

      return {
        key: f.key,
        label: f.label,
        values: rows.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          culturalMeaning: r.culturalMeaning,
          active: r.active,
          count: r._count.patterns,
        })),
      };
    }),
  );
}

export interface AdminCounts {
  pending: number;
  published: number;
  draft: number;
  rejected: number;
  facetValues: number;
}

/** 仪表盘上那三个数字 */
export async function adminCounts(): Promise<AdminCounts> {
  const [byStatus, facetValues] = await Promise.all([
    prisma.pattern.groupBy({ by: ["status"], _count: { _all: true } }),
    Promise.all(FACETS.map((f) => facetDelegate(prisma, f.model).count())).then((a) =>
      a.reduce((x, y) => x + y, 0),
    ),
  ]);

  const n = (s: string) =>
    (byStatus as unknown as { status: string; _count: { _all: number } }[]).find((r) => r.status === s)
      ?._count._all ?? 0;

  return {
    pending: await prisma.pending.count({ where: { status: "pending" } }),
    published: n("published"),
    draft: n("draft"),
    rejected: n("rejected"),
    facetValues,
  };
}

/** 把六个 { <model>: {...} }[] 拍平成 { dynasty: [...], motif: [...] } */
function pickFacets(row: Record<string, unknown>): FacetMap {
  const out: FacetMap = {};
  for (const f of FACETS) {
    const links = (row[f.relation] ?? []) as Record<string, FacetValue>[];
    out[f.key] = links.map((l) => l[f.model]).filter(Boolean);
  }
  return out;
}
