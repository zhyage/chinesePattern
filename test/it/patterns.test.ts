import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "@/lib/db";
import { buildTestEnv, destroyTestEnv } from "../setup-db";
import { GET as listPatterns } from "@/app/api/patterns/route";
import { GET as getPattern } from "@/app/api/patterns/[id]/route";
import { GET as getFacets } from "@/app/api/facets/route";

/** 直接调 handler，不起 HTTP 服务器 —— 快得多也稳得多 */
async function call(
  handler: (req: never, ctx: never) => Promise<Response>,
  url: string,
  params?: Record<string, string>,
) {
  const res = await handler(
    new Request(url) as never,
    { params: Promise.resolve(params ?? {}) } as never,
  );
  return { status: res.status, body: await res.json() };
}

const BASE = "http://localhost/api";

/** 按名字查分面值 id —— 不硬编码 id，避免 seed 顺序一变测试就红 */
async function idOf(
  model: "dynasty" | "region" | "ethnicGroup" | "category" | "motif" | "medium",
  name: string,
): Promise<number> {
  const delegate = prisma[model] as unknown as {
    findUnique: (a: unknown) => Promise<{ id: number } | null>;
  };
  const row = await delegate.findUnique({ where: { name }, select: { id: true } });
  if (!row) throw new Error(`找不到 ${model} = ${name}`);
  return row.id;
}

let ID: {
  shang: number;
  tang: number;
  jihe: number;
  jixiang: number;
  yunlei: number;
  qingtong: number;
};

beforeAll(async () => {
  buildTestEnv();
  ID = {
    shang: await idOf("dynasty", "商"),
    tang: await idOf("dynasty", "唐"),
    jihe: await idOf("category", "几何纹"),
    jixiang: await idOf("category", "吉祥纹"),
    yunlei: await idOf("motif", "云雷纹"),
    qingtong: await idOf("medium", "青铜器"),
  };
});

afterAll(() => destroyTestEnv());

describe("GET /api/patterns —— 列表与筛选", () => {
  it("无筛选返回全部已发布纹饰", async () => {
    const { status, body } = await call(listPatterns, `${BASE}/patterns`);
    expect(status).toBe(200);
    expect(body.total).toBe(14);
    expect(body.data).toHaveLength(14);
  });

  it("单维筛选：朝代=商", async () => {
    const { body } = await call(listPatterns, `${BASE}/patterns?dynasty=${ID.shang}`);
    expect(body.total).toBe(6); // 饕餮×2 + 云雷×2 + 夔龙×2
  });

  it("单维筛选：母题=云雷纹", async () => {
    const { body } = await call(listPatterns, `${BASE}/patterns?motif=${ID.yunlei}`);
    expect(body.total).toBe(2);
  });

  it("同维多值 = OR（几何纹 或 吉祥纹）", async () => {
    const { body } = await call(
      listPatterns,
      `${BASE}/patterns?category=${ID.jihe},${ID.jixiang}`,
    );
    expect(body.total).toBe(8); // 几何纹 4 + 吉祥纹 4
  });

  it("跨维 = AND（商 且 青铜器）", async () => {
    const { body } = await call(
      listPatterns,
      `${BASE}/patterns?dynasty=${ID.shang}&medium=${ID.qingtong}`,
    );
    expect(body.total).toBe(6);
  });

  it("矛盾组合返回 0 而不是报错", async () => {
    const { status, body } = await call(
      listPatterns,
      `${BASE}/patterns?dynasty=${ID.tang}&medium=${ID.qingtong}`,
    );
    expect(status).toBe(200);
    expect(body.total).toBe(0);
    expect(body.data).toEqual([]);
  });

  it("搜索命中名称", async () => {
    const { body } = await call(
      listPatterns,
      `${BASE}/patterns?search=${encodeURIComponent("云雷")}`,
    );
    expect(body.total).toBe(2);
  });

  it("搜索命中分面值名（不只是 pattern 自己的名字）", async () => {
    // 「青铜」不在任何 pattern 的名字里，只出现在 medium 分面值「青铜器」上
    const { body } = await call(
      listPatterns,
      `${BASE}/patterns?search=${encodeURIComponent("青铜")}`,
    );
    expect(body.total).toBe(6);
  });

  it("分页：pageSize 生效，total 是总数而不是当页数", async () => {
    const { body } = await call(listPatterns, `${BASE}/patterns?pageSize=5`);
    expect(body.data).toHaveLength(5);
    expect(body.total).toBe(14);
    expect(body.totalPages).toBe(3);
    expect(body.page).toBe(1);
  });

  it("★ total 与实际匹配数一致 —— findMany 和 count 必须同源", async () => {
    // 这是最容易写错的地方：两处 where 不同步时，列表条数和分页总数会对不上
    for (const q of [
      "",
      `?dynasty=${ID.shang}`,
      `?motif=${ID.yunlei}`,
      `?category=${ID.jihe},${ID.jixiang}`,
      `?dynasty=${ID.shang}&medium=${ID.qingtong}`,
    ]) {
      const { body } = await call(listPatterns, `${BASE}/patterns${q}&pageSize=100`);
      expect(body.total, `查询 ${q} 的 total 与 data 长度不符`).toBe(body.data.length);
    }
  });

  it("每条记录带缩略图与完整六组分面", async () => {
    const { body } = await call(listPatterns, `${BASE}/patterns?pageSize=3`);
    for (const p of body.data) {
      expect(p.thumbnail, `${p.name} 缺缩略图`).toBeTruthy();
      expect(Object.keys(p.facets).sort()).toEqual(
        ["category", "dynasty", "ethnicGroup", "medium", "motif", "region"].sort(),
      );
    }
  });

  it("只返回已发布的 —— 草稿不出现", async () => {
    const draft = await prisma.pattern.create({ data: { name: "草稿测试", status: "draft" } });
    try {
      const { body } = await call(listPatterns, `${BASE}/patterns?pageSize=100`);
      expect(body.total).toBe(14);
      expect(body.data.some((p: { name: string }) => p.name === "草稿测试")).toBe(false);
    } finally {
      await prisma.pattern.delete({ where: { id: draft.id } });
    }
  });
});

describe("GET /api/patterns/[id] —— 详情", () => {
  it("返回名称、图片、六组分面", async () => {
    const target = await prisma.pattern.findFirst({ where: { name: "云雷纹·圆雷" } });
    const { status, body } = await call(getPattern, `${BASE}/patterns/${target!.id}`, {
      id: String(target!.id),
    });
    expect(status).toBe(200);
    expect(body.name).toBe("云雷纹·圆雷");
    expect(body.images.length).toBeGreaterThan(0);
    expect(body.facets.motif[0].name).toBe("云雷纹");
  });

  it("分面带说明文字（详情页悬停提示要用）", async () => {
    const target = await prisma.pattern.findFirst({ where: { name: "云雷纹·圆雷" } });
    const { body } = await call(getPattern, `${BASE}/patterns/${target!.id}`, {
      id: String(target!.id),
    });
    expect(body.facets.motif[0]).toHaveProperty("description");
    expect(body.facets.motif[0].description).toBeTruthy();
  });

  it("每个 pattern 恰好一张主图，且是位图", async () => {
    const all = await prisma.pattern.findMany({ include: { images: true } });
    for (const p of all) {
      const primaries = p.images.filter((i) => i.isPrimary);
      expect(primaries, `${p.name} 的主图数`).toHaveLength(1);
      expect(primaries[0].type, `${p.name} 的主图类型`).toBe("bitmap");
    }
  });

  it("不存在的 id → 404", async () => {
    const { status } = await call(getPattern, `${BASE}/patterns/999999`, { id: "999999" });
    expect(status).toBe(404);
  });

  it("非数字 id → 400", async () => {
    const { status } = await call(getPattern, `${BASE}/patterns/abc`, { id: "abc" });
    expect(status).toBe(400);
  });
});

describe("GET /api/facets —— 分面选项", () => {
  it("返回六组", async () => {
    const { status, body } = await call(getFacets, `${BASE}/facets`);
    expect(status).toBe(200);
    expect(body.data).toHaveLength(6);
    expect(body.data.map((g: { key: string }) => g.key)).toEqual([
      "dynasty",
      "region",
      "ethnicGroup",
      "category",
      "motif",
      "medium",
    ]);
  });

  it("每组都含一行「其它」", async () => {
    const { body } = await call(getFacets, `${BASE}/facets`);
    for (const g of body.data) {
      const names = g.values.map((v: { name: string }) => v.name);
      expect(names, `${g.label} 缺「其它」`).toContain("其它");
    }
  });

  it("每个值带使用计数", async () => {
    const { body } = await call(getFacets, `${BASE}/facets`);
    const motif = body.data.find((g: { key: string }) => g.key === "motif");
    const yunlei = motif.values.find((v: { name: string }) => v.name === "云雷纹");
    expect(yunlei.count).toBe(2);
  });

  it("计数只统计已发布的 pattern", async () => {
    const motif = await prisma.motif.findUnique({ where: { name: "云雷纹" } });
    const draft = await prisma.pattern.create({
      data: {
        name: "草稿不该被计数",
        status: "draft",
        motifs: { create: [{ motifId: motif!.id }] },
      },
    });
    try {
      const { body } = await call(getFacets, `${BASE}/facets`);
      const g = body.data.find((x: { key: string }) => x.key === "motif");
      const yunlei = g.values.find((v: { name: string }) => v.name === "云雷纹");
      expect(yunlei.count).toBe(2); // 仍然是 2，草稿没算进去
    } finally {
      await prisma.pattern.delete({ where: { id: draft.id } });
    }
  });
});
