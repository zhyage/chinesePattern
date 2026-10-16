/**
 * 图片缩放的档位与钳制。
 *
 * **倍率都是相对图片原始像素（naturalWidth）的**：1 = 100% = 一个图片像素
 * 对应一个 CSS 像素。这样"1:1"才有确切含义，位图放到超过 1 之后就是
 * 在放大扫描件的颗粒 —— 界面上要让人看得见这件事。
 *
 * 为什么单独抽出来：滚轮步进要处理"当前值不在档位上"（适应屏幕算出来的
 * 倍率通常不是整数档）和两端边界，这类边界最容易写错，值得 UT 钉死。
 */

/** 滚轮沿着它走 */
export const ZOOM_STEPS = [0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8] as const;

export const MIN_ZOOM = ZOOM_STEPS[0];
export const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1];

/** 工具栏上的固定档位按钮（"适应"是另一个按钮，值由容器尺寸算出来） */
export const ZOOM_PRESETS = [1, 2, 4] as const;

const EPS = 1e-6;

export function clampZoom(z: number): number {
  // NaN 单独兜底（它和任何数比较都是 false，会被下面的 min/max 原样放行）。
  // ±Infinity 不用特殊处理 —— min/max 天然把它夹到边界，这也正是"钳制"该有的语义。
  if (Number.isNaN(z)) return 1;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z));
}

/**
 * 沿档位表走一步。
 *
 * 当前值不在档位上时（如"适应"算出的 0.63），放大走**严格大于**它的最近一档
 * （0.75），缩小走严格小于的最近一档（0.5）—— 不会"原地不动"，否则从小倍率
 * 滚轮会像失灵。
 */
export function stepZoom(current: number, dir: 1 | -1): number {
  const c = clampZoom(current);
  if (dir === 1) {
    return ZOOM_STEPS.find((z) => z > c + EPS) ?? MAX_ZOOM;
  }
  for (let i = ZOOM_STEPS.length - 1; i >= 0; i--) {
    if (ZOOM_STEPS[i] < c - EPS) return ZOOM_STEPS[i];
  }
  return MIN_ZOOM;
}

/**
 * "适应屏幕"的倍率：让整张图刚好装进可用区域（**该放大就放大**）。
 *
 * 这里不设 1 的上限 —— 灯箱里"适应"就该铺满，而且顶栏会显示真实倍率，
 * 超过 100% 时用户一眼能看出这是放大的（小图会更糊，那是实情，不该藏）。
 * 行内视图的"不放大"是另一回事，由 CSS 的 object-scale-down 负责。
 */
export function fitZoom(
  containerWidth: number,
  containerHeight: number,
  naturalWidth: number,
  naturalHeight: number,
): number {
  if (!naturalWidth || !naturalHeight || !containerWidth || !containerHeight) return 1;
  return Math.min(containerWidth / naturalWidth, containerHeight / naturalHeight);
}

/** 显示成 "100%" / "37%" */
export function formatZoom(z: number): string {
  return `${Math.round(z * 100)}%`;
}
