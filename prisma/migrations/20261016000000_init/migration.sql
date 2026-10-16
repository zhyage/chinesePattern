-- CreateTable
CREATE TABLE "dynasties" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cultural_meaning" TEXT
);

-- CreateTable
CREATE TABLE "regions" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cultural_meaning" TEXT
);

-- CreateTable
CREATE TABLE "ethnic_groups" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cultural_meaning" TEXT
);

-- CreateTable
CREATE TABLE "categories" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cultural_meaning" TEXT
);

-- CreateTable
CREATE TABLE "motifs" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cultural_meaning" TEXT
);

-- CreateTable
CREATE TABLE "mediums" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cultural_meaning" TEXT
);

-- CreateTable
CREATE TABLE "patterns" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cultural_meaning" TEXT,
    "source" TEXT,
    "source_url" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "pattern_dynasties" (
    "pattern_id" INTEGER NOT NULL,
    "dynasty_id" INTEGER NOT NULL,

    PRIMARY KEY ("pattern_id", "dynasty_id"),
    CONSTRAINT "pattern_dynasties_pattern_id_fkey" FOREIGN KEY ("pattern_id") REFERENCES "patterns" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pattern_dynasties_dynasty_id_fkey" FOREIGN KEY ("dynasty_id") REFERENCES "dynasties" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pattern_regions" (
    "pattern_id" INTEGER NOT NULL,
    "region_id" INTEGER NOT NULL,

    PRIMARY KEY ("pattern_id", "region_id"),
    CONSTRAINT "pattern_regions_pattern_id_fkey" FOREIGN KEY ("pattern_id") REFERENCES "patterns" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pattern_regions_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pattern_ethnic_groups" (
    "pattern_id" INTEGER NOT NULL,
    "ethnic_group_id" INTEGER NOT NULL,

    PRIMARY KEY ("pattern_id", "ethnic_group_id"),
    CONSTRAINT "pattern_ethnic_groups_pattern_id_fkey" FOREIGN KEY ("pattern_id") REFERENCES "patterns" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pattern_ethnic_groups_ethnic_group_id_fkey" FOREIGN KEY ("ethnic_group_id") REFERENCES "ethnic_groups" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pattern_categories" (
    "pattern_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,

    PRIMARY KEY ("pattern_id", "category_id"),
    CONSTRAINT "pattern_categories_pattern_id_fkey" FOREIGN KEY ("pattern_id") REFERENCES "patterns" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pattern_categories_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pattern_motifs" (
    "pattern_id" INTEGER NOT NULL,
    "motif_id" INTEGER NOT NULL,

    PRIMARY KEY ("pattern_id", "motif_id"),
    CONSTRAINT "pattern_motifs_pattern_id_fkey" FOREIGN KEY ("pattern_id") REFERENCES "patterns" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pattern_motifs_motif_id_fkey" FOREIGN KEY ("motif_id") REFERENCES "motifs" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "pattern_mediums" (
    "pattern_id" INTEGER NOT NULL,
    "medium_id" INTEGER NOT NULL,

    PRIMARY KEY ("pattern_id", "medium_id"),
    CONSTRAINT "pattern_mediums_pattern_id_fkey" FOREIGN KEY ("pattern_id") REFERENCES "patterns" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "pattern_mediums_medium_id_fkey" FOREIGN KEY ("medium_id") REFERENCES "mediums" ("id") ON DELETE CASCADE ON UPDATE CASCADE
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
CREATE TABLE "pending" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "cultural_meaning" TEXT,
    "source" TEXT,
    "source_url" TEXT,
    "facets" TEXT NOT NULL DEFAULT '{}',
    "suggested_facets" TEXT NOT NULL DEFAULT '{}',
    "images" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "review_note" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "dynasties_name_key" ON "dynasties"("name");

-- CreateIndex
CREATE UNIQUE INDEX "regions_name_key" ON "regions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ethnic_groups_name_key" ON "ethnic_groups"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "motifs_name_key" ON "motifs"("name");

-- CreateIndex
CREATE UNIQUE INDEX "mediums_name_key" ON "mediums"("name");

-- CreateIndex
CREATE INDEX "patterns_status_idx" ON "patterns"("status");

-- CreateIndex
CREATE INDEX "pattern_dynasties_dynasty_id_idx" ON "pattern_dynasties"("dynasty_id");

-- CreateIndex
CREATE INDEX "pattern_regions_region_id_idx" ON "pattern_regions"("region_id");

-- CreateIndex
CREATE INDEX "pattern_ethnic_groups_ethnic_group_id_idx" ON "pattern_ethnic_groups"("ethnic_group_id");

-- CreateIndex
CREATE INDEX "pattern_categories_category_id_idx" ON "pattern_categories"("category_id");

-- CreateIndex
CREATE INDEX "pattern_motifs_motif_id_idx" ON "pattern_motifs"("motif_id");

-- CreateIndex
CREATE INDEX "pattern_mediums_medium_id_idx" ON "pattern_mediums"("medium_id");

-- CreateIndex
CREATE INDEX "pattern_images_pattern_id_idx" ON "pattern_images"("pattern_id");

-- CreateIndex
CREATE INDEX "pending_status_idx" ON "pending"("status");

