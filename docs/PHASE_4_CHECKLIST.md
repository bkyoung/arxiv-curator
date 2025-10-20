# Phase 4: Summaries - Implementation Checklist

**Status**: 🚧 In Progress
**Start Date**: 2025-10-20
**Timeline**: Week 5 (Serial Development Roadmap)
**Dependencies**: Phase 3 (Briefings & Core UI) ✅ Complete

---

## Overview

Phase 4 adds AI-generated paper summaries to reduce reading time and provide quick insights. Users receive concise "What's New" summaries and key points for papers in their briefings, generated using local or cloud LLMs with intelligent caching.

**Key Goal**: Enable users to understand a paper's contribution in < 30 seconds without reading the full abstract.

---

## Deliverables

### 1. Summary Data Model ⏳

- [ ] **Database Schema**
  - [ ] Create `Summary` model in Prisma schema
  - [ ] Fields: `id`, `paperId`, `summaryType`, `whatsNew`, `keyPoints`, `markdownContent`, `contentHash`, `generatedAt`
  - [ ] Add unique constraint on `(paperId, summaryType)`
  - [ ] Add index on `paperId`
  - [ ] Add `Summary` relation to `Paper` model
  - [ ] Run migration: `npx prisma migrate dev --name phase_4_summaries`

### 2. LLM Integration Layer ✅

- [x] **LLM Service Interface**
  - [x] Create `server/lib/llm.ts` with unified interface
  - [x] Define `LLMProvider` type (`local` | `cloud`)
  - [x] Define `GenerateSummaryInput` interface
  - [x] Define `GenerateSummaryOutput` interface
  - [x] Implement provider selection logic (reads from UserProfile)
  - [x] Test LLM service interface (5 tests)

- [x] **Local LLM Integration (Ollama)**
  - [x] Create `server/lib/llm/ollama.ts`
  - [x] Implement `generateSummaryOllama()` function
  - [x] Use model: `gemma3:27b` (27B parameters)
  - [x] Format prompt for summary generation
  - [x] Parse structured output (JSON)
  - [x] Handle errors and retries
  - [x] Test Ollama integration (8 tests with mocked HTTP)

- [x] **Cloud LLM Integration (Google Gemini)**
  - [x] Create `server/lib/llm/gemini.ts`
  - [x] Implement `generateSummaryGemini()` function
  - [x] Use model: `gemini-2.5-flash`
  - [x] Configure API key from environment
  - [x] Format prompt for summary generation
  - [x] Parse structured output (JSON)
  - [x] Handle rate limiting and errors
  - [x] Test Gemini integration (8 tests with mocked API)

### 3. Summary Generation Agent ✅

- [x] **Core Summary Generator**
  - [x] Create `server/agents/summarizer.ts`
  - [x] Implement `generateSummary(paperId, userId)` function
  - [x] Load paper with abstract
  - [x] Generate content hash from abstract
  - [x] Check for existing cached summary
  - [x] Call LLM to generate summary if not cached
  - [x] Parse LLM response into structured format
  - [x] Save summary to database
  - [x] Test summary generator (12 tests)

- [x] **Prompt Engineering**
  - [x] Design "What's New" prompt template
  - [x] Design "Key Points" prompt template
  - [x] Include examples in few-shot format
  - [x] Optimize for conciseness (2-3 sentences for "What's New")
  - [x] Optimize for specificity (3-5 bullets for "Key Points")
  - [x] Test prompt variations (manual validation)

- [x] **Summary Caching**
  - [x] Implement content hashing (SHA-256 of abstract)
  - [x] Check cache before LLM call
  - [x] Return cached summary if exists
  - [x] Track cache hit/miss rate (optional analytics)
  - [x] Test caching logic (6 tests)

### 4. tRPC Summaries Router ✅

- [x] **Create Router File**
  - [x] Create `server/routers/summaries.ts`
  - [x] Import dependencies (zod, trpc, prisma, summarizer)

- [x] **Endpoint: getSummary**
  - [x] Protected procedure (requires authentication)
  - [x] Accept `paperId` input
  - [x] Check if summary exists
  - [x] Generate if not exists (call `generateSummary`)
  - [x] Return summary with markdown content
  - [x] Test getSummary endpoint (5 tests)

- [x] **Endpoint: regenerateSummary**
  - [x] Protected procedure
  - [x] Accept `paperId` input
  - [x] Delete existing summary
  - [x] Generate new summary
  - [x] Return new summary
  - [x] Test regenerateSummary endpoint (3 tests)

- [x] **Add to App Router**
  - [x] Import `summariesRouter` in `server/routers/_app.ts`
  - [x] Add to `appRouter` exports
  - [x] Verify tRPC client types updated

### 5. Summary UI Components ✅

- [x] **Summary Panel Component**
  - [x] Create `components/SummaryPanel.tsx`
  - [x] Accept `paperId` prop
  - [x] Use `trpc.summaries.getSummary.useQuery()`
  - [x] Display loading state (skeleton)
  - [x] Display "What's New" section
  - [x] Display "Key Points" as bullet list
  - [x] Display regenerate button (admin/power users)
  - [x] Handle errors gracefully
  - [x] Test Summary Panel (11 tests)

- [x] **Integrate into Paper Detail View**
  - [x] Update `components/PaperDetailView.tsx`
  - [x] Add Summary Panel after "Why Shown"
  - [x] Use Card component for consistent styling
  - [x] Default to visible state
  - [x] Test integration (12 tests passing with mock)

### 6. Auto-Summarization for Briefings ⏳

- [x] **Bulk Summary Generation**
  - [x] Create `server/lib/bulk-summarize.ts`
  - [x] Implement `summarizeTopPapers(briefingId)` function
  - [x] Load top 10 papers from briefing
  - [x] Generate summaries in parallel (concurrency limit: 3)
  - [x] Track progress and errors
  - [x] Return summary of results
  - [x] Test bulk summarization (8 tests)

- [ ] **Integrate with Digest Generation**
  - [ ] Update `server/agents/recommender.ts`
  - [ ] After briefing creation, trigger summary generation
  - [ ] Make async (don't block briefing creation)
  - [ ] Enqueue pg-boss job for summarization
  - [ ] Test integration (4 tests)

- [ ] **Worker Job for Summarization**
  - [ ] Create `worker/jobs/generate-summaries.ts`
  - [ ] Implement job handler
  - [ ] Register job in `worker/index.ts`
  - [ ] Test job execution (3 tests)

### 7. Testing

- [ ] **Unit Tests (Mocked LLM Calls)**
  - [ ] LLM service interface tests (5 tests)
  - [ ] Ollama integration tests (8 tests, mocked HTTP)
  - [ ] Gemini integration tests (8 tests, mocked API)
  - [ ] Summary generator tests (12 tests)
  - [ ] Caching logic tests (6 tests)
  - [ ] tRPC router tests (8 tests)
  - [ ] Bulk summarization tests (8 tests)
  - [ ] Target: 55+ new tests

- [ ] **Integration Tests (Real LLM Calls)**
  - [ ] End-to-end summary generation (local LLM)
  - [ ] End-to-end summary generation (cloud LLM)
  - [ ] Cache hit scenario
  - [ ] Bulk summarization flow
  - [ ] Target: 4 integration tests

- [ ] **UI Component Tests**
  - [ ] Summary Panel component (10 tests)
  - [ ] Paper Detail View integration (5 tests)
  - [ ] Loading and error states (6 tests)
  - [ ] Target: 21 new UI tests

- [ ] **Manual Testing**
  - [ ] Generate summary for real paper (local LLM)
  - [ ] Generate summary for real paper (cloud LLM)
  - [ ] Verify "What's New" quality
  - [ ] Verify "Key Points" quality
  - [ ] Test cache hit (regenerate same paper)
  - [ ] Test bulk summarization (10 papers)
  - [ ] Measure generation time (target: < 5 seconds per paper)

---

## Acceptance Criteria

**Must Pass All:**

1. **Summary Generation**
   - [ ] Summaries generated successfully with local LLM
   - [ ] Summaries generated successfully with cloud LLM
   - [ ] "What's New" is 2-3 concise sentences
   - [ ] "Key Points" contains 3-5 specific bullets
   - [ ] Generation completes in < 5 seconds per paper

2. **Caching**
   - [ ] Identical abstracts return cached summaries
   - [ ] Cache hit rate > 30% after one week of usage
   - [ ] Cached summaries returned in < 100ms

3. **UI Integration**
   - [ ] Summary panel displays correctly in detail view
   - [ ] Loading states show skeleton/spinner
   - [ ] Errors display user-friendly messages
   - [ ] Accordion expands/collapses smoothly

4. **Bulk Generation**
   - [ ] Top 10 papers in briefing auto-summarized
   - [ ] Generation runs asynchronously (doesn't block UI)
   - [ ] Failures logged but don't break workflow
   - [ ] Completion time < 30 seconds for 10 papers (parallel)

5. **Code Quality**
   - [ ] All 80+ new tests passing
   - [ ] Linting passes
   - [ ] TypeScript strict mode passes
   - [ ] Build succeeds

6. **Performance**
   - [ ] Local LLM: < 5 seconds per summary
   - [ ] Cloud LLM: < 3 seconds per summary
   - [ ] Bulk generation (10 papers): < 30 seconds
   - [ ] UI remains responsive during generation

---

## Dependencies

**External Services**:
- Ollama running locally (for local LLM option)
- Google AI API key configured (for cloud LLM option)

**npm Packages (New)**:
```json
{
  "@google/generative-ai": "^0.21.0",  // Google Gemini SDK
  "crypto": "built-in"                  // For content hashing (SHA-256)
}
```

**Environment Variables (New)**:
```env
GOOGLE_AI_API_KEY=your_api_key_here
OLLAMA_BASE_URL=http://localhost:11434  # Default ollama URL
```

**UserProfile Configuration**:
- Uses existing `useLocalLLM` field from Phase 3

---

## Key Files to Create/Modify

### New Files:
```
server/
  lib/
    llm.ts                       # Unified LLM interface
    llm/
      ollama.ts                  # Ollama integration
      gemini.ts                  # Google Gemini integration
    bulk-summarize.ts            # Bulk summary generation
  agents/
    summarizer.ts                # Summary generation agent
  routers/
    summaries.ts                 # Summaries tRPC router
worker/
  jobs/
    generate-summaries.ts        # Worker job for async summarization
components/
  SummaryPanel.tsx               # Summary display component
__tests__/
  server/
    lib/
      llm.test.ts                # LLM interface tests
      llm/
        ollama.test.ts           # Ollama tests
        gemini.test.ts           # Gemini tests
      bulk-summarize.test.ts     # Bulk tests
    agents/
      summarizer.test.ts         # Summarizer tests
    routers/
      summaries.test.ts          # Router tests
  components/
    SummaryPanel.test.tsx        # UI tests
  worker/
    jobs/
      generate-summaries.test.ts # Job tests
```

### Modified Files:
```
prisma/schema.prisma             # Add Summary model
server/routers/_app.ts           # Add summaries router
server/agents/recommender.ts     # Trigger summary generation
worker/index.ts                  # Register summary job
components/PaperDetailView.tsx   # Integrate SummaryPanel
```

---

## Risk Mitigation

**LLM Response Quality**
- Risk: LLM generates poor quality or verbose summaries
- Mitigation: Extensive prompt engineering, few-shot examples, multiple test iterations

**LLM Availability**
- Risk: Local LLM (ollama) not running, cloud LLM rate limits
- Mitigation: Graceful fallback, clear error messages, retry logic with exponential backoff

**Generation Time**
- Risk: Summaries take too long to generate (> 10 seconds)
- Mitigation: Async generation, progress indicators, parallel processing with concurrency limits

**Cost (Cloud LLM)**
- Risk: High API costs for cloud LLM usage
- Mitigation: Intelligent caching, prefer local LLM by default, track usage metrics

---

## Implementation Strategy

### Week 5 Timeline (5 days)

**Day 1: LLM Integration Layer**
- Create LLM interface (`server/lib/llm.ts`)
- Implement Ollama integration (`server/lib/llm/ollama.ts`)
- Implement Gemini integration (`server/lib/llm/gemini.ts`)
- Write tests for LLM integrations (21 tests)
- Manual testing: Generate test summary with both providers

**Day 2: Summary Generation Agent**
- Add `Summary` model to Prisma schema
- Run migration
- Create `server/agents/summarizer.ts`
- Implement content hashing and caching
- Write tests for summarizer (18 tests)
- End-to-end test: Generate and cache summary

**Day 3: tRPC Router + Bulk Summarization**
- Create `server/routers/summaries.ts`
- Implement `getSummary` and `regenerateSummary` endpoints
- Create `server/lib/bulk-summarize.ts`
- Write tests for router and bulk logic (16 tests)
- Integration test: Full API flow

**Day 4: UI Components**
- Create `components/SummaryPanel.tsx`
- Integrate into `components/PaperDetailView.tsx`
- Write UI component tests (15 tests)
- Manual testing: Verify UI rendering and interactions

**Day 5: Auto-Summarization + Polish**
- Create `worker/jobs/generate-summaries.ts`
- Integrate with briefing generation workflow
- Update `server/agents/recommender.ts`
- Write worker tests (7 tests)
- Manual testing:
  - Generate briefing → verify summaries auto-generated
  - Test error handling
  - Test cache hit rate
  - Performance validation
- Bug fixes and polish

---

## Success Metrics

### Quantitative
- Summary generation time: < 5 seconds (local), < 3 seconds (cloud)
- Cache hit rate: > 30% after 1 week
- Summary quality: 80%+ user satisfaction (manual review sample)
- Test coverage: 80+ new tests passing
- Bulk generation: 10 papers in < 30 seconds

### Qualitative
- "What's New" summaries are concise and accurate
- "Key Points" highlight the most important contributions
- UI integration feels natural and non-intrusive
- Error handling is graceful and informative

---

## Notes

- **Prompt Engineering**: Critical for quality. Plan multiple iterations during Day 1-2
- **Caching Strategy**: Content hash (SHA-256) ensures same abstract = same summary
- **Async by Default**: Don't block user experience waiting for summaries
- **Local First**: Default to local LLM (privacy, cost), fallback to cloud for speed/quality
- **Future Enhancement**: Track which summaries users actually read (analytics for Phase 9+)

---

## Next Phase Preview

**Phase 5-6 (Critical Analysis)** will add:
- PDF parsing and full-text analysis
- Analyst Agent with three critique depths (A/B/C)
- Deep analysis beyond just the abstract
- Comparative analysis vs similar papers
- SOTA benchmark checking

---

**Phase 4 Start Date**: 2025-10-20
**Phase 4 Target Completion**: 2025-10-24 (5 days)
**Status**: 🚧 In Progress
