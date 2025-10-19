# ArXiv Curator - Implementation Roadmap

## Executive Summary

**DECISION: Serial Development Approach**

This roadmap outlines the **serial development strategy** for implementing the ArXiv Curator platform. Development will proceed linearly through 10 weeks of implementation phases, followed by 2 weeks of beta testing and iteration.

**Timeline: 10 weeks development + 2 weeks beta = 12 weeks total**

This approach prioritizes:
- Simplicity in branch management (main branch only)
- Lower cognitive load (focused attention on one phase at a time)
- Reduced merge conflict risk
- Easier context maintenance throughout development
- Incremental validation at each phase

For reference, an alternative parallel development approach using git worktrees is documented in the Appendix, but **has not been selected** for this project.

---

## Serial Development Timeline

### Overview

```
Week 1:  Foundation (PostgreSQL, Prisma, Auth, Queue)
Week 2:  Ingestion & Enrichment (Scout Agent, arXiv parsing)
Week 3:  Personalization & Scoring (Ranker, rules engine)
Week 4:  Briefings & Core UI (MVP - daily digests)
Week 5:  Summaries (AI-generated TL;DRs)
Week 6-7: Critical Analysis (Analyst Agent, three-tier critiques)
Week 8:  Collections (Notebooks, Synthesizer, exports)
Week 9:  Trends & Analytics (Velocity, SOTA, visualizations)
Week 10: Polish & Optimization (Performance, testing, monitoring)
Week 11-12: Beta Testing & Iteration
```

**Key Milestone: MVP delivered by end of Week 4**

---

## Dependency Analysis

### Critical Path (Must Be Sequential)

```
Phase 0: Foundation (Week 1)
    ↓
Phase 1: Ingestion & Enrichment (Week 2)
    ↓
Phase 2: Personalization & Scoring (Week 3)
    ↓
Phase 3: Briefings & Core UI (Week 4)
    ↓
[PARALLEL WORK BEGINS HERE]
```

**Why These Must Be Sequential:**
- **Phase 0** provides the infrastructure (database, auth, job queue) that everything depends on
- **Phase 1** creates the paper data pipeline that all downstream features consume
- **Phase 2** implements the scoring/ranking system needed for useful briefings
- **Phase 3** delivers the core user experience and proves the basic value proposition

### Independent Work Streams (Post-Phase 3)

After Phase 3, these features have **no interdependencies** and can proceed in parallel:

```
Stream A: Deep Analysis (Analyst Agent)
Stream B: Collections & Synthesis (Synthesizer Agent)
Stream C: Trends & Analytics (Velocity tracking)
Stream D: Summaries (Actually can start after Phase 1!)
```

---

## Serial Development Plan (Selected Approach)

### Timeline: 10 Weeks Critical Path

| Week | Phase | Deliverables | Status |
|------|-------|-------------|--------|
| 1 | Foundation | PostgreSQL + pgvector, Prisma schema, NextAuth, pg-boss, tRPC | ✅ Complete |
| 2 | Ingestion & Enrichment | Scout Agent, arXiv OAI-PMH/Atom parsing, rate limiting, enrichment, UI | ✅ Complete |
| 3 | Personalization | Ranker Agent, rules engine, vector profiles, feedback system | 📋 Planned |
| 4 | Briefings & UI | Recommender Agent, three-pane layout, paper cards, hotkeys, digest generation |
| 5 | Summaries | Summary generation (skim), LLM integration (local + cloud), summary UI |
| 6-7 | Critical Analysis | PDF parsing, Analyst Agent (Depths A/B/C), critique UI, job status tracking |
| 8 | Collections | Notebooks CRUD, Synthesizer Agent, export (Markdown/PDF/NotebookLM) |
| 9 | Trends | Topic velocity, emerging topics, SOTA board, technique graphs, visualizations |
| 10 | Polish | Performance optimization, error handling, testing, monitoring, documentation |
| 11-12 | Beta | Production deployment, user testing, feedback, iteration |

### Why Serial Development?

**Selected for this project because:**
- ✅ Simpler branch management (main branch only)
- ✅ Lower cognitive load (one thing at a time)
- ✅ No merge conflicts between parallel streams
- ✅ Easier to maintain focus and context
- ✅ Natural learning progression (understand each layer deeply)
- ✅ Incremental validation (test thoroughly at each phase)

**Trade-offs accepted:**
- Longer wall time to delivery (10 weeks vs 6-7 weeks parallel)
- Sequential dependency chain (one phase blocks the next)
- Later access to advanced features for testing

---

## Detailed Phase Breakdown

### Phase 0: Foundation (Week 1) ✅ COMPLETE

**Critical Infrastructure - All downstream work depends on this**

**Completion Date**: October 19, 2025

#### Deliverables
- [x] PostgreSQL 17+ with pgvector extension
- [x] Prisma schema (core models: User, UserProfile, Paper, PaperEnriched, Score, Feedback)
- [x] Auth.js v5 (NextAuth.js v5) integration (email/password, optional OAuth)
- [x] pg-boss job queue setup
- [x] tRPC baseline routing
- [x] Docker Compose development environment
- [x] MinIO S3-compatible storage
- [x] Basic Next.js 15 app structure (App Router, React 19)

#### Key Files Created
```
prisma/
  schema.prisma
  migrations/
    20250119_init.sql
src/
  server/
    db.ts
    routers/
      _app.ts
  lib/
    auth.ts
docker-compose.yml
.env.example
```

#### Acceptance Criteria
- User can register/login via NextAuth
- Database schema migrated successfully
- tRPC health check endpoint returns 200
- Job queue can enqueue and process test jobs
- MinIO accessible at http://localhost:9000

---

### Phase 1: Ingestion & Enrichment (Week 2) ✅ COMPLETE

**Data Pipeline - Feeds all downstream features**

**Completion Date**: October 19, 2025

#### Deliverables
- [x] Scout Agent: arXiv OAI-PMH client
- [x] Scout Agent: Atom feed RSS parser
- [x] Rate limiter (1 request/3 seconds for arXiv)
- [x] Paper version supersedence logic
- [x] Enricher Agent Tier 0:
  - [x] Embedding generation (local via ollama or cloud)
  - [x] Math depth estimation
  - [x] Topic/facet classification (zero-shot LLM)
  - [x] Evidence signal detection (baselines, ablations, code, data)
- [x] Settings UI: Sources & Categories selection (with shadcn/ui)
- [x] Basic paper list view (with enrichment badges and pagination)
- [x] Worker process with LangGraph.js orchestration
- [x] Comprehensive test suite (92 tests passing)

#### LangGraph.js Workflow (Scout → Enrich)
```typescript
// Worker: ScoutEnrichWorkflow
const workflow = new StateGraph<PipelineState>({
  channels: { ... }
})
  .addNode("scout", scoutNode)       // Fetch from arXiv
  .addNode("enrich", enrichNode)     // Compute embeddings, classify
  .addEdge("scout", "enrich")
  .addEdge("enrich", END);
```

#### Acceptance Criteria
- Daily arXiv ingestion fetches 100-500 papers
- Papers are enriched with embeddings (768-dim vectors)
- Topic classification produces 3-5 topics per paper
- Evidence signals detected (hasCode, hasBaselines, etc.)
- User can view raw paper list (unranked)

---

### Phase 2: Personalization & Scoring (Week 3)

**Ranking Engine - Makes papers personally relevant**

#### Deliverables
- [ ] Classifier Agent: Topic/facet tagging
- [ ] Ranker Agent: Multi-signal scoring
  - [ ] Novelty (centroid distance, novel keywords, LOF)
  - [ ] Evidence (baselines, ablations, code, data)
  - [ ] Velocity (EMA slope, keyword burst)
  - [ ] Personal Fit (cosine similarity + rule bonuses)
  - [ ] Lab Prior (boost for preferred labs)
  - [ ] Math Penalty (depth × sensitivity)
- [ ] Personalization rules engine:
  - [ ] Include/exclude topics & keywords
  - [ ] Lab boost configuration
  - [ ] Math depth tolerance slider
  - [ ] Exploration rate tuning
- [ ] Feedback system (thumbs up/down, save, dismiss)
- [ ] Vector profile learning (exponential moving average)
- [ ] User Profile Management UI

#### LangGraph.js Workflow (Classify → Rank)
```typescript
// Worker: ClassifyRankWorkflow
const workflow = new StateGraph<PipelineState>({
  channels: { ... }
})
  .addNode("classify", classifyNode)   // Tag topics/facets
  .addNode("rank", rankNode)           // Compute final scores
  .addEdge("classify", "rank")
  .addEdge("rank", END);
```

#### Acceptance Criteria
- Papers scored with final_score (0-1 range)
- Scores decomposed into N, E, V, P, L, M components
- User rules (includes/excludes) correctly filter papers
- Feedback updates user profile vector
- Papers ranked by personal relevance

---

### Phase 3: Briefings & Core UI (Week 4)

**Core User Experience - MVP Delivery**

#### Deliverables
- [ ] Recommender Agent: Daily digest generation
  - [ ] Noise cap enforcement
  - [ ] Target selection (10-20 papers)
  - [ ] Exploration strategy (15% default)
  - [ ] Material improvement filter
- [ ] Three-pane layout (navigation, briefing list, detail)
- [ ] Paper cards with:
  - [ ] Title, authors, abstract
  - [ ] Score breakdown visualization
  - [ ] Topics/facets badges
  - [ ] "Why Shown" explanations (feature attribution)
- [ ] Hotkeys support (j/k navigation, s save, h hide, c critique)
- [ ] Scheduled digest generation (pg-boss cron, after 6am)
- [ ] Settings tabs:
  - [ ] Sources
  - [ ] Categories
  - [ ] Personalization
  - [ ] Preferences
  - [ ] AI Models

#### LangGraph.js Workflow (Recommend)
```typescript
// Worker: RecommendWorkflow
const workflow = new StateGraph<RecommendState>({
  channels: { ... }
})
  .addNode("recommend", recommendNode)   // Generate digest
  .addEdge(START, "recommend")
  .addEdge("recommend", END);
```

#### Acceptance Criteria
- User receives daily briefing (10-20 papers)
- Papers sorted by relevance
- "Why Shown" correctly attributes score components
- Hotkeys functional (j/k/s/h/c)
- Feedback persists and updates profile
- MVP is functional end-to-end

**🎯 MILESTONE: CORE VALUE DELIVERED** - User can now browse personalized paper briefings.

---

### Phase 4: Summaries (Week 5)

**AI-Generated TL;DRs - Reduce reading time**

#### Deliverables
- [ ] Summary generation (skim type)
  - [ ] "What's New" section (2-3 sentences)
  - [ ] Key Points (3-5 bullets)
  - [ ] Markdown output
- [ ] LLM integration:
  - [ ] Local LLM (ollama: llama3.2, mistral, qwen2.5)
  - [ ] Cloud LLM fallback (Gemini 2.0 Flash, GPT-4o-mini)
- [ ] Summary caching (by content hash)
- [ ] Summary UI component (accordion in paper detail view)
- [ ] Auto-generate summaries for top 10 papers in digest

#### Database Schema Addition
```prisma
model Summary {
  id              String   @id @default(cuid())
  paperId         String
  summaryType     String   // "skim"
  whatsNew        String
  keyPoints       String[]
  markdownContent String
  generatedAt     DateTime @default(now())

  paper Paper @relation(fields: [paperId], references: [id])
  @@index([paperId, summaryType])
}
```

#### tRPC Router Addition
```typescript
export const summariesRouter = router({
  getSummary: protectedProcedure
    .input(z.object({ paperId: z.string() }))
    .query(async ({ input }) => { ... }),

  regenerateSummary: protectedProcedure
    .input(z.object({ paperId: z.string() }))
    .mutation(async ({ input }) => { ... }),
});
```

#### Acceptance Criteria
- Summaries generated for papers (local or cloud LLM)
- Summary UI displays in paper detail view
- Cached summaries reused (no duplicate generation)
- Top 10 papers auto-summarized in daily digest

---

### Phase 5: Critical Analysis (Weeks 6-7)

**Analyst Agent - On-demand deep dives**

#### Week 6: PDF Parsing & Depths A/B

##### Deliverables
- [ ] PDF download from arXiv
- [ ] PDF parsing (text extraction, section detection)
- [ ] Analyst Agent Depth A (Fast):
  - [ ] 5-8 bullets
  - [ ] Abstract-only analysis
  - [ ] Local LLM
  - [ ] ~60 second execution
- [ ] Analyst Agent Depth B (Compare):
  - [ ] Vector search for 3 similar papers
  - [ ] Comparison table generation
  - [ ] Cloud LLM (Gemini 2.0 Flash)
  - [ ] ~2 minute execution
- [ ] Critique UI dropdown (paper detail view)
- [ ] Job status tracking (pending/running/completed)

#### Week 7: Depth C & Polish

##### Deliverables
- [ ] Analyst Agent Depth C (Deep):
  - [ ] Full PDF analysis
  - [ ] Cost estimation & user confirmation
  - [ ] SOTA benchmark check
  - [ ] Cloud LLM (Gemini 2.0 Pro)
  - [ ] ~5 minute execution
- [ ] Analysis regeneration UI
- [ ] Error handling for failed analyses

#### Database Schema Addition
```prisma
model Analysis {
  id                  String   @id @default(cuid())
  paperId             String
  userId              String
  depth               String   // "A", "B", "C"
  claimsEvidence      String
  limitations         String[]
  neighborComparison  Json?    // Only for Depth B
  verdict             String
  confidence          Float
  markdownContent     String
  generatedAt         DateTime @default(now())

  paper Paper @relation(fields: [paperId], references: [id])
  user  User  @relation(fields: [userId], references: [id])

  @@index([paperId, userId, depth])
}
```

#### LangGraph.js Workflow (Analyst Agent)
```typescript
// Worker: AnalystWorkflow
const workflow = new StateGraph<AnalystState>({
  channels: { ... }
})
  .addNode("downloadPdf", downloadPdfNode)
  .addNode("parsePdf", parsePdfNode)
  .addNode("analyzeDepthA", analyzeDepthANode)
  .addNode("findNeighbors", findNeighborsNode)   // Depth B only
  .addNode("analyzeDepthB", analyzeDepthBNode)   // Depth B only
  .addNode("analyzeDepthC", analyzeDepthCNode)   // Depth C only
  .addConditionalEdges("parsePdf", routeByDepth)
  .addEdge("analyzeDepthA", END)
  .addEdge("analyzeDepthB", END)
  .addEdge("analyzeDepthC", END);
```

#### Acceptance Criteria
- User can request Depth A/B/C critiques
- PDF downloaded and parsed correctly
- Critiques display in UI with markdown rendering
- Job status tracked (user sees "Analyzing..." state)
- Cost estimation shown for Depth C before execution

---

### Phase 6: Collections (Week 8)

**Synthesizer Agent - Organize papers into insights**

#### Deliverables
- [ ] Notebook CRUD (create/read/update/delete)
- [ ] Add/remove papers to notebooks
- [ ] User notes and tagging
- [ ] Notebook list UI
- [ ] Notebook detail view
- [ ] Synthesizer Agent:
  - [ ] Auto-synthesis on paper addition
  - [ ] Continuous synthesis mode (checkbox)
  - [ ] Pattern extraction across papers
  - [ ] Contradiction detection
  - [ ] Design pattern identification
- [ ] Synthesis UI display
- [ ] Export functionality:
  - [ ] Markdown (downloadable file)
  - [ ] PDF (server-side generation)
  - [ ] NotebookLM format (JSON)
- [ ] Synthesis regeneration UI

#### Database Schema Addition
```prisma
model Notebook {
  id           String   @id @default(cuid())
  userId       String
  title        String
  description  String?
  purpose      String?  // "survey", "experiment", "writeup"
  isContinuous Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  user      User                 @relation(fields: [userId], references: [id])
  items     NotebookItem[]
  synthesis NotebookSynthesis?

  @@index([userId])
}

model NotebookItem {
  id         String   @id @default(cuid())
  notebookId String
  paperId    String
  userNotes  String?
  tags       String[]
  addedAt    DateTime @default(now())

  notebook Notebook @relation(fields: [notebookId], references: [id])
  paper    Paper    @relation(fields: [paperId], references: [id])

  @@unique([notebookId, paperId])
}

model NotebookSynthesis {
  id              String   @id @default(cuid())
  notebookId      String   @unique
  markdownContent String
  generatedAt     DateTime @default(now())
  updatedAt       DateTime @updatedAt

  notebook Notebook @relation(fields: [notebookId], references: [id])
}
```

#### LangGraph.js Workflow (Synthesizer Agent)
```typescript
// Worker: SynthesizerWorkflow
const workflow = new StateGraph<SynthesizerState>({
  channels: { ... }
})
  .addNode("loadPapers", loadPapersNode)
  .addNode("extractPatterns", extractPatternsNode)
  .addNode("detectContradictions", detectContradictionsNode)
  .addNode("synthesize", synthesizeNode)
  .addEdge("loadPapers", "extractPatterns")
  .addEdge("extractPatterns", "detectContradictions")
  .addEdge("detectContradictions", "synthesize")
  .addEdge("synthesize", END);
```

#### Acceptance Criteria
- User can create notebooks and add papers
- Synthesis automatically generated on paper addition (if continuous mode enabled)
- Export to Markdown/PDF/NotebookLM format works
- User notes and tags persist
- Synthesis UI displays patterns and contradictions

---

### Phase 7: Trends & Analytics (Week 9)

**Velocity Tracking - Identify emerging research directions**

#### Deliverables
- [ ] Topic velocity computation:
  - [ ] Daily topic count aggregation
  - [ ] EMA slope calculation (7-day window)
  - [ ] Week-over-week growth rate
  - [ ] Velocity persistence (TopicVelocity table)
- [ ] Emerging topics:
  - [ ] Detection algorithm (≥30% WoW, ≥6 papers)
  - [ ] Highlighting in UI
- [ ] SOTA tracking:
  - [ ] Benchmark board (Papers with Code integration)
  - [ ] Recent results display
- [ ] Technique co-occurrence:
  - [ ] Network analysis
  - [ ] Graph storage
- [ ] Visualizations:
  - [ ] Velocity sparklines (topic cards)
  - [ ] Heatmaps (topics × time)
  - [ ] Co-occurrence graphs (D3.js or similar)
  - [ ] Trends dashboard UI

#### Database Schema Addition
```prisma
model TopicVelocity {
  id         String   @id @default(cuid())
  topic      String
  date       DateTime
  count      Int
  velocity   Float    // EMA slope
  growthRate Float    // WoW growth

  @@unique([topic, date])
  @@index([topic, date])
}

model TechniqueCooccurrence {
  id              String @id @default(cuid())
  technique1      String
  technique2      String
  cooccurrenceCount Int
  updatedAt       DateTime @updatedAt

  @@unique([technique1, technique2])
}
```

#### Acceptance Criteria
- Topic velocity computed daily
- Emerging topics highlighted in UI
- SOTA benchmark board displays recent results
- Technique co-occurrence graph interactive
- Trends dashboard functional

---

### Phase 8: Polish & Optimization (Week 10)

**Quality & Performance - Production readiness**

#### Deliverables
- [ ] Performance optimization:
  - [ ] Database query optimization (indexes, N+1 query elimination)
  - [ ] React component memoization
  - [ ] LLM caching (content hash-based)
  - [ ] Image lazy loading
  - [ ] Bundle size optimization
- [ ] Error handling & retry logic:
  - [ ] Exponential backoff for external APIs
  - [ ] Dead letter queue for failed jobs
  - [ ] User-friendly error messages
  - [ ] Graceful degradation (local LLM fallback)
- [ ] OpenTelemetry instrumentation:
  - [ ] Trace LLM calls
  - [ ] Track pipeline execution times
  - [ ] Monitor job queue depth
  - [ ] Database query tracing
- [ ] Testing:
  - [ ] Unit tests (80%+ coverage target)
  - [ ] Integration tests (API endpoints)
  - [ ] E2E tests (critical user flows)
  - [ ] Load testing (100+ papers/digest)
- [ ] Documentation:
  - [ ] README with setup instructions
  - [ ] API documentation (tRPC introspection)
  - [ ] Architecture decision records (ADRs)
  - [ ] Deployment guide

#### Acceptance Criteria
- All tests pass
- Production build succeeds
- Performance metrics acceptable (<2s page load)
- Error handling graceful
- Documentation complete
- No critical security vulnerabilities (npm audit)

---

### Phase 9: Beta & Iteration (Weeks 11-12)

**Production Deployment & Real-World Validation**

#### Week 11: Production Deployment

##### Deliverables
- [ ] Docker images built and pushed
- [ ] Deployment configuration:
  - [ ] Kubernetes manifests (or Docker Compose for single-node)
  - [ ] Environment variables configured
  - [ ] Secrets management
- [ ] Database migration in production
- [ ] Observability:
  - [ ] Monitoring dashboards (Grafana)
  - [ ] Alerting rules (Prometheus)
  - [ ] Log aggregation
- [ ] Backup strategy:
  - [ ] Database backups (daily)
  - [ ] Object storage backups
- [ ] SSL/TLS certificates
- [ ] Domain configuration

#### Week 12: Beta Testing & Iteration

##### Deliverables
- [ ] Beta user onboarding (5-10 initial users)
- [ ] Feedback collection:
  - [ ] Qualitative interviews
  - [ ] In-app feedback widget
  - [ ] Usage analytics
- [ ] Metrics tracking:
  - [ ] Time saved (self-reported)
  - [ ] Daily active users
  - [ ] Papers saved vs dismissed
  - [ ] Feature usage (analysis, collections, trends)
  - [ ] Cost per user per day
- [ ] Iteration:
  - [ ] Bug fixes
  - [ ] UX improvements
  - [ ] Scoring weight tuning based on feedback
  - [ ] Performance improvements

#### Success Criteria
- Production system stable (>99% uptime)
- Beta users report time savings (target: 2+ hours → 10-15 minutes)
- <20% false positive rate (immediate dismissals)
- System converges on user preferences within 2 weeks
- Cost target met (≤$5/day per user)
- At least 3 active daily users

---

## Branch Strategy

### Main Branch Only

All development proceeds on `main` branch with direct commits or short-lived feature branches that merge quickly (same day or next day).

```bash
# Example workflow
git checkout main
git pull

# Work on Phase N feature
git add .
git commit -m "feat(phase-N): implement feature X"
git push

# OR use short-lived branch
git checkout -b phase-N-feature-x
# ... work ...
git commit -m "feat(phase-N): implement feature X"
git checkout main
git merge phase-N-feature-x
git branch -d phase-N-feature-x
git push
```

### Commit Message Conventions

Follow conventional commits:
```
feat(scope): description       # New feature
fix(scope): description        # Bug fix
refactor(scope): description   # Code refactor
test(scope): description       # Test additions
docs(scope): description       # Documentation
chore(scope): description      # Maintenance
```

Examples:
```
feat(ingestion): add arXiv OAI-PMH client
feat(scoring): implement novelty signal calculation
fix(ui): correct paper card score display
refactor(db): optimize paper query indexes
test(ranker): add unit tests for scoring formula
docs(api): document tRPC router endpoints
```

---

## Development Workflow

### Daily Routine

1. **Morning**: Review current phase deliverables
2. **Work Session**: Implement features for current phase
3. **Testing**: Validate functionality against acceptance criteria
4. **Commit**: Push working code to main
5. **End of Day**: Update progress tracking (optional)

### Phase Completion Checklist

Before moving to next phase:
- [ ] All deliverables implemented
- [ ] All acceptance criteria met
- [ ] Tests written and passing
- [ ] Code formatted (as per user's .claude/CLAUDE.md: run formatter)
- [ ] Linting passes (as per user's .claude/CLAUDE.md)
- [ ] Build succeeds (as per user's .claude/CLAUDE.md)
- [ ] Manual testing completed
- [ ] Documentation updated

### Phase Transition

```bash
# End of Phase N
npm run test           # All tests pass
npm run lint           # Linting passes
npm run build          # Build succeeds
git add .
git commit -m "feat(phase-N): complete phase N - [summary]"
git push

# Start Phase N+1
# Review Phase N+1 deliverables in roadmap
# Begin implementation
```

---

## Alternative Approach: Parallel Development (Not Selected)

**Note: This section is for reference only. The parallel approach using git worktrees was considered but not selected for this project.**

For documentation of the parallel development strategy (6-7 week timeline using git worktrees), see Appendix A below.

---

## Appendix A: Parallel Development Strategy (Reference Only)

### Timeline: 6-7 Weeks Wall Time (NOT SELECTED)

### Timeline: 6-7 Weeks Wall Time

### Strategy Overview

Use **git worktrees** to maintain multiple simultaneous development environments, each focused on an independent feature stream. This allows different features to progress in parallel without merge conflicts.

### Git Worktree Setup

```bash
# Main worktree (foundation + core pipeline)
/Users/brandon/Development/personal/arxiv-curator/

# Parallel worktrees after Phase 3 completes
/Users/brandon/Development/personal/arxiv-curator-summaries/     # Stream D
/Users/brandon/Development/personal/arxiv-curator-analyst/       # Stream A
/Users/brandon/Development/personal/arxiv-curator-collections/   # Stream B
/Users/brandon/Development/personal/arxiv-curator-trends/        # Stream C
```

**Setup Commands:**
```bash
# After Phase 3 (week 4) completes on main
git worktree add ../arxiv-curator-summaries -b feature/summaries
git worktree add ../arxiv-curator-analyst -b feature/analyst-agent
git worktree add ../arxiv-curator-collections -b feature/collections
git worktree add ../arxiv-curator-trends -b feature/trends-analytics
```

### Detailed Parallel Timeline

#### Weeks 1-4: Sequential Foundation (Same as Serial)

| Week | Focus | Deliverables |
|------|-------|-------------|
| 1 | Foundation | DB, auth, queue, tRPC baseline |
| 2 | Ingestion | Scout Agent, enrichment pipeline |
| 3 | Personalization | Scoring, ranking, user profiles |
| 4 | Briefings | Daily digests, core UI, working MVP |

**Milestone:** By end of Week 4, core system is functional. User can browse daily briefings of personalized papers.

---

#### Weeks 5-7: Parallel Streams (4 Concurrent Work Streams)

**Stream D starts Week 2** (only depends on Phase 1), others start Week 5.

```
┌──────────────────────────────────────────────────────────────┐
│ Week 5-7: PARALLEL DEVELOPMENT                               │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Stream A: Deep Analysis (Analyst Agent)                    │
│  ├─ Week 5: PDF download & parsing                          │
│  ├─ Week 6: Analyst Agent Depth A (Fast)                    │
│  └─ Week 7: Depths B (Compare) & C (Deep), critique UI      │
│                                                              │
│  Stream B: Collections & Synthesis                          │
│  ├─ Week 5: Notebook CRUD, add/remove papers                │
│  ├─ Week 6: Synthesizer Agent, continuous synthesis         │
│  └─ Week 7: Export functionality (Markdown/PDF/NotebookLM)  │
│                                                              │
│  Stream C: Trends & Analytics                               │
│  ├─ Week 5: Topic velocity computation (EMA)                │
│  ├─ Week 6: Emerging topic detection, SOTA tracking         │
│  └─ Week 7: Visualizations (sparklines, heatmaps, graphs)   │
│                                                              │
│  Stream D: Summaries (Starts Week 2!)                       │
│  ├─ Week 2-3: Summary generation, LLM integration           │
│  └─ Week 4: Summary UI integration, merges into main        │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Key Insight:** Stream D (Summaries) can start immediately after Phase 1 completes (Week 2) because it only needs paper metadata and enrichment data. This feature merges back into main by Week 4, ready for the Phase 3 UI.

---

#### Week 7: Integration & Merge

```bash
# End of Week 7: Merge all streams back to main
git checkout main
git merge feature/summaries        # Already merged Week 4
git merge feature/analyst-agent
git merge feature/collections
git merge feature/trends-analytics

# Run integration tests
npm run test:integration
npm run build

# Resolve any conflicts (should be minimal due to isolated domains)
```

**Expected Merge Complexity:**
- **Low Risk**: Each stream touches different parts of the codebase
  - Stream A: Analysis models, PDF handling, critique UI
  - Stream B: Notebook models, synthesis logic, export utilities
  - Stream C: Velocity calculations, trend models, analytics UI
  - Stream D: Summary models, LLM integration (already merged)

- **Potential Conflicts**:
  - Shared UI components (paper detail view) - easily resolved
  - Database schema additions (clean migrations per stream)
  - tRPC route additions (no conflicts, just combine)

---

#### Weeks 8-9: Polish & Beta (Sequential)

| Week | Focus | Deliverables |
|------|-------|-------------|
| 8 | Polish | Performance tuning, error handling, testing, monitoring, documentation |
| 9 | Beta | Production deployment, user validation, feedback collection, iteration |

---

### Parallel Work Execution Model

#### Database Schema Isolation Strategy

Each stream adds its own tables without modifying core tables:

**Stream A (Analyst):**
```prisma
model Analysis {
  id               String
  paperId          String
  depth            String  // A/B/C
  claimsEvidence   String
  verdict          String
  // ...
}
```

**Stream B (Collections):**
```prisma
model Notebook {
  id          String
  userId      String
  title       String
  // ...
}

model NotebookItem { ... }
model NotebookSynthesis { ... }
```

**Stream C (Trends):**
```prisma
model TopicVelocity {
  id          String
  topic       String
  velocity    Float
  // ...
}
```

**Stream D (Summaries):**
```prisma
model Summary {
  id            String
  paperId       String
  summaryType   String
  keyPoints     String[]
  // ...
}
```

**Migration Strategy:**
```bash
# Each stream maintains its own migration file
feature/analyst-agent:     prisma/migrations/20250119_add_analysis.sql
feature/collections:       prisma/migrations/20250119_add_notebooks.sql
feature/trends-analytics:  prisma/migrations/20250119_add_velocity.sql
feature/summaries:         prisma/migrations/20250119_add_summaries.sql

# During merge: Combine all migrations, resolve numbering
```

---

#### tRPC Route Isolation

Each stream adds new router namespaces without touching existing ones:

```typescript
// feature/analyst-agent
export const analysisRouter = router({
  requestAnalysis: protectedProcedure.input(...).mutation(...),
  getAnalysis: protectedProcedure.input(...).query(...),
});

// feature/collections
export const notebooksRouter = router({
  createNotebook: protectedProcedure.input(...).mutation(...),
  synthesize: protectedProcedure.input(...).mutation(...),
});

// feature/trends-analytics
export const trendsRouter = router({
  getTopicVelocity: protectedProcedure.input(...).query(...),
  getEmergingTopics: protectedProcedure.input(...).query(...),
});

// feature/summaries
export const summariesRouter = router({
  getSummary: protectedProcedure.input(...).query(...),
});

// On merge: Combine into main appRouter
export const appRouter = router({
  papers: papersRouter,
  briefings: briefingsRouter,
  analysis: analysisRouter,      // Stream A
  notebooks: notebooksRouter,     // Stream B
  trends: trendsRouter,           // Stream C
  summaries: summariesRouter,     // Stream D
});
```

**No conflicts**: Each router is isolated to its domain.

---

#### UI Component Isolation

Minimize conflicts by isolating UI into feature directories:

```
app/
├── briefings/          # Core (Phase 3)
├── analysis/           # Stream A
│   ├── components/
│   └── [paperId]/page.tsx
├── collections/        # Stream B
│   ├── components/
│   └── [notebookId]/page.tsx
├── trends/             # Stream C
│   ├── components/
│   └── page.tsx
└── papers/
    └── [id]/
        ├── page.tsx            # POTENTIAL CONFLICT ZONE
        └── components/
            ├── SummaryPanel.tsx      # Stream D
            ├── AnalysisPanel.tsx     # Stream A
            └── CollectionButton.tsx  # Stream B
```

**Conflict Resolution Strategy:**
- Leave `papers/[id]/page.tsx` as a shell that imports feature components
- Each stream adds its own panel component
- Main coordinates layout during merge

---

### Advantages of Parallel Approach

1. **3-4 Week Time Savings**: 10 weeks → 6-7 weeks wall time
2. **Early Feature Delivery**: All major features ready simultaneously (Week 7 vs Week 9)
3. **Independent Progress**: Blockers in one stream don't affect others
4. **Specialized Focus**: Developers can work in isolated domains without context switching
5. **Faster Feedback**: Advanced features (Collections, Analysis) available earlier for testing

### Disadvantages of Parallel Approach

1. **Higher Coordination Overhead**: Need to coordinate schema changes, API contracts
2. **Merge Risk**: Integration week (Week 7) may reveal unforeseen conflicts
3. **Testing Complexity**: Each stream needs its own test suite + final integration testing
4. **Cognitive Load**: Managing 4 simultaneous development contexts
5. **Infrastructure**: Need 4x local environments (Docker Compose per worktree)

---

## Worktree-Specific Development Setup

### Local Environment per Worktree

Each worktree needs its own:
- Database instance (different ports)
- MinIO instance (different ports)
- Next.js dev server (different ports)
- Worker process (different job queues)

**Example Configuration:**

```bash
# arxiv-curator/ (main)
DATABASE_URL=postgresql://localhost:5432/arxiv_curator_main
MINIO_PORT=9000
NEXT_PORT=3000

# arxiv-curator-analyst/
DATABASE_URL=postgresql://localhost:5433/arxiv_curator_analyst
MINIO_PORT=9001
NEXT_PORT=3001

# arxiv-curator-collections/
DATABASE_URL=postgresql://localhost:5434/arxiv_curator_collections
MINIO_PORT=9002
NEXT_PORT=3002

# arxiv-curator-trends/
DATABASE_URL=postgresql://localhost:5435/arxiv_curator_trends
MINIO_PORT=9003
NEXT_PORT=3003
```

**Docker Compose Override per Worktree:**

```yaml
# arxiv-curator-analyst/.env.local
COMPOSE_PROJECT_NAME=arxiv_analyst
POSTGRES_PORT=5433
MINIO_PORT=9001
NEXT_PORT=3001
```

---

## Detailed Phase Breakdown

### Phase 0: Foundation (Week 1)

**Critical Infrastructure - No Parallelization Possible**

#### Deliverables
- [ ] PostgreSQL 16+ with pgvector extension
- [ ] Prisma schema (core models: User, UserProfile, Paper, PaperEnriched, Score, Feedback)
- [ ] NextAuth.js integration (email/password, optional OAuth)
- [ ] pg-boss job queue setup
- [ ] tRPC baseline routing
- [ ] Docker Compose development environment
- [ ] MinIO S3-compatible storage
- [ ] Basic Next.js 14 app structure (App Router)

#### Key Files Created
```
prisma/
  schema.prisma
  migrations/
    20250119_init.sql
src/
  server/
    db.ts
    routers/
      _app.ts
  lib/
    auth.ts
docker-compose.yml
.env.example
```

#### Acceptance Criteria
- User can register/login via NextAuth
- Database schema migrated successfully
- tRPC health check endpoint returns 200
- Job queue can enqueue and process test jobs
- MinIO accessible at http://localhost:9000

---

### Phase 1: Ingestion & Enrichment (Week 2)

**Data Pipeline - No Parallelization Possible**

#### Deliverables
- [ ] Scout Agent: arXiv OAI-PMH client
- [ ] Scout Agent: Atom feed RSS parser
- [ ] Rate limiter (1 request/3 seconds for arXiv)
- [ ] Paper version supersedence logic
- [ ] Enricher Agent Tier 0:
  - [ ] Embedding generation (local via ollama or cloud)
  - [ ] Math depth estimation
  - [ ] Topic/facet classification (zero-shot LLM)
  - [ ] Evidence signal detection (baselines, ablations, code, data)
- [ ] Settings UI: Sources & Categories selection
- [ ] Basic paper list view

#### LangGraph.js Workflow (Scout → Enrich)
```typescript
// Worker: ScoutEnrichWorkflow
const workflow = new StateGraph<PipelineState>({
  channels: { ... }
})
  .addNode("scout", scoutNode)       // Fetch from arXiv
  .addNode("enrich", enrichNode)     // Compute embeddings, classify
  .addEdge("scout", "enrich")
  .addEdge("enrich", END);
```

#### Acceptance Criteria
- Daily arXiv ingestion fetches 100-500 papers
- Papers are enriched with embeddings (768-dim vectors)
- Topic classification produces 3-5 topics per paper
- Evidence signals detected (hasCode, hasBaselines, etc.)
- User can view raw paper list (unranked)

---

### Phase 2: Personalization & Scoring (Week 3)

**Ranking Engine - No Parallelization Possible**

#### Deliverables
- [ ] Classifier Agent: Topic/facet tagging
- [ ] Ranker Agent: Multi-signal scoring
  - [ ] Novelty (centroid distance, novel keywords, LOF)
  - [ ] Evidence (baselines, ablations, code, data)
  - [ ] Velocity (EMA slope, keyword burst)
  - [ ] Personal Fit (cosine similarity + rule bonuses)
  - [ ] Lab Prior (boost for preferred labs)
  - [ ] Math Penalty (depth × sensitivity)
- [ ] Personalization rules engine:
  - [ ] Include/exclude topics & keywords
  - [ ] Lab boost configuration
  - [ ] Math depth tolerance slider
  - [ ] Exploration rate tuning
- [ ] Feedback system (thumbs up/down, save, dismiss)
- [ ] Vector profile learning (exponential moving average)
- [ ] User Profile Management UI

#### LangGraph.js Workflow (Classify → Rank)
```typescript
// Worker: ClassifyRankWorkflow
const workflow = new StateGraph<PipelineState>({
  channels: { ... }
})
  .addNode("classify", classifyNode)   // Tag topics/facets
  .addNode("rank", rankNode)           // Compute final scores
  .addEdge("classify", "rank")
  .addEdge("rank", END);
```

#### Acceptance Criteria
- Papers scored with final_score (0-1 range)
- Scores decomposed into N, E, V, P, L, M components
- User rules (includes/excludes) correctly filter papers
- Feedback updates user profile vector
- Papers ranked by personal relevance

---

### Phase 3: Briefings & Core UI (Week 4)

**Core User Experience - No Parallelization Possible**

#### Deliverables
- [ ] Recommender Agent: Daily digest generation
  - [ ] Noise cap enforcement
  - [ ] Target selection (10-20 papers)
  - [ ] Exploration strategy (15% default)
  - [ ] Material improvement filter
- [ ] Three-pane layout (navigation, briefing list, detail)
- [ ] Paper cards with:
  - [ ] Title, authors, abstract
  - [ ] Score breakdown visualization
  - [ ] Topics/facets badges
  - [ ] "Why Shown" explanations (feature attribution)
- [ ] Hotkeys support (j/k navigation, s save, h hide, c critique)
- [ ] Scheduled digest generation (pg-boss cron, after 6am)
- [ ] Settings tabs:
  - [ ] Sources
  - [ ] Categories
  - [ ] Personalization
  - [ ] Preferences
  - [ ] AI Models

#### LangGraph.js Workflow (Recommend)
```typescript
// Worker: RecommendWorkflow
const workflow = new StateGraph<RecommendState>({
  channels: { ... }
})
  .addNode("recommend", recommendNode)   // Generate digest
  .addEdge(START, "recommend")
  .addEdge("recommend", END);
```

#### Acceptance Criteria
- User receives daily briefing (10-20 papers)
- Papers sorted by relevance
- "Why Shown" correctly attributes score components
- Hotkeys functional (j/k/s/h/c)
- Feedback persists and updates profile
- MVP is functional end-to-end

**Milestone: CORE VALUE DELIVERED** - User can now browse personalized paper briefings.

---

### Phase 4: Summaries (Stream D - Starts Week 2, Merges Week 4)

**Can Proceed in Parallel After Phase 1**

#### Git Worktree Setup
```bash
# After Phase 1 completes (end of Week 2)
git worktree add ../arxiv-curator-summaries -b feature/summaries
cd ../arxiv-curator-summaries
```

#### Deliverables
- [ ] Summary generation (skim type)
  - [ ] "What's New" section (2-3 sentences)
  - [ ] Key Points (3-5 bullets)
  - [ ] Markdown output
- [ ] LLM integration:
  - [ ] Local LLM (ollama: llama3.2, mistral, qwen2.5)
  - [ ] Cloud LLM fallback (Gemini 2.0 Flash, GPT-4o-mini)
- [ ] Summary caching (by content hash)
- [ ] Summary UI component (accordion in paper detail view)
- [ ] Auto-generate summaries for top 10 papers in digest

#### Database Schema Addition
```prisma
model Summary {
  id              String   @id @default(cuid())
  paperId         String
  summaryType     String   // "skim"
  whatsNew        String
  keyPoints       String[]
  markdownContent String
  generatedAt     DateTime @default(now())

  paper Paper @relation(fields: [paperId], references: [id])
  @@index([paperId, summaryType])
}
```

#### tRPC Router Addition
```typescript
export const summariesRouter = router({
  getSummary: protectedProcedure
    .input(z.object({ paperId: z.string() }))
    .query(async ({ input }) => { ... }),

  regenerateSummary: protectedProcedure
    .input(z.object({ paperId: z.string() }))
    .mutation(async ({ input }) => { ... }),
});
```

#### Merge Strategy (Week 4)
```bash
# Week 4: Merge back into main before Phase 3 UI work completes
git checkout main
git merge feature/summaries
npm run prisma:migrate
npm run build
npm run test
```

**Merge Risk:** Low - only adds new Summary model and summariesRouter, no modifications to core.

#### Acceptance Criteria
- Summaries generated for papers (local or cloud LLM)
- Summary UI displays in paper detail view
- Cached summaries reused (no duplicate generation)
- Top 10 papers auto-summarized in daily digest

---

### Phase 5: Critical Analysis (Stream A - Weeks 5-7)

**Analyst Agent - Parallel Stream**

#### Git Worktree Setup
```bash
# Week 5 start (after Phase 3 completes)
git worktree add ../arxiv-curator-analyst -b feature/analyst-agent
cd ../arxiv-curator-analyst
```

#### Week 5: PDF Parsing & Depth A
- [ ] PDF download from arXiv
- [ ] PDF parsing (text extraction, section detection)
- [ ] Analyst Agent Depth A (Fast):
  - [ ] 5-8 bullets
  - [ ] Abstract-only analysis
  - [ ] Local LLM
  - [ ] ~60 second execution
- [ ] Critique UI dropdown (paper detail view)

#### Week 6: Depth B (Compare)
- [ ] Vector search for 3 similar papers
- [ ] Comparison table generation
- [ ] Cloud LLM (Gemini 2.0 Flash)
- [ ] ~2 minute execution
- [ ] Critique status tracking (pending/running/completed)

#### Week 7: Depth C (Deep)
- [ ] Full PDF analysis
- [ ] Cost estimation & user confirmation
- [ ] SOTA benchmark check
- [ ] Cloud LLM (Gemini 2.0 Pro)
- [ ] ~5 minute execution
- [ ] Analysis regeneration UI

#### Database Schema Addition
```prisma
model Analysis {
  id                  String   @id @default(cuid())
  paperId             String
  userId              String
  depth               String   // "A", "B", "C"
  claimsEvidence      String
  limitations         String[]
  neighborComparison  Json?    // Only for Depth B
  verdict             String
  confidence          Float
  markdownContent     String
  generatedAt         DateTime @default(now())

  paper Paper @relation(fields: [paperId], references: [id])
  user  User  @relation(fields: [userId], references: [id])

  @@index([paperId, userId, depth])
}
```

#### LangGraph.js Workflow (Analyst Agent)
```typescript
// Worker: AnalystWorkflow
const workflow = new StateGraph<AnalystState>({
  channels: { ... }
})
  .addNode("downloadPdf", downloadPdfNode)
  .addNode("parsePdf", parsePdfNode)
  .addNode("analyzeDepthA", analyzeDepthANode)
  .addNode("findNeighbors", findNeighborsNode)   // Depth B only
  .addNode("analyzeDepthB", analyzeDepthBNode)   // Depth B only
  .addNode("analyzeDepthC", analyzeDepthCNode)   // Depth C only
  .addConditionalEdges("parsePdf", routeByDepth)
  .addEdge("analyzeDepthA", END)
  .addEdge("analyzeDepthB", END)
  .addEdge("analyzeDepthC", END);
```

#### Acceptance Criteria
- User can request Depth A/B/C critiques
- PDF downloaded and parsed correctly
- Critiques display in UI with markdown rendering
- Job status tracked (user sees "Analyzing..." state)
- Cost estimation shown for Depth C before execution

---

### Phase 6: Collections (Stream B - Weeks 5-7)

**Synthesizer Agent - Parallel Stream**

#### Git Worktree Setup
```bash
# Week 5 start (after Phase 3 completes)
git worktree add ../arxiv-curator-collections -b feature/collections
cd ../arxiv-curator-collections
```

#### Week 5: Notebook CRUD
- [ ] Create/read/update/delete notebooks
- [ ] Add/remove papers to notebooks
- [ ] User notes and tagging
- [ ] Notebook list UI
- [ ] Notebook detail view

#### Week 6: Synthesizer Agent
- [ ] Auto-synthesis on paper addition
- [ ] Continuous synthesis mode (checkbox)
- [ ] Pattern extraction across papers
- [ ] Contradiction detection
- [ ] Design pattern identification
- [ ] Synthesis UI display

#### Week 7: Export Functionality
- [ ] Export to Markdown (downloadable file)
- [ ] Export to PDF (server-side generation)
- [ ] Export to NotebookLM format (JSON)
- [ ] Synthesis regeneration UI

#### Database Schema Addition
```prisma
model Notebook {
  id           String   @id @default(cuid())
  userId       String
  title        String
  description  String?
  purpose      String?  // "survey", "experiment", "writeup"
  isContinuous Boolean  @default(false)
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  user      User                 @relation(fields: [userId], references: [id])
  items     NotebookItem[]
  synthesis NotebookSynthesis?

  @@index([userId])
}

model NotebookItem {
  id         String   @id @default(cuid())
  notebookId String
  paperId    String
  userNotes  String?
  tags       String[]
  addedAt    DateTime @default(now())

  notebook Notebook @relation(fields: [notebookId], references: [id])
  paper    Paper    @relation(fields: [paperId], references: [id])

  @@unique([notebookId, paperId])
}

model NotebookSynthesis {
  id              String   @id @default(cuid())
  notebookId      String   @unique
  markdownContent String
  generatedAt     DateTime @default(now())
  updatedAt       DateTime @updatedAt

  notebook Notebook @relation(fields: [notebookId], references: [id])
}
```

#### LangGraph.js Workflow (Synthesizer Agent)
```typescript
// Worker: SynthesizerWorkflow
const workflow = new StateGraph<SynthesizerState>({
  channels: { ... }
})
  .addNode("loadPapers", loadPapersNode)
  .addNode("extractPatterns", extractPatternsNode)
  .addNode("detectContradictions", detectContradictionsNode)
  .addNode("synthesize", synthesizeNode)
  .addEdge("loadPapers", "extractPatterns")
  .addEdge("extractPatterns", "detectContradictions")
  .addEdge("detectContradictions", "synthesize")
  .addEdge("synthesize", END);
```

#### Acceptance Criteria
- User can create notebooks and add papers
- Synthesis automatically generated on paper addition (if continuous mode enabled)
- Export to Markdown/PDF/NotebookLM format works
- User notes and tags persist
- Synthesis UI displays patterns and contradictions

---

### Phase 7: Trends & Analytics (Stream C - Weeks 5-7)

**Velocity Tracking - Parallel Stream**

#### Git Worktree Setup
```bash
# Week 5 start (after Phase 3 completes)
git worktree add ../arxiv-curator-trends -b feature/trends-analytics
cd ../arxiv-curator-trends
```

#### Week 5: Topic Velocity Computation
- [ ] Daily topic count aggregation
- [ ] EMA slope calculation (7-day window)
- [ ] Week-over-week growth rate
- [ ] Velocity persistence (TopicVelocity table)

#### Week 6: Emerging Topics & SOTA Tracking
- [ ] Emerging topic detection (≥30% WoW, ≥6 papers)
- [ ] SOTA benchmark board (Papers with Code integration)
- [ ] Technique co-occurrence graphs (network analysis)

#### Week 7: Visualizations
- [ ] Velocity sparklines (topic cards)
- [ ] Heatmaps (topics × time)
- [ ] Co-occurrence graphs (D3.js or similar)
- [ ] Trends dashboard UI

#### Database Schema Addition
```prisma
model TopicVelocity {
  id         String   @id @default(cuid())
  topic      String
  date       DateTime
  count      Int
  velocity   Float    // EMA slope
  growthRate Float    // WoW growth

  @@unique([topic, date])
  @@index([topic, date])
}

model TechniqueCooccurrence {
  id              String @id @default(cuid())
  technique1      String
  technique2      String
  cooccurrenceCount Int
  updatedAt       DateTime @updatedAt

  @@unique([technique1, technique2])
}
```

#### Acceptance Criteria
- Topic velocity computed daily
- Emerging topics highlighted in UI
- SOTA benchmark board displays recent results
- Technique co-occurrence graph interactive
- Trends dashboard functional

---

### Phase 8: Polish & Optimization (Week 8)

**Integration & Quality - Sequential After All Streams Merge**

#### Week 8: Merge Week (Integration)

**Monday-Wednesday: Merge All Streams**
```bash
git checkout main

# Merge each feature branch
git merge feature/summaries         # Already merged Week 4
git merge feature/analyst-agent
git merge feature/collections
git merge feature/trends-analytics

# Resolve conflicts (expected: minimal)
# - Database migrations: combine into sequential order
# - tRPC routers: combine into appRouter
# - UI components: paper detail view layout coordination

# Run full test suite
npm run test:unit
npm run test:integration
npm run test:e2e

# Build production bundle
npm run build
```

**Thursday-Friday: Polish & Optimization**

#### Deliverables
- [ ] Performance optimization:
  - [ ] Database query optimization (indexes, N+1 query elimination)
  - [ ] React component memoization
  - [ ] LLM caching (content hash-based)
  - [ ] Image lazy loading
- [ ] Error handling & retry logic:
  - [ ] Exponential backoff for external APIs
  - [ ] Dead letter queue for failed jobs
  - [ ] User-friendly error messages
- [ ] OpenTelemetry instrumentation:
  - [ ] Trace LLM calls
  - [ ] Track pipeline execution times
  - [ ] Monitor job queue depth
- [ ] Testing:
  - [ ] Unit tests (80%+ coverage)
  - [ ] Integration tests (API endpoints)
  - [ ] E2E tests (critical user flows)
- [ ] Documentation:
  - [ ] README with setup instructions
  - [ ] API documentation (tRPC introspection)
  - [ ] Architecture decision records (ADRs)

#### Acceptance Criteria
- All tests pass
- Production build succeeds
- No regressions from merge
- Performance metrics acceptable (<2s page load)
- Error handling graceful

---

### Phase 9: Beta & Iteration (Weeks 9-10)

**Production Deployment & Real-World Validation - Sequential**

#### Week 9: Production Deployment
- [ ] Docker images built and pushed
- [ ] Kubernetes manifests (or Docker Compose for single-node)
- [ ] Database migration in production
- [ ] Environment variables configured
- [ ] Monitoring dashboards (Grafana)
- [ ] Alerting rules (Prometheus)

#### Week 10: Beta Testing & Iteration
- [ ] Invite beta users (5-10 initial users)
- [ ] Collect qualitative feedback
- [ ] Track key metrics:
  - [ ] Time saved (self-reported)
  - [ ] Daily active users
  - [ ] Papers saved vs dismissed
  - [ ] Feature usage (analysis, collections, trends)
- [ ] Bug fixes and UX improvements
- [ ] Tuning scoring weights based on feedback

#### Acceptance Criteria
- Production system stable (>99% uptime)
- Beta users report time savings
- <20% false positive rate (immediate dismissals)
- System converges on user preferences within 2 weeks
- Cost target met (≤$5/day per user)

---

## Phase Progress Tracking

### Recommended Tracking Method

Track progress through each phase using this simple markdown checklist format:

```markdown
## Current Phase: [Phase Name]

### Week: [Week Number]

**Status**: [Not Started | In Progress | Completed]

**Deliverables Progress**:
- [ ] Deliverable 1
- [ ] Deliverable 2
- [ ] Deliverable 3

**Acceptance Criteria**:
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

**Notes**:
- Key decisions made
- Blockers encountered
- Lessons learned
```

### Milestone Markers

Use these key milestones to track overall progress:

| Milestone | Week | Significance |
|-----------|------|--------------|
| Foundation Ready | 1 | Infrastructure operational, ready for feature development |
| Data Pipeline Flowing | 2 | Papers ingesting from arXiv, enrichment working |
| Personalization Working | 3 | Scoring system operational, user profiles functional |
| **MVP Delivered** | **4** | **Core value proposition proven** |
| Summaries Live | 5 | AI-generated TL;DRs enhance paper consumption |
| Deep Analysis Ready | 7 | Three-tier critique system operational |
| Collections Functional | 8 | Users can organize and synthesize papers |
| Analytics Dashboard Live | 9 | Trend tracking and visualization complete |
| Production Ready | 10 | Polished, tested, documented |
| **Beta Launch** | **11-12** | **Real users validating the system** |

---

## Next Steps

1. **Review this roadmap** to ensure alignment with project goals
2. **Set up development environment** (Docker Compose, PostgreSQL, MinIO, etc.)
3. **Begin Phase 0** (Foundation) immediately
   - Install PostgreSQL 17+ with pgvector
   - Initialize Next.js 15 project with App Router and React 19
   - Set up Prisma ORM v6
   - Configure Auth.js v5 (NextAuth.js v5)
   - Set up pg-boss job queue
4. **Track progress** using phase completion checklists
5. **Validate early and often** - test against acceptance criteria at each phase

---

## Appendix: File Structure for Parallel Streams

```
arxiv-curator/                        # Main worktree
├── app/
│   ├── briefings/                    # Phase 3
│   └── settings/                     # Phase 3
├── prisma/
│   └── schema.prisma                 # Phase 0-3 core models
└── src/server/routers/
    ├── papers.ts                     # Phase 1-2
    └── briefings.ts                  # Phase 3

arxiv-curator-analyst/                # Stream A worktree
├── app/analysis/                     # New feature UI
├── prisma/schema.prisma              # + Analysis model
└── src/server/routers/
    └── analysis.ts                   # New router

arxiv-curator-collections/            # Stream B worktree
├── app/collections/                  # New feature UI
├── prisma/schema.prisma              # + Notebook models
└── src/server/routers/
    └── notebooks.ts                  # New router

arxiv-curator-trends/                 # Stream C worktree
├── app/trends/                       # New feature UI
├── prisma/schema.prisma              # + TopicVelocity model
└── src/server/routers/
    └── trends.ts                     # New router

arxiv-curator-summaries/              # Stream D worktree (merged Week 4)
├── prisma/schema.prisma              # + Summary model
└── src/server/routers/
    └── summaries.ts                  # New router
```

Each worktree is isolated, allowing independent development without conflicts.

---

**End of Implementation Roadmap**
