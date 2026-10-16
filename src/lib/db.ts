import { PrismaClient } from "@prisma/client";

// adapter 是 CJS 包，必须用 require
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  // 在函数内读环境变量，而不是模块顶层 —— 测试要在加载本模块前改 DATABASE_URL，
  // 顶层常量会来不及（vitest 的 import 是提前解析的）
  const url = process.env.DATABASE_URL ?? `file:${process.cwd()}/dev.db`;
  const adapter = new PrismaBetterSqlite3({ url });
  return new PrismaClient({ adapter });
}

const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
