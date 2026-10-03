import "dotenv/config";
import { PrismaClient } from "@prisma/client";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");

const adapter = new PrismaBetterSqlite3({ url: `file:${process.cwd()}/dev.db` });
const prisma = new PrismaClient({ adapter });

async function main() {
  // 清空已有数据
  await prisma.patternImage.deleteMany();
  await prisma.variationImage.deleteMany();
  await prisma.patternTag.deleteMany();
  await prisma.tag.deleteMany();
  await prisma.relation.deleteMany();
  await prisma.variation.deleteMany();
  await prisma.period.deleteMany();
  await prisma.pattern.deleteMany();

  // ── 朝代 ──
  const periods = [
    { name: "商", periodStart: -1600, periodEnd: -1046, description: "约公元前1600年—前1046年" },
    { name: "西周", periodStart: -1046, periodEnd: -771, description: "约公元前1046年—前771年" },
    { name: "春秋", periodStart: -770, periodEnd: -476, description: "约公元前770年—前476年" },
    { name: "战国", periodStart: -475, periodEnd: -221, description: "约公元前475年—前221年" },
    { name: "汉", periodStart: -202, periodEnd: 220, description: "公元前202年—公元220年" },
    { name: "唐", periodStart: 618, periodEnd: 907, description: "公元618年—907年" },
    { name: "宋", periodStart: 960, periodEnd: 1279, description: "公元960年—1279年" },
    { name: "明", periodStart: 1368, periodEnd: 1644, description: "公元1368年—1644年" },
    { name: "清", periodStart: 1644, periodEnd: 1912, description: "公元1644年—1912年" },
  ];
  for (const p of periods) {
    await prisma.period.create({ data: p });
  }
  console.log(`✓ 已创建 ${periods.length} 个朝代`);

  // ── 标签 ──
  const tags = [
    // 题材
    { name: "动物纹", type: "category" },
    { name: "植物纹", type: "category" },
    { name: "几何纹", type: "category" },
    { name: "吉祥纹", type: "category" },
    { name: "自然纹", type: "category" },
    // 载体
    { name: "青铜器", type: "medium" },
    { name: "玉器", type: "medium" },
    { name: "织锦", type: "medium" },
    { name: "陶瓷", type: "medium" },
    { name: "漆器", type: "medium" },
    { name: "建筑彩绘", type: "medium" },
    // 地域
    { name: "中原", type: "region" },
    { name: "楚地", type: "region" },
    { name: "巴蜀", type: "region" },
    // 民族
    { name: "汉族", type: "ethnic" },
    { name: "苗族", type: "ethnic" },
    // 朝代（用于筛选栏）
    { name: "商", type: "dynasty" },
    { name: "西周", type: "dynasty" },
    { name: "春秋", type: "dynasty" },
    { name: "战国", type: "dynasty" },
    { name: "汉", type: "dynasty" },
    { name: "唐", type: "dynasty" },
    { name: "宋", type: "dynasty" },
    { name: "明", type: "dynasty" },
    { name: "清", type: "dynasty" },
  ];
  const createdTags: Record<string, number> = {};
  for (const t of tags) {
    const tag = await prisma.tag.create({ data: t });
    createdTags[t.name] = tag.id;
  }
  console.log(`✓ 已创建 ${tags.length} 个标签`);

  // ── 核心纹饰 ──
  const 饕餮纹 = await prisma.pattern.create({
    data: {
      name: "饕餮纹",
      alternateName: "兽面纹",
      dynasty: "商",
      periodStart: "约公元前1600年",
      periodEnd: "约公元前1046年",
      region: "中原",
      category: "动物纹",
      medium: "青铜器",
      description:
        "饕餮纹是商代青铜器上最常见的纹饰之一，以对称的兽面为主要特征，双目圆睁，巨口獠牙，额上立耳，形象庄严神秘。多装饰于鼎、尊、罍等礼器的腹部和足部。",
      culturalMeaning:
        "饕餮是古代传说中贪食的凶兽，但在青铜器上，饕餮纹并非单纯的装饰，而是商代人沟通天地、祭祀神灵的重要媒介，具有通神、辟邪的宗教功能，同时也象征着王权和威严。",
      source: "河南安阳殷墟出土",
      status: "published",
    },
  });
  console.log(`✓ 已创建: ${饕餮纹.name}`);

  const 云雷纹 = await prisma.pattern.create({
    data: {
      name: "云雷纹",
      alternateName: null,
      dynasty: "商",
      periodStart: "约公元前1600年",
      periodEnd: "约公元前1046年",
      region: "中原",
      category: "几何纹",
      medium: "青铜器",
      description:
        "云雷纹是一种以螺旋形线条构成的几何纹饰，呈回旋状排列，线条细密而规整。常用于青铜器的主体纹饰上方或下方作为边饰，也用作主纹的地纹。",
      culturalMeaning:
        "云雷纹源于对自然现象（云气和雷电）的抽象化表达。古人认为云雷与天象相关，带有沟通天地的寓意。在商周青铜器上，云雷纹多用作地纹，衬托主纹的神秘威严。",
      source: "河南安阳殷墟妇好墓出土",
      status: "published",
    },
  });
  console.log(`✓ 已创建: ${云雷纹.name}`);

  const 祥云纹 = await prisma.pattern.create({
    data: {
      name: "祥云纹",
      alternateName: "云气纹、流云纹",
      dynasty: "汉",
      periodStart: "约公元前202年",
      periodEnd: "约公元220年",
      region: "中原",
      category: "自然纹",
      medium: "织锦",
      description:
        "祥云纹以流畅的曲线勾画出云朵的飘逸形态，线条婉转回旋，造型舒展优美。汉代祥云纹线条较粗犷奔放，至唐宋时期渐趋精致规整。",
      culturalMeaning:
        "祥云纹是中国最吉祥的传统纹样之一。云与'运'谐音，祥云即吉祥之云，寓意福运绵长、万事如意。在道教文化中，云气也是仙人登天的媒介，故有'神仙脚踏祥云'之说。",
      source: "湖南长沙马王堆汉墓出土织物",
      status: "published",
    },
  });
  console.log(`✓ 已创建: ${祥云纹.name}`);

  const 夔龙纹 = await prisma.pattern.create({
    data: {
      name: "夔龙纹",
      alternateName: "夔纹",
      dynasty: "商",
      periodStart: "约公元前1600年",
      periodEnd: "约公元前1046年",
      region: "中原",
      category: "动物纹",
      medium: "青铜器",
      description:
        "夔龙纹为单足龙形纹饰，龙首回顾，张口卷尾，身躯呈弯曲状，线条刚劲有力。夔龙是传说中一种仅有单足的异兽，常以侧面形象出现。",
      culturalMeaning:
        "夔在古代神话中是一种独脚怪兽，《山海经》有载。夔龙纹是后来蟠龙纹、云龙纹的雏形，在商周青铜器中具有重要的礼器装饰意义，代表权力和威严。",
      source: "河南安阳殷墟出土",
      status: "published",
    },
  });
  console.log(`✓ 已创建: ${夔龙纹.name}`);

  const 蟠螭纹 = await prisma.pattern.create({
    data: {
      name: "蟠螭纹",
      alternateName: "螭纹",
      dynasty: "春秋",
      periodStart: "约公元前770年",
      periodEnd: "约公元前476年",
      region: "中原",
      category: "动物纹",
      medium: "玉器",
      description:
        "蟠螭纹为盘曲交缠的螭龙纹饰。螭是传说中的无角龙，多条螭龙相互缠绕，形成繁复而有序的几何化图案，线条纤细流畅，充满动感。",
      culturalMeaning:
        "螭龙在传统文化中象征美好吉祥，蟠螭纹流行于春秋战国时期，常见于玉器、铜镜上。多龙缠绕的构图，寓意生生不息、绵绵不绝。",
      source: "山西太原晋国赵卿墓出土玉器",
      status: "published",
    },
  });
  console.log(`✓ 已创建: ${蟠螭纹.name}`);

  const 连珠纹 = await prisma.pattern.create({
    data: {
      name: "连珠纹",
      alternateName: "联珠纹",
      dynasty: "唐",
      periodStart: "约公元618年",
      periodEnd: "约公元907年",
      region: "中原",
      category: "几何纹",
      medium: "织锦",
      description:
        "连珠纹由大小相同的圆形相连排列而成，形如一串串珍珠。唐代的连珠纹常作为边饰或界栏使用，排列整齐，富有节奏感。",
      culturalMeaning:
        "连珠纹源自波斯萨珊王朝的装饰艺术，通过丝绸之路传入中国，是中外文化交流的产物。在唐代流行后，逐渐融入中国传统纹饰体系，常见于织锦和金银器上。",
      source: "新疆吐鲁番阿斯塔那古墓出土织物",
      status: "published",
    },
  });
  console.log(`✓ 已创建: ${连珠纹.name}`);

  const 宝相花纹 = await prisma.pattern.create({
    data: {
      name: "宝相花纹",
      alternateName: "宝花",
      dynasty: "唐",
      periodStart: "约公元618年",
      periodEnd: "约公元907年",
      region: "中原",
      category: "植物纹",
      medium: "织锦",
      description:
        "宝相花纹以莲花、牡丹等花卉为原型，经过图案化处理形成的对称式装饰花纹。花型饱满，层次丰富，中心为花蕊，外层花瓣层层展开，华美富丽。",
      culturalMeaning:
        "宝相花是佛教艺术与本土装饰融合的产物。'宝相'一词源于佛教，指佛像的庄严相好。宝相花纹寓意吉祥、圆满、圣洁，是唐代最具代表性的装饰纹样之一。",
      source: "敦煌莫高窟出土唐代丝织品",
      status: "published",
    },
  });
  console.log(`✓ 已创建: ${宝相花纹.name}`);

  // ── 变种 ──
  await prisma.variation.create({
    data: {
      patternId: 饕餮纹.id,
      variantName: "商代早期饕餮纹",
      dynasty: "商",
      region: "中原",
      description: "商代早期饕餮纹线条较简单，双目突出，构图粗犷，尚处于形成期。",
    },
  });
  await prisma.variation.create({
    data: {
      patternId: 饕餮纹.id,
      variantName: "商代晚期饕餮纹",
      dynasty: "商",
      region: "中原",
      description: "商代晚期是饕餮纹的鼎盛期，纹饰繁复精细，常以云雷纹为地纹，多层装饰，庄严神秘。",
    },
  });
  await prisma.variation.create({
    data: {
      patternId: 饕餮纹.id,
      variantName: "西周饕餮纹",
      dynasty: "西周",
      region: "中原",
      description: "西周时期饕餮纹逐渐简化，线条趋于柔和，神秘感减弱，装饰性增强。",
    },
  });

  await prisma.variation.create({
    data: {
      patternId: 云雷纹.id,
      variantName: "商代云雷纹",
      dynasty: "商",
      description: "商代云雷纹以细密的单线回旋为主，排列规整，常作地纹衬托主纹。",
    },
  });
  await prisma.variation.create({
    data: {
      patternId: 云雷纹.id,
      variantName: "周代云雷纹",
      dynasty: "西周",
      description: "周代云雷纹线条较粗，风格比商代更加疏朗。",
    },
  });

  await prisma.variation.create({
    data: {
      patternId: 祥云纹.id,
      variantName: "汉代云气纹",
      dynasty: "汉",
      description: "汉代云气纹线条粗犷奔放，云尾拖长，充满动感。",
    },
  });
  await prisma.variation.create({
    data: {
      patternId: 祥云纹.id,
      variantName: "唐代祥云纹",
      dynasty: "唐",
      description: "唐代祥云纹趋于丰满圆润，线条流畅，更具装饰性。",
    },
  });
  await prisma.variation.create({
    data: {
      patternId: 祥云纹.id,
      variantName: "清代祥云纹",
      dynasty: "清",
      description: "清代祥云纹造型规整精致，常用于官服补子、建筑彩绘中。",
    },
  });

  console.log("✓ 已创建变种数据");

  // ── 关联关系 ──
  await prisma.relation.create({
    data: {
      patternAId: 云雷纹.id,
      patternBId: 祥云纹.id,
      relationType: "evolves_to",
      description: "云雷纹的螺旋形态在后世逐渐演变为祥云纹的流畅云气形态",
    },
  });

  await prisma.relation.create({
    data: {
      patternAId: 饕餮纹.id,
      patternBId: 云雷纹.id,
      relationType: "contains",
      description: "商代晚期饕餮纹常以云雷纹作为底纹衬托主体",
    },
  });

  await prisma.relation.create({
    data: {
      patternAId: 夔龙纹.id,
      patternBId: 蟠螭纹.id,
      relationType: "evolves_to",
      description: "夔龙纹是早期龙纹形态，后世演变为蟠螭纹等更复杂的龙纹系统",
    },
  });

  await prisma.relation.create({
    data: {
      patternAId: 连珠纹.id,
      patternBId: 宝相花纹.id,
      relationType: "same_theme",
      description: "连珠纹和宝相花纹均为唐代流行的装饰纹样，常共同出现在织锦上",
    },
  });

  console.log("✓ 已创建关联关系");

  // ── 标签关联 ──
  const patternTagData = [
    { patternId: 饕餮纹.id, tagId: createdTags["动物纹"] },
    { patternId: 饕餮纹.id, tagId: createdTags["青铜器"] },
    { patternId: 饕餮纹.id, tagId: createdTags["中原"] },
    { patternId: 饕餮纹.id, tagId: createdTags["汉族"] },
    { patternId: 云雷纹.id, tagId: createdTags["几何纹"] },
    { patternId: 云雷纹.id, tagId: createdTags["青铜器"] },
    { patternId: 祥云纹.id, tagId: createdTags["自然纹"] },
    { patternId: 祥云纹.id, tagId: createdTags["织锦"] },
    { patternId: 祥云纹.id, tagId: createdTags["吉祥纹"] },
    { patternId: 夔龙纹.id, tagId: createdTags["动物纹"] },
    { patternId: 夔龙纹.id, tagId: createdTags["青铜器"] },
    { patternId: 蟠螭纹.id, tagId: createdTags["动物纹"] },
    { patternId: 蟠螭纹.id, tagId: createdTags["玉器"] },
    { patternId: 连珠纹.id, tagId: createdTags["几何纹"] },
    { patternId: 连珠纹.id, tagId: createdTags["织锦"] },
    { patternId: 宝相花纹.id, tagId: createdTags["植物纹"] },
    { patternId: 宝相花纹.id, tagId: createdTags["织锦"] },
    { patternId: 宝相花纹.id, tagId: createdTags["吉祥纹"] },
  ];
  for (const pt of patternTagData) {
    await prisma.patternTag.create({ data: pt });
  }
  console.log("✓ 已创建标签关联");

  // ── 示例图片占位（每个纹饰至少 2 张矢量 + 2 张位图）──
  const imageData = [
    // 饕餮纹
    { patternId: 饕餮纹.id, url: "/patterns/taotie.svg", type: "vector", purpose: "thumbnail", isPrimary: true, sortOrder: 0, label: "标准矢量图" },
    { patternId: 饕餮纹.id, url: "/patterns/taotie-alt.svg", type: "vector", purpose: "detail", isPrimary: false, sortOrder: 1, label: "简化版" },
    { patternId: 饕餮纹.id, url: "/patterns/taotie.jpg", type: "bitmap", purpose: "detail", isPrimary: true, sortOrder: 0, label: "青铜器照片" },
    { patternId: 饕餮纹.id, url: "/patterns/taotie-alt.jpg", type: "bitmap", purpose: "detail", isPrimary: false, sortOrder: 1, label: "拓片" },
    // 云雷纹
    { patternId: 云雷纹.id, url: "/patterns/yunlei.svg", type: "vector", purpose: "thumbnail", isPrimary: true, sortOrder: 0, label: "标准矢量图" },
    { patternId: 云雷纹.id, url: "/patterns/yunlei-alt.svg", type: "vector", purpose: "detail", isPrimary: false, sortOrder: 1, label: "同心圆版" },
    { patternId: 云雷纹.id, url: "/patterns/yunlei.jpg", type: "bitmap", purpose: "detail", isPrimary: true, sortOrder: 0, label: "拓片扫描" },
    { patternId: 云雷纹.id, url: "/patterns/yunlei-alt.jpg", type: "bitmap", purpose: "detail", isPrimary: false, sortOrder: 1, label: "线描稿" },
    // 祥云纹
    { patternId: 祥云纹.id, url: "/patterns/xiangyun.svg", type: "vector", purpose: "thumbnail", isPrimary: true, sortOrder: 0, label: "标准矢量图" },
    { patternId: 祥云纹.id, url: "/patterns/xiangyun-alt.svg", type: "vector", purpose: "detail", isPrimary: false, sortOrder: 1, label: "简化版" },
    { patternId: 祥云纹.id, url: "/patterns/xiangyun.jpg", type: "bitmap", purpose: "detail", isPrimary: true, sortOrder: 0, label: "织物照片" },
    { patternId: 祥云纹.id, url: "/patterns/xiangyun-alt.jpg", type: "bitmap", purpose: "detail", isPrimary: false, sortOrder: 1, label: "局部特写" },
    // 夔龙纹
    { patternId: 夔龙纹.id, url: "/patterns/kui.svg", type: "vector", purpose: "thumbnail", isPrimary: true, sortOrder: 0, label: "标准矢量图" },
    { patternId: 夔龙纹.id, url: "/patterns/kui-alt.svg", type: "vector", purpose: "detail", isPrimary: false, sortOrder: 1, label: "简化版" },
    { patternId: 夔龙纹.id, url: "/patterns/kui.jpg", type: "bitmap", purpose: "detail", isPrimary: true, sortOrder: 0, label: "青铜器照片" },
    { patternId: 夔龙纹.id, url: "/patterns/kui-alt.jpg", type: "bitmap", purpose: "detail", isPrimary: false, sortOrder: 1, label: "复原图" },
    // 蟠螭纹
    { patternId: 蟠螭纹.id, url: "/patterns/panchi.svg", type: "vector", purpose: "thumbnail", isPrimary: true, sortOrder: 0, label: "标准矢量图" },
    { patternId: 蟠螭纹.id, url: "/patterns/panchi-alt.svg", type: "vector", purpose: "detail", isPrimary: false, sortOrder: 1, label: "线描版" },
    { patternId: 蟠螭纹.id, url: "/patterns/panchi.jpg", type: "bitmap", purpose: "detail", isPrimary: true, sortOrder: 0, label: "玉器照片" },
    { patternId: 蟠螭纹.id, url: "/patterns/panchi-alt.jpg", type: "bitmap", purpose: "detail", isPrimary: false, sortOrder: 1, label: "细节放大" },
    // 连珠纹
    { patternId: 连珠纹.id, url: "/patterns/lianzhu.svg", type: "vector", purpose: "thumbnail", isPrimary: true, sortOrder: 0, label: "标准矢量图" },
    { patternId: 连珠纹.id, url: "/patterns/lianzhu-alt.svg", type: "vector", purpose: "detail", isPrimary: false, sortOrder: 1, label: "椭圆版" },
    { patternId: 连珠纹.id, url: "/patterns/lianzhu.jpg", type: "bitmap", purpose: "detail", isPrimary: true, sortOrder: 0, label: "织锦照片" },
    { patternId: 连珠纹.id, url: "/patterns/lianzhu-alt.jpg", type: "bitmap", purpose: "detail", isPrimary: false, sortOrder: 1, label: "文物局部" },
    // 宝相花纹
    { patternId: 宝相花纹.id, url: "/patterns/baoxiang.svg", type: "vector", purpose: "thumbnail", isPrimary: true, sortOrder: 0, label: "标准矢量图" },
    { patternId: 宝相花纹.id, url: "/patterns/baoxiang-alt.svg", type: "vector", purpose: "detail", isPrimary: false, sortOrder: 1, label: "五瓣版" },
    { patternId: 宝相花纹.id, url: "/patterns/baoxiang.jpg", type: "bitmap", purpose: "detail", isPrimary: true, sortOrder: 0, label: "织物照片" },
    { patternId: 宝相花纹.id, url: "/patterns/baoxiang-alt.jpg", type: "bitmap", purpose: "detail", isPrimary: false, sortOrder: 1, label: "颜色变体" },
  ];
  for (const img of imageData) {
    await prisma.patternImage.create({ data: img });
  }
  console.log("✓ 已创建示例图片记录");

  console.log("\n🎉 种子数据创建完成！");
}

main()
  .catch((e) => {
    console.error("❌ 种子数据创建失败:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
