-- AlterTable: Add contentHash column to Summary table
ALTER TABLE "Summary" ADD COLUMN IF NOT EXISTS "contentHash" TEXT;

-- CreateIndex: Add index on contentHash for faster lookups
CREATE INDEX IF NOT EXISTS "Summary_contentHash_idx" ON "Summary"("contentHash");

-- CreateIndex: Add unique constraint on (paperId, summaryType) for upsert operations
CREATE UNIQUE INDEX IF NOT EXISTS "Summary_paperId_summaryType_key" ON "Summary"("paperId", "summaryType");

-- DropIndex: Remove old composite index since we now have unique constraint
DROP INDEX IF EXISTS "Summary_paperId_summaryType_idx";
