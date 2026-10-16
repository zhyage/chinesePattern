#!/usr/bin/env node
/**
 * 数据迁移：把纹样的「图组」摊开成两层结构。
 *
 *   饕餮纹 (顶层)                     饕餮纹·甲  ← 接手 taotie.jpg + taotie.svg
 *     ├── 图组1: taotie.jpg + taotie.svg
 *     └── 图组2: taotie-alt.jpg + taotie-alt.svg
 *                                     饕餮纹·乙  ← 接手 taotie-alt.jpg + taotie-alt.svg
 *
 * 【为什么要按这个顺序配对】图片查看器（src/components/image-viewer.tsx:20-23）是靠
 * **数组下标**配对的 —— bitmapImages[i] + vectorImages[i]，没有任何显式的分组字段。
 * 所以拆分必须复刻它当前实际用的那个配对，否则会把用户现在看到的分组拆错。
 *
 * 【幂等】已有子项的纹样直接跳过；重复运行不会重复创建。
 *
 * 【必须用 Node 20】better-sqlite3 是懒加载的，Node 24 下 require 成功但
 * new Database() 会抛 ERR_DLOPEN_FAILED。
 *
 * 用法：
 *   export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
 *   node scripts/migrate-hierarchy.js --dry-run
 *   node scripts/migrate-hierarchy.js
 */

/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("node:path");
const Database = require("better-sqlite3");

const DRY_RUN = process.argv.includes("--dry-run");
const DB_PATH = path.join(__dirname, "..", "dev.db");

/** 中性编号：甲乙丙丁… 不声称任何含义，等换成真素材时再改成语义名。 */
const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];

/**
 * 语义名覆盖表 —— 只有【已核实过形态】的纹样才列在这里。
 * 云雷纹·圆雷 的形态是从真实参考图描摹出来的（圆转螺旋），名字有依据；
 * 其余纹样目前都是占位图形，用中性编号，不编造含义。
 */
const NAME_OVERRIDES = {
  云雷纹: ["云雷纹·圆雷", "云雷纹·同心圆"],
};

const db = new Database(DB_PATH, { fileMustExist: true });
db.pragma("foreign_keys = ON");

const log = (...a) => console.log(...a);
const now = () => new Date().toISOString();

// 注意列名：isPrimary / sortOrder 在 schema 里没有 @map，库中就是驼峰；
// 而 pattern_id / created_at 有 @map，是下划线。别想当然。
const IMG_COLS = 'id, url, type, "isPrimary" AS isPrimary, "sortOrder" AS sortOrder';

function splitIntoGroups(images) {
  const bmp = images.filter((i) => i.type === "bitmap");
  const vec = images.filter((i) => i.type === "vector");
  const n = Math.max(bmp.length, vec.length);
  const groups = [];
  for (let i = 0; i < n; i++) {
    const members = [bmp[i], vec[i]].filter(Boolean);
    if (members.length) groups.push(members);
  }
  return groups;
}

function ensurePrimary(patternId, styleName) {
  const has = db
    .prepare(`SELECT count(*) c FROM pattern_images WHERE pattern_id = ? AND "isPrimary" = 1`)
    .get(patternId).c;
  if (has > 0) return null;

  const pick = db
    .prepare(
      `SELECT id, url FROM pattern_images WHERE pattern_id = ?
       ORDER BY (type = 'vector') DESC, "sortOrder" ASC, id ASC LIMIT 1`,
    )
    .get(patternId);
  if (!pick) return null;

  if (!DRY_RUN) db.prepare(`UPDATE pattern_images SET "isPrimary" = 1 WHERE id = ?`).run(pick.id);
  return pick.url;
}

function main() {
  // 顶层且尚无子项的纹样
  const parents = db
    .prepare(
      `SELECT id, name, dynasty, category, medium FROM patterns
       WHERE parent_id IS NULL
         AND id NOT IN (SELECT parent_id FROM patterns WHERE parent_id IS NOT NULL)
       ORDER BY id`,
    )
    .all();

  let createdCount = 0;

  for (const p of parents) {
    const images = db
      .prepare(
        `SELECT ${IMG_COLS} FROM pattern_images WHERE pattern_id = ?
         ORDER BY "sortOrder" ASC, id ASC`,
      )
      .all(p.id);

    if (!images.length) continue; // 无图，跳过（云雷纹就是这种，已处理过）

    const groups = splitIntoGroups(images);
    if (groups.length < 2) {
      log(`· ${p.name}：只有 ${groups.length} 个图组，无需拆分`);
      continue;
    }

    const names =
      NAME_OVERRIDES[p.name] ??
      groups.map((_, i) => `${p.name}·${STEMS[i] ?? `(${i + 1})`}`);

    log(`【${p.name}】${groups.length} 个图组 → ${names.join(" / ")}`);

    groups.forEach((members, i) => {
      const styleName = names[i] ?? `${p.name}·${STEMS[i]}`;

      if (DRY_RUN) {
        log(`  + 将创建「${styleName}」 ← ${members.map((m) => m.url).join(" + ")}`);
        return;
      }

      const info = db
        .prepare(
          `INSERT INTO patterns
             (name, dynasty, category, medium, status, parent_id, created_at, updated_at)
           VALUES (?, ?, ?, ?, 'published', ?, ?, ?)`,
        )
        .run(styleName, p.dynasty, p.category, p.medium, p.id, now(), now());
      const styleId = info.lastInsertRowid;

      for (const m of members) {
        db.prepare("UPDATE pattern_images SET pattern_id = ? WHERE id = ?").run(styleId, m.id);
      }

      const promoted = ensurePrimary(styleId, styleName);
      createdCount++;
      log(
        `  + 「${styleName}」(id=${styleId}) ← ${members.map((m) => m.url).join(" + ")}` +
          (promoted ? `  主图=${promoted}` : ""),
      );
    });
  }

  // 修正已有子项的主图（幂等；云雷纹在上一轮已处理）
  for (const c of db.prepare("SELECT id, name FROM patterns WHERE parent_id IS NOT NULL").all()) {
    const promoted = ensurePrimary(c.id, c.name);
    if (promoted) log(`  ↑ 「${c.name}」主图修正为 ${promoted}`);
  }

  // 清空照抄来的精确年代（period_start 是从朝代表抄的，不是纹样年代）
  const stale = db
    .prepare("SELECT count(*) c FROM patterns WHERE period_start IS NOT NULL OR period_end IS NOT NULL")
    .get().c;
  if (stale && !DRY_RUN) {
    db.prepare("UPDATE patterns SET period_start = NULL, period_end = NULL").run();
    log(`~ 已清空 ${stale} 条纹样的 period_start / period_end`);
  }

  // ── 汇总 ──────────────────────────────────────────────
  log("");
  if (DRY_RUN) {
    log("【这是 dry-run，未写入任何数据】");
  } else {
    log(`本次新建式样 ${createdCount} 个`);
  }
  log("");
  for (const r of db
    .prepare(
      `SELECT p.id, p.name, p.parent_id, par.name AS parent_name,
              (SELECT count(*) FROM pattern_images i WHERE i.pattern_id = p.id) AS imgs
       FROM patterns p LEFT JOIN patterns par ON par.id = p.parent_id
       ORDER BY COALESCE(p.parent_id, p.id), p.parent_id IS NOT NULL, p.id`,
    )
    .all()) {
    const mark = r.parent_id ? `  └─ [${r.parent_name}]` : "";
    log(`  id=${String(r.id).padStart(2)}  图=${r.imgs}  ${r.name}${mark}`);
  }

  const orphans = db
    .prepare(
      "SELECT count(*) c FROM pattern_images x LEFT JOIN patterns p ON p.id = x.pattern_id WHERE p.id IS NULL",
    )
    .get().c;
  const noPrimary = db
    .prepare(
      `SELECT count(*) c FROM patterns p
       WHERE EXISTS (SELECT 1 FROM pattern_images i WHERE i.pattern_id = p.id)
         AND NOT EXISTS (SELECT 1 FROM pattern_images i WHERE i.pattern_id = p.id AND i."isPrimary" = 1)`,
    )
    .get().c;
  log("");
  log(`孤立图片行：${orphans}（必须为 0）`);
  log(`有图但无主图的纹样：${noPrimary}（必须为 0）`);
}

db.transaction(main)();
db.close();
