import { describe, it, expect, beforeAll, afterAll } from "vitest";
import prisma from "@/lib/db";
import { buildTestEnv, destroyTestEnv } from "../setup-db";
import { GET as listFacets, POST as createFacet } from "@/app/api/admin/facets/route";
import { PATCH as updateFacet } from "@/app/api/admin/facets/[facet]/[id]/route";
import { listFacets as publicFacets } from "@/lib/patterns-query";

async function call(
  handler: (req: never, ctx: never) => Promise<Response>,
  url: string,
  init?: RequestInit & { params?: Record<string, string> },
) {
  const { params, ...rest } = init ?? {};
  const res = await handler(
    new Request(url, rest) as never,
    { params: Promise.resolve(params ?? {}) } as never,
  );
  return { status: res.status, body: await res.json() };
}

function postJson(url: string, data: unknown) {
  return call(createFacet, url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

function patchJson(facet: string, id: number, data: unknown) {
  return call(updateFacet, `${BASE}/admin/facets/${facet}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    params: { facet, id: String(id) },
  });
}

const BASE = "http://localhost/api";

/**
 * 两个接口返回的分组形状不同：管理端每行多一个 `active`。
 * 用一个宽松的公共形状同时接住 `FacetGroup[]`（公开）和 admin 的返回。
 */
type AnyGroup = { key: string; values: { name: string; active?: boolean; count: number }[] };
const group = (groups: AnyGroup[], key: string) => groups.find((g) => g.key === key)!;

beforeAll(() => buildTestEnv());
afterAll(() => destroyTestEnv());

describe("GET /api/admin/facets", () => {
  it("返回六个维度，各自带上标签和全部值", async () => {
    const { status, body } = await call(listFacets, `${BASE}/admin/facets`);
    expect(status).toBe(200);
    expect(body.data.map((g: { key: string }) => g.key)).toEqual([
      "dynasty", "region", "ethnicGroup", "category", "motif", "medium",
    ]);
    expect(group(body.data, "dynasty").values.length).toBeGreaterThan(0);
  });

  it("每行带 active 和 count", async () => {
    const { body } = await call(listFacets, `${BASE}/admin/facets`);
    const shang = group(body.data, "dynasty").values.find((v) => v.name === "商")!;
    expect(shang.active).toBe(true);
    expect(shang.count).toBeGreaterThan(0);
  });

  it("★ 和公开接口不同：**包含已停用的值**", async () => {
    const dynasty = await prisma.dynasty.findUnique({ where: { name: "西周" } });
    await prisma.dynasty.update({ where: { id: dynasty!.id }, data: { active: false } });

    const admin = await call(listFacets, `${BASE}/admin/facets`);
    expect(group(admin.body.data, "dynasty").values.some((v) => v.name === "西周")).toBe(true);

    // 公开接口不该看见它
    const pub = await publicFacets();
    expect(group(pub, "dynasty").values.some((v) => v.name === "西周")).toBe(false);

    await prisma.dynasty.update({ where: { id: dynasty!.id }, data: { active: true } });
  });

  it("★ 计数含**所有状态**的 pattern —— 和公开接口的关键差别", async () => {
    const d = await prisma.dynasty.findUnique({ where: { name: "唐" } });
    const pick = (groups: { key: string; values: { name: string; count: number }[] }[]) =>
      groups.find((g) => g.key === "dynasty")!.values.find((v) => v.name === "唐")!.count;

    const before = pick((await call(listFacets, `${BASE}/admin/facets`)).body.data);

    // 加一条**未发布**的 pattern 引用它
    const p = await prisma.pattern.create({ data: { name: "草稿条目", status: "draft" } });
    await prisma.patternDynasty.create({ data: { patternId: p.id, dynastyId: d!.id } });

    // 管理端要能看见它 —— 管理员据此判断"这一行还有没有人在用"
    expect(pick((await call(listFacets, `${BASE}/admin/facets`)).body.data)).toBe(before + 1);
    // 公开端只数已发布的
    expect(pick(await publicFacets())).toBe(before);

    await prisma.pattern.delete({ where: { id: p.id } });
  });

  it("★ 停用不影响已有引用 —— 分类不会被悄悄改掉", async () => {
    const dynasty = await prisma.dynasty.findUnique({ where: { name: "商" } });
    const before = await prisma.patternDynasty.count({ where: { dynastyId: dynasty!.id } });
    expect(before).toBeGreaterThan(0);

    await prisma.dynasty.update({ where: { id: dynasty!.id }, data: { active: false } });
    const after = await prisma.patternDynasty.count({ where: { dynastyId: dynasty!.id } });
    expect(after).toBe(before);

    await prisma.dynasty.update({ where: { id: dynasty!.id }, data: { active: true } });
  });
});

describe("POST /api/admin/facets", () => {
  it("新建一行", async () => {
    const { status, body } = await postJson(`${BASE}/admin/facets`, {
      facet: "motif",
      name: "双喜纹",
      description: "婚庆用",
    });
    expect(status).toBe(201);
    const row = await prisma.motif.findUnique({ where: { id: body.id } });
    expect(row!.name).toBe("双喜纹");
    expect(row!.active).toBe(true);
  });

  it("新建后立刻出现在公开接口里", async () => {
    const pub = await publicFacets();
    expect(group(pub, "motif").values.some((v) => v.name === "双喜纹")).toBe(true);
  });

  it("名称首尾空格被去掉", async () => {
    const { body } = await postJson(`${BASE}/admin/facets`, { facet: "motif", name: "  回纹  " });
    const row = await prisma.motif.findUnique({ where: { id: body.id } });
    expect(row!.name).toBe("回纹");
  });

  it("facet 非法 → 400", async () => {
    const { status } = await postJson(`${BASE}/admin/facets`, { facet: "不存在的维度", name: "x" });
    expect(status).toBe(400);
  });

  it("name 为空 → 400", async () => {
    expect((await postJson(`${BASE}/admin/facets`, { facet: "motif", name: "   " })).status).toBe(400);
    expect((await postJson(`${BASE}/admin/facets`, { facet: "motif" })).status).toBe(400);
  });

  it("重名 → 409", async () => {
    const { status, body } = await postJson(`${BASE}/admin/facets`, { facet: "motif", name: "云雷纹" });
    expect(status).toBe(409);
    expect(body.error).toContain("已存在");
  });

  it("★ 重名撞上的是**已停用**的行时，提示去启用而不是新建", async () => {
    const m = await prisma.motif.findUnique({ where: { name: "回纹" } });
    await prisma.motif.update({ where: { id: m!.id }, data: { active: false } });

    const { status, body } = await postJson(`${BASE}/admin/facets`, { facet: "motif", name: "回纹" });
    expect(status).toBe(409);
    expect(body.error).toContain("停用");

    await prisma.motif.update({ where: { id: m!.id }, data: { active: true } });
  });

  it("同名在不同维度里是允许的（各表独立）", async () => {
    const { status } = await postJson(`${BASE}/admin/facets`, { facet: "category", name: "回纹" });
    expect(status).toBe(201);
  });

  it("请求体不是 JSON → 400", async () => {
    const res = await createFacet(
      new Request(`${BASE}/admin/facets`, { method: "POST", body: "不是 json" }) as never,
    );
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/admin/facets/[facet]/[id]", () => {
  it("改名称 / 说明 / 文化含义", async () => {
    const m = await prisma.motif.findUnique({ where: { name: "回纹" } });
    const { status } = await patchJson("motif", m!.id, {
      name: "回字纹",
      description: "由回字形线条构成",
      culturalMeaning: "寓意绵延不绝",
    });
    expect(status).toBe(200);
    const row = await prisma.motif.findUnique({ where: { id: m!.id } });
    expect(row!.name).toBe("回字纹");
    expect(row!.description).toBe("由回字形线条构成");
  });

  it("停用 / 启用", async () => {
    const m = await prisma.motif.findUnique({ where: { name: "回字纹" } });
    expect((await patchJson("motif", m!.id, { active: false })).status).toBe(200);
    expect((await prisma.motif.findUnique({ where: { id: m!.id } }))!.active).toBe(false);

    expect((await patchJson("motif", m!.id, { active: true })).status).toBe(200);
    expect((await prisma.motif.findUnique({ where: { id: m!.id } }))!.active).toBe(true);
  });

  it("空字符串的说明 → 存成 NULL，不是空串", async () => {
    const m = await prisma.motif.findUnique({ where: { name: "回字纹" } });
    await patchJson("motif", m!.id, { description: "   " });
    expect((await prisma.motif.findUnique({ where: { id: m!.id } }))!.description).toBeNull();
  });

  it("★ id 只在各自的表里唯一 —— 同一个 id 在不同 facet 下是两行不同的东西", async () => {
    // dynasty id=1 是「商」；拿 facet=motif 去改它，改的应该是 motif 的 id=1
    const d1 = await prisma.dynasty.findUnique({ where: { id: 1 } });
    const m1 = await prisma.motif.findUnique({ where: { id: 1 } });
    expect(d1!.name).not.toBe(m1!.name);

    await patchJson("motif", 1, { description: "只该改到 motif 那一行" });
    expect((await prisma.motif.findUnique({ where: { id: 1 } }))!.description).toBe("只该改到 motif 那一行");
    expect((await prisma.dynasty.findUnique({ where: { id: 1 } }))!.description).not.toBe("只该改到 motif 那一行");
  });

  it("未知 facet → 404", async () => {
    expect((await patchJson("nope", 1, { name: "x" })).status).toBe(404);
  });

  it("id 非法 → 400", async () => {
    expect((await patchJson("motif", NaN, { name: "x" })).status).toBe(400);
  });

  it("行不存在 → 404", async () => {
    expect((await patchJson("motif", 999999, { name: "x" })).status).toBe(404);
  });

  it("改成已存在的名称 → 409", async () => {
    const m = await prisma.motif.findUnique({ where: { name: "回字纹" } });
    expect((await patchJson("motif", m!.id, { name: "云雷纹" })).status).toBe(409);
  });

  it("改成自己原来的名称 → 允许（不算撞名）", async () => {
    const m = await prisma.motif.findUnique({ where: { name: "回字纹" } });
    expect((await patchJson("motif", m!.id, { name: "回字纹" })).status).toBe(200);
  });

  it("name 改成空白 → 400", async () => {
    const m = await prisma.motif.findUnique({ where: { name: "回字纹" } });
    expect((await patchJson("motif", m!.id, { name: "   " })).status).toBe(400);
  });

  it("active 不是布尔 → 400", async () => {
    const m = await prisma.motif.findUnique({ where: { name: "回字纹" } });
    expect((await patchJson("motif", m!.id, { active: "yes" })).status).toBe(400);
  });

  it("没有任何字段 → 400", async () => {
    const m = await prisma.motif.findUnique({ where: { name: "回字纹" } });
    expect((await patchJson("motif", m!.id, {})).status).toBe(400);
  });
});
