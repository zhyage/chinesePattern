import path from "node:path";

/**
 * 素材文件的位置。**所有涉及素材路径的地方都从这里取**，不要各处硬编码。
 *
 * 用环境变量覆盖有两个用途：
 *   1. **测试隔离** —— 测试把 PUBLIC_DIR 指向临时目录，
 *      绝不碰 public/patterns/ 里的真实素材（这是被实际教训过的：
 *      一个未校验的路径曾把整个 public/pending/ 目录搬走）
 *   2. **将来换存储** —— 生产要换成阿里云 OSS / AWS S3（design.md §7.1），
 *      这里是集中的切换点
 */

/** 素材根目录。默认 <仓库根>/public */
export function publicDir(): string {
  return process.env.PUBLIC_DIR ?? path.join(process.cwd(), "public");
}

/** 待审素材暂存区。上传先落这里，审核通过才移到 patterns/ */
export function pendingDir(): string {
  return path.join(publicDir(), "pending");
}

/** 已发布的素材目录 */
export function patternsDir(): string {
  return path.join(publicDir(), "patterns");
}
