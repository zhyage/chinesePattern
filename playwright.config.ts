import { defineConfig, devices } from "@playwright/test";
import path from "node:path";

/**
 * ET（端到端）—— 真的开浏览器、真的起服务器。
 *
 * 与 UT/IT 的分工：
 *   UT  纯函数
 *   IT  直接调 route handler，验接口行为
 *   ET  只有浏览器能验的东西 —— 点击链路、CSS 驱动的交互（图片切换）、
 *       页面之间的跳转。UT/IT 原理上覆盖不到这些。
 *
 * 隔离：用独立的 `test.db`，与 IT 同一套（两者不会同时跑）。
 * 素材**不隔离** —— Next 的静态服务永远读真实 `public/`，`PUBLIC_DIR` 只影响
 * 我们自己的上传代码。所以 ET 里看到的就是真实素材，也就不该做上传类测试
 * （那是 /admin 的事，等阶段 4 重写完再说）。
 */

const PORT = 3100; // 避开 npm run dev 的 3000
const TEST_DB = path.join(process.cwd(), "test.db");

export default defineConfig({
  testDir: "./test/e2e",
  // 共用一个库，串行跑避免互相踩（与 IT 同策略）
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  // 本地不重试：偶发失败要看见，不要被重试掩盖
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  timeout: 30_000,

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    // 先建库（migrate + seed），再起服务 —— 顺序不能反
    command: "npm run e2e:serve",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: `file:${TEST_DB}`,
      // 读路径用不到，设上是为了万一有写入也别落到真实目录
      PUBLIC_DIR: path.join(process.cwd(), ".test-public"),
      // 独立的构建目录 —— 否则会和正在跑的 `npm run dev` 抢 .next，
      // 而 Next 16 不允许同目录两个 dev server（第二个直接拒绝启动）
      NEXT_DIST_DIR: ".next-e2e",
    },
  },
});
