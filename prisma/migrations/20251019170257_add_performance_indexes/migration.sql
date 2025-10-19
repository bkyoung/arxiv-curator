-- Add GIN indexes for array fields to support efficient array operations
-- GIN (Generalized Inverted Index) is optimal for array contains operations

-- Paper.categories: Frequently queried for filtering papers by category
CREATE INDEX "Paper_categories_idx" ON "Paper" USING GIN (categories);

-- PaperEnriched.topics: Phase 2+ will filter by topics for personalization
CREATE INDEX "PaperEnriched_topics_idx" ON "PaperEnriched" USING GIN (topics);

-- PaperEnriched.facets: Phase 2+ will filter by facets for personalization
CREATE INDEX "PaperEnriched_facets_idx" ON "PaperEnriched" USING GIN (facets);

-- PaperEnriched.mathDepth: Phase 2 math penalty calculation and filtering
CREATE INDEX "PaperEnriched_mathDepth_idx" ON "PaperEnriched" ("mathDepth");

-- Composite index for common ranking queries (status + pubDate)
-- Useful for "get enriched papers ordered by pubDate" queries
CREATE INDEX "Paper_status_pubDate_idx" ON "Paper" (status, "pubDate" DESC);