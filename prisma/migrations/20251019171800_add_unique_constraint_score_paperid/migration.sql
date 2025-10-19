-- Add unique constraint on Score.paperId
-- Each paper should have only one score record

-- Remove the old non-unique index
DROP INDEX IF EXISTS "Score_paperId_idx";

-- Add unique constraint
CREATE UNIQUE INDEX "Score_paperId_key" ON "Score"("paperId");
