import prisma from "@/lib/db";
import { FACETS } from "@/lib/facets";
import { facetDelegate } from "@/lib/facet-delegates";

/**
 * 待审队列的查询 —— 接口（`/api/admin/pending`）和页面（`/admin/pending`）共用。
 *
 * 与 `patterns-query.ts` 同样的理由：查询逻辑只有一份，
 * 页面不必 HTTP 自调用自己的接口。
 */

export interface PendingListItem {
  id: number;
  name: string;
  status: string;
  createdAt: Date;
  reviewedAt: Date | null;
  reviewNote: string | null;
  facets: Record<string, number[]>;
  suggestedFacets: Record<string, string[]>;
  images: { url: string; type: string }[];
  thumbnail: string | null;
  /** 通过时会往查找表里插新行 —— 列表要能一眼看出来 */
  hasSuggestions: boolean;
}

/**
 * 队列列表。
 *
 * **默认只返回 `pending`** —— 它叫"待审队列"，把已通过/已驳回的混进来是错的。
 * 要查历史传 `"approved"` / `"rejected"`；传 `"all"` 看全部。
 */
export async function listPending(status = "pending"): Promise<PendingListItem[]> {
  const where = status === "all" ? {} : { status };
  const rows = await prisma.pending.findMany({ where, orderBy: { createdAt: "desc" } });

  return rows.map((r) => {
    const images = JSON.parse(r.images) as { url: string; type: string }[];
    const suggestedFacets = JSON.parse(r.suggestedFacets) as Record<string, string[]>;
    return {
      id: r.id,
      name: r.name,
      status: r.status,
      createdAt: r.createdAt,
      reviewedAt: r.reviewedAt,
      reviewNote: r.reviewNote,
      facets: JSON.parse(r.facets) as Record<string, number[]>,
      suggestedFacets,
      images,
      thumbnail: images.find((i) => i.type === "bitmap")?.url ?? images[0]?.url ?? null,
      hasSuggestions: Object.values(suggestedFacets).some((a) => a.length > 0),
    };
  });
}

export interface PendingDetail {
  id: number;
  name: string;
  description: string | null;
  culturalMeaning: string | null;
  source: string | null;
  sourceUrl: string | null;
  status: string;
  createdAt: Date;
  reviewedAt: Date | null;
  reviewNote: string | null;
  /** 分面 id 已解析成名字 —— 光有 id 没法在页面上显示 */
  facets: Record<string, { id: number; name: string }[]>;
  suggestedFacets: Record<string, string[]>;
  /**
   * 每个建议值在查找表里的**现状**。
   * 审核页据此区分「会新建」和「会重新启用（原来已停用）」——
   * 后者如果不说明，通过之后条目会多出一个"看不见"的分类。
   */
  suggestedStatus: Record<string, { name: string; exists: boolean; active: boolean }[]>;
  images: { url: string; type: string }[];
}

/** 单个待审件。不存在返回 null。 */
export async function getPendingById(id: number): Promise<PendingDetail | null> {
  const p = await prisma.pending.findUnique({ where: { id } });
  if (!p) return null;

  const rawFacets = JSON.parse(p.facets) as Record<string, number[]>;
  const facets: Record<string, { id: number; name: string }[]> = {};
  for (const f of FACETS) {
    const ids = rawFacets[f.key] ?? [];
    if (!ids.length) {
      facets[f.key] = [];
      continue;
    }
    facets[f.key] = (await facetDelegate(prisma, f.model).findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true },
    })) as { id: number; name: string }[];
  }

  const suggestedFacets = JSON.parse(p.suggestedFacets) as Record<string, string[]>;

  // 建议值在查找表里的现状：通过时是"新建"还是"复用一条已停用的"
  const suggestedStatus: PendingDetail["suggestedStatus"] = {};
  for (const f of FACETS) {
    const names = suggestedFacets[f.key] ?? [];
    if (!names.length) continue;
    suggestedStatus[f.key] = [];
    for (const name of names) {
      const row = (await facetDelegate(prisma, f.model).findUnique({
        where: { name },
        select: { id: true, active: true },
      })) as { id: number; active: boolean } | null;
      suggestedStatus[f.key].push({ name, exists: !!row, active: row?.active ?? true });
    }
  }

  return {
    id: p.id,
    name: p.name,
    description: p.description,
    culturalMeaning: p.culturalMeaning,
    source: p.source,
    sourceUrl: p.sourceUrl,
    status: p.status,
    createdAt: p.createdAt,
    reviewedAt: p.reviewedAt,
    reviewNote: p.reviewNote,
    facets,
    suggestedFacets,
    suggestedStatus,
    images: JSON.parse(p.images) as { url: string; type: string }[],
  };
}
