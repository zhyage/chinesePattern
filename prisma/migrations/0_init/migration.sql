-- CreateTable
CREATE TABLE "patterns" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "alternate_name" TEXT,
    "dynasty" TEXT NOT NULL,
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
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "pattern_images" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pattern_id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "purpose" TEXT,
    "label" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pattern_images_pattern_id_fkey" FOREIGN KEY ("pattern_id") REFERENCES "patterns" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "variations" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pattern_id" INTEGER NOT NULL,
    "variant_name" TEXT NOT NULL,
    "dynasty" TEXT NOT NULL,
    "region" TEXT,
    "description" TEXT,
    "period_start" TEXT,
    "period_end" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "variations_pattern_id_fkey" FOREIGN KEY ("pattern_id") REFERENCES "patterns" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "variation_images" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "variation_id" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "purpose" TEXT,
    "label" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "variation_images_variation_id_fkey" FOREIGN KEY ("variation_id") REFERENCES "variations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "relations" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "pattern_a_id" INTEGER NOT NULL,
    "pattern_b_id" INTEGER NOT NULL,
    "relation_type" TEXT NOT NULL,
    "description" TEXT,
    CONSTRAINT "relations_pattern_a_id_fkey" FOREIGN KEY ("pattern_a_id") REFERENCES "patterns" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "relations_pattern_b_id_fkey" FOREIGN KEY ("pattern_b_id") REFERENCES "patterns" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tags" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "pattern_tags" (
    "pattern_id" INTEGER NOT NULL,
    "tag_id" INTEGER NOT NULL,

    PRIMARY KEY ("pattern_id", "tag_id"),
    CONSTRAINT "pattern_tags_pattern_id_fkey" FOREIGN KEY ("pattern_id") REFERENCES "patterns" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pattern_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "tags" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "periods" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "period_start" INTEGER,
    "period_end" INTEGER,
    "description" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "tags_name_key" ON "tags"("name");

-- CreateIndex
CREATE UNIQUE INDEX "periods_name_key" ON "periods"("name");

