# Known Issues

This document tracks known bugs and issues discovered during manual testing that are not yet fixed.

## UI/UX Issues

### Multiple Pages Missing Navigation Sidebar
**Status:** Not Fixed
**Priority:** Medium
**Discovered:** 2025-10-20

**Description:**
When navigating to `/saved` or `/papers` pages from the left navigation pane, the NavigationPane (left sidebar) disappears, leaving no way to navigate back to other pages except using the browser's back button.

**Expected Behavior:**
All pages should maintain consistent navigation with the NavigationPane visible on the left, similar to the briefings pages.

**Current Behavior:**
- Briefings page (`/briefings/latest`): Uses 3-pane layout with NavigationPane + BriefingList + PaperDetailView ✓
- Saved page (`/saved`): Uses standalone layout with centered container, no NavigationPane ✗
- Papers page (`/papers`): Uses standalone layout with centered container, no NavigationPane ✗
- Settings page (`/settings`): Uses standalone layout with centered container, no NavigationPane ✗

**Files Involved:**
- `app/saved/page.tsx` (line 58) - Missing NavigationPane component
- `app/papers/page.tsx` (line 76) - Missing NavigationPane component
- `app/settings/page.tsx` (line 100) - Missing NavigationPane component
- `app/briefings/latest/page.tsx` (lines 155-157) - Reference implementation with proper 3-pane layout

**Possible Solutions:**
1. Add NavigationPane to each affected page (maintain consistent layout)
2. Create a shared layout component for all authenticated pages
3. Use Next.js layout.tsx to enforce consistent navigation across routes (recommended)

---

## Enhancement Requests

### Summary Loading Indicator
**Status:** Deferred
**Priority:** Low
**Discovered:** 2025-10-20

**Description:**
When loading a paper summary, there's no visual indicator that the summary is being generated. Users may think the UI is frozen while waiting for the LLM response (which can take 3-8 seconds for local models).

**Suggested Enhancement:**
Add a skeleton loader or spinner to the SummaryPanel component while summaries are being fetched.

**Files Involved:**
- `components/SummaryPanel.tsx`

### Module-Level API Key Initialization (Gemini)
**Status:** Deferred
**Priority:** Low
**Source:** Code Review (gemini_review.md)

**Description:**
The code review suggested initializing the Gemini API key at module level (outside the function) for better efficiency. However, this causes issues in test environments where `vi.mock()` and imports are hoisted, making it difficult to stub environment variables before the module loads.

**Current Implementation:**
API key is checked inside the `generateSummaryGemini()` function on each call.

**Suggested Enhancement:**
Consider using a singleton pattern or lazy initialization that's testable.

**Files Involved:**
- `server/lib/llm/gemini.ts`

**Trade-offs:**
- Pro: Module-level init is more efficient (check once vs every call)
- Con: Makes testing more difficult without global test setup
- Current: Slight inefficiency but better testability

### LLM Request Timeouts
**Status:** Deferred
**Priority:** Medium
**Source:** Code Review (claude_review_2025-10-20_14-12.md)

**Description:**
LLM calls (both Ollama and Gemini) don't have timeout protection. If the LLM service hangs, requests could wait indefinitely.

**Suggested Enhancement:**
Add 30-second timeout with AbortController pattern:
```typescript
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 30000);
try {
  // ... LLM call with abort signal
} finally {
  clearTimeout(timeout);
}
```

**Files Involved:**
- `server/lib/llm/ollama.ts`
- `server/lib/llm/gemini.ts`

**Impact:**
- Prevents resource exhaustion from hanging LLM services
- Better error handling for slow/unresponsive LLMs

### Cost Estimation for Depth C Analysis
**Status:** Deferred
**Priority:** Medium
**Source:** Phase 5 Planning (Days 3-4)
**Target Phase:** Phase 6 or later

**Description:**
Users should be warned about estimated API costs before triggering Depth C analyses, which use cloud LLMs extensively and can be expensive.

**Suggested Enhancement:**
Add a `getCostEstimate` endpoint that calculates approximate token usage and API cost based on paper length.

**Example**:
```typescript
getCostEstimate: protectedProcedure
  .input(z.object({ paperId: z.string(), depth: z.enum(['A', 'B', 'C']) }))
  .query(async ({ input }) => {
    // Calculate estimated tokens (abstract + PDF length)
    // Return estimated cost in USD
    // Gemini 2.5 Flash: ~$0.075 input / $0.30 output per million tokens
  })
```

**Files Involved:**
- `server/routers/analysis.ts` (future endpoint)
- UI components (cost warning before generation)

---

### pgvector Index Optimization
**Status:** Deferred
**Priority:** Medium
**Source:** Phase 5 Planning (Days 3-4)
**Target Phase:** Performance optimization phase

**Description:**
The neighbor discovery feature uses pgvector cosine similarity search on the `PaperEnriched.embedding` column. As the dataset grows, this query will become slower without proper indexing.

**Suggested Enhancement:**
Create an IVFFlat or HNSW index on the embedding column for faster similarity searches.

**Migration**:
```sql
-- Create ivfflat index for fast approximate nearest neighbor search
CREATE INDEX paper_embedding_idx ON "PaperEnriched"
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Or use HNSW for better accuracy (requires pgvector 0.5.0+)
CREATE INDEX paper_embedding_idx ON "PaperEnriched"
USING hnsw (embedding vector_cosine_ops);
```

**Trade-offs:**
- **Pro**: 10-100x faster similarity searches
- **Con**: Slightly slower inserts, additional storage overhead
- **Current**: Acceptable performance for small datasets (<10k papers)

**Files Involved:**
- `prisma/migrations/` (new migration)
- `server/agents/analyst.ts` (no code changes needed)

---

## Code Quality Improvements (Deferred)

### Replace `as any` Type Assertions
**Status:** Deferred
**Priority:** Low
**Source:** Code Review (claude_review_2025-10-20_14-12.md)

**Description:**
A few instances of `as any` type assertions in production code bypass TypeScript's type checking.

**Files Involved:**
- `server/lib/bulk-summarize.ts:33` - `Promise<any>` → `Promise<void>`
- `server/lib/bulk-summarize.ts:115` - Type assertion for error results

**Suggested Fix:**
```typescript
type TaskResult = { success: true; paperId: string } | { success: false; paperId: string; error: string };
```

### Extract Content Hashing Utility
**Status:** Deferred
**Priority:** Low
**Source:** Code Review (claude_review_2025-10-20_14-12.md)

**Description:**
The `generateContentHash()` function is currently in `summarizer.ts` but could be reused across multiple modules (embeddings cache, paper deduplication, etc.).

**Suggested Enhancement:**
Move to `/server/lib/utils/hashing.ts` with generic interface:
```typescript
export function hashContent(content: string, algorithm: 'sha256' | 'md5' = 'sha256'): string
export function hashObject(obj: unknown): string
```

**Files Involved:**
- `server/agents/summarizer.ts:26-28` - Current location

---

## Fixed Issues

### Critical: Cache Bug with Abstract Changes
**Status:** FIXED (2025-10-20)
**Priority:** Critical
**Source:** Code Review (codex_review.md)

**Issue:**
When a paper's abstract changed, `generateSummaryForPaper` tried to create a new summary, but the unique constraint `[paperId, summaryType]` caused a P2002 error because the old summary still existed.

**Fix:**
Changed `prisma.summary.create()` to `prisma.summary.upsert()` to update existing summaries when abstract changes.

**Files Modified:**
- `server/agents/summarizer.ts:130`

### Environment Variable Mismatch
**Status:** FIXED (2025-10-20)
**Priority:** High
**Source:** Code Review (claude/gemini reviews)

**Issue:**
Code used `GOOGLE_AI_API_KEY` but `server/env.ts` validated `GOOGLE_API_KEY`.

**Fix:**
Updated env validation schema and `.env.example` to use `GOOGLE_AI_API_KEY`.

**Files Modified:**
- `server/env.ts:28`
- `.env.example:22`

### Use protectedProcedure for Auth
**Status:** FIXED (2025-10-20)
**Priority:** High
**Source:** Code Review (gemini_review.md)

**Issue:**
Summaries router used `publicProcedure` with manual auth checks instead of tRPC's built-in `protectedProcedure`.

**Fix:**
Changed to `protectedProcedure` and removed manual checks.

**Files Modified:**
- `server/routers/summaries.ts:9,19,64`

### Consolidated LLM Provider Code
**Status:** FIXED (2025-10-20)
**Priority:** High
**Source:** Code Review (gemini/claude reviews)

**Issue:**
~50 lines of duplicated code between `ollama.ts` and `gemini.ts` (system prompts, validation, temperature settings).

**Fix:**
Extracted shared logic to `server/lib/llm/shared.ts`:
- `SUMMARY_SYSTEM_PROMPT`
- `SUMMARY_TEMPERATURE` and `SUMMARY_TOP_P`
- `buildSummaryPrompt()`
- `validateSummaryResponse()`
- `normalizeSummaryResponse()`

**Files Created:**
- `server/lib/llm/shared.ts`

**Files Modified:**
- `server/lib/llm/ollama.ts`
- `server/lib/llm/gemini.ts`

### Use deleteMany Instead of delete
**Status:** FIXED (2025-10-20)
**Priority:** Medium
**Source:** Code Review (gemini_review.md)

**Issue:**
`regenerateSummary` used `delete().catch()` which silenced errors. `deleteMany` is cleaner and doesn't throw if record doesn't exist.

**Fix:**
Changed to `prisma.summary.deleteMany()`.

**Files Modified:**
- `server/routers/summaries.ts:64`
