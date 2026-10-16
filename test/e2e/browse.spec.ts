import { test, expect, type Page } from "@playwright/test";

/**
 * 首页（合并后的浏览页）—— 筛选、搜索、分页、卡片。
 *
 * ⚠️ **断言写的是关系，不是绝对数字。**
 * 现在 seed 是 14 条，但真实素材录进来之后条数就变了。
 * `expect(total).toBe(14)` 会在那天集体爆掉 —— 所以这里改成断言
 * "筛选后的条数 == 该选项旁边的计数"这类**恒成立的关系**。
 */

/** 侧栏里可点的分面选项（置灰的 count=0 选项是 span，不是 a） */
const clickableOptions = (page: Page) => page.locator('a[data-testid="facet-option"]');
const total = (page: Page) => page.getByTestId("result-total");

// 六个维度地位平等是这套模型的核心主张，所以六个都验，不只挑一个代表
const FACETS = ["dynasty", "region", "ethnicGroup", "category", "motif", "medium"] as const;

test.describe("分面筛选", () => {
  for (const facet of FACETS) {
    test(`${facet}：选一个值 → 条数等于该值旁边的计数`, async ({ page }) => {
      await page.goto("/");

      const option = clickableOptions(page).and(page.locator(`[data-facet="${facet}"]`)).first();
      const count = Number(await option.getAttribute("data-count"));
      expect(count, "该维度第一个可选项的计数应大于 0").toBeGreaterThan(0);

      await option.click();

      // 单值筛选：结果条数应当正好等于该值在全库里的已发布条数
      await expect(total(page)).toHaveText(String(count));
      await expect(
        page.locator(`a[data-facet="${facet}"][data-checked="true"]`),
      ).toHaveCount(1);
    });
  }

  test("再点一次取消选中 → 回到未筛选的条数", async ({ page }) => {
    await page.goto("/");
    const before = await total(page).innerText();

    await clickableOptions(page).first().click();
    await expect(total(page)).not.toHaveText(before);

    await clickableOptions(page).and(page.locator('[data-checked="true"]')).first().click();
    await expect(total(page)).toHaveText(before);
  });

  test("同一维度选两个值 = OR（并集，不会比单选更少）", async ({ page }) => {
    await page.goto("/");

    const group = page.locator('[data-testid="facet-group"][data-facet="dynasty"]');
    const opts = group.locator('a[data-testid="facet-option"]');
    const a = Number(await opts.nth(0).getAttribute("data-count"));
    const b = Number(await opts.nth(1).getAttribute("data-count"));

    await opts.nth(0).click();
    await expect(total(page)).toHaveText(String(a));

    await page.locator('a[data-testid="facet-option"][data-checked="true"]').first();
    await group.locator('a[data-testid="facet-option"]').nth(1).click();

    // OR 的下界是较大的那个 —— 如果误实现成 AND，结果会 ≤ min(a,b) 而失败
    await expect
      .poll(async () => Number(await total(page).innerText()))
      .toBeGreaterThanOrEqual(Math.max(a, b));
  });

  test("跨维度选两个值 = AND（交集，不会比单选更多）", async ({ page }) => {
    await page.goto("/");

    const dOpt = page.locator('a[data-facet="dynasty"][data-testid="facet-option"]').first();
    const mOpt = page.locator('a[data-facet="medium"][data-testid="facet-option"]').first();
    const d = Number(await dOpt.getAttribute("data-count"));
    const m = Number(await mOpt.getAttribute("data-count"));

    await dOpt.click();
    await expect(total(page)).toHaveText(String(d));
    await page.locator('a[data-facet="medium"][data-testid="facet-option"]').first().click();

    // AND 的上界是较小的那个 —— 如果误实现成 OR，结果会 ≥ max(a,b) 而失败
    await expect
      .poll(async () => Number(await total(page).innerText()))
      .toBeLessThanOrEqual(Math.min(d, m));
  });
});

test.describe("搜索", () => {
  test("切换筛选时搜索词不丢", async ({ page }) => {
    await page.goto("/");

    // 拿第一张卡片的名字当搜索词 —— 保证有结果，且不写死任何数据
    const name = (await page.getByTestId("pattern-card").first().locator("h3").innerText()).trim();
    await page.goto(`/?search=${encodeURIComponent(name)}`);
    await expect(total(page)).not.toHaveText("0");

    // 再加一个分面筛选
    await clickableOptions(page).first().click();

    // 搜索词要同时留在 URL 和输入框里 —— 点一下筛选就把它弄丢是很容易犯的错
    await expect(page).toHaveURL(/search=/);
    await expect(page.getByRole("searchbox")).toHaveValue(name);
  });

  test("搜不到时给出空状态，而不是白屏", async ({ page }) => {
    await page.goto("/?search=zzz这个纹饰肯定不存在zzz");
    await expect(page.getByTestId("empty-state")).toBeVisible();
    await expect(total(page)).toHaveText("0");
  });
});

test.describe("卡片与素材", () => {
  test("点卡片进详情页", async ({ page }) => {
    await page.goto("/");
    const card = page.getByTestId("pattern-card").first();
    const id = await card.getAttribute("data-pattern-id");

    await card.click();
    await expect(page).toHaveURL(new RegExp(`/patterns/${id}$`));
    await expect(page.locator("h1")).not.toBeEmpty();
  });

  test("卡片标签：最多 3 个维度，每维最多一个，且带维度提示", async ({ page }) => {
    await page.goto("/");

    const cards = page.getByTestId("pattern-card");
    expect(await cards.count()).toBeGreaterThan(0);

    for (let i = 0; i < (await cards.count()); i++) {
      const titles = await cards
        .nth(i)
        .locator("[data-slot=badge]")
        .evaluateAll((els) => els.map((e) => e.getAttribute("title") ?? ""));

      // 规则本身在 test/ut/card-badges.test.ts 里穷举了；这里只验组件真的接上了它 ——
      // 旧实现没有 title，所以"每个标签都有「维度：值」形式的提示"能证明接线正确
      expect(titles.length).toBeLessThanOrEqual(3);
      const dims = titles.map((t) => t.split("：")[0]);
      for (const t of titles) expect(t).toMatch(/^(朝代|地域|民族|题材|母题|载体)：.+/);
      // 每维最多一个 —— 维度名不该重复
      expect(new Set(dims).size, `第 ${i} 张卡片的标签维度重复了：${titles}`).toBe(dims.length);
    }
  });

  test("所有缩略图都真的加载出来了（没有破图）", async ({ page }) => {
    await page.goto("/");

    // 图片是 loading="lazy" 的，先滚到底把它们都触发出来
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForLoadState("networkidle");

    // 一次性收集所有 naturalWidth === 0 的图 —— 破图的 src 会一起报出来，好定位
    const broken = await page.evaluate(() =>
      Array.from(document.querySelectorAll('[data-testid="pattern-card"] img'))
        .filter((el) => (el as HTMLImageElement).naturalWidth === 0)
        .map((el) => el.getAttribute("src")),
    );

    expect(broken, "这些缩略图没加载出来").toEqual([]);
    expect(await page.getByTestId("pattern-card").count()).toBeGreaterThan(0);
  });
});
