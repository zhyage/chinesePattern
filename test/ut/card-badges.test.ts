import { describe, it, expect } from "vitest";
import { pickCardBadges, MAX_BADGES } from "@/lib/card-badges";
import type { FacetMap } from "@/lib/patterns-query";

/** 造分面数据：只写关心的维度，其余留空 */
const f = (spec: Record<string, string[]>): FacetMap =>
  Object.fromEntries(
    Object.entries(spec).map(([k, names]) => [k, names.map((name, i) => ({ id: i + 1, name }))]),
  );

const texts = (facets: FacetMap) => pickCardBadges(facets).map((b) => b.text);

describe("pickCardBadges", () => {
  it("六个维度各一个值 → 按优先级取前三个", () => {
    expect(
      texts(
        f({
          dynasty: ["商"],
          motif: ["云雷纹"],
          category: ["几何纹"],
          medium: ["青铜器"],
          region: ["中原"],
          ethnicGroup: ["其它"],
        }),
      ),
    ).toEqual(["商", "云雷纹", "几何纹"]);
  });

  it("★ 某一维多值时不占额外名额 —— 母题不会被三个朝代挤掉", () => {
    expect(
      texts(
        f({
          dynasty: ["商", "周", "春秋"],
          motif: ["云雷纹"],
          category: ["几何纹"],
          medium: ["青铜器"],
        }),
      ),
    ).toEqual(["商 +2", "云雷纹", "几何纹"]);
  });

  it("多值用 +N 表达，N 是「除第一个之外还有几个」", () => {
    expect(texts(f({ dynasty: ["商", "周"] }))).toEqual(["商 +1"]);
    expect(texts(f({ dynasty: ["商", "周", "春秋", "战国"] }))).toEqual(["商 +3"]);
  });

  it("单值不加 +N", () => {
    expect(texts(f({ dynasty: ["商"] }))).toEqual(["商"]);
  });

  it("★ 前面的维度为空时顺延，名额让给后面的维度", () => {
    expect(
      texts(f({ motif: ["云雷纹"], category: ["几何纹"], medium: ["青铜器"] })),
    ).toEqual(["云雷纹", "几何纹", "青铜器"]);
  });

  it(`最多 ${MAX_BADGES} 个维度，多出来的丢掉`, () => {
    const out = texts(
      f({
        dynasty: ["商"],
        motif: ["云雷纹"],
        category: ["几何纹"],
        medium: ["青铜器"],
        region: ["中原"],
        ethnicGroup: ["其它"],
      }),
    );
    expect(out).toHaveLength(MAX_BADGES);
    expect(out).not.toContain("青铜器");
  });

  it("某个维度是空数组 = 没有该维度，不算占位", () => {
    expect(texts(f({ dynasty: [], motif: ["云雷纹"] }))).toEqual(["云雷纹"]);
  });

  it("分面全空 → 不产出任何标签（卡片不渲染标签行）", () => {
    expect(pickCardBadges({})).toEqual([]);
  });

  it("title 列出该维度的全部值，不只是显示出来的那个", () => {
    const [badge] = pickCardBadges(f({ dynasty: ["商", "周", "春秋"] }));
    expect(badge.title).toBe("朝代：商、周、春秋");
  });

  it("单值时 title 也带上维度名，读者不用猜「商」是什么", () => {
    const [badge] = pickCardBadges(f({ medium: ["青铜器"] }));
    expect(badge.title).toBe("载体：青铜器");
  });

  it("key 是维度键，同一维度多值也只产出一个标签", () => {
    const badges = pickCardBadges(f({ dynasty: ["商", "周", "春秋"] }));
    expect(badges).toHaveLength(1);
    expect(badges[0].key).toBe("dynasty");
  });
});
