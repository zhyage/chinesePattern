/**
 * 初始数据。
 *
 * ⚠️ 本脚本开头会清空全部表。不要无脑重跑 —— 会丢掉手工录入的数据。
 *    它只在「建库 / 重建库」时用。
 *
 * 数据来源：从旧的层级模型（tag `pre-flat-rewrite`）迁移而来。
 * 迁移时做了两处判断，都记在这里：
 *
 *   1. 【未搬运】旧 pattern 上的 `source` 字段（如"河南安阳殷墟妇好墓出土"）。
 *      那是**无出处的具体出处声明**，而旧数据本身是占位素材。
 *      按「不编造」的原则没有搬。拿到真实引证后请自行补到对应母题上。
 *
 *   2. 【照搬】`region = 中原` 对所有 pattern 生效。
 *      这个值零信息量（所有纹样一样），但它不是"编造"，属于既有数据，
 *      照搬以便你后续整理时决定去留。
 *
 *   3. 旧的 7 个「类型」行（无图）已消失 —— 它们的描述/文化含义上移到了
 *      对应的 motif 记录，14 个「式样」行成为扁平的 pattern。
 *
 * 用法（必须 Node 20）：
 *   export PATH="$HOME/.nvm/versions/node/v20.20.2/bin:$PATH"
 *   npx tsx prisma/seed.ts
 */

import "dotenv/config";
import { PrismaClient } from "@prisma/client";

// adapter 是 CJS 包，必须用 require（与 src/lib/db.ts 保持一致）
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");

const url = process.env.DATABASE_URL ?? `file:${process.cwd()}/dev.db`;
const adapter = new PrismaBetterSqlite3({ url });
const prisma = new PrismaClient({ adapter });

// ─────────────────────────────────────────────────────────────
// 六个分面维度的初始值
// 每张表都会额外插入一行「其它」—— 它是真实的一行，不是空值的隐式表达。
// 详见 design.md §2.4
// ─────────────────────────────────────────────────────────────

const OTHER = "其它";

const DYNASTIES = ["商", "西周", "春秋", "战国", "汉", "唐", "宋", "明", "清"];
const REGIONS = ["中原", "楚地", "巴蜀"];
const ETHNIC_GROUPS = ["汉族", "苗族"];
const CATEGORIES = ["动物纹", "植物纹", "几何纹", "吉祥纹", "自然纹"];
const MOTIFS = ["饕餮纹", "云雷纹", "祥云纹", "夔龙纹", "蟠螭纹", "连珠纹", "宝相花纹"];
const MEDIUMS = ["青铜器", "玉器", "织锦", "陶瓷", "漆器", "建筑彩绘"];

// ─────────────────────────────────────────────────────────────
// 母题的说明文字
// 扁平模型下没有"类型记录"，所以「云雷纹是什么」这段文字只能挂在 motif 表上。
// 这是从旧模型上移过来的既有内容，未经考据核实，按需修改。
// ─────────────────────────────────────────────────────────────

const MOTIF_TEXT: Record<string, { description: string; culturalMeaning: string }> = {
  饕餮纹: {
    description:
      "饕餮纹是商代青铜器上最常见的纹饰之一，以对称的兽面为主要特征，双目圆睁，巨口獠牙，额上立耳，形象庄严神秘。多装饰于鼎、尊、罍等礼器的腹部和足部。",
    culturalMeaning:
      "饕餮是古代传说中贪食的凶兽，但在青铜器上，饕餮纹并非单纯的装饰，而是商代人沟通天地、祭祀神灵的重要媒介，具有通神、辟邪的宗教功能，同时也象征着王权和威严。",
  },
  云雷纹: {
    description:
      "云雷纹是一种以螺旋形线条构成的几何纹饰，呈回旋状排列，线条细密而规整。常用于青铜器的主体纹饰上方或下方作为边饰，也用作主纹的地纹。",
    culturalMeaning:
      "云雷纹源于对自然现象（云气和雷电）的抽象化表达。古人认为云雷与天象相关，带有沟通天地的寓意。在商周青铜器上，云雷纹多用作地纹，衬托主纹的神秘威严。",
  },
  祥云纹: {
    description:
      "祥云纹以流畅的曲线勾画出云朵的飘逸形态，线条婉转回旋，造型舒展优美。汉代祥云纹线条较粗犷奔放，至唐宋时期渐趋精致规整。",
    culturalMeaning:
      "祥云纹是中国最吉祥的传统纹样之一。云与'运'谐音，祥云即吉祥之云，寓意福运绵长、万事如意。在道教文化中，云气也是仙人登天的媒介，故有'神仙脚踏祥云'之说。",
  },
  夔龙纹: {
    description:
      "夔龙纹为单足龙形纹饰，龙首回顾，张口卷尾，身躯呈弯曲状，线条刚劲有力。夔龙是传说中一种仅有单足的异兽，常以侧面形象出现。",
    culturalMeaning:
      "夔在古代神话中是一种独脚怪兽，《山海经》有载。夔龙纹是后来蟠龙纹、云龙纹的雏形，在商周青铜器中具有重要的礼器装饰意义，代表权力和威严。",
  },
  蟠螭纹: {
    description:
      "蟠螭纹为盘曲交缠的螭龙纹饰。螭是传说中的无角龙，多条螭龙相互缠绕，形成繁复而有序的几何化图案，线条纤细流畅，充满动感。",
    culturalMeaning:
      "螭龙在传统文化中象征美好吉祥，蟠螭纹流行于春秋战国时期，常见于玉器、铜镜上。多龙缠绕的构图，寓意生生不息、绵绵不绝。",
  },
  连珠纹: {
    description:
      "连珠纹由大小相同的圆形相连排列而成，形如一串串珍珠。唐代的连珠纹常作为边饰或界栏使用，排列整齐，富有节奏感。",
    culturalMeaning:
      "连珠纹源自波斯萨珊王朝的装饰艺术，通过丝绸之路传入中国，是中外文化交流的产物。在唐代流行后，逐渐融入中国传统纹饰体系，常见于织锦和金银器上。",
  },
  宝相花纹: {
    description:
      "宝相花纹以莲花、牡丹等花卉为原型，经过图案化处理形成的对称式装饰花纹。花型饱满，层次丰富，中心为花蕊，外层花瓣层层展开，华美富丽。",
    culturalMeaning:
      "宝相花是佛教艺术与本土装饰融合的产物。'宝相'一词源于佛教，指佛像的庄严相好。宝相花纹寓意吉祥、圆满、圣洁，是唐代最具代表性的装饰纹样之一。",
  },
};

// ─────────────────────────────────────────────────────────────
// 14 条 pattern（扁平）
//
// ⚠️ 14 条里只有「云雷纹·圆雷」是真实素材：
//    位图 yunlei.png 是拓片扫描件（1074×274），矢量 yunlei.svg 是据它忠实描摹的
//    （来源见 design.md §10）。其余 13 条的位图与矢量都仍是**占位图形**。
//    替换时只需换同名文件，结构不用动。
//
// 图片约定：每个 pattern 一张位图 + 一张矢量。
//   位图为主图（isPrimary），作列表缩略图 —— 真实素材以照片/扫描件为主，用它更能代表实物。
//   矢量图次之，供详情页切换与打版工具使用。
// ─────────────────────────────────────────────────────────────

interface SeedPattern {
  name: string;
  motif: string;
  categories: string[];
  dynasties: string[];
  regions: string[];
  ethnicGroups: string[];
  mediums: string[];
  slug: string;
}

const PATTERNS: SeedPattern[] = [
  { name: "饕餮纹·甲", motif: "饕餮纹", categories: ["动物纹"], dynasties: ["商"], regions: ["中原"], ethnicGroups: ["汉族"], mediums: ["青铜器"], slug: "taotie" },
  { name: "饕餮纹·乙", motif: "饕餮纹", categories: ["动物纹"], dynasties: ["商"], regions: ["中原"], ethnicGroups: ["汉族"], mediums: ["青铜器"], slug: "taotie-alt" },
  { name: "云雷纹·圆雷", motif: "云雷纹", categories: ["几何纹"], dynasties: ["商"], regions: ["中原"], ethnicGroups: [], mediums: ["青铜器"], slug: "yunlei" },
  { name: "云雷纹·同心圆", motif: "云雷纹", categories: ["几何纹"], dynasties: ["商"], regions: ["中原"], ethnicGroups: [], mediums: ["青铜器"], slug: "yunlei-alt" },
  { name: "祥云纹·甲", motif: "祥云纹", categories: ["自然纹", "吉祥纹"], dynasties: ["汉"], regions: ["中原"], ethnicGroups: [], mediums: ["织锦"], slug: "xiangyun" },
  { name: "祥云纹·乙", motif: "祥云纹", categories: ["自然纹", "吉祥纹"], dynasties: ["汉"], regions: ["中原"], ethnicGroups: [], mediums: ["织锦"], slug: "xiangyun-alt" },
  { name: "夔龙纹·甲", motif: "夔龙纹", categories: ["动物纹"], dynasties: ["商"], regions: ["中原"], ethnicGroups: [], mediums: ["青铜器"], slug: "kui" },
  { name: "夔龙纹·乙", motif: "夔龙纹", categories: ["动物纹"], dynasties: ["商"], regions: ["中原"], ethnicGroups: [], mediums: ["青铜器"], slug: "kui-alt" },
  { name: "蟠螭纹·甲", motif: "蟠螭纹", categories: ["动物纹"], dynasties: ["春秋"], regions: ["中原"], ethnicGroups: [], mediums: ["玉器"], slug: "panchi" },
  { name: "蟠螭纹·乙", motif: "蟠螭纹", categories: ["动物纹"], dynasties: ["春秋"], regions: ["中原"], ethnicGroups: [], mediums: ["玉器"], slug: "panchi-alt" },
  { name: "连珠纹·甲", motif: "连珠纹", categories: ["几何纹"], dynasties: ["唐"], regions: ["中原"], ethnicGroups: [], mediums: ["织锦"], slug: "lianzhu" },
  { name: "连珠纹·乙", motif: "连珠纹", categories: ["几何纹"], dynasties: ["唐"], regions: ["中原"], ethnicGroups: [], mediums: ["织锦"], slug: "lianzhu-alt" },
  { name: "宝相花纹·甲", motif: "宝相花纹", categories: ["植物纹", "吉祥纹"], dynasties: ["唐"], regions: ["中原"], ethnicGroups: [], mediums: ["织锦"], slug: "baoxiang" },
  { name: "宝相花纹·乙", motif: "宝相花纹", categories: ["植物纹", "吉祥纹"], dynasties: ["唐"], regions: ["中原"], ethnicGroups: [], mediums: ["织锦"], slug: "baoxiang-alt" },
];

// ─────────────────────────────────────────────────────────────

async function main() {
  console.log("清空全部表…");
  // 顺序：先删有外键指向别人的
  await prisma.patternDynasty.deleteMany();
  await prisma.patternRegion.deleteMany();
  await prisma.patternEthnicGroup.deleteMany();
  await prisma.patternCategory.deleteMany();
  await prisma.patternMotif.deleteMany();
  await prisma.patternMedium.deleteMany();
  await prisma.patternImage.deleteMany();
  await prisma.pattern.deleteMany();
  await prisma.pending.deleteMany();
  await prisma.dynasty.deleteMany();
  await prisma.region.deleteMany();
  await prisma.ethnicGroup.deleteMany();
  await prisma.category.deleteMany();
  await prisma.motif.deleteMany();
  await prisma.medium.deleteMany();

  // ── 六张分面查找表 ────────────────────────────────────────
  console.log("建立分面查找表…");
  const dynastyIds = await buildFacet(DYNASTIES, (name) => prisma.dynasty.create({ data: { name } }));
  const regionIds = await buildFacet(REGIONS, (name) => prisma.region.create({ data: { name } }));
  const ethnicIds = await buildFacet(ETHNIC_GROUPS, (name) => prisma.ethnicGroup.create({ data: { name } }));
  const categoryIds = await buildFacet(CATEGORIES, (name) => prisma.category.create({ data: { name } }));
  const mediumIds = await buildFacet(MEDIUMS, (name) => prisma.medium.create({ data: { name } }));

  // 母题额外带上说明文字
  const motifIds: Record<string, number> = {};
  for (const name of MOTIFS) {
    const text = MOTIF_TEXT[name];
    const m = await prisma.motif.create({
      data: {
        name,
        description: text?.description ?? null,
        culturalMeaning: text?.culturalMeaning ?? null,
      },
    });
    motifIds[name] = m.id;
  }
  motifIds[OTHER] = (await prisma.motif.create({ data: { name: OTHER } })).id;
  console.log(`  dynasty ${DYNASTIES.length + 1} / region ${REGIONS.length + 1} / ethnic ${ETHNIC_GROUPS.length + 1}`);
  console.log(`  category ${CATEGORIES.length + 1} / motif ${MOTIFS.length + 1} / medium ${MEDIUMS.length + 1}`);

  // ── 14 条 pattern ─────────────────────────────────────────
  console.log("建立纹饰…");
  for (const p of PATTERNS) {
    const created = await prisma.pattern.create({
      data: {
        name: p.name,
        status: "published",
        images: {
          create: [
            // 位图为主图：真实素材以照片/扫描件为主，缩略图用它更能代表实物
            { url: `/patterns/${p.slug}.png`, type: "bitmap", purpose: "thumbnail", isPrimary: true, sortOrder: 0, label: "位图" },
            { url: `/patterns/${p.slug}.svg`, type: "vector", purpose: "detail", isPrimary: false, sortOrder: 1, label: "矢量图" },
          ],
        },
      },
    });

    // 一个 pattern 可以有多个 motif、多个题材……六个维度都是多对多。
    // 某个维度一个值都没选时，挂该维度的「其它」行 —— 它是真实的一行，
    // 不是空值（design.md §2.4）。所以这里用 resolve() 兜底。
    const resolve = (names: string[], map: Record<string, number>) =>
      (names.length ? names : [OTHER]).map((n) => map[n]);

    await prisma.patternMotif.createMany({
      data: resolve([p.motif], motifIds).map((id) => ({ patternId: created.id, motifId: id })),
    });
    await prisma.patternCategory.createMany({
      data: resolve(p.categories, categoryIds).map((id) => ({ patternId: created.id, categoryId: id })),
    });
    await prisma.patternDynasty.createMany({
      data: resolve(p.dynasties, dynastyIds).map((id) => ({ patternId: created.id, dynastyId: id })),
    });
    await prisma.patternRegion.createMany({
      data: resolve(p.regions, regionIds).map((id) => ({ patternId: created.id, regionId: id })),
    });
    await prisma.patternEthnicGroup.createMany({
      data: resolve(p.ethnicGroups, ethnicIds).map((id) => ({ patternId: created.id, ethnicGroupId: id })),
    });
    await prisma.patternMedium.createMany({
      data: resolve(p.mediums, mediumIds).map((id) => ({ patternId: created.id, mediumId: id })),
    });

    console.log(`  ✓ ${p.name}`);
  }

  console.log("\n完成。");
}

/** 建一批分面值 + 一行「其它」，返回 name → id */
async function buildFacet(names: string[], create: (name: string) => Promise<{ id: number; name: string }>) {
  const map: Record<string, number> = {};
  for (const name of names) {
    const row = await create(name);
    map[name] = row.id;
  }
  map[OTHER] = (await create(OTHER)).id;
  return map;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
