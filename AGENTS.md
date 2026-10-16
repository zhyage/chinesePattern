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
- 不要无脑重跑 `prisma/seed.ts` —— 它开头会 `deleteMany()` 清空全部手工/测试数据。
- 接口报错不要用 `catch { return [] }` 静默吞掉，要让错误可见。
