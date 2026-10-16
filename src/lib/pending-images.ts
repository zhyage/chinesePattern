import path from "node:path";
import { stat } from "node:fs/promises";
import { pendingDir } from "@/lib/storage";

/**
 * 暂存区图片路径的校验。
 *
 * ⚠️ 这是**安全边界**，不是格式检查。测试时抓到的真实漏洞：
 *
 *   提交时 images[].url 只检查了"是非空字符串"，审核通过时直接拿它去
 *   `rename()` —— 于是：
 *     · 传 "/pending/"（一个目录）→ 整个 public/pending/ 被搬进 public/patterns/
 *     · 传 "/../../package.json"    → 可以移走仓库里任意文件
 *
 *   两处都必须挡：提交时就拒绝非法 URL（早失败），审核时再解析校验一遍
 *   （因为 pending 记录可能来自更早的、未校验的提交）。
 */

const PENDING_URL_PREFIX = "/pending/";

/**
 * 允许的扩展名（与上传接口的白名单一致）。
 * 导出给 `pattern-image-files.ts` 用 —— 白名单只能有一份，
 * 两处各写一份迟早会漂移，而这是安全边界。
 */
export const ALLOWED_IMAGE_EXT = new Set([".svg", ".png", ".jpg", ".jpeg", ".webp"]);
const ALLOWED_EXT = ALLOWED_IMAGE_EXT;

/**
 * 提交时用：判断一个 URL 是不是合法的暂存区图片路径。
 * 要求：以 /pending/ 开头、不含目录跳转、有白名单内的扩展名。
 */
export function isValidPendingUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  if (!url.startsWith(PENDING_URL_PREFIX)) return false;
  if (url.includes("..")) return false;

  const filename = url.slice(PENDING_URL_PREFIX.length);
  // 必须是一层文件名，不能再有子路径
  if (!filename || filename.includes("/") || filename.includes("\\")) return false;

  return ALLOWED_EXT.has(path.extname(filename).toLowerCase());
}

/**
 * 审核时用：把 URL 解析成绝对路径，并确认它**确实是 public/pending/ 下的一个文件**。
 * 返回 null 表示不合法或文件不存在。
 */
export async function resolvePendingFile(url: string): Promise<string | null> {
  if (!isValidPendingUrl(url)) return null;

  const dir = pendingDir();
  const abs = path.resolve(dir, url.slice(PENDING_URL_PREFIX.length));

  // 双保险：解析后必须仍在暂存区之内
  const rel = path.relative(dir, abs);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;

  try {
    const s = await stat(abs);
    if (!s.isFile()) return null; // 目录也不行
  } catch {
    return null; // 不存在
  }

  return abs;
}
