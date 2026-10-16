import { defineConfig } from "vitest/config";
import path from "node:path";

const ROOT = import.meta.dirname;

/**
 * 测试隔离的关键：**数据库和素材目录都指向测试专用位置**，
 * 测试永远不会碰 dev.db 和 public/patterns/ 里的真实素材。
 *
 * 这里用 `test.env` 而不是在测试文件里设 —— 因为 `src/lib/db.ts` 在模块加载时
 * 就会读 DATABASE_URL，测试文件里的赋值来不及。
 *
 * 目录约定（见 CLAUDE.md）：
 *   test/ut/   单元测试 —— 纯函数，不碰数据库，跑一次约 0.5 秒
 *   test/it/   集成测试 —— 要建测试库 + 迁移 + seed，跑一次约 12 秒
 *
 * 测试文件用 `@/` 别名引用源码（如 `@/lib/facets`），不要写 `../../src/...`
 * 的相对路径 —— 那样一移动文件就会断。
 */
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(ROOT, "src") },
  },
  test: {
    environment: "node",
    // 刻意同时保留两个 pattern：如果只留 test/，将来有人把测试放回 src/ 下
    // 就会**静默不跑**（以为测了其实没测）。宁可容忍，也不要静默失败。
    include: ["src/**/*.test.ts", "test/**/*.test.ts"],
    env: {
      DATABASE_URL: `file:${path.join(ROOT, "test.db")}`,
      PUBLIC_DIR: path.join(ROOT, ".test-public"),
    },
    // 各 IT 文件共用同一个 test.db，串行跑避免互相踩
    fileParallelism: false,
    // 建库 + 迁移 + seed 有子进程开销，放宽超时
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
