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

**Stage 1A: Museum — In development.** Next.js project initialized at `/home/vdmc34/my/chinesePattern`.

## Commands

```bash
npm run dev     # Start dev server (localhost:3000)
npm run build   # Production build
npm run lint    # Run ESLint
```

## Tech Stack

- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS v4
- shadcn/ui (pending setup)
- Prisma + SQLite (pending setup)
- Deployment: Vercel (pending)

## Important Docs

- [design.md](design.md) — Complete requirements specification
- [idea.md](idea.md) — Original project idea
- [schedule.md](schedule.md) — Task breakdown and schedule
