import { test, expect, type Page } from "@playwright/test";

/**
 * 详情页 —— 图片查看器、分面 chip、404。
 *
 * 这里放的是**原理上只有浏览器能验**的东西：
 *   - 位图/矢量切换靠的是纯 CSS（`#radio:checked ~ .img`），没有 JS 参与，
 *     jsdom 和 route handler 都测不到
 *   - chip 点进首页是**跨页**链路，IT 只测得到两端各自的接口
 */

/** 从首页拿一个真实存在的 pattern id，避免写死数字 */
async function firstPatternId(page: Page): Promise<string> {
  await page.goto("/");
  const id = await page.getByTestId("pattern-card").first().getAttribute("data-pattern-id");
  if (!id) throw new Error("首页没有渲染出任何纹饰卡片");
  return id;
}

/** 当前可见的那张图（两张图都在 DOM 里，靠 CSS 显示其中一张） */
const visibleImage = (page: Page) => page.locator('[data-testid="viewer-image"]:visible');

test("图片查看器：默认显示位图，点「矢量图」切过去", async ({ page }) => {
  await page.goto(`/patterns/${await firstPatternId(page)}`);

  // 两张图都在 DOM 里，但同一时刻只应显示一张
  await expect(visibleImage(page)).toHaveCount(1);
  await expect(visibleImage(page)).toHaveAttribute("data-kind", "bitmap");

  await page.getByText("矢量图", { exact: true }).click();

  await expect(visibleImage(page)).toHaveCount(1);
  await expect(visibleImage(page)).toHaveAttribute("data-kind", "vector");

  // 光"可见"不够 —— CSS 死循环会把图压成 0×0，而 0×0 的元素
  // Playwright 判为不可见，但图本身是加载成功的（naturalWidth > 0）。
  // 这里量真实的绘制尺寸，把这整类布局塌陷钉死。
  await expect
    .poll(async () =>
      visibleImage(page).evaluate((el) => {
        const r = el.getBoundingClientRect();
        return Math.round(r.width) * Math.round(r.height);
      }),
    )
    .toBeGreaterThan(0);

  // 切回去也要行
  await page.getByText("位图", { exact: true }).click();
  await expect(visibleImage(page)).toHaveAttribute("data-kind", "bitmap");
});

test("显示的图是真的加载出来了（不是破图）", async ({ page }) => {
  await page.goto(`/patterns/${await firstPatternId(page)}`);

  // naturalWidth === 0 说明请求 404 或解码失败 —— 光看 DOM 有 <img> 是发现不了的
  await expect
    .poll(() => visibleImage(page).evaluate((el) => (el as HTMLImageElement).naturalWidth))
    .toBeGreaterThan(0);

  const src = await visibleImage(page).getAttribute("src");
  expect(src, "位图应当是 /patterns/ 下的素材").toMatch(/^\/patterns\/.+\.(png|jpg|jpeg|webp)$/i);
});

test("六个分面都渲染出来，且 chip 能点进首页并已筛选", async ({ page }) => {
  const id = await firstPatternId(page);
  await page.goto(`/patterns/${id}`);

  // 六个维度地位平等 —— 每条至少有一个分面值（seed 里空维度会落到「其它」）
  await expect(page.getByTestId("facet-chip").first()).toBeVisible();

  const chip = page.getByTestId("facet-chip").first();
  const facet = await chip.getAttribute("data-facet");
  const valueId = await chip.getAttribute("data-value-id");

  await chip.click();

  // 落到首页，且 URL 带着对应的筛选参数
  await expect(page).toHaveURL(new RegExp(`\\?${facet}=${valueId}$`));
  // 侧栏里那个值处于选中态
  await expect(
    page.locator(`a[data-testid="facet-option"][data-facet="${facet}"][data-value-id="${valueId}"]`),
  ).toHaveAttribute("data-checked", "true");
  await expect(page.getByTestId("result-total")).not.toHaveText("0");
});

test.describe("点图放大（灯箱）", () => {
  /** 打开灯箱：从详情页点当前可见的那张图 */
  async function openZoom(page: Page) {
    await page.goto(`/patterns/${await firstPatternId(page)}`);
    await visibleImage(page).click();
    await expect(page.getByTestId("image-zoom")).toBeVisible();
  }

  const shownWidth = (page: Page) =>
    page.getByTestId("zoom-image").evaluate((el) => el.getBoundingClientRect().width);

  test("关闭状态下没有灯箱；点图后打开，且显示的是你点的那一张", async ({ page }) => {
    await page.goto(`/patterns/${await firstPatternId(page)}`);
    await expect(page.getByTestId("image-zoom")).toHaveCount(0);

    // 先切到矢量图，再点它 —— 灯箱应该开在矢量图上，而不是一律开在位图
    await page.getByText("矢量图", { exact: true }).click();
    await visibleImage(page).click();

    await expect(page.getByTestId("image-zoom")).toBeVisible();
    await expect(page.getByTestId("zoom-image")).toHaveAttribute("data-kind", "vector");
  });

  test("打开时整张图都在视口内（默认「适应」）", async ({ page }) => {
    await openZoom(page);
    const box = await page.getByTestId("zoom-image").evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { w: r.width, h: r.height };
    });
    const vp = page.viewportSize()!;
    expect(box.w).toBeLessThanOrEqual(vp.width);
    expect(box.h).toBeLessThanOrEqual(vp.height);
    expect(box.w).toBeGreaterThan(0);
  });

  test("★ 倍率与渲染宽度严格成比例（1:1 时 = 原始像素宽）", async ({ page }) => {
    await openZoom(page);

    await page.locator('[data-testid="zoom-preset"][data-zoom="1"]').click();
    const one = await Promise.all([
      shownWidth(page),
      // 必须断言类型：locator.evaluate 的元素类型是 SVGElement | HTMLElement
      page.getByTestId("zoom-image").evaluate((el) => (el as HTMLImageElement).naturalWidth),
    ]);
    // 100% = 一个图片像素对一个 CSS 像素
    expect(one[0]).toBeCloseTo(one[1], 0);

    await page.locator('[data-testid="zoom-preset"][data-zoom="2"]').click();
    expect(await shownWidth(page)).toBeCloseTo(one[0] * 2, 0);

    await page.locator('[data-testid="zoom-preset"][data-zoom="4"]').click();
    expect(await shownWidth(page)).toBeCloseTo(one[0] * 4, 0);

    // 这条同时钉死两个曾经踩过的坑：图片被 Tailwind preflight 的 max-width:100%
    // 卡住、以及作为 flex 子项被 flex-shrink 压回容器宽度 —— 两者都会让上面全部失败
  });

  test("滚轮能缩放，且到顶/到底会停住", async ({ page }) => {
    await openZoom(page);
    const level = page.getByTestId("zoom-level");
    const body = page.getByTestId("zoom-body");
    const wheel = (dy: number) =>
      body.evaluate((el, d) => el.dispatchEvent(new WheelEvent("wheel", { deltaY: d, bubbles: true, cancelable: true })), dy);

    const before = await level.innerText();
    await wheel(-120);
    await expect(level).not.toHaveText(before);

    // 一直放大不该越过上限
    for (let i = 0; i < 20; i++) await wheel(-120);
    const top = await level.innerText();
    await wheel(-120);
    await expect(level).toHaveText(top);
  });

  test("灯箱里能在位图/矢量之间切换", async ({ page }) => {
    await openZoom(page);
    await expect(page.getByTestId("zoom-image")).toHaveAttribute("data-kind", "bitmap");

    await page.locator('[data-testid="zoom-kind"][data-kind="vector"]').click();
    await expect(page.getByTestId("zoom-image")).toHaveAttribute("data-kind", "vector");
    await expect(page.getByTestId("zoom-image")).toHaveAttribute("src", /\.svg$/);

    await page.locator('[data-testid="zoom-kind"][data-kind="bitmap"]').click();
    await expect(page.getByTestId("zoom-image")).toHaveAttribute("data-kind", "bitmap");
  });

  for (const [how, close] of [
    ["ESC", async (page: Page) => page.keyboard.press("Escape")],
    ["点空白处", async (page: Page) => page.getByTestId("zoom-body").click({ position: { x: 8, y: 8 } })],
  ] as const) {
    test(`${how} 能关闭灯箱，且详情页还在`, async ({ page }) => {
      await openZoom(page);
      await close(page);
      await expect(page.getByTestId("image-zoom")).toHaveCount(0);
      await expect(page.getByTestId("facet-chip").first()).toBeVisible();
    });
  }
});

test("不存在的纹饰返回 404，而不是崩溃", async ({ page }) => {
  const res = await page.goto("/patterns/999999");
  expect(res?.status()).toBe(404);
});
