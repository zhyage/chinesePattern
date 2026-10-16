# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## rules
* talk to me by chinese
* Don't Assume
* Don't Hide Confusion
* Surface Tradeoffs
* Goal-Driven Execution
* Don't Touch What You Don't Understand
* Simple First
* Verify Before Trust
* Batch Questions
* Reflect After Each Step
* Save My Tokens
* Treat Me Like a Senior


## 测试约定（**每次代码改动都必须遵守**）

改完任何代码之后，收工之前必须做这两件事：

1. **确认是否有相关用例需要同步更新**
   改了函数行为、改了接口返回、改了数据结构 —— 对应的测试用例要一起改。
   新增功能要补新用例。**改了行为却不改用例 = 测试开始说谎**，比没有测试更糟。

2. **跑一遍全部测试**（`npm test`）
   不只是跑你刚碰过的那部分。目的是确认**这次改动没有破坏别的功能**。
   测试红了不要绕过、不要注释掉 —— 要么修代码，要么改用例并说明为什么。

```bash
npm test            # UT + IT，收工前必跑（约 14 秒）
npm run test:ut     # 只跑单元测试（约 0.5 秒，不需要数据库）
npm run test:it     # 只跑集成测试（约 12 秒，要建测试库）
npm run test:e2e    # 端到端（约 30 秒，真开浏览器 + 真起服务器）
npm run typecheck   # tsc --noEmit（约 6 秒）
npm run test:watch  # 开发时用
```

> ⚠️ **`test/` 下的类型错误没人管，除非你跑 `npm run typecheck`。**
> `next build` 只检查 `src/`；vitest 和 playwright 都只转译不做类型检查。
> 于是 `test/` 里的类型错误能一路绿灯通过构建和测试，直到某天有人跑 tsc 才发现
> （实际发生过：`locator.evaluate` 的元素类型是 `SVGElement | HTMLElement`，
> 不等于 `HTMLImageElement`）。**动了测试文件就顺手跑一次。**

**目录约定**

```
test/
├── setup-db.ts      测试环境搭建（建测试库 / 素材目录）
├── ut/              单元测试 —— 纯函数，不碰数据库
├── it/              集成测试 —— 调 route handler，需要数据库
└── e2e/             端到端 —— Playwright，真浏览器（*.spec.ts）
```

- 测试**统一放 `test/` 下，不要和源码放一起**（保持一致；混着放会出现两套约定）
- 测试里用 `@/` 别名引用源码（`@/lib/facets`），**不要写 `../../src/...`** —— 一移动文件就断
- IT 直接调 route handler，不起 HTTP 服务器（快得多也稳得多）
- ET 用 `.spec.ts` 后缀 —— vitest 只收 `*.test.ts`，两者不会互相误跑

**三层各管什么**（别在错的一层写用例）

| 层 | 管什么 | 例子 |
|---|---|---|
| UT | 纯函数 | URL 拼装、id 解析 |
| IT | 接口行为 | 筛选条数、分页、审核流 |
| ET | **只有浏览器能验的** | 点击链路、CSS 驱动的交互、跨页跳转、素材是否真的加载出来 |

**ET 服务器的生命周期**（Playwright 自己管，四种情况实测过）

| 情形 | 结果 |
|---|---|
| 全部通过 | ✓ 自动回收 |
| 有用例失败 | ✓ 自动回收 |
| Ctrl+C（SIGINT） | ✓ 自动回收 |
| **SIGKILL**（`kill -9` / OOM / 强关终端） | ❌ **变成孤儿进程，占着 3100** |

捕不到信号的强杀是唯一会漏的情况，之后跑 ET 会起不来。清掉：

```bash
fuser -k 3100/tcp
```

ET 用独立的 `.next-e2e` 构建目录（见 `next.config.ts` 的 `distDir`），所以**可以一边开着
`npm run dev` 一边跑 ET** —— 否则 Next 16 会因为同目录已有 dev server 而拒绝启动。

**⚠️ 「点了没反应」先查跨源拦截**

Next 16 默认**拦截跨源的 dev 资源**（`/_next/webpack-hmr` 等）。从局域网 IP
（如 `192.168.x.x:3000`）打开页面时，后果**不是"热更新失效"那么轻**，而是
**React 根本不水合**：CSS 全部正常、页面看着没毛病，但**所有 JS 交互都是死的**。

最容易误判的地方：详情页上除了灯箱，其它交互（筛选链接、位图/矢量切换）
全靠普通链接和 CSS 工作，**不依赖 JS** —— 所以症状看起来只是"点图片没反应"，
很容易当成图片组件的 bug 去查。

`next.config.ts` 的 `allowedDevOrigins` 已经放开了私有网段。换网络环境
（IP 变了）后再出现这个症状，先回来看它。判断是否水合，控制台跑：

```js
Object.keys(document.querySelector('[data-testid=viewer-image]')).some(k => k.startsWith('__react'))
```

`true` = 水合了，问题在别处；`false` = JS 没跑起来。

**写 ET 的两条硬规则**

1. **断言写关系，不写绝对数字。** 现在是 14 条 seed，真实素材录进来就变了。
   写"筛选后条数 == 该选项旁边的计数"，不要写 `expect(total).toBe(14)`。
2. **别只断言"元素可见"。** CSS 死循环（收缩包裹容器 + 百分比宽度）会把图压成
   `0×0` —— 图**加载成功**（`naturalWidth > 0`）但绘制尺寸为零，肉眼在测试里看不出来。
   视觉相关的东西要量真实盒尺寸，见 `test/e2e/detail.spec.ts` 的图片切换用例。

> 这两条不是建议。跳过它们，前面几轮踩过的坑（路径穿越漏洞、目录被整个搬走、
> `其它` 兜底缺失）就会以同样的方式再出现一次。

---

## Project Overview

**中国传统纹饰 App (Chinese Traditional Pattern Motif App)**

A dual-core web application:
1. **纹饰素材库 (Museum)** — Collect, organize, and display Chinese traditional patterns/motifs with cultural context
2. **纹饰排版打版工具 (Workbench)** — User uploads SVG base boards (garment patterns, tea pot layouts, etc.), selects patterns from the library, arranges them freely, and exports 1:1 printable SVGs for craft use (embroidery, wood carving, laser engraving, etc.)

## Current Phase

**Stage 1A：素材库 — 正在按「扁平 + 分面」模型重写。**

数据模型已从早期的「纹饰类型 → 式样」两层结构，改为**一张扁平的 pattern 表 +
六个地位平等的分面维度**（朝代/地域/民族/题材/母题/载体，都是多对多）。
演变时间线、关联图谱、变种、层级 —— 全部废除。理由见 [design.md](design.md) §2.1。

> 动手前务必先读 design.md §11 术语表 —— `category`（题材）和 `motif`（母题）
> 是两个不同的维度，历史上多次因混用而返工。

## Commands

```bash
npm run dev     # Start dev server (localhost:3000)
npm run build   # Production build
npm run lint    # Run ESLint
```

## ⚠️ 数据库操作的硬约束

- **必须用 Node v20.20.2**：`better-sqlite3` 原生模块在 Node 24 下崩溃（`ERR_DLOPEN_FAILED`）。
  注意 `require("better-sqlite3")` 在 Node 24 下**会成功**（原生绑定懒加载），
  只有 `new Database()` 才抛错 —— 别用 import 来验证版本。
  ```bash
  export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
  ```
- **schema 变更走 `prisma migrate`**（已建立基线），不要用 `db push`
- ⚠️ **`prisma migrate dev` 不会重新生成 Prisma Client** —— 尽管它打印
  "Your database is now in sync with your schema"。不加 `prisma generate` 的话，
  新字段在类型和运行时都不存在，报 `Unknown field xxx for select statement`。
  **改完 schema 一定补一条 `npx prisma generate`**（踩过两次）
- **SQLite 的迁移是"重建表"**：Prisma 会 `CREATE new_x` → `INSERT ... SELECT` →
  `DROP x` → `RENAME`。行数相同不代表数据对，**改完要用备份做内容 diff**，
  不能只看 `count(*)`
- **改 schema 前先备份 `dev.db`**，改完核对行数 / 外键 / 完整性
- **不要无脑重跑 `prisma/seed.ts`** —— 它开头会 `deleteMany()` 清空全部数据
- **不要给 `prisma.config.ts` 加 seed 配置** —— 那会让 `prisma db seed` 无确认清库

## ⚠️ UI 约定：导航链接不要用 `<Button render={<Link/>}>`

要"看起来像按钮的链接"，用 **`Link` + `buttonVariants()`**：

```tsx
import { buttonVariants } from "@/components/ui/button";
<Link href="/x" className={buttonVariants({ variant: "outline", size: "sm" })}>文字</Link>
```

不要在 `<Button>` 上挂 `render={<Link/>}`。Base UI 的 Button 用 `useButton`，
会给渲染出的 `<a>` 塞上 **`role="button" tabindex="0"`** —— 把链接的语义改掉了：
读屏软件念成按钮，`getByRole("link")` 也找不到它。

> 这个坑绕了一圈：最初 `render={<Link/>}` 会报一条开发警告（"expected a native `<button>`"），
> 我按提示加了 `nativeButton={false}` —— **结果那条警告正是对的**：它指出的是
> "拿 Button 组件做链接"这件事本身有问题。加了开关之后警告没了，
> 但 `<a>` 变成了 `role="button"`，是个**真实的无障碍退化**。是 ET
> （`getByRole("link")` 定位不到）把它暴露出来的。
> **警告消失不等于问题解决。**

`<Badge render={<Link/>}>` 不受影响 —— Badge 是 span 语义，不走 `useButton`。

## Tech Stack

- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS v4
- **UI 组件库是 `@base-ui/react`，不是 Radix**（`components.json` 的 style 为 `base-nova`）
- Prisma 7 + SQLite（开发）/ PostgreSQL（生产）
- 排版引擎：**原生 SVG + React**（早期文档选的 Fabric.js 已废弃，理由见 design.md §7.2）
- Deployment: Vercel（未部署）

## Important Docs

- [design.md](design.md) — **需求与数据模型，开发的唯一依据**
- [design.old.md](design.old.md) — 旧版设计（已作废，仅作历史参考）
- [idea.md](idea.md) — 最初的构想
- [schedule.md](schedule.md) — ⚠️ 旧版 1A 任务表，与当前模型冲突，尚未重写
