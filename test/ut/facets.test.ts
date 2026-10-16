import { describe, it, expect } from "vitest";
import { parseIds, FACETS, FACET_KEYS } from "@/lib/facets";

describe("parseIds —— 解析筛选参数", () => {
  it("解析逗号分隔的 id", () => {
    expect(parseIds("1,2,3")).toEqual([1, 2, 3]);
  });

  it("去重", () => {
    expect(parseIds("1,1,2,2,3")).toEqual([1, 2, 3]);
  });

  it("容忍空白", () => {
    expect(parseIds(" 1 , 2 ,3 ")).toEqual([1, 2, 3]);
  });

  it("空值返回空数组", () => {
    expect(parseIds(null)).toEqual([]);
    expect(parseIds(undefined)).toEqual([]);
    expect(parseIds("")).toEqual([]);
  });

  it("非数字被剔除", () => {
    expect(parseIds("abc")).toEqual([]);
    expect(parseIds("1,abc,2")).toEqual([1, 2]);
  });

  it("只保留正整数 —— 0 和负数不是合法 id", () => {
    expect(parseIds("0,-1,3")).toEqual([3]);
  });

  it("只用逗号作分隔符，其它符号不切分", () => {
    expect(parseIds("1;2")).toEqual([1]);
    expect(parseIds("1 2")).toEqual([1]);
  });
});

describe("FACETS 配置", () => {
  it("恰好六个维度", () => {
    expect(FACETS).toHaveLength(6);
    expect(FACET_KEYS).toEqual(["dynasty", "region", "ethnicGroup", "category", "motif", "medium"]);
  });

  it("category 是题材、motif 是母题 —— 这两个最容易被搞混", () => {
    const byKey = Object.fromEntries(FACETS.map((f) => [f.key, f]));
    expect(byKey.category.label).toBe("题材");
    expect(byKey.motif.label).toBe("母题");
  });

  it("每个维度都有完整字段（漏一个就会在别处静默出问题）", () => {
    for (const f of FACETS) {
      expect(f.key, `${f.key}.key`).toBeTruthy();
      expect(f.label, `${f.key}.label`).toBeTruthy();
      expect(f.relation, `${f.key}.relation`).toBeTruthy();
      expect(f.fk, `${f.key}.fk`).toBeTruthy();
      expect(f.model, `${f.key}.model`).toBeTruthy();
      expect(f.junction, `${f.key}.junction`).toBeTruthy();
    }
  });

  it("各维度的 key / relation / fk / junction 互不重复", () => {
    for (const field of ["key", "relation", "fk", "model", "junction"] as const) {
      const values = FACETS.map((f) => f[field]);
      expect(new Set(values).size, `${field} 有重复`).toBe(values.length);
    }
  });
});
