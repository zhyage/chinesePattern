import { test, expect, type Page } from "@playwright/test";

/**
 * 管理后台（design.md §5.4）—— 只测 **UI 层**。
 *
 * 为什么这里**不测"提交 → 审核通过 → 落成 pattern"的完整流程**：
 *
 *   ① 那条链路已经有 24 个 IT 用例覆盖（文件搬家、落库、六张中间表、驳回清理），
 *      在浏览器里再跑一遍只是重复。
 *   ② 更重要 —— E2E 的服务器读的是**真实 `public/`**（Next 的静态服务不认
 *      `PUBLIC_DIR`），而审核通过的图片落在 `.test-public/patterns/`。
 *      于是新条目的缩略图**必然 404**，会污染 `browse.spec` 的"不许有破图"用例。
 *
 * 所以这里的用例都**不新增 pattern**，只做读取和可逆的改动。
 */

const BASE = "/admin";

test("★ 仪表盘显示真实数字，而不是全 0", async ({ page }) => {
  // 这是修掉的那个 bug：旧页面调已删除的 /api/admin/review，
  // 一个 404 被裸 catch 吞掉，四个数字**全**变 0，包括数据正常的那些
  await page.goto(BASE);

  const card = (label: string) => page.locator(`[data-testid="admin-card"][data-label="${label}"]`);
  const num = async (label: string) =>
    Number((await card(label).locator("div").first().innerText()).trim());

  const published = await num("已发布");
  expect(published, "库里明明有已发布条目，不该是 0").toBeGreaterThan(0);
  expect(await num("查找表值")).toBeGreaterThan(0);

  // 和 /admin/patterns 页面上的总数对得上 —— 两处都读同一份查询，
  // 对不上就说明有一边在撒谎
  await page.goto(`${BASE}/patterns`);
  const listed = Number(await page.getByTestId("admin-total").innerText());
  const draftTab = page.locator('[data-testid="status-tab"][data-status="draft"]');
  await draftTab.click();
  // ⚠️ 必须等导航落地再读 —— 这是个链接跳转，innerText() 不会自己等，
  //    不等的话读到的是上一页的数字（第一次写就踩了这个）
  await expect(page).toHaveURL(/status=draft/);
  const drafts = Number(await page.getByTestId("admin-total").innerText());

  expect(listed).toBe(published + drafts);
});

test("仪表盘常驻未认证警告", async ({ page }) => {
  await page.goto(BASE);
  await expect(page.getByTestId("no-auth-warning")).toContainText("未启用认证");
});

test("已发布列表：渲染行、搜索、状态筛选", async ({ page }) => {
  await page.goto(`${BASE}/patterns`);

  const rows = page.getByTestId("admin-row");
  const total = Number(await page.getByTestId("admin-total").innerText());
  expect(total).toBeGreaterThan(0);
  expect(await rows.count()).toBe(Math.min(total, 20));

  // 拿第一行的名称去搜，应该能搜到它
  const name = (await rows.first().locator("div.text-sm.font-medium").innerText()).trim();
  await page.locator('input[name="search"]').fill(name);
  await page.getByRole("button", { name: "搜索" }).click();
  await expect(page).toHaveURL(/search=/);
  await expect(page.getByTestId("admin-total")).toHaveText("1");

  // 搜不到 → 空状态
  await page.goto(`${BASE}/patterns?search=zzz不存在zzz`);
  await expect(page.getByTestId("admin-empty")).toBeVisible();
  await expect(page.getByTestId("admin-total")).toHaveText("0");
});

test("★ 删除要求手动输入名称 —— 输错时确认按钮不可用", async ({ page }) => {
  await page.goto(`${BASE}/patterns`);

  const row = page.getByTestId("admin-row").first();
  const name = (await row.locator("div.text-sm.font-medium").innerText()).trim();
  await row.getByTestId("delete-pattern").click();

  const dialog = page.getByTestId("delete-dialog");
  await expect(dialog).toBeVisible();

  const confirm = page.getByTestId("delete-confirm");
  await expect(confirm, "还没输入时不能点").toBeDisabled();

  await page.getByTestId("delete-confirm-input").fill("随便输点什么");
  await expect(confirm).toBeDisabled();

  await page.getByTestId("delete-confirm-input").fill(name);
  await expect(confirm, "名称对了才允许").toBeEnabled();

  // 只验证闸门，不真的删 —— 删掉会污染其他用例
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
});

test.describe("查找表维护", () => {
  test("六个 tab 都在，当前 tab 的表格有行", async ({ page }) => {
    await page.goto(`${BASE}/facets`);
    await expect(page.getByTestId("facet-tab")).toHaveCount(6);
    expect(await page.getByTestId("facet-row").count()).toBeGreaterThan(0);
  });

  test("★ 停用 → 从前台筛选器消失；启用 → 回来（已有引用不受影响）", async ({ page }) => {
    await page.goto(`${BASE}/facets?facet=dynasty`);

    // 找一行有引用的（count > 0），停用它才有意义
    const row = page.locator('[data-testid="facet-row"][data-active="true"]').filter({ hasText: "条在用" }).first();
    const name = (await row.locator("span.text-sm.font-medium").innerText()).trim();

    await row.getByTestId("facet-toggle").click();
    await expect(page.locator(`[data-testid="facet-row"]:has-text("${name}")`).first()).toHaveAttribute(
      "data-active",
      "false",
    );

    // 前台筛选器里不该再出现它
    await page.goto("/");
    await expect(
      page.locator(`a[data-testid="facet-option"][data-facet="dynasty"]`).filter({ hasText: name }),
    ).toHaveCount(0);

    // 恢复 —— 否则后面的用例看到的筛选器和预期不一致
    await page.goto(`${BASE}/facets?facet=dynasty`);
    const off = page.locator(`[data-testid="facet-row"][data-active="false"]`).filter({ hasText: name }).first();
    await off.getByTestId("facet-toggle").click();
    await expect(page.locator(`[data-testid="facet-row"]:has-text("${name}")`).first()).toHaveAttribute(
      "data-active",
      "true",
    );
  });

  test("新增一行；重名会被挡下并说明原因", async ({ page }) => {
    await page.goto(`${BASE}/facets?facet=medium`);

    await page.getByTestId("add-facet-input").fill("测试新增值");
    await page.getByTestId("add-facet-submit").click();
    await expect(page.locator('[data-testid="facet-row"]').filter({ hasText: "测试新增值" })).toHaveCount(1);

    // 重名
    await page.getByTestId("add-facet-input").fill("测试新增值");
    await page.getByTestId("add-facet-submit").click();
    await expect(page.getByTestId("add-facet-error")).toContainText("已存在");
  });

  test("★ 被停用的值仍在筛选中时：chip 显示名字，侧边栏也带上它", async ({ page }) => {
    // 这是评审指出的断层，但实际症状比它说的更糟：
    // chip 的名字来自 listFacets()，而停用值不在那份列表里 → 兜底成**裸 id**。
    // 用自建的值做测试，避免动到 browse.spec 依赖的真实分类。
    await page.goto(`${BASE}/facets?facet=motif`);
    await page.getByTestId("add-facet-input").fill("Z_停用测试");
    await page.getByTestId("add-facet-submit").click();

    const row = page.locator('[data-testid="facet-row"]').filter({ hasText: "Z_停用测试" }).first();
    const valueId = await row.getAttribute("data-value-id");
    await row.getByTestId("facet-toggle").click();
    await expect(
      page.locator(`[data-testid="facet-row"][data-value-id="${valueId}"]`),
    ).toHaveAttribute("data-active", "false");

    // 直接带参数访问 —— 模拟"从详情页的分面 chip 点进来"
    await page.goto(`/?motif=${valueId}`);

    const chip = page.getByTestId("selected-chip");
    await expect(chip).toContainText("Z_停用测试");
    expect((await chip.innerText()).trim(), "chip 不能只剩一个裸数字").not.toBe(String(valueId));

    // 侧边栏也要有这一行，并标出它已停用
    await expect(
      page.locator(`a[data-testid="facet-option"][data-facet="motif"][data-value-id="${valueId}"]`),
    ).toContainText("已停用");
  });

  test("行内编辑：改名与说明", async ({ page }) => {
    await page.goto(`${BASE}/facets?facet=medium`);

    const row = page.locator('[data-testid="facet-row"]').filter({ hasText: "测试新增值" }).first();
    const valueId = await row.getAttribute("data-value-id");
    await row.getByTestId("facet-edit").click();

    // ⚠️ 进入编辑态后，名称从文本变成输入框的 value —— has-text 过滤器再也匹配不到这一行，
    //    必须改用 data-value-id 定位（第一次写就踩了这个，超时 30 秒）
    const editing = page.locator(`[data-testid="facet-row"][data-value-id="${valueId}"]`);
    await editing.getByTestId("facet-name-input").fill("测试改名后");
    await editing.getByLabel("说明").fill("这是一段说明");
    await editing.getByTestId("facet-save").click();

    await expect(page.locator('[data-testid="facet-row"]').filter({ hasText: "测试改名后" })).toHaveCount(1);
  });
});

test.describe("待审队列", () => {
  test("队列为空时给出空状态和入口", async ({ page }) => {
    await page.goto(`${BASE}/pending`);
    await expect(page.getByTestId("pending-total")).toBeVisible();
    await expect(page.getByTestId("pending-empty")).toBeVisible();
  });
});

test.describe("编辑器", () => {
  test("新建页：六个分面组、两个图片槽、没填齐时不能提交", async ({ page }) => {
    await page.goto(`${BASE}/edit/new`);

    await expect(page.getByTestId("editor-facet-group")).toHaveCount(6);
    await expect(page.getByTestId("image-slot")).toHaveCount(2);
    await expect(page.getByTestId("editor-submit")).toBeDisabled();

    await page.getByTestId("editor-name").fill("只填了名字");
    await expect(page.getByTestId("editor-submit"), "缺图片仍不能提交").toBeDisabled();
  });

  test("★ 改已发布条目：预填现有数据，且提示是「保存即生效」", async ({ page }) => {
    await page.goto(`${BASE}/patterns`);
    await page.getByTestId("admin-row").first().getByRole("link", { name: "编辑" }).click();

    await expect(page).toHaveURL(/\/admin\/edit\/pattern\/\d+$/);
    await expect(page.getByTestId("editor-name")).not.toHaveValue("");
    // 两张图都预填了 —— 没换就不该要求重新上传
    await expect(page.getByTestId("image-preview")).toHaveCount(2);
    // 分面已选中
    expect(await page.locator('[data-testid="editor-facet-option"][data-checked="true"]').count()).toBeGreaterThan(0);
    await expect(page.getByText("保存即生效")).toBeVisible();

    // 状态控件必须存在且预填成当前状态 —— 曾经漏掉它，导致保存后条目变草稿却无处可改
    await expect(page.getByTestId("editor-status")).toHaveValue("published");
  });

  test("新建页没有状态控件（状态由流程决定）", async ({ page }) => {
    await page.goto(`${BASE}/edit/new`);
    await expect(page.getByTestId("editor-status")).toHaveCount(0);
  });

  test("★ 「其它」与具体值互斥（勾一个会自动取消另一个）", async ({ page }) => {
    await page.goto(`${BASE}/edit/new`);
    const group = page.locator('[data-testid="editor-facet-group"][data-facet="ethnicGroup"]');
    const other = group.locator('[data-testid="editor-facet-option"]').filter({ hasText: "其它" }).first();
    const miao = group.locator('[data-testid="editor-facet-option"]').filter({ hasText: "苗族" }).first();

    await other.click();
    await expect(other).toHaveAttribute("data-checked", "true");

    await miao.click();
    await expect(miao).toHaveAttribute("data-checked", "true");
    await expect(other, "选了具体值，「其它」应自动取消").toHaveAttribute("data-checked", "false");

    await other.click();
    await expect(other).toHaveAttribute("data-checked", "true");
    await expect(miao, "选「其它」应清空同维的具体值").toHaveAttribute("data-checked", "false");
  });

  test("分面可以勾选/取消，新建值进「建议」区", async ({ page }) => {
    await page.goto(`${BASE}/edit/new`);

    const opt = page.locator('[data-testid="editor-facet-option"]').first();
    await opt.click();
    await expect(opt).toHaveAttribute("data-checked", "true");
    await opt.click();
    await expect(opt).toHaveAttribute("data-checked", "false");

    const group = page.locator('[data-testid="editor-facet-group"][data-facet="dynasty"]');
    await group.getByTestId("editor-new-value").fill("测试新朝代");
    await group.getByRole("button", { name: "新建" }).click();
    await expect(group.getByTestId("editor-suggested")).toContainText("测试新朝代");
  });
});
