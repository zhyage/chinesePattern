import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { readdirSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import prisma from "@/lib/db";
import { buildTestEnv, destroyTestEnv, TEST_PUBLIC, putPendingFile } from "../setup-db";
import { PUT as putPattern, DELETE as deletePattern } from "@/app/api/admin/patterns/[id]/route";

/**
 * 编辑已发布条目（`PUT`）与删除（`DELETE`）—— design.md §5.4。
 *
 * 这里最值得盯的是**图片**：编辑时提交上来的 `images` 会混着两种 URL
 * （`/patterns/…` 没换的 + `/pending/…` 换了的），而搬文件/删文件一旦搞错，
 * 结果要么是破图、要么是悄悄删掉还在用的文件。
 */

const BASE = "http://localhost/api";

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

/** seed 只写库不铺文件，所以测试里要自己造出真实存在的素材文件 */
function putPatternFile(name: string, content = "<svg/>"): string {
  const dir = path.join(TEST_PUBLIC, "patterns");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, name), content);
  return `/patterns/${name}`;
}

const patternFiles = () => readdirSync(path.join(TEST_PUBLIC, "patterns"));
const pendingFiles = () => readdirSync(path.join(TEST_PUBLIC, "pending"));

const img = (url: string, type: "bitmap" | "vector") => ({ url, type });

let id: number;
let bmp: string; // 当前位图的 URL
let vec: string; // 当前矢量图的 URL

const put = (data: Record<string, unknown>) =>
  call(putPattern, `${BASE}/admin/patterns/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
    params: { id: String(id) },
  });

const del = (confirm?: string) =>
  call(deletePattern, `${BASE}/admin/patterns/${id}${confirm === undefined ? "" : `?confirm=${encodeURIComponent(confirm)}`}`, {
    method: "DELETE",
    params: { id: String(id) },
  });

/** 提交时最常用的形状：两张图原样不动 */
const body = (over: Record<string, unknown> = {}) => ({
  name: "云雷纹·圆雷",
  images: [img(bmp, "bitmap"), img(vec, "vector")],
  facets: {},
  ...over,
});

beforeAll(async () => {
  buildTestEnv();
  const p = await prisma.pattern.create({ data: { name: "云雷纹·圆雷", status: "published" } });
  id = p.id;
  bmp = putPatternFile("t-bmp.png", "原始位图");
  vec = putPatternFile("t-vec.svg", "原始矢量");
  await prisma.patternImage.createMany({
    data: [
      { patternId: id, url: bmp, type: "bitmap", isPrimary: true, sortOrder: 0, label: "位图" },
      { patternId: id, url: vec, type: "vector", isPrimary: false, sortOrder: 1, label: "矢量图" },
    ],
  });
});
afterAll(() => destroyTestEnv());

describe("PUT —— 基本字段与分面", () => {
  it("改名 / 描述 / 出处", async () => {
    const { status } = await put(body({ name: "云雷纹·圆雷（改）", description: "改了", source: "某书" }));
    expect(status).toBe(200);
    const p = await prisma.pattern.findUnique({ where: { id } });
    expect(p!.name).toBe("云雷纹·圆雷（改）");
    expect(p!.description).toBe("改了");
    expect(p!.source).toBe("某书");
  });

  it("分面整套替换", async () => {
    const motif = await prisma.motif.findUnique({ where: { name: "云雷纹" } });
    const cat = await prisma.category.findUnique({ where: { name: "几何纹" } });
    await put(body({ name: "云雷纹·圆雷", facets: { motif: [motif!.id], category: [cat!.id] } }));

    const links = await prisma.patternMotif.findMany({ where: { patternId: id } });
    expect(links.map((l) => l.motifId)).toEqual([motif!.id]);
    expect(await prisma.patternCategory.count({ where: { patternId: id } })).toBe(1);
  });

  it("★ 某维度一个值都没选 → 挂「其它」，不是清空", async () => {
    await put(body({ facets: {} }));
    const other = await prisma.motif.findUnique({ where: { name: "其它" } });
    const links = await prisma.patternMotif.findMany({ where: { patternId: id } });
    expect(links.map((l) => l.motifId)).toEqual([other!.id]);
  });

  it("★ 坏的分面 id → 400（以前会撞外键报 500）", async () => {
    const { status, body: b } = await put(body({ facets: { motif: [999999] } }));
    expect(status).toBe(400);
    expect(b.error).toContain("母题");
  });

  it("★ 不传 status → **保持原值**，不能悄悄把条目下架", async () => {
    // 真实事故：PUT 里写的是 `status: (body.status as string) || "draft"`，
    // 而当时的编辑器根本不发 status 字段 —— 于是"保存一次编辑"就把已发布的
    // 条目变成草稿（前台立刻不可见），而且界面上没有地方能改回来。
    // 破坏性的默认值比报错糟糕得多：报错当场发现，静默改状态要等某天发现条目不见了。
    expect((await prisma.pattern.findUnique({ where: { id } }))!.status).toBe("published");

    const { status } = await put(body({ name: "云雷纹·圆雷" })); // body() 刻意不带 status
    expect(status).toBe(200);

    expect(
      (await prisma.pattern.findUnique({ where: { id } }))!.status,
      "不该因为一次编辑就被改成 draft",
    ).toBe("published");
  });

  it("显式传 status 时才改它", async () => {
    await put(body({ status: "draft" }));
    expect((await prisma.pattern.findUnique({ where: { id } }))!.status).toBe("draft");

    await put(body({ status: "published" }));
    expect((await prisma.pattern.findUnique({ where: { id } }))!.status).toBe("published");
  });

  it("非法 status → 400", async () => {
    for (const s of ["已发布", "", 42, "PUBLISHED", null]) {
      expect((await put(body({ status: s }))).status, `status=${JSON.stringify(s)} 应被拒绝`).toBe(400);
    }
  });

  it("name 空白 → 400", async () => {
    expect((await put(body({ name: "   " }))).status).toBe(400);
  });

  it("不存在的条目 → 404", async () => {
    const r = await call(putPattern, `${BASE}/admin/patterns/999999`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body()),
      params: { id: "999999" },
    });
    expect(r.status).toBe(404);
  });
});

describe("PUT —— 图片", () => {
  it("★ 两张都没换 → 不搬任何文件，URL 原样保留", async () => {
    const before = patternFiles().sort();
    const { status } = await put(body());
    expect(status).toBe(200);

    const imgs = await prisma.patternImage.findMany({ where: { patternId: id }, orderBy: { sortOrder: "asc" } });
    expect(imgs.map((i) => i.url)).toEqual([bmp, vec]);
    expect(patternFiles().sort(), "不该产生任何新文件").toEqual(before);
  });

  it("★ 只换位图 → 只搬新的，矢量图原样不动（混合 URL 的核心场景）", async () => {
    const staged = putPendingFile("new-bmp.png", "新位图");
    const { status } = await put(body({ images: [img(staged, "bitmap"), img(vec, "vector")] }));
    expect(status).toBe(200);

    const imgs = await prisma.patternImage.findMany({ where: { patternId: id }, orderBy: { sortOrder: "asc" } });
    const newBmpUrl = imgs.find((i) => i.type === "bitmap")!.url;

    expect(newBmpUrl).toMatch(/^\/patterns\/[0-9a-f]{8}-bitmap\.png$/); // UUID 重命名，客户端名字不参与
    expect(imgs.find((i) => i.type === "vector")!.url, "没换的矢量图不该被动过").toBe(vec);

    // 新文件到位、暂存文件搬走
    expect(existsSync(path.join(TEST_PUBLIC, "patterns", path.basename(newBmpUrl)))).toBe(true);
    expect(existsSync(path.join(TEST_PUBLIC, "pending", "new-bmp.png"))).toBe(false);

    // 被替换掉的旧位图文件应被清掉；矢量图文件必须还在
    expect(existsSync(path.join(TEST_PUBLIC, "patterns", path.basename(bmp))), "旧位图应被删除").toBe(false);
    expect(existsSync(path.join(TEST_PUBLIC, "patterns", path.basename(vec))), "仍在用的矢量图不能被删").toBe(true);

    bmp = newBmpUrl;
  });

  it("换图后 isPrimary / sortOrder 按提交的值落库", async () => {
    const imgs = await prisma.patternImage.findMany({ where: { patternId: id } });
    expect(imgs.filter((i) => i.isPrimary).map((i) => i.type)).toEqual(["bitmap"]);
  });

  it("图片数量不对 → 400", async () => {
    expect((await put(body({ images: [img(bmp, "bitmap")] }))).status).toBe(400);
    expect((await put(body({ images: [] }))).status).toBe(400);
    expect(
      (await put(body({ images: [img(bmp, "bitmap"), img(vec, "bitmap")] }))).status,
    ).toBe(400);
  });

  it("★ 非法图片地址 → 400，且一个文件都没动", async () => {
    const filesBefore = patternFiles().sort();
    const pendingBefore = pendingFiles().sort();

    for (const bad of ["/pending/", "/../../package.json", "/pending/不存在.png", "/etc/passwd"]) {
      const { status } = await put(body({ images: [img(bad, "bitmap"), img(vec, "vector")] }));
      expect(status, `应该拒绝 ${bad}`).toBe(400);
    }

    expect(patternFiles().sort()).toEqual(filesBefore);
    expect(pendingFiles().sort()).toEqual(pendingBefore);
  });

  it("★ 校验失败时数据库也不该被改动", async () => {
    const beforeRow = await prisma.pattern.findUnique({ where: { id } });
    await put(body({ name: "不该生效", images: [img("/pending/", "bitmap")] }));
    const afterRow = await prisma.pattern.findUnique({ where: { id } });
    expect(afterRow!.name).toBe(beforeRow!.name);
  });

  it("★ 被别的条目共用的图片不会被删掉", async () => {
    const other = await prisma.pattern.create({ data: { name: "共用图", status: "published" } });
    await prisma.patternImage.create({
      data: { patternId: other.id, url: vec, type: "vector", isPrimary: false, sortOrder: 0 },
    });

    const staged = putPendingFile("another.png", "另一张");
    await put(body({ images: [img(staged, "bitmap"), img(vec, "vector")] }));

    expect(
      existsSync(path.join(TEST_PUBLIC, "patterns", path.basename(vec))),
      "还被别的条目引用着，不能删",
    ).toBe(true);

    // 清理：这个"共用的条目"若不删掉，后面的删除用例会因为它还引用着 vec
    // 而正确地跳过删文件，看起来却像实现坏了 —— 用例之间的状态泄漏就是这样变成假故障的
    await prisma.pattern.delete({ where: { id: other.id } });
  });
});

describe("DELETE", () => {
  it("★ 不带 confirm 或 confirm 不匹配 → 400，且什么都没删", async () => {
    expect((await del()).status).toBe(400);
    expect((await del("错的名称")).status).toBe(400);
    expect(await prisma.pattern.findUnique({ where: { id } })).not.toBeNull();
  });

  it("★ confirm 正确 → 删库 + 真删图片文件", async () => {
    const p = await prisma.pattern.findUnique({ where: { id } });
    const urls = (await prisma.patternImage.findMany({ where: { patternId: id } })).map((i) => i.url);
    expect(urls.length).toBe(2);

    const { status } = await del(p!.name);
    expect(status).toBe(200);

    expect(await prisma.pattern.findUnique({ where: { id } })).toBeNull();
    // 中间表与图片行级联删除
    expect(await prisma.patternImage.count({ where: { patternId: id } })).toBe(0);
    expect(await prisma.patternMotif.count({ where: { patternId: id } })).toBe(0);

    for (const u of urls) {
      expect(existsSync(path.join(TEST_PUBLIC, "patterns", path.basename(u))), `${u} 应被删除`).toBe(false);
    }
  });

  it("不存在的条目 → 404", async () => {
    const r = await call(deletePattern, `${BASE}/admin/patterns/999999?confirm=x`, {
      method: "DELETE",
      params: { id: "999999" },
    });
    expect(r.status).toBe(404);
  });
});
