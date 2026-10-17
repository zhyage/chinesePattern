import path from "node:path";
import { randomUUID } from "node:crypto";
import { stat, rename, mkdir, rm } from "node:fs/promises";
import { ALLOWED_IMAGE_EXT, resolvePendingFile } from "@/lib/pending-images";
import { patternsDir } from "@/lib/storage";
import prisma from "@/lib/db";

/**
 * 已发布条目的图片：校验、搬运、清理。
 *
 * **审核通过（`PATCH /api/admin/pending/[id]`）和编辑保存（`PUT /api/admin/patterns/[id]`）
 * 共用这一份** —— design.md §5.4 明确要求，不各写一份。
 *
 * 两种来源的输入会长得不一样，这是重点：
 *   - 审核通过：`pending.images` 里全是 `/pending/…`（都是新传的）
 *   - 编辑保存：混着 `/pending/…`（换了的那张）和 `/patterns/…`（没换的那张）
 * 所以下面的 URL 校验必须**同时接受两种前缀**。
 *
 * 处理顺序是刻意固定的（design.md §5.4）：
 *   ① 全部校验 → ② 搬文件 → ③ 写库 → ④ 提交后再删旧文件
 * 反过来（先写库）失败时，库里的 URL 会指向不存在的文件 —— **对外就是破图**。
 * 现在失败只留下孤儿文件，浪费磁盘而已。破图是用户可见的故障，孤儿不是。
 */

const PATTERN_URL_PREFIX = "/patterns/";

export type ImageKind = "bitmap" | "vector";

export interface RawImage {
  url: string;
  type: string;
  isPrimary?: boolean;
  sortOrder?: number;
  label?: string | null;
  purpose?: string | null;
}

export interface ValidatedImage {
  /** 暂存区的绝对路径；`null` = 这张图已经在 patterns/ 里，不用搬 */
  abs: string | null;
  url: string;
  type: ImageKind;
  isPrimary: boolean;
  sortOrder: number;
  label: string | null;
  purpose: string | null;
}

export interface StoredImage {
  url: string;
  type: ImageKind;
  isPrimary: boolean;
  sortOrder: number;
  label: string | null;
  purpose: string | null;
}

/** `/patterns/<文件名>` → 绝对路径。不合法或不是文件返回 null。 */
export async function resolvePatternFile(url: unknown): Promise<string | null> {
  if (typeof url !== "string" || !url.startsWith(PATTERN_URL_PREFIX)) return null;
  if (url.includes("..")) return null;

  const filename = url.slice(PATTERN_URL_PREFIX.length);
  if (!filename || filename.includes("/") || filename.includes("\\")) return null;
  if (!ALLOWED_IMAGE_EXT.has(path.extname(filename).toLowerCase())) return null;

  const dir = patternsDir();
  const abs = path.resolve(dir, filename);
  // 双保险：解析后必须仍在素材目录之内
  const rel = path.relative(dir, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;

  try {
    const s = await stat(abs);
    if (!s.isFile()) return null;
  } catch {
    return null;
  }
  return abs;
}

/**
 * 图片数量规则：**恰好一张位图 + 一张矢量图**（design.md §4.4）。
 *
 * ⚠️ **这是"1+1"假设的三处落点之一**（另两处：`pattern-editor.tsx` 的两个槽位、
 * `image-viewer.tsx` 的下标配对）。`pattern_images` 表本身是 1:N，存 N 张毫无问题；
 * 限制只活在这三处应用层代码里。
 * 将来要支持多图时，三处必须**一起**改 —— 光放松这里，查看器的下标配对会张冠李戴；
 * 另外 `isPrimary` 的默认值会让多张图全变主图、`sortOrder` 会全部撞车。
 *
 * ⚠️ 三条路径共用这一份 —— 之前「提交待审」只要求"至少各一张"，
 * 而「审核通过 / 编辑保存」要求"恰好各一张"。于是一条「2 位图 + 1 矢量」
 * 的提交能**成功入库**，却**永远过不了审核**，而且报错说的是"必须恰好有一张位图"，
 * 提交者根本不知道问题出在哪。抽成一份就不再有第二个规则。
 *
 * 返回 null 表示通过。
 */
export function checkImageCounts(images: { type: string }[]): string | null {
  for (const k of ["bitmap", "vector"] as const) {
    const n = images.filter((i) => i.type === k).length;
    if (n !== 1) {
      return `必须恰好有一张${k === "bitmap" ? "位图" : "矢量图"}，收到 ${n} 张`;
    }
  }
  return null;
}

/**
 * 校验提交上来的图片列表。
 *
 * 规则（design.md §4.4 / §5.4）：**恰好一张位图 + 一张矢量图，两张都必填。**
 * 只校验、不搬任何东西 —— 任何一项不通过，调用方直接返回 400，磁盘和库都没动过。
 */
export async function validateImages(
  raw: unknown,
): Promise<{ ok: true; images: ValidatedImage[] } | { ok: false; error: string }> {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: "images 必须是数组，且至少包含位图和矢量图各一张" };
  }

  const images: ValidatedImage[] = [];
  for (const item of raw as RawImage[]) {
    if (!item || typeof item !== "object") return { ok: false, error: "images 的元素必须是对象" };

    const url = item.url;
    const type = item.type;
    if (type !== "bitmap" && type !== "vector") {
      return { ok: false, error: `图片 type 必须是 bitmap 或 vector，收到：${String(type)}` };
    }
    if (typeof url !== "string") return { ok: false, error: "图片 url 必须是字符串" };

    // 两种前缀都接受：暂存区的要搬，已发布的原样留
    let abs: string | null = null;
    if (url.startsWith("/pending/")) {
      abs = await resolvePendingFile(url);
      if (!abs) {
        return { ok: false, error: `待审图片不存在或地址非法：${url}（必须是 public/pending/ 下的图片文件）` };
      }
    } else {
      abs = await resolvePatternFile(url);
      if (!abs) {
        return { ok: false, error: `图片不存在或地址非法：${url}（必须是 public/patterns/ 或 public/pending/ 下的图片文件）` };
      }
    }

    images.push({
      abs: abs && url.startsWith("/pending/") ? abs : null,
      url,
      type,
      isPrimary: item.isPrimary ?? type === "bitmap",
      sortOrder: item.sortOrder ?? (type === "bitmap" ? 0 : 1),
      label: item.label ?? (type === "vector" ? "矢量图" : "位图"),
      purpose: item.purpose ?? (type === "bitmap" ? "thumbnail" : "detail"),
    });
  }

  const countError = checkImageCounts(images);
  if (countError) return { ok: false, error: countError };

  return { ok: true, images };
}

/**
 * 把暂存区的图片搬进 `public/patterns/`，返回最终要写库的图片列表。
 *
 * 文件名由服务端用 UUID 生成，**用户提供的名字一个字符都不参与**
 * （阶段 2 的路径穿越漏洞就是从"信任用户传进来的名字"来的）。
 * 已经在 patterns/ 里的图原样保留 —— 编辑时没换的那张不该被重新搬运。
 */
export async function moveStagedImages(images: ValidatedImage[]): Promise<StoredImage[]> {
  const dir = patternsDir();
  await mkdir(dir, { recursive: true });

  const out: StoredImage[] = [];
  for (const img of images) {
    let url = img.url;
    if (img.abs) {
      const filename = `${randomUUID().slice(0, 8)}-${img.type}${path.extname(img.abs).toLowerCase()}`;
      await rename(img.abs, path.join(dir, filename));
      url = `/patterns/${filename}`;
    }
    out.push({
      url,
      type: img.type,
      isPrimary: img.isPrimary,
      sortOrder: img.sortOrder,
      label: img.label,
      purpose: img.purpose,
    });
  }
  return out;
}

/**
 * 删掉不再被任何 `pattern_images` 行引用的图片文件。
 *
 * **必须在数据库事务提交之后调用。** 提前删的话，事务一失败，
 * 库还指着那个已经被删掉的文件 —— 那就是破图。
 *
 * best-effort：删不掉只记日志，不影响已经成功的保存。
 */
export async function deleteUnreferencedFiles(urls: string[]): Promise<void> {
  for (const url of new Set(urls)) {
    if (!url.startsWith(PATTERN_URL_PREFIX)) continue;

    // 可能被别的 pattern 共用 —— 现在是一对一，但规则不该依赖这件事
    const stillUsed = await prisma.patternImage.count({ where: { url } });
    if (stillUsed > 0) continue;

    const abs = await resolvePatternFile(url);
    if (!abs) continue;

    try {
      await rm(abs, { force: true });
    } catch (e) {
      console.error(`[图片清理] 删除失败：${url}`, e);
    }
  }
}
