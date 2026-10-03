# Stage 1A Schedule — 博物馆优先

> 目标：完成纹饰素材库（博物馆）的所有功能，验证内容展示和交互设计，积累纹饰数据。
> 技术栈：Next.js 14+ (App Router) + Prisma + SQLite + Tailwind + shadcn/ui
> 部署：Vercel（上线阶段）

---

## Task 1：项目初始化（预计 1 天）

| 子任务 | 说明 |
|--------|------|
| 1.1 | `npx create-next-app@latest`，选 App Router + TypeScript + Tailwind |
| 1.2 | 安装并配置 shadcn/ui（`npx shadcn@latest init`） |
| 1.3 | 安装 Prisma + better-sqlite3，`npx prisma init`，配 SQLite |
| 1.4 | 配置基础目录结构（`src/lib/`, `src/components/ui/`, `public/patterns/`, `public/boards/`） |
| 1.5 | 配置 ESLint + Prettier |

**验证：** `npm run dev` 启动成功，浏览器访问 `localhost:3000` 看到 Next.js 默认页

---

## Task 2：数据库 Schema + 种子数据（预计 1 天）

| 子任务 | 说明 |
|--------|------|
| 2.1 | 编写 Prisma Schema：`Pattern` 表（所有字段 + bitmap_url + vector_url） |
| 2.2 | 编写 `Variation` 表（pattern_id, variant_name, dynasty, region, description, bitmap_url, vector_url） |
| 2.3 | 编写 `Relation` 表（pattern_a_id, pattern_b_id, relation_type, description） |
| 2.4 | 编写 `Tag` + `PatternTag` 表（分类标签多对多） |
| 2.5 | 编写 `Period/Dynasty` 表（name, period_start, period_end, description） |
| 2.6 | 编写种子数据脚本，插入 5-10 个经典纹饰作为初始数据 |
| 2.7 | `npx prisma db push` + 验证数据库可用 |

**验证方法：**
- 运行 `npx prisma db push` 无报错
- 运行 `npx prisma studio` 打开可视化界面，确认种子数据已写入所有表
- 检查各表之间关联关系正确（Pattern ↔ Variation, Pattern ↔ Tag 等）

---

## Task 3：API Routes（预计 1 天）

| 子任务 | 说明 |
|--------|------|
| 3.1 | `GET /api/patterns` — 纹饰列表（支持分页、筛选、搜索参数） |
| 3.2 | `GET /api/patterns/[id]` — 纹饰详情（含变种和关联） |
| 3.3 | `GET /api/patterns/[id]/variations` — 变种列表 |
| 3.4 | `GET /api/patterns/[id]/relations` — 关联纹饰列表 |
| 3.5 | `GET /api/tags` — 所有标签（用于筛选栏） |
| 3.6 | `GET /api/dynasties` — 所有朝代列表 |

**验证方法（用 curl 或浏览器直接访问）：**
```bash
# 验证列表接口
curl http://localhost:3000/api/patterns
curl http://localhost:3000/api/patterns?dynasty=商
curl http://localhost:3000/api/patterns?search=饕餮

# 验证详情接口
curl http://localhost:3000/api/patterns/1

# 验证关联数据
curl http://localhost:3000/api/patterns/1/variations
curl http://localhost:3000/api/patterns/1/relations

# 验证筛选数据
curl http://localhost:3000/api/tags
curl http://localhost:3000/api/dynasties
```

**验证标准：**
- 所有接口返回 200 + 正确 JSON 结构
- 筛选参数组合正确过滤数据
- 不存在的数据返回 404
- 字段缺失时数据库不报错（空值处理）

---

## Task 4：前端 — 首页 + 纹饰浏览（预计 2 天）

| 子任务 | 说明 |
|--------|------|
| 4.1 | 首页 `src/app/page.tsx` — 精选纹饰展示、朝代/题材快速入口、搜索框 |
| 4.2 | 浏览页 `src/app/patterns/page.tsx` — 纹饰网格（卡片含缩略图+名称+朝代） |
| 4.3 | 筛选栏组件 — 可折叠的多维度筛选（朝代/地域/题材/载体），多选组合，已选条件标签 |
| 4.4 | 搜索组件 — 输入关键词，与筛选条件叠加 |
| 4.5 | 卡片悬停效果 — hover 显示 [查看详情] [加入排版] 按钮 |

**验证方法：**
- **功能验证：**
  - 首页渲染正常，精选纹饰可见
  - 点"商代"快速入口 → 跳转到浏览页并自动选中"商代"筛选
  - 勾选多个筛选条件 → 网格内容正确过滤
  - 搜索框输入关键字 → 结果匹配
  - 已选条件标签可点 × 移除
  - 卡片 hover 出现操作按钮
- **响应式验证（浏览器的 DevTools 调尺寸）：**
  - 桌面（>1024px）：左侧筛选栏可见，网格 3-4 列
  - 平板（768-1024px）：筛选栏可折叠，网格 2-3 列
  - 手机（<768px）：筛选栏为底部弹出或侧滑抽屉，网格 1-2 列

---

## Task 5：前端 — 纹饰详情（预计 1.5 天）

| 子任务 | 说明 |
|--------|------|
| 5.1 | 详情页 `src/app/patterns/[id]/page.tsx` — 大图 + 元数据 + 文化含义 |
| 5.2 | 图片缩放组件 — 点击放大、滚轮缩放、位图/矢量图切换 |
| 5.3 | 变种列表模块 — 同一纹饰不同朝代的变种横向展示 |
| 5.4 | 关联纹饰模块 — 关联纹饰卡片列表 |
| 5.5 | "加入排版"按钮 — 跳转到排版工作区（当前先占位） |

**验证方法：**
- **功能验证：**
  - 直接访问详情页（`/patterns/1`）和从浏览页点入 → 均正常显示
  - 元数据显示完整（名称、朝代、文化含义等）
  - 点击大图 → 放大/可缩放
  - 点"查看矢量" → 切换到 SVG 渲染
  - 点变种卡片 → 切换到对应朝代的变种详情
  - 关联纹饰有点击跳转
- **边界情况：**
  - 不存在 ID → 404 或友好提示
  - 只有位图没有 SVG → 隐藏"查看矢量"按钮
  - 纹饰无变种 → 变种区域隐藏或显示"暂无"
  - 纹饰有关联 → 显示列表，无关联 → 隐藏区域

---

## Task 6：前端 — 时间线 + 关联图谱（预计 2 天）

| 子任务 | 说明 |
|--------|------|
| 6.1 | 时间线页 `src/app/patterns/[id]/timeline/page.tsx` — 横向时间轴，按朝代排列 |
| 6.2 | 时间线交互 — 横向拖拽滑动、点击节点跳转变种详情 |
| 6.3 | 关联图谱页 `src/app/patterns/[id]/relations/page.tsx` — 网络图（节点+连线） |
| 6.4 | 图谱交互 — 拖拽、缩放、点击节点跳转 |

**验证方法：**
- **时间线：**
  - 有多个变种的纹饰 → 时间线正确显示各朝代节点
  - 横向拖拽滑动流畅
  - 点击节点 → 跳转到对应变种详情
  - 只有一个变种的纹饰 → 时间线显示单节点或提示"暂无更多变种"
  - 响应式：手机上时间线可滑动查看
- **关联图谱：**
  - 有关联的纹饰 → 正确渲染节点和连线
  - 拖拽图谱 → 节点跟随移动
  - 滚轮缩放 → 图谱放大缩小
  - 点击节点 → 跳转到关联纹饰详情
  - 无关联的纹饰 → 显示"暂无关联"或空状态

---

## Task 7：管理后台 — 后端 CRUD（预计 1.5 天）

| 子任务 | 说明 |
|--------|------|
| 7.1 | `POST /api/admin/patterns` — 创建纹饰 |
| 7.2 | `PUT /api/admin/patterns/[id]` — 更新纹饰 |
| 7.3 | `DELETE /api/admin/patterns/[id]` — 删除纹饰 |
| 7.4 | `POST /api/admin/variations` — 添加变种 |
| 7.5 | `POST /api/admin/relations` — 添加关联关系 |
| 7.6 | 文件上传 API — 接收 SVG/位图文件，保存到 `public/` 目录 |
| 7.7 | `GET /api/admin/review` — 待审核列表 |

**验证方法（用 curl）：**
```bash
# 创建
curl -X POST http://localhost:3000/api/admin/patterns \
  -H "Content-Type: application/json" \
  -d '{"name":"测试纹饰","dynasty":"商","category":"动物纹"}'

# 更新
curl -X PUT http://localhost:3000/api/admin/patterns/1 \
  -H "Content-Type: application/json" \
  -d '{"description":"更新描述"}'

# 删除
curl -X DELETE http://localhost:3000/api/admin/patterns/1

# 创建后通过 GET 确认数据已写入
curl http://localhost:3000/api/admin/patterns
```

**验证标准：**
- 创建后能在 GET 列表查到
- 更新后字段正确变更
- 删除后数据不可查
- 文件上传后能在 `public/` 目录找到，URL 可访问

---

## Task 8：管理后台 — 前端页面（预计 2 天）

| 子任务 | 说明 |
|--------|------|
| 8.1 | 仪表盘 `src/app/admin/page.tsx` — 概览统计、最近导入记录 |
| 8.2 | 审核列表 `src/app/admin/review/page.tsx` — 逐条审核，批量通过/拒绝 |
| 8.3 | 编辑器 `src/app/admin/edit/[id]/page.tsx` — 基本信息、图像上传、文化信息表单 |
| 8.4 | SVG 颜色标注模块 — 路径列表 + data-color-role 下拉选择 + 预览效果 |
| 8.5 | 变种管理模块 — 添加/编辑/删除变种 |
| 8.6 | 关联管理模块 — 添加/编辑/删除关联关系 |
| 8.7 | 批量导入 `src/app/admin/import/page.tsx` — 拖拽上传 + URL 批量拉取 |

**验证方法（人工操作）：**
- **仪表盘：** 数据统计数字正确，和数据库实际记录数一致
- **审核列表：**
  - 待审核纹饰逐条显示
  - 点"通过" → 状态变更为已发布
  - 点"拒绝" → 从队列移除
  - 批量操作正常
- **编辑器：**
  - 打开已有纹饰 → 表单预填正确
  - 修改字段 → 保存后刷新页面显示更新后的值
  - 上传图片 → 文件保存成功，预览可见
  - SVG 颜色标注 → 路径列表正确，修改 color-role 后可预览换色效果
  - 添加/删除变种 → 列表正确刷新
  - 添加/删除关联 → 列表正确刷新
- **批量导入：**
  - 拖拽 SVG 文件 → 导入成功
  - URL 批量拉取 → 文件保存到目录

---

## Task 9：AI 辅助集成（预计 1 天）

| 子任务 | 说明 |
|--------|------|
| 9.1 | 接入 Claude API（或兼容 API），创建 AI 服务封装 `src/lib/ai.ts` |
| 9.2 | AI 建议元数据功能 — 上传图片后调 AI，返回建议填充到编辑器表单 |
| 9.3 | AI 建议 SVG 标注 — 分析 SVG 路径结构，建议 color-role 分配 |
| 9.4 | AI 建议关联 — 根据当前纹饰名称/朝代，提示可能的关联关系 |
| 9.5 | AI 生成文化解读草稿 — 填充到文化含义文本框 |

**验证方法：**
- 点"AI 智能填充"按钮 → 加载中状态 → AI 返回建议 → 自动填入表单
- 建议数据格式正确（名称不会填到朝代字段）
- AI 调用失败（如无网络/API key 错误）→ 显示友好错误提示，不影响已有表单数据
- AI 建议 SVG 标注 → 路径角色分配合理，预览换色效果可接受
- API key 不存在时 → AI 功能不可用，但不能导致整个后台崩溃

---

## Task 10：PWA + 部署上线（预计 0.5 天）

| 子任务 | 说明 |
|--------|------|
| 10.1 | 配置 `manifest.json` + Service Worker |
| 10.2 | 生成 App 图标（192x192 + 512x512） |
| 10.3 | 部署到 Vercel（`git push` → 自动部署） |
| 10.4 | 配置自定义域名（可选） |

**验证方法：**
- Chrome DevTools → Application → Manifest → 显示正确
- Lighthouse → PWA 审计 → 全部通过
- Deployment: Vercel 部署成功，域名可访问
- 手机 Safari/Chrome → "添加到主屏幕" → 可正常打开，有启动屏和图标

---

## 依赖与并行

```
Task 1 (1d) ← 起点
  ↓
Task 2 (1d)
  ↓
Task 3 (1d) ──→ Task 7 (1.5d)
  ↓                ↓
Task 4 (2d)    Task 8 (2d)   可以并行
  ↓                ↓
Task 5 (1.5d)     Task 9 (1d)  Task 9 依赖 Task 8
  ↓
Task 6 (2d)
  ↓
Task 10 (0.5d)
```

**合计：** 按串行 ~13.5 天；Task 4+5+6 和 Task 7+8+9 并行 → 约 **9-10 天**
