import { describe, it, expect } from "vitest";
import {
  readSelection,
  toggleValue,
  selectedCount,
  clearSelection,
  buildQuery,
  hrefWith,
} from "@/lib/facet-url";

const sp = (q: string) => new URLSearchParams(q);

describe("readSelection", () => {
  it("从 query 里读出六个维度的已选 id", () => {
    expect(readSelection(sp("motif=3,7&dynasty=1"))).toEqual({ dynasty: [1], motif: [3, 7] });
  });

  it("空 query 返回空对象", () => {
    expect(readSelection(sp(""))).toEqual({});
  });

  it("忽略非分面的参数（search / page 不该混进来）", () => {
    expect(readSelection(sp("search=云雷&page=2"))).toEqual({});
  });

  it("剔除非法 id，不让脏参数进查询", () => {
    expect(readSelection(sp("motif=3,abc,-1,0,"))).toEqual({ motif: [3] });
  });

  it("某个维度全是非法值时该维度不出现（而不是空数组）", () => {
    expect(readSelection(sp("motif=abc"))).toEqual({});
  });
});

describe("toggleValue", () => {
  it("未选中 → 选中", () => {
    expect(toggleValue({}, "motif", 3)).toEqual({ motif: [3] });
  });

  it("已选中 → 取消", () => {
    expect(toggleValue({ motif: [3] }, "motif", 3)).toEqual({});
  });

  it("取消最后一个值后整个 key 消失，不留空数组", () => {
    const out = toggleValue({ motif: [3] }, "motif", 3);
    expect("motif" in out).toBe(false);
  });

  it("保留同一维度的其它值（同维多选 = OR）", () => {
    expect(toggleValue({ motif: [3, 7] }, "motif", 3)).toEqual({ motif: [7] });
  });

  it("不影响其它维度（跨维 = AND）", () => {
    expect(toggleValue({ motif: [3], dynasty: [1] }, "motif", 9)).toEqual({
      motif: [3, 9],
      dynasty: [1],
    });
  });

  it("返回新对象，不改动入参", () => {
    const before = { motif: [3] };
    toggleValue(before, "motif", 9);
    expect(before).toEqual({ motif: [3] });
  });
});

describe("selectedCount / clearSelection", () => {
  it("统计全部已选值个数", () => {
    expect(selectedCount({ motif: [1, 2], dynasty: [3] })).toBe(3);
  });

  it("清空单个维度，保留其它维度", () => {
    expect(clearSelection({ motif: [1], dynasty: [3] }, "motif")).toEqual({ dynasty: [3] });
  });

  it("不传 key = 清空全部", () => {
    expect(clearSelection({ motif: [1], dynasty: [3] })).toEqual({});
  });
});

describe("buildQuery", () => {
  it("把已选值拼成逗号分隔的参数", () => {
    expect(buildQuery({ motif: [3, 7] })).toBe("motif=3%2C7");
  });

  it("空选择 + 无 extra → 空串", () => {
    expect(buildQuery({})).toBe("");
  });

  it("extra 里的空值被丢掉（避免留下 page= 这种空参数）", () => {
    expect(buildQuery({}, { search: "", page: null, pageSize: undefined })).toBe("");
  });

  it("extra 覆盖同名分面参数 —— 调用方传什么就是什么", () => {
    expect(buildQuery({}, { page: 2 })).toBe("page=2");
  });
});

describe("hrefWith", () => {
  it("有参数时拼上问号", () => {
    expect(hrefWith("/", "motif=3")).toBe("/?motif=3");
  });

  it("无参数时就是路径本身，不留孤零零的问号", () => {
    expect(hrefWith("/", "")).toBe("/");
  });

  it("详情页路径同样适用", () => {
    expect(hrefWith("/patterns/23", "motif=3")).toBe("/patterns/23?motif=3");
  });
});
