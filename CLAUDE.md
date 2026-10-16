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
- **改 schema 前先备份 `dev.db`**，改完核对行数 / 外键 / 完整性
- **不要无脑重跑 `prisma/seed.ts`** —— 它开头会 `deleteMany()` 清空全部数据
- **不要给 `prisma.config.ts` 加 seed 配置** —— 那会让 `prisma db seed` 无确认清库

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
