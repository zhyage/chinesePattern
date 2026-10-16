import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { isValidPendingUrl, resolvePendingFile } from "@/lib/pending-images";
import { pendingDir } from "@/lib/storage";

/**
 * 这是**安全边界**的测试，不是格式检查。
 *
 * 每一条「必须拒绝」都对应一种真实攻击 —— 这些不是假想的：
 * 测试期间真的发生过一次未校验的路径把整个 public/pending/ 目录搬走的事故。
 */

describe("isValidPendingUrl —— 合法输入", () => {
  const ok = [
    "/pending/abc.svg",
    "/pending/abc.jpg",
    "/pending/abc.jpeg",
    "/pending/abc.png",
    "/pending/abc.webp",
    "/pending/1730000000000-a1b2c3d4.svg", // 上传接口实际生成的形式
  ];

  it.each(ok)("接受 %s", (url) => {
    expect(isValidPendingUrl(url)).toBe(true);
  });

  it("扩展名大小写不敏感", () => {
    expect(isValidPendingUrl("/pending/abc.SVG")).toBe(true);
    expect(isValidPendingUrl("/pending/abc.JpG")).toBe(true);
  });
});

describe("isValidPendingUrl —— 必须拒绝（安全）", () => {
  const attacks: Array<[string, string]> = [
    ["/../../package.json", "移走仓库里任意文件"],
    ["/pending/../patterns/yunlei.svg", "从暂存区逃到素材区"],
    ["/etc/passwd", "绝对路径"],
    ["/pending/", "目录本身 —— 实测把整个目录搬走过"],
    ["/pending/a/b.svg", "子路径"],
    ["http://evil.com/x.svg", "外链"],
    ["pending/abc.svg", "缺前导斜杠"],
    ["/pending/abc", "无扩展名"],
    ["/pending/abc.exe", "扩展名不在白名单"],
    ["/pending/abc.svg.txt", "双扩展名（真实扩展名是 .txt）"],
    ["/pending/..%2f..%2fetc/passwd", "URL 编码的目录跳转"],
    ["\\pending\\abc.svg", "反斜杠"],
    ["/pending/....//abc.svg", "拼接式跳转"],
  ];

  it.each(attacks)("拒绝 %s（%s）", (url) => {
    expect(isValidPendingUrl(url)).toBe(false);
  });

  it("拒绝非字符串", () => {
    expect(isValidPendingUrl(null)).toBe(false);
    expect(isValidPendingUrl(undefined)).toBe(false);
    expect(isValidPendingUrl(123)).toBe(false);
    expect(isValidPendingUrl({})).toBe(false);
    expect(isValidPendingUrl([])).toBe(false);
  });
});

describe("resolvePendingFile —— 解析成真实文件路径", () => {
  const dir = pendingDir();

  beforeAll(() => {
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, "real.svg"), "<svg/>");
    mkdirSync(path.join(dir, "a-directory"), { recursive: true });
  });

  afterAll(() => {
    rmSync(dir, { recursive: true, force: true });
    // 连父目录一起清 —— 只删 pending/ 会留下一个空的 .test-public
    rmSync(path.dirname(dir), { recursive: true, force: true });
  });

  it("存在的文件 → 返回绝对路径", async () => {
    const abs = await resolvePendingFile("/pending/real.svg");
    expect(abs).toBe(path.join(dir, "real.svg"));
  });

  it("文件不存在 → null", async () => {
    expect(await resolvePendingFile("/pending/nope.svg")).toBeNull();
  });

  it("路径指向目录 → null（必须是文件）", async () => {
    expect(await resolvePendingFile("/pending/a-directory")).toBeNull();
  });

  it("非法 URL → null，且不会去访问文件系统", async () => {
    expect(await resolvePendingFile("/../../package.json")).toBeNull();
    expect(await resolvePendingFile("/pending/")).toBeNull();
    expect(await resolvePendingFile("/etc/passwd")).toBeNull();
  });

  it("解析结果必定落在暂存区之内", async () => {
    const abs = await resolvePendingFile("/pending/real.svg");
    expect(abs).not.toBeNull();
    expect(path.relative(dir, abs as string).startsWith("..")).toBe(false);
  });
});
