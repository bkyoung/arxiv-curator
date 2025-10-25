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

### Structured Logging Implementation
**Status:** Deferred
**Priority:** Medium-High
**Source:** Post-Phase 5 Review
**Target Phase:** Phase 6 or dedicated infrastructure sprint

**Description:**
The codebase currently uses `console.log()`, `console.warn()`, and `console.error()` throughout for logging. This approach lacks structure, makes debugging difficult, and doesn't integrate with log aggregation services.

**Suggested Enhancement:**
Implement structured logging with a proper logger (pino or winston) to provide:
- Structured JSON logs with context (request IDs, user IDs, paper IDs, etc.)
- Log levels (trace, debug, info, warn, error, fatal)
- Integration with log aggregation services (DataDog, Sentry, etc.)
- Performance (pino is ~5x faster than console.log)
- Automatic context propagation

**Implementation Example:**
```typescript
// server/lib/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  ...(process.env.NODE_ENV === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  }),
});

// Usage:
logger.info({ paperId, depth }, 'Starting critique generation');
logger.error({ error, paperId }, 'PDF download failed');
```

**Files to Update (Estimate: ~50 locations):**
- `server/agents/analyst.ts` (~10 console.* calls)
- `server/lib/pdf-parser.ts` (~5 calls)
- `server/routers/analysis.ts` (~3 calls)
- `worker/index.ts` (~15 calls)
- `worker/jobs/critique-paper.ts` (~3 calls)
- All other server files (~15 calls)

**Dependencies:**
```json
{
  "pino": "^8.x.x",
  "pino-pretty": "^10.x.x"  // For development
}
```

**Trade-offs:**
- **Pro**: Better debugging, production monitoring, performance
- **Con**: Retrofitting becomes harder the longer we wait (already ~50 locations)
- **Urgency**: Medium-High - should be done before codebase grows much larger

---

### PDF Size Limits and Streaming Validation
**Status:** Deferred
**Priority:** Medium
**Source:** Code Review (claude_review_2025-10-21_12-48.md Issue #8)
**Target Phase:** Phase 6 or security hardening sprint

**Description:**
PDF downloads have no size limit, creating a potential DoS vector where malicious or corrupted arXiv entries with multi-GB PDFs could crash the worker via memory exhaustion.

**Suggested Enhancement:**
Add 50MB size limit with streaming validation that aborts download if limit exceeded.

**Implementation:**
```typescript
// server/lib/pdf-parser.ts
const MAX_PDF_SIZE = 50 * 1024 * 1024; // 50MB

// Check Content-Length header
const contentLength = response.headers.get('content-length');
if (contentLength && parseInt(contentLength) > MAX_PDF_SIZE) {
  throw new Error(`PDF too large: ${contentLength} bytes (max ${MAX_PDF_SIZE})`);
}

// Stream with size enforcement
const chunks: Uint8Array[] = [];
let totalSize = 0;
const reader = response.body!.getReader();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  totalSize += value.length;
  if (totalSize > MAX_PDF_SIZE) {
    reader.cancel();
    throw new Error(`PDF download exceeded ${MAX_PDF_SIZE} bytes`);
  }
  chunks.push(value);
}
```

**Estimated Time:** 1 hour
**Priority:** Medium - Academic papers rarely exceed 10MB, but protection is prudent

---

### LLM Call Timeouts
**Status:** Deferred
**Priority:** Medium
**Source:** Code Review (claude_review_2025-10-21_12-48.md Issue #9)
**Target Phase:** Phase 6 or reliability sprint

**Description:**
LLM API calls (Ollama and Gemini) have no timeout protection. If the LLM service hangs or becomes unresponsive, worker jobs could wait indefinitely, consuming worker concurrency slots.

**Suggested Enhancement:**
Add 5-minute timeout with AbortController for all LLM calls.

**Implementation:**
```typescript
// server/lib/llm/critique.ts
const LLM_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export async function generateCritiqueOllama(input: GenerateCritiqueInput) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

  try {
    const response = await fetch(`${process.env.OLLAMA_BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ /* ... */ }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error(`LLM request timed out after ${LLM_TIMEOUT_MS}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

**Files to Update:**
- `server/lib/llm/critique.ts` (both Ollama and Gemini functions)
- `server/lib/llm/ollama.ts` (summary generation)
- `server/lib/llm/gemini.ts` (summary generation)

**Estimated Time:** 1 hour
**Priority:** Medium - Prevents resource exhaustion

---

### Input Validation for Vector Operations
**Status:** Deferred
**Priority:** Medium
**Source:** Code Review (claude_review_2025-10-21_12-48.md Issue #4)
**Target Phase:** Phase 6

**Description:**
`findSimilarPapers()` doesn't validate embedding input. Invalid embeddings (NaN, Infinity, empty arrays) or negative limits/dayRange could crash pgvector queries or produce confusing results.

**Suggested Enhancement:**
```typescript
// server/agents/analyst.ts
export async function findSimilarPapers(
  embedding: number[],
  limit: number,
  dayRange: number,
  excludePaperId?: string
): Promise<SimilarPaper[]> {
  // Validate embedding
  if (embedding.length === 0) {
    return [];
  }
  if (!embedding.every(val => Number.isFinite(val))) {
    throw new Error('Invalid embedding: all values must be finite numbers');
  }

  // Validate limit and dayRange
  if (limit <= 0 || !Number.isInteger(limit)) {
    throw new Error('limit must be a positive integer');
  }
  if (dayRange <= 0 || !Number.isFinite(dayRange)) {
    throw new Error('dayRange must be a positive number');
  }

  // Continue with query...
}
```

**Estimated Time:** 30 minutes
**Priority:** Medium - Security and robustness

---

### Extract Magic Numbers to Named Constants
**Status:** Deferred
**Priority:** Low-Medium
**Source:** Code Review (claude_review_2025-10-21_12-48.md Issue #5)
**Target Phase:** Phase 6

**Description:**
Hard-coded truncation lengths (20000, 3000, 2000, 4000) scattered throughout analyst.ts lack explanation. Unclear why specific values were chosen and difficult to adjust if LLM context windows change.

**Suggested Enhancement:**
```typescript
// server/agents/analyst.ts (top of file)
/**
 * PDF Content Truncation Limits
 *
 * Gemini 2.5 Flash has 1M token context window
 * We allocate ~20% for PDF content, ~10% for response, 70% buffer
 * Approximate conversion: 4 chars = 1 token
 */
const PDF_TRUNCATION_LIMITS = {
  FULL_PDF: 20000,        // ~5000 tokens for Depth C full analysis
  INTRO: 3000,            // ~750 tokens for paper introduction
  CONCLUSION: 2000,       // ~500 tokens for conclusion section
  METHODOLOGY: 4000,      // ~1000 tokens for methods section
} as const;

// Usage:
const truncatedPDF = pdfText.length > PDF_TRUNCATION_LIMITS.FULL_PDF
  ? pdfText.slice(0, PDF_TRUNCATION_LIMITS.FULL_PDF) + '\n\n[Truncated for LLM context]'
  : pdfText;
```

**Estimated Time:** 30 minutes
**Priority:** Low-Medium - Maintainability and documentation

---

### Replace `any` Type Assertions
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

---

## Phase 5 Integration Fixes (2025-10-21)

### Critical: React Infinite Render Loop in PaperDetailView
**Status:** FIXED (2025-10-21)
**Priority:** Critical
**Source:** Manual E2E Testing

**Issue:**
The `useEffect` hook in `PaperDetailView.tsx` included `analysisAQuery`, `analysisBQuery`, and `analysisCQuery` objects in its dependency array. These objects change on every render, causing:
- Effect runs → refetch triggered
- Query objects change → effect runs again
- Infinite loop → "Maximum update depth exceeded" error
- Component crashes → Analysis panel disappears after showing progress

**Fix:**
Removed query objects from dependency array, keeping only primitive values (`jobStatusQuery.data?.state` and `selectedDepth`). The `refetch` functions are stable and don't need to be in dependencies.

**Files Modified:**
- `components/PaperDetailView.tsx:84` - Fixed useEffect dependencies

### Ollama Model Name Mismatch
**Status:** FIXED (2025-10-21)
**Priority:** High
**Source:** Manual E2E Testing

**Issue:**
Code requested `gemma2:27b` from Ollama, but the Ollama instance only had `gemma3:27b` available. This caused "Ollama API error: Not Found" and all Depth A critique jobs failed.

**Fix:**
Changed model name to `gemma3:27b` to match available model.

**Files Modified:**
- `server/lib/llm/critique.ts:30`

### Job Queue Naming Inconsistency
**Status:** FIXED (2025-10-21)
**Priority:** High
**Source:** Manual E2E Testing

**Issue:**
Router sent jobs to `'critique-paper'` queue but worker listened to `'analyze-paper'` queue, causing jobs to never be processed. Also, `getJobStatus` looked in wrong queue.

**Fix:**
Standardized all job names to `'analyze-paper'` across router and worker.

**Files Modified:**
- `server/routers/analysis.ts:54,99,124` - Changed to `'analyze-paper'`
- `worker/index.ts:80,191` - Queue creation and registration

### pg-boss Not Initialized in Web Server Context
**Status:** FIXED (2025-10-21)
**Priority:** High
**Source:** Manual E2E Testing

**Issue:**
When sending jobs from the web server (analysis router), pg-boss was not initialized, causing "boss not started" errors.

**Fix:**
Added `ensureBossStarted()` function in analysis router to initialize pg-boss before sending jobs.

**Files Modified:**
- `server/routers/analysis.ts:14-20,51` - Added boss startup logic

### Dropdown Background Transparency
**Status:** FIXED (2025-10-21)
**Priority:** Medium
**Source:** Manual E2E Testing

**Issue:**
Generate Critique dropdown had transparent background, making text difficult to read when overlaid on page content.

**Fix:**
Added explicit background color classes (`bg-background border-border shadow-lg`).

**Files Modified:**
- `components/GenerateCritiqueDropdown.tsx:95`

### SummaryPanel Error Messaging
**Status:** IMPROVED (2025-10-21)
**Priority:** Low
**Source:** Manual E2E Testing

**Issue:**
When no summary exists, SummaryPanel showed red error message "Failed to load summary" which was alarming for normal condition.

**Enhancement:**
Distinguished between "no summary exists" (subtle italic message) vs actual errors (red error message).

**Files Modified:**
- `components/SummaryPanel.tsx:67-94`

### Papers Page Missing Detail View Integration
**Status:** FIXED (2025-10-21)
**Priority:** High
**Source:** Phase 5 Integration

**Issue:**
Papers page only showed card list without clickable interaction or PaperDetailView, making it impossible to access Critical Analysis feature from papers page.

**Fix:**
Implemented two-pane layout with:
- Clickable paper cards with visual selection (ring border)
- Right pane showing PaperDetailView when paper selected
- State management for `selectedPaperId`
- Close button to return to list-only view

**Files Modified:**
- `app/papers/page.tsx` - Added two-pane layout and PaperDetailView integration
- `__tests__/app/papers/page.test.tsx` - Added comprehensive tRPC mocks for analysis/summaries
