import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readdirSync } from "node:fs";
import path from "node:path";
import prisma from "@/lib/db";
import { buildTestEnv, destroyTestEnv, putPendingFile, TEST_PUBLIC } from "../setup-db";
import { POST as uploadFile } from "@/app/api/admin/upload/route";
import { POST as submitPending, GET as listPending } from "@/app/api/admin/pending/route";
import { PATCH as reviewPending } from "@/app/api/admin/pending/[id]/route";

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
  return call(submitPending, url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

const BASE = "http://localhost/api";
const files = () => readdirSync(path.join(TEST_PUBLIC, "patterns"));
const pending = () => readdirSync(path.join(TEST_PUBLIC, "pending"));

let motifYunlei: number;

beforeAll(async () => {
  buildTestEnv();
  const m = await prisma.motif.findUnique({ where: { name: "云雷纹" } });
  motifYunlei = m!.id;
});

afterAll(() => destroyTestEnv());

describe("POST /api/admin/upload —— 上传到暂存区", () => {
  const form = (name: string, content = "<svg/>") => {
    const fd = new FormData();
    fd.append("file", new File([content], name, { type: "image/svg+xml" }));
    return { method: "POST", body: fd } as RequestInit;
  };

  it("接受合法文件，返回 /pending/ 下的地址", async () => {
    const { status, body } = await call(uploadFile, `${BASE}/admin/upload`, form("a.svg"));
    expect(status).toBe(200);
    expect(body.data.url).toMatch(/^\/pending\/.+\.svg$/);
    expect(body.data.type).toBe("vector");
  });

  it("★ 恶意文件名不参与路径 —— 落点仍在暂存区", async () => {
    const { status, body } = await call(
      uploadFile,
      `${BASE}/admin/upload`,
      form("../../evil.svg"),
    );
    expect(status).toBe(200);
    // 服务端用 UUID 生成名字，用户提供的名字只出现在 originalName 里
    expect(body.data.url).toMatch(/^\/pending\/[0-9]+-[0-9a-f]{8}\.svg$/);
    expect(body.data.url).not.toContain("..");
    expect(body.data.originalName).toBe("../../evil.svg");
  });

  it("拒绝不在白名单里的扩展名", async () => {
    const { status } = await call(uploadFile, `${BASE}/admin/upload`, form("a.exe"));
    expect(status).toBe(400);
  });

  it("缺少 file 字段 → 400", async () => {
    const { status } = await call(uploadFile, `${BASE}/admin/upload`, {
      method: "POST",
      body: new FormData(),
    });
    expect(status).toBe(400);
  });
});

describe("POST /api/admin/pending —— 提交校验", () => {
  it("缺 name → 400", async () => {
    const { status } = await postJson(`${BASE}/admin/pending`, {
      facets: {},
      images: [
        { url: putPendingFile("x1.svg"), type: "vector" },
        { url: putPendingFile("x1.jpg"), type: "bitmap" },
      ],
    });
    expect(status).toBe(400);
  });

  it("只有矢量、没位图 → 400", async () => {
    const { status } = await postJson(`${BASE}/admin/pending`, {
      name: "缺位图",
      images: [{ url: putPendingFile("x2.svg"), type: "vector" }],
    });
    expect(status).toBe(400);
  });

  it("只有位图、没矢量 → 400", async () => {
    const { status } = await postJson(`${BASE}/admin/pending`, {
      name: "缺矢量",
      images: [{ url: putPendingFile("x3.jpg"), type: "bitmap" }],
    });
    expect(status).toBe(400);
  });

  // ★ 这些 URL 曾经能通过校验，并在 approve 时被拿去 rename()
  const ATTACKS = [
    "/pending/",
    "/../../package.json",
    "/pending/../patterns/yunlei.svg",
    "/etc/passwd",
    "http://evil.com/x.svg",
    "/pending/a/b.svg",
  ];

  it.each(ATTACKS)("拒绝非法图片地址 %s", async (url) => {
    const { status } = await postJson(`${BASE}/admin/pending`, {
      name: "攻击尝试",
      images: [
        { url, type: "vector" },
        { url, type: "bitmap" },
      ],
    });
    expect(status).toBe(400);
  });

  it("合法提交 → 201 且状态为 pending", async () => {
    const { status, body } = await postJson(`${BASE}/admin/pending`, {
      name: "正常提交",
      description: "描述",
      facets: { motif: [motifYunlei] },
      images: [
        { url: putPendingFile("ok.svg"), type: "vector" },
        { url: putPendingFile("ok.jpg"), type: "bitmap" },
      ],
    });
    expect(status).toBe(201);
    expect(body.data.status).toBe("pending");
    expect(JSON.parse(body.data.facets)).toEqual({ motif: [motifYunlei] });
  });
});

describe("PATCH /api/admin/pending/[id] —— 审核", () => {
  /** 造一个待审件并返回它的 id */
  async function makePending(extra: Record<string, unknown> = {}) {
    const { body } = await postJson(`${BASE}/admin/pending`, {
      name: extra.name ?? `待审-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      facets: {},
      images: [
        { url: putPendingFile(`p${Math.random().toString(36).slice(2, 8)}.svg`), type: "vector" },
        { url: putPendingFile(`p${Math.random().toString(36).slice(2, 8)}.jpg`), type: "bitmap" },
      ],
      ...extra,
    });
    return body.data.id as number;
  }

  const review = (id: number, data: unknown) =>
    call(reviewPending, `${BASE}/admin/pending/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
      params: { id: String(id) },
    });

  it("通过 → 落成 pattern，六个维度都有中间表记录", async () => {
    const id = await makePending({ facets: { motif: [motifYunlei] } });
    const { status, body } = await review(id, { action: "approve" });
    expect(status).toBe(200);

    const p = await prisma.pattern.findUnique({
      where: { id: body.data.patternId },
      include: {
        motifs: true,
        categories: true,
        dynasties: true,
        regions: true,
        ethnicGroups: true,
        mediums: true,
        images: true,
      },
    });
    expect(p!.status).toBe("published");
    expect(p!.motifs).toHaveLength(1);
    expect(p!.categories).toHaveLength(1);
    expect(p!.dynasties).toHaveLength(1);
    expect(p!.regions).toHaveLength(1);
    expect(p!.ethnicGroups).toHaveLength(1);
    expect(p!.mediums).toHaveLength(1);
    expect(p!.images).toHaveLength(2);
  });

  it("★ 未选的维度挂「其它」而不是留空", async () => {
    const id = await makePending({ facets: { motif: [motifYunlei] } });
    const { body } = await review(id, { action: "approve" });
    const p = await prisma.pattern.findUnique({
      where: { id: body.data.patternId },
      include: { mediums: { include: { medium: true } } },
    });
    expect(p!.mediums[0].medium.name).toBe("其它");
  });

  it("★ 建议的新分面值会被建进查找表，并与已选值并存", async () => {
    const id = await makePending({
      facets: { motif: [motifYunlei] },
      suggestedFacets: { motif: ["测试新母题"] },
    });
    const { body } = await review(id, { action: "approve" });

    const created = await prisma.motif.findUnique({ where: { name: "测试新母题" } });
    expect(created, "建议的母题没有被创建").toBeTruthy();

    const p = await prisma.pattern.findUnique({
      where: { id: body.data.patternId },
      include: { motifs: { include: { motif: true } } },
    });
    const names = p!.motifs.map((m) => m.motif.name).sort();
    expect(names).toEqual(["云雷纹", "测试新母题"].sort());
  });

  it("图片从 pending/ 移到 patterns/，位图为主图", async () => {
    const before = files().length;
    const id = await makePending({ facets: { motif: [motifYunlei] } });
    const { body } = await review(id, { action: "approve" });

    expect(files().length, "patterns/ 里应多出两个文件").toBe(before + 2);

    const p = await prisma.pattern.findUnique({
      where: { id: body.data.patternId },
      include: { images: true },
    });
    const primary = p!.images.filter((i) => i.isPrimary);
    expect(primary).toHaveLength(1);
    expect(primary[0].type).toBe("bitmap");
  });

  it("驳回 → 标记 rejected，且**不产生 pattern**", async () => {
    const before = await prisma.pattern.count();
    const id = await makePending({});
    const { status, body } = await review(id, { action: "reject", note: "素材不合格" });

    expect(status).toBe(200);
    expect(body.data.status).toBe("rejected");
    expect(body.data.reviewNote).toBe("素材不合格");
    expect(await prisma.pattern.count()).toBe(before);
  });

  it("重复审核 → 409", async () => {
    const id = await makePending({});
    await review(id, { action: "approve" });
    const { status, body } = await review(id, { action: "approve" });
    expect(status).toBe(409);
    expect(body.error).toContain("approved");
  });

  it("不存在的 id → 404", async () => {
    const { status } = await review(999999, { action: "approve" });
    expect(status).toBe(404);
  });

  it("非法 action → 400", async () => {
    const id = await makePending({});
    const { status } = await review(id, { action: "删除" });
    expect(status).toBe(400);
  });

  it("★ 第二道防线：库里的脏记录（非法图片地址）在审核时被挡，且不移动任何文件", async () => {
    // 直接往库里塞一条 —— 绕过提交时的校验，模拟"修复前留下的旧记录"
    const dirty = await prisma.pending.create({
      data: {
        name: "脏记录",
        facets: "{}",
        suggestedFacets: "{}",
        images: JSON.stringify([
          { url: "/pending/", type: "vector" },
          { url: "/../../package.json", type: "bitmap" },
        ]),
      },
    });

    const filesBefore = files().length;
    const pendingBefore = pending().length;

    const { status } = await review(dirty.id, { action: "approve" });
    expect(status).toBe(400);

    expect(files().length, "不应有任何文件被移入 patterns/").toBe(filesBefore);
    expect(pending().length, "不应有任何文件被移出 pending/").toBe(pendingBefore);

    const still = await prisma.pending.findUnique({ where: { id: dirty.id } });
    expect(still!.status, "失败时不应把 pending 标记为已审核").toBe("pending");

    await prisma.pending.delete({ where: { id: dirty.id } });
  });

  it("★ 脏记录只有一张图 → 同样被挡（位图与矢量图都必填）", async () => {
    const dirty = await prisma.pending.create({
      data: {
        name: "只有一张图",
        facets: "{}",
        suggestedFacets: "{}",
        images: JSON.stringify([{ url: putPendingFile("only-one.png"), type: "bitmap" }]),
      },
    });

    const before = files().length;
    const { status } = await review(dirty.id, { action: "approve" });
    expect(status).toBe(400);
    expect(files().length, "不该有任何文件被移入 patterns/").toBe(before);
    expect((await prisma.pending.findUnique({ where: { id: dirty.id } }))!.status).toBe("pending");

    await prisma.pending.delete({ where: { id: dirty.id } });
  });
});

describe("GET /api/admin/pending —— 列表", () => {
  it("返回待审队列", async () => {
    const { status, body } = await call(listPending, `${BASE}/admin/pending`);
    expect(status).toBe(200);
    expect(Array.isArray(body.data)).toBe(true);
  });
});
