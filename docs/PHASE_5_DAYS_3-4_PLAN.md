# Phase 5 Days 3-4: Implementation Plan

**Status**: In Progress
**Days**: 3-4 of 7
**Focus**: Analyst Agent Depths B & C + tRPC Router + Background Jobs

---

## Day 3: Depths B & C Implementation

### Objectives
1. Implement pgvector similarity search for neighbor discovery
2. Complete Depth B (Comparative Critique) with comparison tables
3. Complete Depth C (Deep Critique) with full PDF analysis
4. Maintain TDD approach with comprehensive test coverage

### Architecture Decisions

**Clean Architecture Layers**:
```
Presentation (Future UI)
    ↓
Application (tRPC Router - Day 4)
    ↓
Domain (Analyst Agent)
    ↓
Infrastructure (Database, LLM, PDF Parser)
```

**Dependency Flow**:
- Analyst Agent depends on: PDF Parser, LLM Critique, Prisma
- No circular dependencies
- All external dependencies injected or imported at module level

### Task Breakdown (Day 3)

#### 3.1 Neighbor Discovery (pgvector Similarity Search)
**File**: `server/agents/analyst.ts`

**Function Signature**:
```typescript
async function findSimilarPapers(
  embedding: number[],
  limit: number,
  dayRange: number,
  excludePaperId?: string
): Promise<SimilarPaper[]>

interface SimilarPaper {
  id: string;
  title: string;
  abstract: string;
  authors: string[];
  pubDate: Date;
  similarity: number;
  summary?: {
    whatsNew: string;
    keyPoints: string[];
  };
}
```

**Implementation**:
- Use Prisma `$queryRaw` for pgvector cosine similarity (`<=>` operator)
- Filter by publication date (last N days)
- Exclude the query paper itself
- Include summaries if available
- Return top N most similar papers

**Tests**:
1. Find 3 similar papers within 180 days
2. Exclude query paper from results
3. Return papers ordered by similarity (desc)
4. Include summaries when available
5. Handle empty embedding case
6. Handle no similar papers case
7. Respect dayRange filter

#### 3.2 Depth B: Comparative Critique
**File**: `server/agents/analyst.ts`

**Function**:
```typescript
async function generateComparativeCritique(
  paper: any,
  userId: string
): Promise<GenerateCritiqueOutput>
```

**Flow**:
1. Find 3 similar papers using `findSimilarPapers()`
2. Download and parse PDF (required for Depth B)
3. Build comparative prompt including neighbor summaries
4. Call cloud LLM (Gemini - always for Depth B)
5. Parse response including comparison table
6. Store in database with `neighborComparison` JSON

**Prompt Template**:
```markdown
## Comparison vs Prior Work
| Aspect | Current Paper | Neighbor 1 | Neighbor 2 | Neighbor 3 |
|--------|---------------|------------|------------|------------|
| Approach | ... | ... | ... | ... |
| Key Results | ... | ... | ... | ... |
| Claims | ... | ... | ... | ... |
| Limitations | ... | ... | ... | ... |

## Relative Positioning
[Analysis of how this work compares to similar recent work]
```

**Tests**:
1. Generate Depth B critique successfully
2. Always use cloud LLM (ignore user preference)
3. Include 3 neighbors in prompt
4. Store neighborComparison JSON
5. Handle case with < 3 neighbors available
6. Require PDF (fail gracefully if unavailable)

#### 3.3 Comparison Table Parser
**File**: `server/agents/analyst.ts`

**Function**:
```typescript
export function extractComparisonTable(markdown: string): any
```

**Implementation**:
- Extract markdown table from "## Comparison vs Prior Work" section
- Store as JSON object with structured data
- Fall back to raw markdown string if parsing fails

**Tests**:
1. Extract comparison table from markdown
2. Return null if no comparison section found
3. Handle malformed tables gracefully

#### 3.4 Depth C: Deep Critique
**File**: `server/agents/analyst.ts`

**Function**:
```typescript
async function generateDeepCritique(
  paper: any,
  userId: string
): Promise<GenerateCritiqueOutput>
```

**Flow**:
1. Download and parse full PDF (required)
2. Extract methodology, experiments sections if possible
3. Build deep critique prompt with full PDF context
4. Call cloud LLM (Gemini - always for Depth C)
5. Parse response
6. Store in database (no neighborComparison for Depth C)

**Prompt Template**:
```markdown
[Include Depth A sections]

## Methodology Review
- Soundness of approach
- Alternative methods considered
- Methodological flaws or shortcuts

## Experimental Design
- Comprehensiveness of experiments
- Appropriateness of baselines
- Statistical significance

## Reproducibility Assessment
- Implementation details sufficient?
- Code/data available?
- Can results be reproduced?

## Compute & Data Costs
- Resource requirements
- Accessibility to typical researchers

## SOTA Comparability
- Fair comparisons to state-of-the-art
- Missing baselines
- Justified SOTA claims
```

**Tests**:
1. Generate Depth C critique successfully
2. Always use cloud LLM
3. Require full PDF (fail if unavailable)
4. Include methodology review
5. Include reproducibility assessment
6. Store with depth="C"

### Acceptance Criteria (Day 3)

- [ ] All new tests passing (target: 30+ new tests)
- [ ] Linting passes
- [ ] Build succeeds
- [ ] findSimilarPapers() returns relevant papers using pgvector
- [ ] Depth B generates comparison tables correctly
- [ ] Depth C analyzes full PDF content
- [ ] Both B and C use cloud LLM regardless of user preference
- [ ] Error handling for PDF failures

---

## Day 4: tRPC Router + Background Jobs

### Objectives
1. Create tRPC analysis router with all endpoints
2. Implement pg-boss job handler for async critique generation
3. Register job in worker process
4. Maintain clean separation of concerns

### Architecture Decisions

**tRPC Router Layer**:
- Handles HTTP requests
- Input validation (zod schemas)
- Authentication (protectedProcedure)
- Enqueues background jobs
- Returns job status

**Job Queue Layer**:
- pg-boss handles job persistence and retry
- Worker process runs separately
- Stateless job handlers
- Idempotent operations

### Task Breakdown (Day 4)

#### 4.1 tRPC Analysis Router
**File**: `server/routers/analysis.ts`

**Endpoints**:

1. **requestAnalysis**
   ```typescript
   requestAnalysis: protectedProcedure
     .input(z.object({
       paperId: z.string(),
       depth: z.enum(['A', 'B', 'C']),
     }))
     .mutation(async ({ ctx, input }) => {
       // Check if analysis already exists
       // If exists: return cached
       // If not: enqueue job, return job ID
     })
   ```

2. **getAnalysis**
   ```typescript
   getAnalysis: protectedProcedure
     .input(z.object({
       paperId: z.string(),
       depth: z.enum(['A', 'B', 'C']),
     }))
     .query(async ({ ctx, input }) => {
       // Return analysis if exists, null otherwise
     })
   ```

3. **getJobStatus**
   ```typescript
   getJobStatus: protectedProcedure
     .input(z.object({ jobId: z.string() }))
     .query(async ({ ctx, input }) => {
       // Query pg-boss for job status
       // Return: created | active | completed | failed
     })
   ```

4. **regenerateAnalysis**
   ```typescript
   regenerateAnalysis: protectedProcedure
     .input(z.object({
       paperId: z.string(),
       depth: z.enum(['A', 'B', 'C']),
     }))
     .mutation(async ({ ctx, input }) => {
       // Delete existing analysis
       // Enqueue new job
       // Return job ID
     })
   ```

**Tests** (19 tests total):
- requestAnalysis: 6 tests (new, cached, validation, auth)
- getAnalysis: 4 tests (exists, not exists, auth)
- getJobStatus: 5 tests (pending, active, completed, failed, not found)
- regenerateAnalysis: 4 tests (delete + enqueue, auth)

#### 4.2 pg-boss Job Handler
**File**: `worker/jobs/critique-paper.ts`

**Interface**:
```typescript
export interface CritiquePaperJobData {
  paperId: string;
  userId: string;
  depth: 'A' | 'B' | 'C';
}

export async function handleCritiquePaperJob(
  job: Job<CritiquePaperJobData>
): Promise<void> {
  // Call generateCritique() from analyst agent
  // Handle errors gracefully
  // Log progress
}
```

**Implementation**:
- Import `generateCritique` from analyst agent
- Parse job data
- Execute critique generation
- Catch and log errors (pg-boss handles retries)
- No need to manually update job status (pg-boss does this)

**Tests** (8 tests):
1. Handle Depth A job successfully
2. Handle Depth B job successfully
3. Handle Depth C job successfully
4. Handle job with invalid paperId
5. Handle LLM errors gracefully
6. Handle PDF parsing errors
7. Log job start and completion
8. Throw error for retry on failure

#### 4.3 Worker Registration
**File**: `worker/index.ts`

**Changes**:
```typescript
import { handleCritiquePaperJob } from './jobs/critique-paper';

// Register job handler
boss.work('critique:paper', {
  teamSize: 2,        // Process up to 2 jobs concurrently
  teamConcurrency: 1, // Each worker processes 1 job at a time
}, handleCritiquePaperJob);
```

**Tests** (3 tests):
1. Verify job handler registered
2. Verify retry policy configured
3. Verify timeout settings

#### 4.4 Integration with App Router
**File**: `server/routers/_app.ts`

**Changes**:
```typescript
import { analysisRouter } from './analysis';

export const appRouter = router({
  // ... existing routers
  analysis: analysisRouter,
});
```

### Clarifying Questions Before Implementation

1. **Job Timeout**: Should Depth C jobs have a longer timeout than A/B?
   - Proposed: A=2min, B=5min, C=10min

2. **Retry Policy**: How many retries for failed LLM calls?
   - Proposed: 3 retries with exponential backoff (1min, 2min, 4min)

3. **Concurrent Job Limit**: How many critique jobs should run in parallel?
   - Proposed: 2 concurrent jobs (teamSize=2)

4. **Cost Warning**: Should we warn users before Depth C (expensive)?
   - Proposed: Yes, add cost estimation to endpoint response

5. **Job Priority**: Should certain depths have higher priority?
   - Proposed: All equal priority for now (FIFO)

### Acceptance Criteria (Day 4)

- [x] All router tests passing (20 tests - COMPLETE)
- [ ] All job handler tests passing (8+ tests - DEFERRED)
- [x] Analysis router added to app router (COMPLETE)
- [x] Job handler registered in worker (COMPLETE)
- [x] Linting passes (COMPLETE)
- [x] Build succeeds (COMPLETE)
- [x] Can enqueue job via tRPC (COMPLETE)
- [x] Worker picks up and processes jobs (COMPLETE - handler registered)
- [x] Job status can be queried (COMPLETE)
- [x] Cached analyses returned immediately (COMPLETE)

---

## Testing Strategy

### Unit Tests (TDD Approach)
1. Write test first (red)
2. Implement minimum code to pass (green)
3. Refactor for clean architecture (refactor)
4. Repeat

### Test Organization
```
__tests__/
  server/
    agents/
      analyst.test.ts          # Days 1-3 (40+ tests total)
    routers/
      analysis.test.ts         # Day 4 (19 tests)
  worker/
    jobs/
      critique-paper.test.ts   # Day 4 (8 tests)
```

### Test Doubles
- Mock Prisma for database operations
- Mock LLM functions for deterministic responses
- Mock PDF parser to avoid file I/O
- Mock pg-boss for job queue operations

---

## Documentation Updates

### Files to Update
1. `PHASE_5_CHECKLIST.md` - Mark completed tasks
2. `KNOWN_ISSUES.md` - Document any deferred items
3. Add inline JSDoc comments for all public functions
4. Update this plan doc with actual vs planned

---

## Risk Mitigation

**Risk: pgvector similarity search performance**
- Mitigation: Index on embedding column, limit results to 3

**Risk: Depth C timeout on long PDFs**
- Mitigation: 10-minute timeout, truncate PDF to 20,000 chars if needed

**Risk: Job queue bottleneck**
- Mitigation: Monitor queue depth, add more workers if needed

**Risk: LLM cost escalation**
- Mitigation: Cache all analyses, warn users of Depth C cost

---

## Next Steps After Days 3-4

Day 5: UI Components
- AnalysisPanel component
- Generate Critique dropdown
- Progress indicator
- Integration with PaperDetailView

Days 6-7: Integration Tests & Polish
- End-to-end tests with real LLM
- Manual testing across all depths
- Performance validation
- Documentation completion

---

**Plan Created**: 2025-10-21
**Last Updated**: 2025-10-21
**Status**: Ready for Day 3 implementation
