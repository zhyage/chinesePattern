-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_patterns" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "alternate_name" TEXT,
    "dynasty" TEXT,
    "period_start" TEXT,
    "period_end" TEXT,
    "region" TEXT,
    "ethnic_group" TEXT,
    "category" TEXT NOT NULL,
    "medium" TEXT,
    "description" TEXT,
    "cultural_meaning" TEXT,
    "source" TEXT,
    "source_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    "parent_id" INTEGER,
    CONSTRAINT "patterns_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "patterns" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_patterns" ("alternate_name", "category", "created_at", "cultural_meaning", "description", "dynasty", "ethnic_group", "id", "medium", "name", "period_end", "period_start", "region", "source", "source_url", "status", "updated_at") SELECT "alternate_name", "category", "created_at", "cultural_meaning", "description", "dynasty", "ethnic_group", "id", "medium", "name", "period_end", "period_start", "region", "source", "source_url", "status", "updated_at" FROM "patterns";
DROP TABLE "patterns";
ALTER TABLE "new_patterns" RENAME TO "patterns";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
