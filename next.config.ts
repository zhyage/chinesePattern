import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * 构建产物目录，默认 `.next`。
   *
   * 为什么允许改：Next 16 的 dev server 会在构建目录下登记实例，
   * **同一目录里第二个 `next dev` 会检测到第一个然后拒绝启动**
   * （报 "Process from config.webServer was not able to start"，并打印已有实例的 PID）。
   * 于是「一边开着 npm run dev，一边跑 npm run test:e2e」会直接失败 ——
   * 而边开发边跑 E2E 恰恰是最常用的时机。
   * ET 的 webServer 用 NEXT_DIST_DIR=.next-e2e 隔离开（见 playwright.config.ts）。
   */
  distDir: process.env.NEXT_DIST_DIR ?? ".next",

  /**
   * 允许从局域网 IP 访问 dev server。
   *
   * ⚠️ 这不是"方便热更新"的小事。Next 16 默认拦截跨源的 dev 资源
   * （`/_next/webpack-hmr` 等），实测后果是 **React 根本不水合**：
   * 页面 CSS 全部正常、看着没毛病，但**所有 JS 交互都是死的**
   * （详情页上唯一的症状是"点图片没反应"，因为其它交互全靠链接和 CSS）。
   *
   * 而 `npm run dev` 用的是 `-H 0.0.0.0`，Next 启动时还会主动打印
   * `Network: http://192.168.x.x:3000` 邀请你用那个地址 —— 用了就踩。
   *
   * 只在开发环境生效，不影响 `next build` 的产物。
   * 换网络环境（IP 变了）时如果又出现"点了没反应"，先回来看这里。
   */
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "localhost", "127.0.0.1"],
};

export default nextConfig;
