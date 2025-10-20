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

### 2. LLM Integration Layer ⏳

- [ ] **LLM Service Interface**
  - [ ] Create `server/lib/llm.ts` with unified interface
  - [ ] Define `LLMProvider` type (`local` | `cloud`)
  - [ ] Define `GenerateSummaryInput` interface
  - [ ] Define `GenerateSummaryOutput` interface
  - [ ] Implement provider selection logic (reads from UserProfile)
  - [ ] Test LLM service interface (5 tests)

- [ ] **Local LLM Integration (Ollama)**
  - [ ] Create `server/lib/llm/ollama.ts`
  - [ ] Implement `generateSummaryOllama()` function
  - [ ] Use model: `llama3.2` (3B parameters)
  - [ ] Format prompt for summary generation
  - [ ] Parse structured output (JSON)
  - [ ] Handle errors and retries
  - [ ] Test Ollama integration (8 tests with mocked HTTP)

- [ ] **Cloud LLM Integration (Google Gemini)**
  - [ ] Create `server/lib/llm/gemini.ts`
  - [ ] Implement `generateSummaryGemini()` function
  - [ ] Use model: `gemini-2.0-flash-exp`
  - [ ] Configure API key from environment
  - [ ] Format prompt for summary generation
  - [ ] Parse structured output (JSON)
  - [ ] Handle rate limiting and errors
  - [ ] Test Gemini integration (8 tests with mocked API)

### 3. Summary Generation Agent ⏳

- [ ] **Core Summary Generator**
  - [ ] Create `server/agents/summarizer.ts`
  - [ ] Implement `generateSummary(paperId, userId)` function
  - [ ] Load paper with abstract
  - [ ] Generate content hash from abstract
  - [ ] Check for existing cached summary
  - [ ] Call LLM to generate summary if not cached
  - [ ] Parse LLM response into structured format
  - [ ] Save summary to database
  - [ ] Test summary generator (12 tests)

- [ ] **Prompt Engineering**
  - [ ] Design "What's New" prompt template
  - [ ] Design "Key Points" prompt template
  - [ ] Include examples in few-shot format
  - [ ] Optimize for conciseness (2-3 sentences for "What's New")
  - [ ] Optimize for specificity (3-5 bullets for "Key Points")
  - [ ] Test prompt variations (manual validation)

- [ ] **Summary Caching**
  - [ ] Implement content hashing (SHA-256 of abstract)
  - [ ] Check cache before LLM call
  - [ ] Return cached summary if exists
  - [ ] Track cache hit/miss rate (optional analytics)
  - [ ] Test caching logic (6 tests)

### 4. tRPC Summaries Router ⏳

- [ ] **Create Router File**
  - [ ] Create `server/routers/summaries.ts`
  - [ ] Import dependencies (zod, trpc, prisma, summarizer)

- [ ] **Endpoint: getSummary**
  - [ ] Protected procedure (requires authentication)
  - [ ] Accept `paperId` input
  - [ ] Check if summary exists
  - [ ] Generate if not exists (call `generateSummary`)
  - [ ] Return summary with markdown content
  - [ ] Test getSummary endpoint (5 tests)

- [ ] **Endpoint: regenerateSummary**
  - [ ] Protected procedure
  - [ ] Accept `paperId` input
  - [ ] Delete existing summary
  - [ ] Generate new summary
  - [ ] Return new summary
  - [ ] Test regenerateSummary endpoint (3 tests)

- [ ] **Add to App Router**
  - [ ] Import `summariesRouter` in `server/routers/_app.ts`
  - [ ] Add to `appRouter` exports
  - [ ] Verify tRPC client types updated

### 5. Summary UI Components ⏳

- [ ] **Summary Panel Component**
  - [ ] Create `components/SummaryPanel.tsx`
  - [ ] Accept `paperId` prop
  - [ ] Use `trpc.summaries.getSummary.useQuery()`
  - [ ] Display loading state (skeleton)
  - [ ] Display "What's New" section
  - [ ] Display "Key Points" as bullet list
  - [ ] Display regenerate button (admin/power users)
  - [ ] Handle errors gracefully
  - [ ] Test Summary Panel (10 tests)

- [ ] **Integrate into Paper Detail View**
  - [ ] Update `components/PaperDetailView.tsx`
  - [ ] Add Summary Panel below abstract
  - [ ] Use accordion/collapsible section
  - [ ] Default to expanded state
  - [ ] Test integration (5 tests)

### 6. Auto-Summarization for Briefings ⏳

- [ ] **Bulk Summary Generation**
  - [ ] Create `server/lib/bulk-summarize.ts`
  - [ ] Implement `summarizeTopPapers(briefingId)` function
  - [ ] Load top 10 papers from briefing
  - [ ] Generate summaries in parallel (concurrency limit: 3)
  - [ ] Track progress and errors
  - [ ] Return summary of results
  - [ ] Test bulk summarization (8 tests)

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
