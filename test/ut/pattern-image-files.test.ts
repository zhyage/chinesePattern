import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { resolvePatternFile, validateImages } from "@/lib/pattern-image-files";
import { patternsDir, pendingDir } from "@/lib/storage";
import { facetDelegate } from "@/lib/facet-delegates";

/**
 * `resolvePatternFile` 和 `resolvePendingFile` 一样是**安全边界**。
 *
 * 这里每一条「必须拒绝」都对应一种真实攻击：这个函数的结果会被拿去
 * `rm()` 删文件、或被写进数据库当成图片地址。放过去一个 `..`，
 * 就意味着能删掉仓库里任意文件。
 *
 * 之前的 IT 用例只覆盖了"不以 /patterns/ 开头"这一种（`/etc/passwd`）——
 * **前缀对了、但里面藏了跳转**的那些分支一个都没测。
 */

const write = (rel: string, content = "x") => {
  const abs = path.join(patternsDir(), rel);
  mkdirSync(path.dirname(abs), { recursive: true });
  writeFileSync(abs, content);
  return abs;
};

beforeAll(() => {
  rmSync(patternsDir(), { recursive: true, force: true });
  mkdirSync(patternsDir(), { recursive: true });
  mkdirSync(pendingDir(), { recursive: true });
  write("ok.png");
  write("ok.svg");
  write("sub/inner.png"); // 子目录里的文件
});

afterAll(() => {
  rmSync(patternsDir(), { recursive: true, force: true });
  rmSync(pendingDir(), { recursive: true, force: true });
});

describe("resolvePatternFile —— 合法输入", () => {
  it("接受存在的素材文件", async () => {
    const abs = await resolvePatternFile("/patterns/ok.png");
    expect(abs).toBe(path.join(patternsDir(), "ok.png"));
  });

  it("扩展名大小写不敏感", async () => {
    write("UPPER.SVG");
    expect(await resolvePatternFile("/patterns/UPPER.SVG")).not.toBeNull();
  });
});

describe("resolvePatternFile —— 必须拒绝（安全）", () => {
  // 第一项是 unknown：非字符串的输入也要能挡住，不能被类型系统挡在测试之外
  const attacks: Array<[unknown, string]> = [
    ["/patterns/../package.json", "用 .. 跳出素材目录"],
    ["/patterns/../../etc/passwd", "跳得更远"],
    ["/patterns/sub/inner.png", "多一层子目录"],
    ["/patterns/ok.png/../../x", "先合法再跳转"],
    ["/patterns/", "空文件名（是目录不是文件）"],
    ["/patterns/sub", "指向一个目录"],
    ["/patterns/nope.png", "文件不存在"],
    ["/patterns/evil.sh", "扩展名不在白名单"],
    ["/patterns/evil.exe", "扩展名不在白名单"],
    ["/patterns/ok.png.exe", "双扩展名，取最后一个"],
    ["/etc/passwd", "不是 /patterns/ 开头"],
    ["/pending/ok.png", "暂存区的路径不该从这个函数走"],
    ["patterns/ok.png", "少了开头的斜杠"],
    ["//patterns/ok.png", "双斜杠开头"],
    ["", "空串"],
    [null, "null"],
    [42, "数字"],
    [{}, "对象"],
  ];

  it.each(attacks)("拒绝 %s（%s）", async (input) => {
    expect(await resolvePatternFile(input)).toBeNull();
  });

  it("反斜杠分隔同样被拒（Windows 风格路径）", async () => {
    expect(await resolvePatternFile("/patterns/..\\package.json")).toBeNull();
  });
});

describe("validateImages —— 数量与类型", () => {
  const okImgs = [
    { url: "/patterns/ok.png", type: "bitmap" },
    { url: "/patterns/ok.svg", type: "vector" },
  ];

  it("一张位图 + 一张矢量图 → 通过", async () => {
    const r = await validateImages(okImgs);
    expect(r.ok).toBe(true);
  });

  it("★ 缺一张 → 拒绝（design.md §5.4：两张都必填）", async () => {
    for (const imgs of [
      [okImgs[0]],
      [okImgs[1]],
      [],
      [okImgs[0], { url: "/patterns/ok.svg", type: "bitmap" }],
      [okImgs[1], { url: "/patterns/ok.png", type: "vector" }],
    ]) {
      const r = await validateImages(imgs);
      expect(r.ok, `${JSON.stringify(imgs)} 应被拒绝`).toBe(false);
    }
  });

  it("不是数组 → 拒绝", async () => {
    for (const v of [null, undefined, "x", {}, 42]) {
      expect((await validateImages(v)).ok).toBe(false);
    }
  });

  it("★ 元素不是对象 → 拒绝", async () => {
    for (const bad of [null, "x", 42, [okImgs[0]]]) {
      const r = await validateImages([bad, okImgs[1]]);
      expect(r.ok, `${JSON.stringify(bad)} 应被拒绝`).toBe(false);
    }
  });

  it("★ type 不是 bitmap/vector → 拒绝", async () => {
    for (const t of ["gif", "png", "", "BITMAP", null, undefined]) {
      const r = await validateImages([{ url: "/patterns/ok.png", type: t }, okImgs[1]]);
      expect(r.ok, `type=${String(t)} 应被拒绝`).toBe(false);
    }
  });

  it("url 不是字符串 → 拒绝", async () => {
    const r = await validateImages([{ url: 42, type: "bitmap" }, okImgs[1]]);
    expect(r.ok).toBe(false);
  });
});

describe("validateImages —— 混合 URL（编辑已发布条目的核心场景）", () => {
  it("★ /patterns/（没换的）与 /pending/（换了的）混在一起都能通过", async () => {
    writeFileSync(path.join(pendingDir(), "staged.png"), "new");
    const r = await validateImages([
      { url: "/patterns/ok.png", type: "bitmap" },
      { url: "/pending/staged.png", type: "vector" },
    ]);
    expect(r.ok).toBe(true);
    if (!r.ok) return;

    // 只有暂存区那张需要搬（abs 非空），已在 patterns/ 的原样留
    const bmp = r.images.find((i) => i.type === "bitmap")!;
    const vec = r.images.find((i) => i.type === "vector")!;
    expect(bmp.abs, "已发布的图不该被重新搬").toBeNull();
    expect(bmp.url).toBe("/patterns/ok.png");
    expect(vec.abs, "暂存区的图需要搬").not.toBeNull();
  });

  it("默认值补齐：位图 isPrimary、sortOrder 与 label", async () => {
    const r = await validateImages([
      { url: "/patterns/ok.png", type: "bitmap" },
      { url: "/patterns/ok.svg", type: "vector" },
    ]);
    if (!r.ok) throw new Error("应当通过");
    const bmp = r.images.find((i) => i.type === "bitmap")!;
    const vec = r.images.find((i) => i.type === "vector")!;
    expect(bmp.isPrimary).toBe(true);
    expect(vec.isPrimary).toBe(false);
    expect(bmp.sortOrder).toBe(0);
    expect(vec.sortOrder).toBe(1);
  });

  it("暂存区地址非法时也拒绝（不会当作已发布图放过）", async () => {
    const r = await validateImages([
      { url: "/pending/../ok.png", type: "bitmap" },
      { url: "/patterns/ok.svg", type: "vector" },
    ]);
    expect(r.ok).toBe(false);
  });
});

describe("facetDelegate", () => {
  it("★ 未知的表名直接抛错 —— 不静默返回 undefined 等到某个请求 500", () => {
    expect(() => facetDelegate({}, "nope")).toThrow(/未知的查找表访问器/);
  });

  it("client 为 null 时也抛错而不是崩溃在别处", () => {
    expect(() => facetDelegate(null, "motif")).toThrow();
  });

  it("取到访问器就原样返回", () => {
    const fake = { findMany: () => {} };
    expect(facetDelegate({ motif: fake }, "motif")).toBe(fake);
  });
});
