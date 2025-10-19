# Phase 1: Ingestion & Enrichment - Implementation Checklist

**Status**: In Progress
**Timeline**: Week 2 (Serial Development Roadmap)
**Dependencies**: Phase 0 (Foundation) ✅ Complete

---

## Overview

Phase 1 implements the data pipeline that feeds all downstream features. Papers are ingested from arXiv, enriched with embeddings and metadata, and made available for ranking and recommendation.

**Key Goal**: Establish automated paper ingestion and Tier 0 (abstract-only) enrichment pipeline.

---

## Deliverables

### 1. Scout Agent: arXiv Integration

- [ ] **OAI-PMH Category Fetcher**
  - [ ] Implement `fetchArxivCategories()` to retrieve category list via OAI-PMH ListSets
  - [ ] Filter to `cs.*` categories only
  - [ ] Store categories in `ArxivCategory` table
  - [ ] Cache with periodic refresh (weekly)
  - [ ] Test with arXiv OAI-PMH endpoint

- [ ] **Atom Feed Parser**
  - [ ] Implement `ingestRecentPapers()` to fetch recent papers via Atom/RSS
  - [ ] Parse Atom XML format
  - [ ] Extract: title, authors, abstract, categories, PDF URL, dates
  - [ ] Handle multi-category papers
  - [ ] Test with sample Atom feed

- [ ] **OAI-PMH Historical Fetcher** (optional for Phase 1)
  - [ ] Implement date range query support
  - [ ] Pagination handling (resumption tokens)
  - [ ] Test with historical date ranges

- [ ] **Rate Limiter**
  - [ ] Implement global rate limiter: 1 request per 3 seconds
  - [ ] Use `bottleneck` library with `minTime: 3000ms`
  - [ ] Single connection enforcement (maxConcurrent: 1)
  - [ ] Exponential backoff on 429/503 errors
  - [ ] Test rate limiting behavior

- [ ] **Paper Version Supersedence**
  - [ ] Detect paper version updates (v1, v2, etc.)
  - [ ] Implement `purgeArtifacts()` to clean old PDFs/metadata from S3
  - [ ] Update DB row via UPSERT on arxiv_id
  - [ ] Preserve user actions (saves, feedback) across versions
  - [ ] Test version upgrade flow

- [ ] **Job Queue Integration**
  - [ ] Create `scout-papers` job queue
  - [ ] Schedule periodic ingestion (every 6 hours)
  - [ ] Manual "Run Now" trigger
  - [ ] Test scheduled and manual execution

### 2. Enricher Agent: Tier 0 Processing

- [ ] **Embedding Generation**
  - [ ] Implement `generateEmbedding()` with local/cloud routing
  - [ ] Local: ollama with all-MiniLM-L6-v2 or similar
  - [ ] Cloud: text-embedding-004 (Google) or text-embedding-3-small (OpenAI)
  - [ ] Combine title + abstract for embedding input
  - [ ] Store 768-dimensional vectors in pgvector
  - [ ] Test both local and cloud embedding generation

- [ ] **Math Depth Estimation**
  - [ ] Implement `estimateMathDepth()` function
  - [ ] LaTeX command density detection
  - [ ] Theory keyword scoring (theorem, proof, lemma, convergence, etc.)
  - [ ] Formula: `0.6 × latex_density + 0.4 × keyword_score`
  - [ ] Test with math-heavy and practical papers

- [ ] **Topic/Facet Classification**
  - [ ] Implement zero-shot LLM classification
  - [ ] Define topic taxonomy: agents, rag, multimodal, architectures, surveys, applications
  - [ ] Define facet taxonomy: planning, memory, tool_use, evaluation, safety, protocols
  - [ ] Multi-label classification (papers can have multiple topics/facets)
  - [ ] Test with diverse paper abstracts

- [ ] **Evidence Signal Detection**
  - [ ] Regex-based detection for:
    - [ ] `hasBaselines`: "baseline", "compared to"
    - [ ] `hasAblations`: "ablation", "ablated"
    - [ ] `hasCode`: "github", "code available", "open source"
    - [ ] `hasData`: "dataset", "data available"
    - [ ] `hasMultipleEvals`: count of "dataset" or "benchmark" mentions >= 2
  - [ ] Test with papers containing various evidence signals

- [ ] **Job Queue Integration**
  - [ ] Create `enrich-paper` job queue
  - [ ] Trigger on new papers (status: "new")
  - [ ] Update paper status to "enriched" on completion
  - [ ] Error handling and retry logic
  - [ ] Test enrichment pipeline

### 3. Worker Process: LangGraph.js Orchestration

- [ ] **LangGraph.js Setup**
  - [ ] Install `@langchain/langgraph` and dependencies
  - [ ] Create worker process entry point (`worker/index.ts`)
  - [ ] Configure LangGraph state management
  - [ ] Test basic workflow execution

- [ ] **Scout → Enrich Workflow**
  - [ ] Define `PipelineState` interface
  - [ ] Implement `scoutNode`: Fetch papers from arXiv
  - [ ] Implement `enrichNode`: Generate embeddings and classify
  - [ ] Connect nodes: `scout → enrich → END`
  - [ ] Test end-to-end pipeline

- [ ] **Job Processing**
  - [ ] Connect pg-boss to LangGraph workflows
  - [ ] Process `scout-papers` jobs
  - [ ] Process `enrich-paper` jobs
  - [ ] Logging and telemetry
  - [ ] Test job processing from queue

### 4. Settings UI: Sources & Categories

- [ ] **Sources Configuration**
  - [ ] Create Settings page route (`app/settings/page.tsx`)
  - [ ] Implement source toggles UI (arXiv ON by default)
  - [ ] Store source preferences in `UserProfile.sourcesEnabled`
  - [ ] tRPC endpoint: `updateSourceSettings`
  - [ ] Test source toggle persistence

- [ ] **Category Selection UI**
  - [ ] Fetch arXiv categories from API
  - [ ] Multi-select checkboxes for categories
  - [ ] Preselect default categories: cs.AI, cs.CL, cs.LG, cs.IR, cs.MA
  - [ ] Store selected categories in `UserProfile.arxivCategories`
  - [ ] tRPC endpoint: `updateCategorySettings`
  - [ ] Test category selection and persistence

- [ ] **Local vs Cloud Routing**
  - [ ] Toggle for `useLocalEmbeddings`
  - [ ] Toggle for `useLocalLLM`
  - [ ] Store preferences in `UserProfile`
  - [ ] Apply routing in Enricher Agent
  - [ ] Test routing behavior

### 5. Basic Paper List View

- [ ] **Papers List UI**
  - [ ] Create Papers page route (`app/papers/page.tsx`)
  - [ ] Display papers in table/card format
  - [ ] Show: title, authors, abstract (truncated), categories, date
  - [ ] Sort by publication date (newest first)
  - [ ] Pagination or infinite scroll
  - [ ] Test with sample papers

- [ ] **tRPC Endpoints**
  - [ ] `papers.list`: Query with filters (date range, categories, status)
  - [ ] `papers.getById`: Fetch single paper details
  - [ ] Test endpoint functionality

### 6. Database Schema Updates

- [ ] **Migrations**
  - [ ] No schema changes needed (Phase 0 covered all models)
  - [ ] Verify pgvector extension is enabled
  - [ ] Verify all indexes exist

### 7. Testing

- [ ] **Unit Tests (All External Services Mocked)**
  - [ ] Scout Agent: category fetching, Atom parsing, rate limiting
    - [ ] Mock fetch for arXiv API calls
    - [ ] Mock Prisma for database operations
    - [ ] Use realistic XML response snapshots
  - [ ] Enricher Agent: embedding generation, math depth, evidence detection
    - [ ] Mock ollama API calls
    - [ ] Mock Prisma for database operations
    - [ ] Use realistic embedding vectors
  - [ ] Classification: topic/facet tagging
    - [ ] Mock LLM API calls
    - [ ] Use realistic classification responses
  - [ ] Test coverage >= 80%
  - [ ] All tests fast (<100ms each)
  - [ ] No external service dependencies

- [ ] **Integration Tests (Real Services)**
  - [ ] End-to-end: Scout → Enrich pipeline with real database
  - [ ] Real arXiv API integration (rate-limited)
  - [ ] Real ollama integration (skip if unavailable)
  - [ ] Job queue processing with pg-boss
  - [ ] Settings persistence
  - [ ] Paper list retrieval

- [ ] **Manual Testing**
  - [ ] Run Scout Agent manually with real arXiv API
  - [ ] Verify papers appear in database
  - [ ] Check embeddings are stored (if ollama available)
  - [ ] Verify Settings UI works
  - [ ] Browse papers in UI

**Testing Philosophy**: Unit tests use mocks for all external services (database, APIs, LLMs) to ensure fast, deterministic, and reliable tests. Integration tests validate real-world behavior with actual services.

---

## Acceptance Criteria

**Must Pass All:**

1. **Daily arXiv Ingestion**
   - [ ] Fetches 100-500 papers from configured categories
   - [ ] Rate limiting enforced (1 request/3 sec)
   - [ ] Papers stored in database with status "new"

2. **Enrichment Pipeline**
   - [ ] Papers enriched with 768-dim embeddings
   - [ ] Topic classification produces 3-5 topics per paper
   - [ ] Evidence signals detected correctly
   - [ ] Math depth score computed
   - [ ] Status updated to "enriched"

3. **Settings UI**
   - [ ] User can select arXiv categories
   - [ ] User can toggle local vs cloud processing
   - [ ] Settings persist correctly

4. **Paper List View**
   - [ ] User can view raw paper list (unranked)
   - [ ] Papers display correctly with metadata
   - [ ] Pagination/infinite scroll works

5. **Testing**
   - [ ] All unit tests pass
   - [ ] All integration tests pass
   - [ ] Manual testing complete

6. **Code Quality**
   - [ ] Linting passes
   - [ ] TypeScript strict mode passes
   - [ ] Build succeeds

---

## Dependencies

**External Services:**
- arXiv OAI-PMH API (http://export.arxiv.org/oai2)
- arXiv Atom API (http://export.arxiv.org/api/query)
- ollama (local embeddings/LLMs) OR
- Google Gemini API / OpenAI API (cloud embeddings/LLMs)

**npm Packages to Install:**
```bash
npm install @langchain/langgraph @langchain/core @langchain/community
npm install bottleneck  # Rate limiting
npm install fast-xml-parser  # XML parsing
npm install zod  # Already installed
```

**Optional (for local embeddings):**
```bash
# Install ollama locally and pull embedding model
ollama pull all-minilm
ollama pull llama3.2  # For classification
```

---

## Key Files to Create/Modify

### New Files:
```
server/
  agents/
    scout.ts              # Scout Agent implementation
    enricher.ts           # Enricher Agent implementation
    classifier.ts         # Classification logic
  lib/
    arxiv.ts              # arXiv API client
    embeddings.ts         # Embedding generation
    rate-limiter.ts       # Rate limiting
worker/
  index.ts                # Worker process entry point
  workflows/
    scout-enrich.ts       # LangGraph workflow
app/
  settings/
    page.tsx              # Settings UI
  papers/
    page.tsx              # Papers list UI
__tests__/
  server/
    agents/
      scout.test.ts
      enricher.test.ts
      classifier.test.ts
    lib/
      arxiv.test.ts
      embeddings.test.ts
```

### Modified Files:
```
server/routers/_app.ts    # Add papers and settings routers
server/routers/
  papers.ts               # New router
  settings.ts             # New router
package.json              # Add new dependencies
```

---

## Risk Mitigation

**Rate Limiting**
- Risk: Violating arXiv rate limits (503 bans)
- Mitigation: Global rate limiter with 3-second delays, exponential backoff

**Embedding Costs**
- Risk: High cloud embedding costs for large volumes
- Mitigation: Default to local embeddings, user-configurable routing

**Classification Accuracy**
- Risk: Poor zero-shot classification results
- Mitigation: Use strong local models (llama3.2) or cloud APIs, iterative prompt tuning

**pgvector Performance**
- Risk: Slow vector similarity searches
- Mitigation: Create IVFFlat indexes, limit search space to recent papers

---

## Notes

- Phase 1 focuses on **data ingestion only** - no ranking/scoring yet
- Paper list view shows unranked papers (sorted by date)
- Tier 0 processing only (abstract-based, no PDF downloads)
- Classification is zero-shot (no fine-tuning required)
- All embeddings stored as 768-dim vectors for consistency

---

## Next Phase Preview

**Phase 2 (Personalization & Scoring)** will add:
- Ranker Agent with multi-signal scoring (N, E, V, P, L, M)
- User profile vector learning from feedback
- Personalization rules engine
- Feedback system (save, hide, thumbs up/down)

---

**Phase 1 Start Date**: [To be filled]
**Phase 1 Completion Date**: [To be filled]
**Status**: 🔄 In Progress
