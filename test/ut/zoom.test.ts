import { describe, it, expect } from "vitest";
import {
  stepZoom,
  clampZoom,
  fitZoom,
  formatZoom,
  ZOOM_STEPS,
  MIN_ZOOM,
  MAX_ZOOM,
} from "@/lib/zoom";

describe("clampZoom", () => {
  it("夹在上下限之间", () => {
    expect(clampZoom(100)).toBe(MAX_ZOOM);
    expect(clampZoom(0)).toBe(MIN_ZOOM);
    expect(clampZoom(-5)).toBe(MIN_ZOOM);
  });

  it("区间内原样返回", () => {
    expect(clampZoom(1.5)).toBe(1.5);
  });

  it("NaN / Infinity 兜底成 1，不产出 NaN 宽度把图撑坏", () => {
    expect(clampZoom(NaN)).toBe(1);
    expect(clampZoom(Infinity)).toBe(MAX_ZOOM);
  });
});

describe("stepZoom 放大", () => {
  it("在档位上时走到下一档", () => {
    expect(stepZoom(1, 1)).toBe(1.5);
    expect(stepZoom(2, 1)).toBe(3);
  });

  it("★ 不在档位上时走严格大于的最近一档 —— 不能原地不动", () => {
    // "适应屏幕"常算出 0.63 这种值；若返回自身，滚轮放大看起来就是失灵的
    expect(stepZoom(0.63, 1)).toBe(0.75);
    expect(stepZoom(0.11, 1)).toBe(0.25);
  });

  it("到顶后停在最大档", () => {
    expect(stepZoom(MAX_ZOOM, 1)).toBe(MAX_ZOOM);
    expect(stepZoom(999, 1)).toBe(MAX_ZOOM);
  });
});

describe("stepZoom 缩小", () => {
  it("在档位上时走到下一档", () => {
    expect(stepZoom(1, -1)).toBe(0.75);
    expect(stepZoom(4, -1)).toBe(3);
  });

  it("★ 不在档位上时走严格小于的最近一档", () => {
    expect(stepZoom(0.63, -1)).toBe(0.5);
    expect(stepZoom(1.2, -1)).toBe(1);
  });

  it("到底后停在最小档", () => {
    expect(stepZoom(MIN_ZOOM, -1)).toBe(MIN_ZOOM);
    expect(stepZoom(0.01, -1)).toBe(MIN_ZOOM);
  });
});

describe("stepZoom 往返", () => {
  it("连续放大再连续缩小能回到原档（不会单向漂移）", () => {
    let z = 1;
    for (let i = 0; i < 3; i++) z = stepZoom(z, 1); // 1 → 1.5 → 2 → 3
    const up = z;
    for (let i = 0; i < 3; i++) z = stepZoom(z, -1);
    expect(z).toBe(1);
    expect(up).toBe(3);
  });

  it("档位表必须严格递增 —— 否则步进逻辑会跳过或卡住", () => {
    for (let i = 1; i < ZOOM_STEPS.length; i++) {
      expect(ZOOM_STEPS[i]).toBeGreaterThan(ZOOM_STEPS[i - 1]);
    }
  });
});

describe("fitZoom", () => {
  it("宽图按宽度受限", () => {
    // 1074×274 的带子放进 900×700
    expect(fitZoom(900, 700, 1074, 274)).toBeCloseTo(900 / 1074);
  });

  it("高图按高度受限", () => {
    // 274×1074 的竖条放进 900×700
    expect(fitZoom(900, 700, 274, 1074)).toBeCloseTo(700 / 1074);
  });

  it("★ 小图会放大铺满 —— 灯箱里「适应」就该铺满，顶栏的倍率会说明这是放大", () => {
    // 180×180 放进 900×700：宽度允许 5 倍，但高度只允许 700/180 ≈ 3.89 —— 高度是限制边
    expect(fitZoom(900, 700, 180, 180)).toBeCloseTo(700 / 180);
  });

  it("图本来就小于可用区域时，两边取较小的比例", () => {
    // 1074×274 放进 1376×780：宽度受限 1.28，高度 2.85 → 取 1.28
    expect(fitZoom(1376, 780, 1074, 274)).toBeCloseTo(1376 / 1074);
  });

  it("尺寸缺失时兜底成 1，不产出 NaN", () => {
    expect(fitZoom(900, 700, 0, 0)).toBe(1);
    expect(fitZoom(0, 0, 1074, 274)).toBe(1);
  });
});

describe("formatZoom", () => {
  it("显示为百分比整数", () => {
    expect(formatZoom(1)).toBe("100%");
    expect(formatZoom(0.633)).toBe("63%");
    expect(formatZoom(4)).toBe("400%");
  });
});
