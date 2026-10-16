import { execFileSync } from "node:child_process";
import { rmSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * 测试环境的搭建与拆除。
 *
 * **隔离原则**：测试用 `test.db` 和 `.test-public/`，绝不碰 `dev.db`
 * 与 `public/patterns/` 里的真实素材。这不是洁癖 —— 之前就发生过一次
 * 未校验的路径把整个 `public/pending/` 目录搬走的事故。
 *
 * 每个 IT 文件在 beforeAll 里建一份全新的库（migrate + seed），afterAll 删掉。
 */

const ROOT = process.cwd();
export const TEST_DB = path.join(ROOT, "test.db");
export const TEST_PUBLIC = path.join(ROOT, ".test-public");

/** 建一个干净的测试库 + 干净的素材目录 */
export function buildTestEnv() {
  rmSync(TEST_DB, { force: true });
  rmSync(`${TEST_DB}-journal`, { force: true });
  rmSync(TEST_PUBLIC, { recursive: true, force: true });
  mkdirSync(path.join(TEST_PUBLIC, "pending"), { recursive: true });
  mkdirSync(path.join(TEST_PUBLIC, "patterns"), { recursive: true });

  const env = { ...process.env, DATABASE_URL: `file:${TEST_DB}` };

  execFileSync("npx", ["prisma", "migrate", "deploy"], { cwd: ROOT, env, stdio: "pipe" });
  execFileSync("npx", ["tsx", "prisma/seed.ts"], { cwd: ROOT, env, stdio: "pipe" });
}

/** 拆掉测试环境 */
export function destroyTestEnv() {
  rmSync(TEST_DB, { force: true });
  rmSync(`${TEST_DB}-journal`, { force: true });
  rmSync(TEST_PUBLIC, { recursive: true, force: true });
}

/**
 * 往测试暂存区放一个假图片文件，返回它的 URL（形如 `/pending/xxx.svg`）。
 * approve 用例需要真实存在的文件。
 */
export function putPendingFile(name: string, content = "<svg/>"): string {
  const dir = path.join(TEST_PUBLIC, "pending");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, name), content);
  return `/pending/${name}`;
}

/** 列出测试素材目录里的文件 */
export function listPatternFiles(): string[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("node:fs").readdirSync(path.join(TEST_PUBLIC, "patterns")) as string[];
  } catch {
    return [];
  }
}
