-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_categories" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cultural_meaning" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_categories" ("cultural_meaning", "description", "id", "name") SELECT "cultural_meaning", "description", "id", "name" FROM "categories";
DROP TABLE "categories";
ALTER TABLE "new_categories" RENAME TO "categories";
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");
CREATE TABLE "new_dynasties" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cultural_meaning" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_dynasties" ("cultural_meaning", "description", "id", "name") SELECT "cultural_meaning", "description", "id", "name" FROM "dynasties";
DROP TABLE "dynasties";
ALTER TABLE "new_dynasties" RENAME TO "dynasties";
CREATE UNIQUE INDEX "dynasties_name_key" ON "dynasties"("name");
CREATE TABLE "new_ethnic_groups" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cultural_meaning" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_ethnic_groups" ("cultural_meaning", "description", "id", "name") SELECT "cultural_meaning", "description", "id", "name" FROM "ethnic_groups";
DROP TABLE "ethnic_groups";
ALTER TABLE "new_ethnic_groups" RENAME TO "ethnic_groups";
CREATE UNIQUE INDEX "ethnic_groups_name_key" ON "ethnic_groups"("name");
CREATE TABLE "new_mediums" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cultural_meaning" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_mediums" ("cultural_meaning", "description", "id", "name") SELECT "cultural_meaning", "description", "id", "name" FROM "mediums";
DROP TABLE "mediums";
ALTER TABLE "new_mediums" RENAME TO "mediums";
CREATE UNIQUE INDEX "mediums_name_key" ON "mediums"("name");
CREATE TABLE "new_motifs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cultural_meaning" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_motifs" ("cultural_meaning", "description", "id", "name") SELECT "cultural_meaning", "description", "id", "name" FROM "motifs";
DROP TABLE "motifs";
ALTER TABLE "new_motifs" RENAME TO "motifs";
CREATE UNIQUE INDEX "motifs_name_key" ON "motifs"("name");
CREATE TABLE "new_regions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cultural_meaning" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true
);
INSERT INTO "new_regions" ("cultural_meaning", "description", "id", "name") SELECT "cultural_meaning", "description", "id", "name" FROM "regions";
DROP TABLE "regions";
ALTER TABLE "new_regions" RENAME TO "regions";
CREATE UNIQUE INDEX "regions_name_key" ON "regions"("name");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
