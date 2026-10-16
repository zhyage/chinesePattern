import { buildTestEnv } from "../setup-db";

/**
 * E2E 开跑前建一份干净的测试库。
 *
 * 复用 IT 的 `buildTestEnv()` —— 同一套隔离保证（独立的 test.db 与
 * .test-public，绝不碰 dev.db 和 public/ 里的真实素材），不另写一份。
 * ET 与 IT 不会同时跑，所以共用 test.db 是安全的。
 */
buildTestEnv();
console.log("[e2e] 测试库已就绪");
