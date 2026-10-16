import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pendingDir } from "@/lib/storage";

/**
 * 上传素材 —— 落到**暂存区** `public/pending/`。
 *
 * 审核通过时才会移到 `public/patterns/`（见 admin/pending 的 approve 分支）。
 * 这样未审核的内容不会混进对外服务的素材目录。
 *
 * ⚠️ 旧实现有两个问题，这里都修掉了：
 *   1. **路径穿越**：直接用 `file.name` 拼路径写盘。上传一个叫
 *      `../../src/app/page.tsx` 的文件就能覆盖源码。
 *   2. **无校验**：不检查扩展名、MIME、大小，任意文件都能落盘。
 *
 * 现在的做法：**完全不用用户提供的文件名**，改用 UUID 生成，
 * 扩展名从白名单里取。
 */

/** 允许的扩展名 → 对应的图片类型 */
const ALLOWED: Record<string, "bitmap" | "vector"> = {
  ".svg": "vector",
  ".png": "bitmap",
  ".jpg": "bitmap",
  ".jpeg": "bitmap",
  ".webp": "bitmap",
};

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "缺少 file 字段" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "文件为空" }, { status: 400 });
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json(
        { error: `文件过大（${(file.size / 1048576).toFixed(1)} MB），上限 10 MB` },
        { status: 413 },
      );
    }

    // 扩展名从**白名单**取，不从用户文件名原样取
    const ext = path.extname(file.name).toLowerCase();
    const type = ALLOWED[ext];
    if (!type) {
      return NextResponse.json(
        { error: `不支持的文件类型 ${ext || "(无扩展名)"}，只允许 ${Object.keys(ALLOWED).join(" / ")}` },
        { status: 400 },
      );
    }

    // 文件名完全由服务端生成 —— 用户提供的名字一个字符都不参与路径
    const filename = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
    const dir = pendingDir();
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));

    return NextResponse.json({
      data: { url: `/pending/${filename}`, type, originalName: file.name, size: file.size },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
