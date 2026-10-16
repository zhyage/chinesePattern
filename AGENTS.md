<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# 项目级行为约定（对本仓库所有任务生效）

## 语言
- **默认用中文回复用户。** 用户可能用英文提问，但回答一律用中文。
- 代码注释、commit message、文档保持中文。

## 沟通风格
- 不假设、不藏困惑，有 tradeoff 直说。
- 先给结论再动手，简单优先，动手前先验证。

## 开发护栏
- 涉及数据库（SQLite / Prisma）的操作，先确认 Node 版本是 **v20.20.2**；
  在 Node 24 下 `better-sqlite3` 原生模块会崩（`ERR_DLOPEN_FAILED`）。
  注意 `require("better-sqlite3")` 在 Node 24 下**会成功**（原生绑定懒加载），
  只有 `new Database()` 才抛错 —— 别用 import 验证版本。
- 不要无脑重跑 `prisma/seed.ts` —— 它开头会 `deleteMany()` 清空全部手工/测试数据。
- 接口报错不要用 `catch { return [] }` 静默吞掉，要让错误可见。
- schema 变更走 `prisma migrate`（已有基线），不要用 `db push`。

## 测试（**每次代码改动都要遵守，详见 CLAUDE.md**）
1. 确认是否有相关用例需要同步更新 —— 改了行为却不改用例，测试就开始说谎
2. 收工前跑 `npm test` 全量，确认没破坏别的功能

```bash
npm test          # UT + IT（收工前必跑）
npm run test:ut   # 只跑单元测试（0.5 秒，不需要数据库）
npm run test:it   # 只跑集成测试（12 秒，要建测试库）
npm run test:e2e  # 端到端（30 秒，Playwright，真开浏览器 + 真起服务器）
```

**目录约定**：测试统一放 `test/ut/`（单元）、`test/it/`（集成）、`test/e2e/`（端到端，用 `.spec.ts` 后缀），**不要和源码放一起**。
测试里用 `@/` 别名引用源码，不要写 `../../src/...` 相对路径。

**ET 的两条硬规则**：断言写关系不写绝对数字（seed 条数会变）；视觉相关的东西别只断言"元素可见" —— 量真实盒尺寸，`0×0` 的塌陷元素在可见性判断里是隐形的。详见 CLAUDE.md。

测试用独立的 `test.db` 与 `.test-public/`，**不会碰 dev.db 和 public/patterns/ 里的真实素材**。
