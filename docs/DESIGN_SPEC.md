# ArXiv Curator - Design & Implementation Specification

**Version:** 1.0 (Final)  
**Last Updated:** October 18, 2025  
**Author:** Brandon Young
**License:** Private/Personal Use

---

## Executive Summary

**ArXiv Curator** is a personal AI-powered research paper curation platform designed to reduce the cognitive burden of staying current with AI research. The system transforms an overwhelming daily feed (hundreds to thousands of papers) into a curated, actionable digest of 10-20 high-signal papers, with on-demand deep analysis capabilities.

**Core Value Proposition:**
- **Massive cognitive load reduction**: From 2+ hours/day manual scanning → 10-15 minutes curated review
- **Aggressive personalization**: Based on explicit rules + learned preferences
- **Cost-conscious**: ≤ $5/day target with local-first LLM/embedding options
- **Transparent**: Always explain "why you're seeing this"
- **On-demand depth**: Three-tier analysis (Fast/Compare/Deep) when needed
- **Collection synthesis**: Organize and synthesize papers into actionable insights

---

## Table of Contents

1. [Objectives & Non-Goals](#1-objectives--non-goals)
2. [Architecture Philosophy](#2-architecture-philosophy)
3. [Source Strategy & Category Configuration](#3-source-strategy--category-configuration)
4. [Personalization Model](#4-personalization-model)
5. [Scoring & Ranking System](#5-scoring--ranking-system)
6. [System Architecture](#6-system-architecture)
7. [Data Model](#7-data-model)
8. [Multi-Agent Pipeline](#8-multi-agent-pipeline)
9. [User Interface Design](#9-user-interface-design)
10. [API Specification](#10-api-specification)
11. [Local-First Implementation](#11-local-first-implementation)
12. [Cost Analysis & Optimization](#12-cost-analysis--optimization)
13. [Implementation Roadmap](#13-implementation-roadmap)
14. [Deployment](#14-deployment)
15. [Success Metrics](#15-success-metrics)
16. [Risk Mitigation](#16-risk-mitigation)
17. [Appendix](#17-appendix)

---

## 1. Objectives & Non-Goals

### 1.1 Core Objectives

**Primary Goal**: Reduce cognitive load on daily arXiv scanning by surfacing a small, high-signal set of papers matched to your interests.

**Specific Objectives:**
1. **Aggressive Personalization**: Learn and apply your preferences with transparent "why-shown" feature attributions
2. **Trend Awareness**: Track research velocity across multiple time windows (Today/7d/30d/180d/365d/Quarter)
3. **On-Demand Deep Analysis**: Three-tier critique system (Fast/Compare/Deep) available when needed
4. **Collection Management**: Organize papers into themed notebooks with automatic synthesis
5. **Cost Consciousness**: Maintain ≤$5/day operating cost with local-first LLM/embedding options
6. **Pull-Based Workflow**: Generate digests on-demand (after 6am) rather than automatic push
7. **Export Capabilities**: Markdown, PDF, and NotebookLM integration

### 1.2 Non-Goals (v1)

- Multi-user teams & collaboration features
- Inline PDF viewer (use external viewer)
- Chat sidecar interface (deferred to v2)
- Sophisticated collaborative authoring
- Real-time notifications (off by default, optional later)
- Mobile-first design (responsive web is sufficient)

### 1.3 Success Criteria

- **Time saved**: 2+ hours/day → 10-15 minutes/day
- **Signal quality**: >80% of "Must Read" papers rated useful
- **False positive rate**: <20% immediate dismissals
- **Cost target**: ≤$5/day with aggressive local-first routing
- **Learning speed**: System converges on preferences within 2 weeks

---

## 2. Architecture Philosophy

### 2.1 Design Principles

**Deterministic & Explainable**
- Every recommendation includes feature attributions
- Scoring is transparent and inspectable
- No "black box" ranking

**Fast Triage, Deep on Demand**
- Abstract-only processing (Tier 0) for all papers
- PDF-based analysis (Tier 1) only when explicitly requested
- Minimize latency for daily digest generation

**Local-First, Cloud-Optional**
- Support local embeddings (ollama/transformers.js)
- Support local LLMs (ollama) for summaries and fast critiques
- Fall back to commercial APIs (Gemini, OpenAI) for high-fidelity work
- User-configurable routing per operation

**Cost-Conscious by Default**
- Tier 0 operations use cheap/free local models
- PDF downloads and deep analysis only on explicit user request
- Aggressive caching of expensive operations

**Single-User, Multi-Tenancy Ready**
- Built for personal use first
- Architecture supports adding multi-tenancy later
- Configurable auth providers (NextAuth.js)

### 2.2 Technology Stack

**Frontend**
- Next.js 14+ (App Router)
- TypeScript (strict mode)
- Tailwind CSS + shadcn/ui
- Lucide React icons
- React Query (TanStack Query)
- Zustand (lightweight state)

**Backend**
- Node.js 20+ (TypeScript)
- Next.js API Routes + tRPC
- NextAuth.js (auth)
- pg-boss (job queue - PostgreSQL-backed)
- LangGraph.js (agent orchestration)

**Data Layer**
- PostgreSQL 16+ with pgvector
- Prisma ORM
- S3-compatible object storage (MinIO)
- No Redis required (pg-boss uses Postgres)

**AI/ML Stack**
- **Embeddings**: 
  - Local: all-MiniLM-L6-v2 via transformers.js or ollama
  - Cloud: text-embedding-004 (Google) or text-embedding-3-small (OpenAI)
- **LLMs**:
  - Local: llama3.2, mistral, qwen2.5 via ollama
  - Cloud: Gemini 2.0 Flash (speed), Gemini 2.0 Pro (quality)
- **Pluggable interface**: Easy to swap providers

**Infrastructure**
- Docker + Docker Compose (dev & single-node production)
- Kubernetes manifests (multi-node production)
- OpenTelemetry + Prometheus + Grafana (observability)

---

## 3. Source Strategy & Category Configuration

### 3.1 Configurable Sources (Settings → Sources)

**Default Configuration:**
- **arXiv**: ON (primary source)
- **OpenAlex**: OFF (opt-in, citation metadata enrichment)
- **Semantic Scholar**: OFF (opt-in, citation graph)
- **GitHub**: OFF (opt-in, link papers to repos)
- **Papers with Code**: OFF (opt-in, benchmark tracking)

**Implementation:**
- Provider registry pattern with per-provider toggles
- Store credentials server-side (env vars or encrypted DB)
- Each provider has adapter interface: `fetch()`, `parse()`, `enrich()`

### 3.2 arXiv Category Management

**Programmatic Category Fetching:**
```typescript
// Fetch categories via OAI-PMH ListSets
// Filter to cs.* sets only
// Cache locally with periodic refresh

interface ArxivCategory {
  id: string;           // e.g., "cs.AI"
  name: string;         // e.g., "Artificial Intelligence"
  description: string;  // Full description from taxonomy
}

// API endpoint
GET /api/taxonomy → ArxivCategory[]
```

**OAI-PMH ListSets Request:**
```
http://export.arxiv.org/oai2?verb=ListSets
```

**Category Selection UI:**
- Multi-select checkboxes
- Preselect: `cs.AI`, `cs.CL`, `cs.LG`, `cs.IR`, `cs.MA`
- Allow regex patterns (e.g., `cs.*` to include all CS)
- Per-user configuration stored in `user_profile`

### 3.3 Ingestion Strategy

**arXiv Ingestion Methods:**
1. **Recent papers**: Atom/RSS feed (last 24-48 hours)
2. **Historical**: OAI-PMH with date ranges
3. **Specific paper**: Direct arXiv ID fetch

**Rate Limiting:**
- **Global limit**: ≤1 request per 3 seconds (arXiv requirement)
- **Implementation**: `bottleneck` library with `minTime: 3000ms`
- **Single connection**: One ingest worker to avoid parallel rate limit violations
- **Exponential backoff**: On 429/503 errors

**Version Supersedence:**
```typescript
// When new version detected (e.g., v2 supersedes v1):
// 1. Purge old PDF/JSON objects from S3
// 2. Update DB row (UPSERT on arxiv_id)
// 3. Re-run minimal enrichment (Tier 0 only)
// 4. Preserve user actions (saves, feedback) across versions

UNIQUE INDEX papers(arxiv_id)
```

---

## 4. Personalization Model

### 4.1 Hybrid Interest Model

**Vector Profile:**
- Mean embedding of Saved/Liked papers
- Subtract mean of Hidden/"Less like this" papers (contrastive learning)
- Weighted by action type: Save (1.0), Open+Dwell (0.5), Dismiss (-0.8), Hide (-1.0)
- Updated online after each feedback action

**Explicit Rules (First-Class UI):**

**Strong Includes** (always prioritize):
- AI agents & agentic systems
- Retrieval-augmented generation (RAG)
- Multimodal language models
- Model architectures (transformers, attention mechanisms)
- Agentic application design & workflows
- Surveys covering any of the above

**Strong Excludes** (filter out):
- Mathematical proofs (unless tied to practical method)
- Heavily theoretical works with low practical applicability
- Training technique improvements (RL, optimizer papers) UNLESS tied to agentic usage
- Papers focused solely on model internals (e.g., "improving training convergence via novel loss function")

**Lab Boosts** (+0.02 to +0.05 score):
- OpenAI
- Google DeepMind
- Meta AI (FAIR)
- Anthropic
- AI2 (Allen Institute)
- HuggingFace
- Cohere
- User-editable list in settings

**Math Depth:**
- **Soft penalty** (not hard filter)
- User-configurable slider (default: 0.7 tolerance)
- Papers with math_depth > threshold get score penalty (not elimination)
- Deprioritize heavy derivations, keep practical results

### 4.2 Exploration

**Adjustable Exploration Rate:**
- Default: **15%** of daily recommendations
- Range: 0-30% (slider in settings)
- "Spicy items" clearly labeled in UI with rationale

**Exploration Strategy:**
- Surface borderline papers (score 0.4-0.6)
- Include papers from excluded topics if showing sudden velocity
- Test boundaries of learned preferences
- Explicitly mark as "Exploration Pick" with explanation

### 4.3 Why-Shown Transparency

**Feature Attribution Display:**
Every recommended paper shows:
```typescript
interface WhyShown {
  profile_match: number;      // Cosine similarity: 0.73
  novelty_signal: string;     // "High" | "Medium" | "Low"
  velocity_boost: number;     // +0.12 (topic trending)
  evidence_quality: string;   // "Strong baselines, code available"
  lab_boost: number;          // +0.03 (DeepMind)
  math_penalty: number;       // -0.05 (heavy math)
  exploration: boolean;       // true if exploration pick
  matched_keywords: string[]; // ["agents", "planning", "tool use"]
  score_breakdown: string;    // "0.28×0.72 + 0.30×0.85 + ... = 0.87"
}
```

**UI Presentation:**
```
💡 Why you're seeing this:
• Matches your interest in agentic systems (profile: 0.73)
• Novel hierarchical planning approach (+novelty)
• Strong evidence: benchmarks on 3 tasks, code released
• Topic trending: +42% mentions this week
• From DeepMind (+lab boost)
```

---

## 5. Scoring & Ranking System

### 5.1 Signal Definitions

**N (Novelty): 0-1**
- Embedding distance from 180-day rolling topic centroid
- New technique detection (keyword grammar + method phrase outliers)
- Local Outlier Factor (LOF) on recent papers
- Formula: `0.4 × centroid_distance + 0.3 × novel_keywords + 0.3 × LOF`

**E (Evidence Quality): 0-1**
- Presence indicators from abstract:
  - Strong baselines mentioned (0.3)
  - Ablation study mentioned (0.2)
  - Code/data available (0.2)
  - Multiple evaluation tasks (0.15)
  - Real-world dataset (not toy) (0.15)
- Enhanced in Tier 1 (PDF analysis) for Critique B/C

**V (Velocity): 0-1**
- Topic EMA slope (exponential moving average of paper counts)
- Short-term keyword bursts (last 7 days vs. prior 30)
- Formula: `0.6 × EMA_slope + 0.4 × keyword_burst`

**P (Personal Fit): 0-1**
- Cosine similarity: `cosine(paper_embedding, user_profile_vector)`
- Rule bonuses: +0.1 per strong include keyword match
- Rule penalties: -1.0 for strong exclude matches (near-elimination)

**L (Lab Prior): 0-0.05**
- Small boost for preferred research labs
- User-configurable list
- Intentionally small to avoid elitism

**M (Math Penalty): 0-0.3**
- Soft penalty based on math_depth score
- Math depth estimation (abstract + title):
  - LaTeX command density
  - Presence of keywords: theorem, proof, convergence, lemma, corollary
  - Formula: `0.6 × latex_density + 0.4 × keyword_score`
- Applied as: `penalty = math_depth × user_math_sensitivity`

### 5.2 Score Formula

**Initial Weights** (tuned for practical material gains):
```
final_score = 0.28×N + 0.30×E + 0.16×V + 0.22×P + 0.04×L - M
```

**Rationale:**
- **E (0.30)**: Highest weight - prioritize well-evidenced work
- **N (0.28)**: Second highest - value novel contributions
- **P (0.22)**: Strong personal fit important but not dominant
- **V (0.16)**: Trending topics get moderate boost
- **L (0.04)**: Lab prior is weak signal
- **M (0-0.3)**: Math penalty variable by user preference

**Material Improvement Filter:**
- Papers claiming <5% improvement over baseline: **score × 0.7**
- Exception: If method is generally useful (new agentic pattern, novel architecture)
- Detected via LLM analysis of abstract claims

### 5.3 Adaptive Learning

**Contextual Bandit:**
- Fast re-weighting of scoring parameters based on user feedback
- Actions: save (+1.0), open+dwell (+0.5), dismiss (-0.3), hide (-0.8), "less like this" (-1.0)
- Update rule: Thompson Sampling or UCB (Upper Confidence Bound)
- Convergence target: 2 weeks of feedback

**Profile Vector Update:**
```typescript
// After each feedback action
function updateUserProfile(
  current_vector: number[],
  paper_embedding: number[],
  feedback_weight: number // +1.0 for save, -1.0 for hide
) {
  // Exponential moving average
  const alpha = 0.1;
  return current_vector.map((v, i) => 
    (1 - alpha) * v + alpha * feedback_weight * paper_embedding[i]
  );
}
```

### 5.4 Noise Cap & Targets

**Daily Digest Targets:**
- **Today**: 10-20 papers (configurable)
- **7 days**: 20-50 papers (configurable)

**Noise Cap:**
- Maximum cards shown per day: user-configurable (default: 25)
- Prevents overwhelming on high-volume days
- Carries over: if quota unmet, accumulates for next day

---

## 6. System Architecture

### 6.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js Application                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   UI (React) │  │  API (tRPC)  │  │  Auth        │  │
│  │   Components │  │  Routes      │  │  (NextAuth)  │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                         ↕ HTTP/WebSocket
┌─────────────────────────────────────────────────────────┐
│                   PostgreSQL + pgvector                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Tables     │  │  pg-boss     │  │  Vector      │  │
│  │   (Prisma)   │  │  (Jobs)      │  │  Search      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────────┐
│                   Worker Process (Node)                 │
│                   LangGraph.js Orchestration            │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Scout → Enrich → Classify → Rank → Recommend   │   │
│  │              ↓                                    │   │
│  │        Analyst (on-demand)                       │   │
│  │        Synthesizer (on-demand)                   │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────────┐
│              S3-Compatible Storage (MinIO)              │
│       PDFs / JSON Artifacts / Exported Documents        │
└─────────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────────┐
│                   AI Services (Pluggable)               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Local       │  │  Gemini API  │  │  OpenAI API  │  │
│  │  (ollama)    │  │              │  │              │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### 6.2 Component Responsibilities

**Next.js Application**
- Serve UI (React components)
- tRPC API endpoints for client-server communication
- NextAuth.js authentication
- Server-side rendering for SEO/performance

**PostgreSQL**
- Primary data store (papers, user profiles, scores, collections)
- pgvector for embeddings and similarity search
- pg-boss for job queue and scheduling

**Worker Process**
- Separate Node.js process running LangGraph workflows
- Consumes jobs from pg-boss queue
- Executes agent pipelines (Scout, Enrich, Classify, etc.)
- On-demand processing for Analyst and Synthesizer

**MinIO (S3-Compatible)**
- Store PDF files (not in database)
- Store JSON artifacts (raw arXiv metadata)
- Store exported documents (Markdown, PDF)

**AI Services**
- Pluggable interface for embeddings and LLM calls
- Route to local (ollama) or cloud (Gemini/OpenAI) based on config
- Fallback chain: local → cloud if local fails

### 6.3 Job Queue (pg-boss)

**Why pg-boss over BullMQ:**
- No Redis dependency (uses Postgres)
- Simpler infrastructure (one less service)
- ACID guarantees from Postgres
- Good enough performance for single-user workload

**Job Types:**
```typescript
enum JobType {
  INGEST_ARXIV = "ingest:arxiv",
  ENRICH_PAPER = "enrich:paper",
  CLASSIFY_PAPER = "classify:paper",
  RANK_PAPERS = "rank:papers",
  GENERATE_DIGEST = "generate:digest",
  CRITIQUE_PAPER = "critique:paper", // A, B, or C
  SYNTHESIZE_COLLECTION = "synthesize:collection",
  COMPUTE_TRENDS = "compute:trends",
}
```

**Scheduling:**
```typescript
// Daily digest generation (cron-like)
await boss.schedule(
  "generate-digest",
  "0 6 * * *", // After 6am daily
  { window: "today" }
);

// Periodic ingestion
await boss.schedule(
  "ingest-arxiv",
  "0 */6 * * *", // Every 6 hours
  { categories: user.arxiv_categories }
);
```

---

## 7. Data Model

### 7.1 Prisma Schema

```prisma
// schema.prisma

generator client {
  provider = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  extensions = [pgvector(map: "vector")]
}

model User {
  id            String        @id @default(cuid())
  email         String        @unique
  name          String?
  createdAt     DateTime      @default(now())
  updatedAt     DateTime      @updatedAt
  
  profile       UserProfile?
  feedback      Feedback[]
  notebooks     Notebook[]
  briefings     Briefing[]
  analyses      Analysis[]
}

model UserProfile {
  userId           String    @id
  user             User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Explicit rules
  includeTopics    String[]  @default([])
  excludeTopics    String[]  @default([])
  includeKeywords  String[]  @default([])
  excludeKeywords  String[]  @default([])
  labBoosts        String[]  @default([])
  
  // Vector profile (learned)
  interestVector   Unsupported("vector(768)")? // pgvector type
  
  // Configuration
  mathDepthMax     Float     @default(0.7)
  explorationRate  Float     @default(0.15)
  noiseCap         Int       @default(25)
  targetToday      Int       @default(15)
  target7d         Int       @default(35)
  
  // arXiv categories
  arxivCategories  String[]  @default(["cs.AI", "cs.CL", "cs.LG", "cs.IR", "cs.MA"])
  
  // Source toggles
  sourcesEnabled   Json      @default("{\"arxiv\": true, \"openAlex\": false, \"semanticScholar\": false, \"github\": false}")
  
  // Local vs Cloud routing
  useLocalEmbeddings Boolean @default(true)
  useLocalLLM        Boolean @default(true)
  
  updatedAt        DateTime  @updatedAt
}

model Paper {
  id              String    @id @default(cuid())
  arxivId         String    @unique
  version         Int       @default(1)
  
  title           String
  authors         Json      // Author[]
  abstract        String
  categories      String[]
  primaryCategory String?
  
  pdfUrl          String?
  codeUrl         String?
  pubDate         DateTime?
  updatedDate     DateTime?
  
  rawMetadata     Json      // Original arXiv XML/JSON
  
  status          String    @default("new") // new | enriched | ranked
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  enriched        PaperEnriched?
  scores          Score[]
  summaries       Summary[]
  analyses        Analysis[]
  feedback        Feedback[]
  notebookItems   NotebookItem[]
  
  @@index([arxivId])
  @@index([pubDate(sort: Desc)])
  @@index([status])
}

model PaperEnriched {
  paperId         String    @id
  paper           Paper     @relation(fields: [paperId], references: [id], onDelete: Cascade)
  
  topics          String[]  // Multi-label: agents, RAG, multimodal, etc.
  facets          String[]  // planning, memory, evaluation, safety, etc.
  
  embedding       Unsupported("vector(768)")? // Paper embedding
  
  mathDepth       Float     @default(0.0)
  hasCode         Boolean   @default(false)
  hasData         Boolean   @default(false)
  
  // Evidence signals
  hasBaselines    Boolean   @default(false)
  hasAblations    Boolean   @default(false)
  hasMultipleEvals Boolean  @default(false)
  
  enrichedAt      DateTime  @default(now())
  
  @@index([paperId])
}

model Score {
  id              String    @id @default(cuid())
  paperId         String
  paper           Paper     @relation(fields: [paperId], references: [id], onDelete: Cascade)
  
  novelty         Float
  evidence        Float
  velocity        Float
  personalFit     Float
  labPrior        Float
  mathPenalty     Float
  finalScore      Float
  
  // Feature attributions for transparency
  whyShown        Json?     // WhyShown object
  
  scoredAt        DateTime  @default(now())
  
  @@index([paperId])
  @@index([finalScore(sort: Desc)])
}

model Feedback {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  paperId         String
  paper           Paper     @relation(fields: [paperId], references: [id], onDelete: Cascade)
  
  action          String    // save | hide | open | dwell | critique | less_like_this | thumbs_up | thumbs_down
  weight          Float     @default(1.0)
  
  context         Json?     // Additional context (e.g., which briefing, dwell time)
  
  createdAt       DateTime  @default(now())
  
  @@index([userId, paperId])
  @@index([createdAt])
}

model Summary {
  id              String    @id @default(cuid())
  paperId         String
  paper           Paper     @relation(fields: [paperId], references: [id], onDelete: Cascade)
  
  summaryType     String    // skim | medium | deep
  
  whatsNew        String?   // 1-2 sentences
  keyPoints       String[]  // Bullet points
  markdownContent String    @db.Text
  
  generatedAt     DateTime  @default(now())
  
  @@index([paperId, summaryType])
}

model Analysis {
  id              String    @id @default(cuid())
  paperId         String
  paper           Paper     @relation(fields: [paperId], references: [id], onDelete: Cascade)
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  depth           String    // A (fast) | B (compare) | C (deep)
  
  claimsEvidence  Json?     // Claim-evidence table
  limitations     String[]
  neighborComparison Json?   // For depth B
  verdict         String?   // promising | solid_incremental | over_claimed
  confidence      String?   // high | medium | low
  
  markdownContent String    @db.Text
  
  generatedAt     DateTime  @default(now())
  
  @@index([paperId, userId])
}

model Briefing {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  window          String    // today | 7d | 30d | 180d | 365d | quarter
  briefingDate    DateTime
  
  topPaperIds     String[]  // Array of paper IDs
  trendSummary    Json?
  
  createdAt       DateTime  @default(now())
  
  @@index([userId, briefingDate(sort: Desc)])
}

model Notebook {
  id              String    @id @default(cuid())
  userId          String
  user            User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  title           String
  description     String?
  purpose         String?   // reference | synthesis | tracking
  
  isContinuous    Boolean   @default(false) // Auto-synthesize on add?
  
  items           NotebookItem[]
  synthesis       NotebookSynthesis?
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@index([userId])
}

model NotebookItem {
  id              String    @id @default(cuid())
  notebookId      String
  notebook        Notebook  @relation(fields: [notebookId], references: [id], onDelete: Cascade)
  paperId         String
  paper           Paper     @relation(fields: [paperId], references: [id], onDelete: Cascade)
  
  userNotes       String?   @db.Text
  tags            String[]
  
  addedAt         DateTime  @default(now())
  
  @@index([notebookId])
  @@unique([notebookId, paperId])
}

model NotebookSynthesis {
  id              String    @id @default(cuid())
  notebookId      String    @unique
  notebook        Notebook  @relation(fields: [notebookId], references: [id], onDelete: Cascade)
  
  markdownContent String    @db.Text
  
  generatedAt     DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}

model TopicVelocity {
  id              String    @id @default(cuid())
  topic           String
  date            DateTime
  
  count           Int       @default(0)
  velocity        Float     @default(0.0) // EMA slope
  growthRate      Float?    // Week-over-week %
  
  @@unique([topic, date])
  @@index([topic, date(sort: Desc)])
}

model ArxivCategory {
  id              String    @id // e.g., "cs.AI"
  name            String    // e.g., "Artificial Intelligence"
  description     String?   @db.Text
  
  updatedAt       DateTime  @updatedAt
  
  @@unique([id])
}
```

### 7.2 Indexes & Performance

**Critical Indexes:**
```sql
-- Vector similarity search (pgvector)
CREATE INDEX papers_enriched_embedding_idx ON "PaperEnriched" 
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX user_profiles_interest_vector_idx ON "UserProfile" 
USING ivfflat ("interestVector" vector_cosine_ops) WITH (lists = 10);

-- Temporal queries
CREATE INDEX papers_pubDate_desc_idx ON "Paper"(pubDate DESC);
CREATE INDEX briefings_user_date_idx ON "Briefing"(userId, briefingDate DESC);
CREATE INDEX feedback_created_idx ON "Feedback"(createdAt DESC);

-- Lookup optimization
CREATE INDEX scores_final_desc_idx ON "Score"(finalScore DESC);
CREATE INDEX papers_status_idx ON "Paper"(status);
```

---

## 8. Multi-Agent Pipeline

### 8.1 Agent Overview

```
Scout → Enricher → Classifier → Ranker → Recommender
                                              ↓
                                      [Digest Generated]
                                              ↓
                                    [User Reviews Papers]
                                              ↓
                               ┌──────────────┴──────────────┐
                               ↓                             ↓
                          Analyst                      Synthesizer
                       (on-demand A/B/C)           (on-demand collection)
```

### 8.2 Scout Agent

**Trigger**: 
- Scheduled: Every 6 hours (pg-boss cron)
- Manual: "Run Now" button in settings

**Responsibilities:**
1. Fetch arXiv category list via OAI-PMH `ListSets`
2. Ingest new papers via Atom feed (recent) or OAI-PMH (historical)
3. Detect paper version updates
4. Handle supersedence (purge old artifacts, update DB)
5. Store raw metadata

**Implementation:**
```typescript
// scout-agent.ts

import { XMLParser } from "fast-xml-parser";
import fetch from "node-fetch";
import Bottleneck from "bottleneck";

// Global rate limiter: 1 request per 3 seconds
const arxivLimiter = new Bottleneck({
  minTime: 3000, // 3 seconds between requests
  maxConcurrent: 1,
});

async function fetchArxivCategories(): Promise<ArxivCategory[]> {
  const url = "http://export.arxiv.org/oai2?verb=ListSets";
  const response = await arxivLimiter.schedule(() => fetch(url));
  const xml = await response.text();
  
  const parser = new XMLParser();
  const parsed = parser.parse(xml);
  
  // Extract sets, filter to cs.*
  const sets = parsed.OAI-PMH.ListSets.set;
  return sets
    .filter((s: any) => s.setSpec.startsWith("cs."))
    .map((s: any) => ({
      id: s.setSpec,
      name: s.setName,
      description: "", // Could fetch from taxonomy page
    }));
}

async function ingestRecentPapers(
  categories: string[]
): Promise<Paper[]> {
  const papers: Paper[] = [];
  
  for (const category of categories) {
    // Fetch Atom feed for category
    const url = `http://export.arxiv.org/api/query?search_query=cat:${category}&start=0&max_results=100&sortBy=submittedDate&sortOrder=descending`;
    
    const response = await arxivLimiter.schedule(() => fetch(url));
    const xml = await response.text();
    
    // Parse Atom XML
    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(xml);
    
    const entries = parsed.feed.entry || [];
    
    for (const entry of Array.isArray(entries) ? entries : [entries]) {
      const arxivId = extractArxivId(entry.id);
      const version = extractVersion(arxivId);
      
      // Check if exists in DB
      const existing = await prisma.paper.findUnique({
        where: { arxivId: arxivId.split("v")[0] }, // Base ID
      });
      
      if (existing && existing.version >= version) {
        continue; // Skip older or same version
      }
      
      if (existing) {
        // Supersedence: purge old artifacts
        await purgeArtifacts(existing.id);
      }
      
      // Parse paper
      const paper = {
        arxivId: arxivId.split("v")[0],
        version,
        title: entry.title,
        authors: parseAuthors(entry.author),
        abstract: entry.summary,
        categories: parseCategories(entry.category),
        primaryCategory: entry.category[0]["@_term"],
        pdfUrl: entry.link.find((l: any) => l["@_title"] === "pdf")?.["@_href"],
        pubDate: new Date(entry.published),
        updatedDate: new Date(entry.updated),
        rawMetadata: entry,
        status: "new",
      };
      
      papers.push(paper);
    }
  }
  
  return papers;
}

async function purgeArtifacts(paperId: string) {
  // Delete from S3
  await s3.deleteObject({
    Bucket: "arxiv-papers",
    Key: `pdfs/${paperId}.pdf`,
  });
  await s3.deleteObject({
    Bucket: "arxiv-papers",
    Key: `metadata/${paperId}.json`,
  });
}
```

**Output**: 
- New/updated papers in `papers` table with status `new`
- Trigger next stage: Enricher

---

### 8.3 Enricher Agent

**Trigger**: Papers with status `new`

**Responsibilities:**
1. Generate embeddings (local or cloud)
2. Normalize title/abstract
3. Extract initial keywords
4. Estimate math depth
5. Detect code/data availability signals

**Tier 0 Processing** (Abstract-only, no PDF):
```typescript
// enricher-agent.ts

interface EnrichmentConfig {
  useLocalEmbeddings: boolean;
  embeddingModel: string; // "local" | "text-embedding-004"
}

async function enrichPaper(
  paper: Paper,
  config: EnrichmentConfig
): Promise<PaperEnriched> {
  
  // 1. Generate embedding
  const embedding = await generateEmbedding(
    `${paper.title}\n\n${paper.abstract}`,
    config
  );
  
  // 2. Estimate math depth
  const mathDepth = estimateMathDepth(paper.title, paper.abstract);
  
  // 3. Extract topics/facets (keyword-based + zero-shot)
  const { topics, facets } = await classifyPaper(paper);
  
  // 4. Detect evidence signals
  const hasBaselines = /baseline|compared to/i.test(paper.abstract);
  const hasAblations = /ablation|ablated/i.test(paper.abstract);
  const hasMultipleEvals = (paper.abstract.match(/dataset|benchmark/gi) || []).length >= 2;
  const hasCode = /github|code available|open.source/i.test(paper.abstract);
  const hasData = /dataset|data available/i.test(paper.abstract);
  
  return {
    paperId: paper.id,
    topics,
    facets,
    embedding,
    mathDepth,
    hasCode,
    hasData,
    hasBaselines,
    hasAblations,
    hasMultipleEvals,
    enrichedAt: new Date(),
  };
}

function estimateMathDepth(title: string, abstract: string): number {
  const text = `${title} ${abstract}`.toLowerCase();
  
  // LaTeX command density
  const latexCommands = text.match(/\\[a-z]+/g) || [];
  const latexDensity = latexCommands.length / text.length;
  
  // Theory keywords
  const theoryKeywords = [
    "theorem", "proof", "lemma", "corollary", "convergence",
    "optimization", "gradient descent", "loss function", "regularization"
  ];
  const keywordCount = theoryKeywords.filter(k => text.includes(k)).length;
  const keywordScore = keywordCount / theoryKeywords.length;
  
  // Combine
  return Math.min(1.0, 0.6 * latexDensity * 100 + 0.4 * keywordScore);
}

async function generateEmbedding(
  text: string,
  config: EnrichmentConfig
): Promise<number[]> {
  if (config.useLocalEmbeddings) {
    // Use local model via ollama or transformers.js
    return await generateLocalEmbedding(text);
  } else {
    // Use cloud API
    return await generateCloudEmbedding(text, config.embeddingModel);
  }
}
```

**Output**: 
- `PaperEnriched` record with embeddings and metadata
- Update paper status to `enriched`
- Trigger next stage: Classifier

---

### 8.4 Classifier Agent

**Trigger**: Papers with status `enriched`

**Responsibilities:**
1. Multi-label topic classification
2. Facet tagging
3. Author/lab detection

**Implementation:**
```typescript
// classifier-agent.ts

async function classifyPaper(paper: Paper): Promise<{
  topics: string[];
  facets: string[];
}> {
  
  // Zero-shot classification using local or cloud LLM
  const prompt = `
Classify this research paper into relevant topics and facets.

Title: ${paper.title}
Abstract: ${paper.abstract}

Topics (select all that apply):
- agents: Papers about AI agents or agentic systems
- rag: Retrieval-augmented generation
- multimodal: Multimodal language models (vision, audio, etc.)
- architectures: Novel model architectures
- surveys: Survey or review papers
- applications: Real-world applications

Facets (select all that apply):
- planning: Planning and reasoning
- memory: Memory systems
- tool_use: Tool use and function calling
- evaluation: Evaluation methods or benchmarks
- safety: AI safety and alignment
- protocols: Interaction protocols

Output JSON:
{"topics": ["...", "..."], "facets": ["...", "..."]}
`;

  const response = await callLLM(prompt, { format: "json" });
  return JSON.parse(response);
}
```

**Output**: 
- Updated `PaperEnriched` with topics and facets
- Trigger next stage: Ranker

---

### 8.5 Ranker Agent

**Trigger**: Enriched papers ready for scoring

**Responsibilities:**
1. Compute signal scores (N, E, V, P, L, M)
2. Apply scoring formula
3. Store scores with feature attributions

**Implementation:**
```typescript
// ranker-agent.ts

async function scorePaper(
  paper: Paper,
  enriched: PaperEnriched,
  userProfile: UserProfile
): Promise<Score> {
  
  // Compute signals
  const novelty = await computeNovelty(enriched);
  const evidence = computeEvidence(enriched);
  const velocity = await computeVelocity(enriched.topics);
  const personalFit = await computePersonalFit(enriched, userProfile);
  const labPrior = computeLabPrior(paper.authors, userProfile.labBoosts);
  const mathPenalty = enriched.mathDepth * (1.0 - userProfile.mathDepthMax);
  
  // Apply formula
  const weights = { N: 0.28, E: 0.30, V: 0.16, P: 0.22, L: 0.04 };
  const finalScore = 
    weights.N * novelty +
    weights.E * evidence +
    weights.V * velocity +
    weights.P * personalFit +
    weights.L * labPrior -
    mathPenalty;
  
  // Material improvement filter
  const hasLowGain = await detectLowGain(paper.abstract);
  const adjustedScore = hasLowGain ? finalScore * 0.7 : finalScore;
  
  // Build feature attributions
  const whyShown = {
    profile_match: personalFit,
    novelty_signal: novelty > 0.7 ? "High" : novelty > 0.4 ? "Medium" : "Low",
    velocity_boost: velocity,
    evidence_quality: describeEvidence(enriched),
    lab_boost: labPrior,
    math_penalty: mathPenalty,
    exploration: false,
    matched_keywords: extractMatchedKeywords(enriched, userProfile),
    score_breakdown: `${weights.N}×${novelty.toFixed(2)} + ${weights.E}×${evidence.toFixed(2)} + ... = ${adjustedScore.toFixed(2)}`,
  };
  
  return {
    paperId: paper.id,
    novelty,
    evidence,
    velocity,
    personalFit,
    labPrior,
    mathPenalty,
    finalScore: adjustedScore,
    whyShown,
    scoredAt: new Date(),
  };
}

async function computeNovelty(enriched: PaperEnriched): Promise<number> {
  // 1. Distance from topic centroid (last 180 days)
  const topicCentroid = await getTopicCentroid(enriched.topics, 180);
  const centroidDistance = cosineSimilarity(enriched.embedding, topicCentroid);
  
  // 2. Local Outlier Factor (LOF) - compare to recent papers
  const recentPapers = await getRecentPaperEmbeddings(30);
  const lofScore = computeLOF(enriched.embedding, recentPapers);
  
  // 3. Novel keyword detection
  const novelKeywords = await detectNovelKeywords(enriched.topics);
  
  // Combine
  return 0.4 * centroidDistance + 0.3 * lofScore + 0.3 * novelKeywords;
}

function computeEvidence(enriched: PaperEnriched): number {
  let score = 0;
  if (enriched.hasBaselines) score += 0.3;
  if (enriched.hasAblations) score += 0.2;
  if (enriched.hasCode) score += 0.2;
  if (enriched.hasMultipleEvals) score += 0.15;
  if (enriched.hasData) score += 0.15;
  return score;
}

async function computePersonalFit(
  enriched: PaperEnriched,
  profile: UserProfile
): Promise<number> {
  // Cosine similarity with user's interest vector
  const cosineSim = cosineSimilarity(
    enriched.embedding,
    profile.interestVector
  );
  
  // Rule bonuses
  let ruleBonus = 0;
  for (const topic of enriched.topics) {
    if (profile.includeTopics.includes(topic)) {
      ruleBonus += 0.1;
    }
    if (profile.excludeTopics.includes(topic)) {
      return 0; // Hard filter
    }
  }
  
  return Math.min(1.0, cosineSim + ruleBonus);
}
```

**Output**: 
- `Score` record with all signals and final score
- Trigger next stage: Recommender

---

### 8.6 Recommender Agent

**Trigger**: 
- Scheduled: After 6am daily (or user-configured time)
- Manual: "Run Now" button

**Responsibilities:**
1. Apply user's noise cap and digest targets
2. Implement exploration strategy
3. Generate briefing with "why shown" explanations
4. Trigger auto-analyses for top papers

**Implementation:**
```typescript
// recommender-agent.ts

async function generateDigest(
  userId: string,
  window: "today" | "7d"
): Promise<Briefing> {
  
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
  });
  
  const target = window === "today" ? profile.targetToday : profile.target7d;
  const noiseCap = profile.noiseCap;
  
  // Get scored papers within window
  const windowDays = window === "today" ? 1 : 7;
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - windowDays);
  
  const scoredPapers = await prisma.score.findMany({
    where: {
      paper: {
        pubDate: { gte: cutoffDate },
      },
      finalScore: { gt: 0.3 }, // Minimum threshold
    },
    include: {
      paper: {
        include: {
          enriched: true,
        },
      },
    },
    orderBy: { finalScore: "desc" },
    take: Math.min(noiseCap * 2, 100), // Fetch more than needed
  });
  
  // Apply exploration strategy
  const explorationCount = Math.ceil(target * profile.explorationRate);
  const regularCount = target - explorationCount;
  
  // Top regular picks
  const regularPicks = scoredPapers.slice(0, regularCount);
  
  // Exploration picks (borderline papers, 0.4-0.6 score)
  const explorationCandidates = scoredPapers.filter(
    s => s.finalScore >= 0.4 && s.finalScore <= 0.6
  );
  const explorationPicks = sample(explorationCandidates, explorationCount);
  
  // Mark exploration picks
  for (const pick of explorationPicks) {
    pick.whyShown.exploration = true;
  }
  
  // Combine and limit to target + noise cap
  const allPicks = [...regularPicks, ...explorationPicks]
    .slice(0, Math.min(target, noiseCap));
  
  // Create briefing
  const briefing = await prisma.briefing.create({
    data: {
      userId,
      window,
      briefingDate: new Date(),
      topPaperIds: allPicks.map(p => p.paperId),
    },
  });
  
  // Trigger auto-analyses for top 5-10
  const autoAnalyzeCount = Math.min(10, Math.ceil(target * 0.4));
  const topForAnalysis = regularPicks.slice(0, autoAnalyzeCount);
  
  for (const paper of topForAnalysis) {
    await boss.send("critique:paper", {
      paperId: paper.paperId,
      userId,
      depth: "A", // Fast critique
      auto: true,
    });
  }
  
  return briefing;
}
```

**Output**: 
- `Briefing` record with paper IDs
- Jobs queued for auto-analysis
- User notified (if enabled)

---

### 8.7 Analyst Agent (On-Demand)

**Trigger**: 
- User clicks "Generate Critique" on paper
- Auto-triggered for top papers in digest

**Responsibilities:**
1. Download and parse PDF (first time only, then cache)
2. Generate structured critique at requested depth (A/B/C)
3. Store analysis

**Three Depths:**

**Depth A (Fast): 5-8 bullet points**
- Uses abstract + (optionally) PDF intro/conclusion
- Local LLM by default (ollama)
- Target latency: <60 seconds

**Depth B (Compare): A + 3 nearest neighbors**
- Find 3 semantically similar papers (last 180d)
- Generate comparison table
- Cloud LLM recommended (Gemini Pro)
- Target latency: 1-2 minutes

**Depth C (Deep): Full PDF analysis**
- Complete methodology review
- Compute/data cost estimation
- SOTA comparability check
- Cloud LLM required (Gemini Pro)
- Target latency: 2-5 minutes

**Implementation:**
```typescript
// analyst-agent.ts

async function generateCritique(
  paperId: string,
  userId: string,
  depth: "A" | "B" | "C",
  config: { useLocalLLM: boolean }
): Promise<Analysis> {
  
  const paper = await prisma.paper.findUnique({
    where: { id: paperId },
    include: { enriched: true },
  });
  
  // Download PDF if not cached and depth requires it
  let pdfText: string | null = null;
  if (depth === "B" || depth === "C") {
    pdfText = await downloadAndParsePDF(paper.pdfUrl, paper.id);
  }
  
  // Generate analysis based on depth
  let markdownContent: string;
  let claimsEvidence: any;
  let neighborComparison: any = null;
  let verdict: string;
  let confidence: string;
  
  if (depth === "A") {
    const result = await generateFastCritique(
      paper,
      pdfText,
      config.useLocalLLM
    );
    markdownContent = result.markdown;
    claimsEvidence = result.claimsEvidence;
    verdict = result.verdict;
    confidence = result.confidence;
    
  } else if (depth === "B") {
    // Find 3 nearest neighbors
    const neighbors = await findSimilarPapers(paper.enriched.embedding, 3, 180);
    
    const result = await generateComparativeCritique(
      paper,
      pdfText,
      neighbors
    );
    markdownContent = result.markdown;
    claimsEvidence = result.claimsEvidence;
    neighborComparison = result.comparison;
    verdict = result.verdict;
    confidence = result.confidence;
    
  } else { // depth === "C"
    const result = await generateDeepCritique(paper, pdfText);
    markdownContent = result.markdown;
    claimsEvidence = result.claimsEvidence;
    verdict = result.verdict;
    confidence = result.confidence;
  }
  
  // Store analysis
  return await prisma.analysis.create({
    data: {
      paperId,
      userId,
      depth,
      claimsEvidence,
      neighborComparison,
      verdict,
      confidence,
      markdownContent,
      generatedAt: new Date(),
    },
  });
}

async function generateFastCritique(
  paper: Paper,
  pdfText: string | null,
  useLocal: boolean
): Promise<{
  markdown: string;
  claimsEvidence: any;
  verdict: string;
  confidence: string;
}> {
  
  const prompt = `
You are a research reviewer providing a fast critical analysis.

Paper: ${paper.title}
Abstract: ${paper.abstract}
${pdfText ? `Introduction: ${extractIntro(pdfText)}` : ""}

Generate a structured critique with:

## Core Contribution
What problem does this solve? What's the proposed solution?

## Key Claims & Evidence
| Claim | Evidence | Assessment |
|-------|----------|------------|
| ... | ... | Supported/Weak/Missing |

## Quick Assessment
- Strengths (2-3 bullets)
- Limitations (2-3 bullets)

## Verdict
Overall: [Promising | Solid Incremental | Over-claimed]
Confidence: [High | Medium | Low]
Reasoning: ...

## Bottom Line
One sentence takeaway for practitioners.
`;

  const response = await callLLM(prompt, { 
    useLocal,
    temperature: 0.3,
  });
  
  // Parse response
  return {
    markdown: response,
    claimsEvidence: extractClaimsTable(response),
    verdict: extractVerdict(response),
    confidence: extractConfidence(response),
  };
}
```

**Output**: 
- `Analysis` record with structured critique
- User notified when complete

---

### 8.8 Synthesizer Agent (On-Demand)

**Trigger**: 
- User clicks "Generate Synthesis" on collection
- Auto-trigger if collection is "continuous" mode and paper added

**Responsibilities:**
1. Load all papers in collection
2. Analyze common patterns
3. Identify contradictions
4. Extract design patterns (if applicable)
5. Generate synthesis document

**Implementation:**
```typescript
// synthesizer-agent.ts

async function synthesizeCollection(
  notebookId: string
): Promise<NotebookSynthesis> {
  
  const notebook = await prisma.notebook.findUnique({
    where: { id: notebookId },
    include: {
      items: {
        include: {
          paper: {
            include: {
              enriched: true,
              summaries: true,
            },
          },
        },
      },
    },
  });
  
  // Prepare context for LLM
  const paperSummaries = notebook.items.map(item => ({
    title: item.paper.title,
    authors: item.paper.authors,
    abstract: item.paper.abstract,
    topics: item.paper.enriched.topics,
    userNotes: item.userNotes,
    summary: item.paper.summaries.find(s => s.summaryType === "skim")?.markdownContent,
  }));
  
  const prompt = `
You are synthesizing insights across a research paper collection.

Collection: ${notebook.title}
Purpose: ${notebook.purpose}
Papers (${paperSummaries.length} total):

${paperSummaries.map((p, i) => `
### Paper ${i + 1}: ${p.title}
Authors: ${p.authors}
Topics: ${p.topics.join(", ")}
Abstract: ${p.abstract}
${p.userNotes ? `User notes: ${p.userNotes}` : ""}
${p.summary ? `Summary: ${p.summary}` : ""}
`).join("\n")}

Generate a comprehensive synthesis document with these sections:

## Overview
What does this collection cover? Common thread?

## Common Patterns
What techniques, architectures, or approaches appear repeatedly?
List 3-5 patterns with examples.

## Divergent Approaches
Where do papers disagree or take different paths?

## Key Insights
What are the 3-5 most important takeaways?

## Open Problems
What gaps or limitations are mentioned across papers?

## Design Patterns (if applicable)
Extract reusable patterns for practitioners.
Format: Pattern name, Problem, Solution, Example papers.

## Evolution (if temporal)
How have ideas progressed? What's the trajectory?

## Recommended Reading Order
Suggest an order for someone new to this topic.

## Further Research
What questions remain? What should be explored next?
`;

  const response = await callLLM(prompt, {
    useLocal: false, // Use cloud for quality
    model: "gemini-2.0-pro",
    temperature: 0.4,
  });
  
  // Store synthesis
  const existing = await prisma.notebookSynthesis.findUnique({
    where: { notebookId },
  });
  
  if (existing) {
    return await prisma.notebookSynthesis.update({
      where: { notebookId },
      data: {
        markdownContent: response,
        updatedAt: new Date(),
      },
    });
  } else {
    return await prisma.notebookSynthesis.create({
      data: {
        notebookId,
        markdownContent: response,
        generatedAt: new Date(),
      },
    });
  }
}
```

**Output**: 
- `NotebookSynthesis` record with markdown content
- User can view/edit/export

---

## 9. User Interface Design

### 9.1 Three-Pane Layout (Desktop Focus)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ ArXiv Curator                                    [User]  [Settings]  [Help]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  ┌──────────────┐  ┌────────────────────────────┐  ┌────────────────────┐  │
│  │ NAVIGATION   │  │   BRIEFING / LIST          │  │  DETAIL / ANALYSIS │  │
│  │ (220px)      │  │   (flex-1, ~500px)         │  │  (flex-1, ~500px)  │  │
│  │              │  │                            │  │                    │  │
│  │ Daily Digest │  │ Today's Briefing           │  │  [Paper Detail]    │  │
│  │  › Today     │  │                            │  │                    │  │
│  │  · 7 Days    │  │ [Paper Card 1]             │  │  Title, Authors    │  │
│  │  · Month     │  │ [Paper Card 2]             │  │  Abstract          │  │
│  │              │  │ [Paper Card 3]             │  │  Why Shown         │  │
│  │ Trends       │  │ ...                        │  │  TL;DR             │  │
│  │  · Heatmap   │  │                            │  │                    │  │
│  │  · Velocity  │  │ [Load More]                │  │  [Generate         │  │
│  │  · SOTA      │  │                            │  │   Critique A/B/C]  │  │
│  │              │  │                            │  │                    │  │
│  │ Collections  │  │                            │  │  [Add to Notebook] │  │
│  │  · Agentic   │  │                            │  │  [Export]          │  │
│  │  · RAG       │  │                            │  │                    │  │
│  │  [+ New]     │  │                            │  │  [Critical         │  │
│  │              │  │                            │  │   Analysis...]     │  │
│  │ Settings     │  │                            │  │                    │  │
│  └──────────────┘  └────────────────────────────┘  └────────────────────┘  │
│                                                                               │
│  [No chat bar by default - deferred to v2]                                   │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Navigation Pane

```typescript
// NavPane.tsx

<aside className="w-56 border-r bg-gray-50 p-4">
  <nav className="space-y-6">
    {/* Daily Digests */}
    <section>
      <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">
        Daily Digest
      </h3>
      <ul className="space-y-1">
        <NavItem 
          active={view === "today"}
          icon={<CalendarDays />}
          label="Today"
          badge={briefings.today?.topPaperIds.length}
          onClick={() => setView("today")}
        />
        <NavItem 
          icon={<Calendar />}
          label="7 Days"
          badge={briefings.week?.topPaperIds.length}
          onClick={() => setView("7d")}
        />
        <NavItem 
          icon={<CalendarRange />}
          label="Month"
          onClick={() => setView("30d")}
        />
      </ul>
    </section>

    {/* Trends */}
    <section>
      <h3 className="text-xs font-semibold uppercase text-gray-500 mb-2">
        Trends
      </h3>
      <ul className="space-y-1">
        <NavItem icon={<TrendingUp />} label="Heatmap" onClick={() => setView("trends-heatmap")} />
        <NavItem icon={<Activity />} label="Velocity" onClick={() => setView("trends-velocity")} />
        <NavItem icon={<Trophy />} label="SOTA Board" onClick={() => setView("trends-sota")} />
      </ul>
    </section>

    {/* Collections */}
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold uppercase text-gray-500">
          Collections
        </h3>
        <Button size="sm" variant="ghost" onClick={createCollection}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      <ul className="space-y-1">
        {notebooks.map(nb => (
          <NavItem
            key={nb.id}
            icon={<BookMarked />}
            label={nb.title}
            badge={nb.items.length}
            onClick={() => setView(`collection-${nb.id}`)}
          />
        ))}
      </ul>
    </section>

    {/* Settings */}
    <section>
      <NavItem 
        icon={<Settings />} 
        label="Settings" 
        onClick={() => setView("settings")}
      />
    </section>
  </nav>
</aside>

// Keyboard shortcuts
useHotkeys("j", () => navigateDown());
useHotkeys("k", () => navigateUp());
useHotkeys("s", () => saveCurrentPaper());
useHotkeys("h", () => hideCurrentPaper());
useHotkeys("c", () => critiquCurrentPaper());
```

### 9.3 Briefing/List Pane

```typescript
// BriefingPane.tsx

<div className="flex-1 overflow-y-auto p-6">
  {/* Header */}
  <div className="mb-6">
    <h1 className="text-2xl font-bold mb-2">
      {window === "today" && "Today's Briefing"}
      {window === "7d" && "This Week's Papers"}
    </h1>
    <div className="flex items-center gap-4 text-sm text-gray-600">
      <span>{briefing.topPaperIds.length} papers</span>
      <Button 
        size="sm" 
        variant="outline"
        onClick={regenerateDigest}
      >
        <RefreshCw className="h-4 w-4 mr-2" />
        Run Now
      </Button>
    </div>
  </div>

  {/* Filters */}
  <div className="flex gap-2 mb-6">
    <Select value={topicFilter} onValueChange={setTopicFilter}>
      <SelectTrigger className="w-40">
        <SelectValue placeholder="All Topics" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Topics</SelectItem>
        <SelectItem value="agents">Agents</SelectItem>
        <SelectItem value="rag">RAG</SelectItem>
        <SelectItem value="multimodal">Multimodal</SelectItem>
      </SelectContent>
    </Select>
    
    <Select value={noveltyFilter} onValueChange={setNoveltyFilter}>
      <SelectTrigger className="w-40">
        <SelectValue placeholder="All Novelty" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All Novelty</SelectItem>
        <SelectItem value="high">High Only</SelectItem>
        <SelectItem value="medium">Medium+</SelectItem>
      </SelectContent>
    </Select>
  </div>

  {/* Paper Cards */}
  <div className="space-y-4">
    {/* Must Read Section */}
    <section>
      <h2 className="text-sm font-semibold uppercase text-gray-500 mb-3">
        Must Read ({mustReadPapers.length})
      </h2>
      {mustReadPapers.map(paper => (
        <PaperCard 
          key={paper.id}
          paper={paper}
          priority="must-read"
          selected={selectedPaperId === paper.id}
          onClick={() => setSelectedPaperId(paper.id)}
        />
      ))}
    </section>

    {/* Worth Scanning */}
    <section>
      <h2 className="text-sm font-semibold uppercase text-gray-500 mb-3">
        Worth Scanning ({worthScanningPapers.length})
      </h2>
      {worthScanningPapers.map(paper => (
        <PaperCard 
          key={paper.id}
          paper={paper}
          priority="worth-scanning"
          selected={selectedPaperId === paper.id}
          onClick={() => setSelectedPaperId(paper.id)}
        />
      ))}
    </section>

    {/* Exploration Picks */}
    {explorationPapers.length > 0 && (
      <section>
        <h2 className="text-sm font-semibold uppercase text-gray-500 mb-3 flex items-center gap-2">
          <Sparkles className="h-4 w-4" />
          Exploration Picks ({explorationPapers.length})
        </h2>
        {explorationPapers.map(paper => (
          <PaperCard 
            key={paper.id}
            paper={paper}
            priority="exploration"
            selected={selectedPaperId === paper.id}
            onClick={() => setSelectedPaperId(paper.id)}
          />
        ))}
      </section>
    )}
  </div>
</div>
```

### 9.4 Paper Card Component

```typescript
// PaperCard.tsx

interface PaperCardProps {
  paper: Paper & { enriched: PaperEnriched; scores: Score[] };
  priority: "must-read" | "worth-scanning" | "exploration";
  selected: boolean;
  onClick: () => void;
}

export function PaperCard({ paper, priority, selected, onClick }: PaperCardProps) {
  const score = paper.scores[0];
  const summary = paper.summaries.find(s => s.summaryType === "skim");
  
  return (
    <Card 
      className={cn(
        "mb-3 cursor-pointer transition-all hover:shadow-md",
        selected && "ring-2 ring-blue-500",
        priority === "must-read" && "border-l-4 border-l-red-500",
        priority === "exploration" && "border-l-4 border-l-purple-500"
      )}
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold leading-tight mb-2">
              {paper.title}
            </CardTitle>
            <p className="text-sm text-gray-600">
              {formatAuthors(paper.authors)} • {format(paper.pubDate, "MMM d, yyyy")}
            </p>
          </div>
          
          {/* Score Badge */}
          <div className="flex flex-col items-end gap-1">
            <Badge variant={getScoreVariant(score.finalScore)}>
              {(score.finalScore * 100).toFixed(0)}
            </Badge>
            {score.whyShown.novelty_signal === "High" && (
              <Badge variant="secondary" className="text-xs">
                <Zap className="h-3 w-3 mr-1" />
                Novel
              </Badge>
            )}
            {score.whyShown.exploration && (
              <Badge variant="outline" className="text-xs">
                <Sparkles className="h-3 w-3 mr-1" />
                Spicy
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Topic Chips */}
        <div className="flex flex-wrap gap-2">
          {paper.enriched.topics.map(topic => (
            <Badge key={topic} variant="outline" className="text-xs">
              {topic}
            </Badge>
          ))}
          {paper.enriched.hasCode && (
            <Badge variant="secondary" className="text-xs">
              <Code className="h-3 w-3 mr-1" />
              Code
            </Badge>
          )}
        </div>
        
        {/* Why Shown */}
        <div className="bg-blue-50 p-3 rounded-md text-sm">
          <div className="flex items-start gap-2">
            <Lightbulb className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium text-blue-900 mb-1">Why you're seeing this:</p>
              <ul className="text-blue-800 space-y-1 text-xs">
                <li>• Matches your interest in {score.whyShown.matched_keywords.join(", ")} (profile: {score.whyShown.profile_match.toFixed(2)})</li>
                {score.whyShown.velocity_boost > 0.1 && (
                  <li>• Topic trending: +{(score.whyShown.velocity_boost * 100).toFixed(0)}% this week</li>
                )}
                {score.whyShown.evidence_quality && (
                  <li>• {score.whyShown.evidence_quality}</li>
                )}
                {score.whyShown.lab_boost > 0 && (
                  <li>• From preferred research lab</li>
                )}
                {score.whyShown.exploration && (
                  <li>• <Sparkles className="h-3 w-3 inline" /> Exploration pick to test your boundaries</li>
                )}
              </ul>
            </div>
          </div>
        </div>
        
        {/* TL;DR */}
        {summary && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-1">TL;DR:</p>
            <p className="text-sm text-gray-600 leading-relaxed">
              {summary.whatsNew}
            </p>
          </div>
        )}
        
        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button size="sm" variant="outline" onClick={(e) => {
            e.stopPropagation();
            generateCritique(paper.id, "A");
          }}>
            <FileText className="h-4 w-4 mr-2" />
            Read Analysis
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline">
                <Save className="h-4 w-4 mr-2" />
                Save
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {notebooks.map(nb => (
                <DropdownMenuItem 
                  key={nb.id}
                  onClick={() => addToNotebook(paper.id, nb.id)}
                >
                  <BookMarked className="h-4 w-4 mr-2" />
                  {nb.title}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={createNewNotebook}>
                <Plus className="h-4 w-4 mr-2" />
                New Collection...
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button size="sm" variant="ghost" onClick={(e) => {
            e.stopPropagation();
            hidePaper(paper.id);
          }}>
            <EyeOff className="h-4 w-4" />
          </Button>
          
          <Button size="sm" variant="ghost" onClick={(e) => {
            e.stopPropagation();
            lessLikeThis(paper.id);
          }}>
            <ThumbsDown className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

### 9.5 Detail/Analysis Pane

```typescript
// DetailPane.tsx

<div className="flex-1 overflow-y-auto p-6 bg-white">
  {selectedPaper ? (
    <>
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">{selectedPaper.title}</h1>
        <p className="text-gray-600 mb-4">
          {formatAuthors(selectedPaper.authors)} • 
          <a 
            href={selectedPaper.pdfUrl} 
            target="_blank" 
            rel="noopener"
            className="text-blue-600 hover:underline ml-2"
          >
            arXiv:{selectedPaper.arxivId}
          </a>
        </p>
        
        <div className="flex gap-2">
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => window.open(selectedPaper.pdfUrl, "_blank")}
          >
            <FileText className="h-4 w-4 mr-2" />
            Open PDF
          </Button>
          
          {selectedPaper.codeUrl && (
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => window.open(selectedPaper.codeUrl, "_blank")}
            >
              <Code className="h-4 w-4 mr-2" />
              View Code
            </Button>
          )}
          
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => window.open(`https://arxiv.org/abs/${selectedPaper.arxivId}`, "_blank")}
          >
            <ExternalLink className="h-4 w-4 mr-2" />
            arXiv Page
          </Button>
        </div>
      </div>
      
      {/* Abstract */}
      <section className="mb-6">
        <h2 className="text-sm font-semibold uppercase text-gray-500 mb-2">
          Abstract
        </h2>
        <p className="text-sm text-gray-700 leading-relaxed">
          {selectedPaper.abstract}
        </p>
      </section>
      
      {/* TL;DR (if available) */}
      {skimSummary && (
        <section className="mb-6 bg-gray-50 p-4 rounded-lg">
          <h2 className="text-sm font-semibold uppercase text-gray-500 mb-2">
            What's New
          </h2>
          <p className="text-sm text-gray-800 font-medium mb-3">
            {skimSummary.whatsNew}
          </p>
          
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Key Points</h3>
          <ul className="space-y-1">
            {skimSummary.keyPoints.map((point, i) => (
              <li key={i} className="text-sm text-gray-700">• {point}</li>
            ))}
          </ul>
        </section>
      )}
      
      {/* Critical Analysis */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Critical Analysis</h2>
          
          {!analysis && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Critique
                  <ChevronDown className="h-4 w-4 ml-2" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => generateCritique("A")}>
                  <Zap className="h-4 w-4 mr-2" />
                  Fast (A) - 5-8 bullets, ~60s
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => generateCritique("B")}>
                  <GitCompare className="h-4 w-4 mr-2" />
                  Compare (B) - + 3 neighbors, ~2min
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => generateCritique("C")}>
                  <FileSearch className="h-4 w-4 mr-2" />
                  Deep (C) - Full analysis, ~5min
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        
        {analysisLoading && (
          <div className="bg-blue-50 p-6 rounded-lg text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-3 text-blue-600" />
            <p className="text-sm font-medium text-blue-900">
              Generating {critiqueDepth} critique...
            </p>
            <p className="text-xs text-blue-700 mt-1">
              Estimated time: {critiqueDepth === "A" ? "~60s" : critiqueDepth === "B" ? "~2min" : "~5min"}
            </p>
          </div>
        )}
        
        {analysis && (
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown>{analysis.markdownContent}</ReactMarkdown>
            
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-700">Verdict: </span>
                  <Badge variant={getVerdictVariant(analysis.verdict)}>
                    {analysis.verdict}
                  </Badge>
                  <span className="text-sm text-gray-600 ml-3">
                    Confidence: {analysis.confidence}
                  </span>
                </div>
                
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={regenerateAnalysis}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
              </div>
            </div>
          </div>
        )}
      </section>
      
      {/* Similar Papers */}
      {similarPapers.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-semibold uppercase text-gray-500 mb-3">
            Similar Papers (last 180 days)
          </h2>
          <div className="space-y-2">
            {similarPapers.map(similar => (
              <Card 
                key={similar.id} 
                className="p-3 cursor-pointer hover:bg-gray-50"
                onClick={() => setSelectedPaperId(similar.id)}
              >
                <p className="text-sm font-medium">{similar.title}</p>
                <p className="text-xs text-gray-600 mt-1">
                  {formatAuthors(similar.authors)} • 
                  {format(similar.pubDate, "MMM yyyy")}
                </p>
              </Card>
            ))}
          </div>
        </section>
      )}
      
      {/* Actions */}
      <section>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add to Collection
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {notebooks.map(nb => (
                <DropdownMenuItem 
                  key={nb.id}
                  onClick={() => addToNotebook(selectedPaper.id, nb.id)}
                >
                  {nb.title}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => exportAs("markdown")}>
                <FileText className="h-4 w-4 mr-2" />
                Markdown
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => exportAs("pdf")}>
                <FileText className="h-4 w-4 mr-2" />
                PDF
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => syncToNotebookLM()}>
                <ExternalLink className="h-4 w-4 mr-2" />
                Send to NotebookLM
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button variant="ghost" onClick={dismissPaper}>
            <Trash className="h-4 w-4 mr-2" />
            Dismiss
          </Button>
        </div>
        
        {/* Feedback */}
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-gray-600 mb-2">Was this recommendation helpful?</p>
          <div className="flex gap-2">
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => provideFeedback("thumbs_up")}
            >
              <ThumbsUp className="h-4 w-4 mr-2" />
              Useful
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => provideFeedback("thumbs_down")}
            >
              <ThumbsDown className="h-4 w-4 mr-2" />
              Not Useful
            </Button>
            <Button 
              size="sm" 
              variant="outline"
              onClick={() => provideFeedback("less_like_this")}
            >
              <Ban className="h-4 w-4 mr-2" />
              Less Like This
            </Button>
          </div>
        </div>
      </section>
    </>
  ) : (
    <div className="flex items-center justify-center h-full text-gray-400">
      <p>Select a paper to view details</p>
    </div>
  )}
</div>
```

### 9.6 Settings View

```typescript
// SettingsView.tsx

<div className="max-w-4xl mx-auto p-6">
  <h1 className="text-3xl font-bold mb-6">Settings</h1>
  
  <Tabs defaultValue="sources">
    <TabsList className="mb-6">
      <TabsTrigger value="sources">Sources</TabsTrigger>
      <TabsTrigger value="categories">Categories</TabsTrigger>
      <TabsTrigger value="personalization">Personalization</TabsTrigger>
      <TabsTrigger value="preferences">Preferences</TabsTrigger>
      <TabsTrigger value="ai">AI Models</TabsTrigger>
    </TabsList>
    
    {/* Sources Tab */}
    <TabsContent value="sources">
      <Card>
        <CardHeader>
          <CardTitle>Data Sources</CardTitle>
          <CardDescription>
            Configure which sources to pull papers from
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">arXiv</p>
              <p className="text-sm text-gray-600">Primary source for research papers</p>
            </div>
            <Switch checked={sources.arxiv} disabled />
          </div>
          
          <Separator />
          
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">OpenAlex</p>
              <p className="text-sm text-gray-600">Citation metadata enrichment</p>
            </div>
            <Switch 
              checked={sources.openAlex}
              onCheckedChange={(v) => updateSource("openAlex", v)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Semantic Scholar</p>
              <p className="text-sm text-gray-600">Citation graph and influence</p>
            </div>
            <Switch 
              checked={sources.semanticScholar}
              onCheckedChange={(v) => updateSource("semanticScholar", v)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">GitHub</p>
              <p className="text-sm text-gray-600">Link papers to repositories</p>
            </div>
            <Switch 
              checked={sources.github}
              onCheckedChange={(v) => updateSource("github", v)}
            />
          </div>
          
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Papers with Code</p>
              <p className="text-sm text-gray-600">Benchmark tracking</p>
            </div>
            <Switch 
              checked={sources.papersWithCode}
              onCheckedChange={(v) => updateSource("papersWithCode", v)}
            />
          </div>
        </CardContent>
      </Card>
    </TabsContent>
    
    {/* Categories Tab */}
    <TabsContent value="categories">
      <Card>
        <CardHeader>
          <CardTitle>arXiv Categories</CardTitle>
          <CardDescription>
            Select which arXiv categories to monitor
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-start gap-3">
                <Checkbox 
                  checked={profile.arxivCategories.includes(cat.id)}
                  onCheckedChange={(checked) => toggleCategory(cat.id, checked)}
                />
                <div>
                  <p className="font-medium text-sm">{cat.id}</p>
                  <p className="text-sm text-gray-600">{cat.name}</p>
                </div>
              </div>
            ))}
          </div>
          
          <Button 
            variant="outline" 
            size="sm"
            className="mt-4"
            onClick={refreshCategories}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh Categories
          </Button>
        </CardContent>
      </Card>
    </TabsContent>
    
    {/* Personalization Tab */}
    <TabsContent value="personalization">
      <div className="space-y-6">
        {/* Strong Includes */}
        <Card>
          <CardHeader>
            <CardTitle>Strong Includes</CardTitle>
            <CardDescription>
              Topics and keywords to always prioritize
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 mb-4">
              {profile.includeTopics.map(topic => (
                <div key={topic} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                  <span className="text-sm">{topic}</span>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => removeTopic(topic, "include")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            
            <div className="flex gap-2">
              <Input 
                placeholder="Add topic or keyword..."
                value={newInclude}
                onChange={(e) => setNewInclude(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addInclude()}
              />
              <Button onClick={addInclude}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {/* Strong Excludes */}
        <Card>
          <CardHeader>
            <CardTitle>Strong Excludes</CardTitle>
            <CardDescription>
              Topics and keywords to filter out
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 mb-4">
              {profile.excludeTopics.map(topic => (
                <div key={topic} className="flex items-center justify-between bg-red-50 p-2 rounded">
                  <span className="text-sm">{topic}</span>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => removeTopic(topic, "exclude")}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            
            <div className="flex gap-2">
              <Input 
                placeholder="Add topic or keyword to exclude..."
                value={newExclude}
                onChange={(e) => setNewExclude(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addExclude()}
              />
              <Button onClick={addExclude}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {/* Lab Boosts */}
        <Card>
          <CardHeader>
            <CardTitle>Lab Boosts</CardTitle>
            <CardDescription>
              Research labs to slightly prioritize
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 mb-4">
              {profile.labBoosts.map(lab => (
                <div key={lab} className="flex items-center justify-between bg-blue-50 p-2 rounded">
                  <span className="text-sm">{lab}</span>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={() => removeLab(lab)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
            
            <div className="flex gap-2">
              <Input 
                placeholder="Add research lab..."
                value={newLab}
                onChange={(e) => setNewLab(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addLab()}
              />
              <Button onClick={addLab}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
        
        {/* Learned Rules */}
        <Card>
          <CardHeader>
            <CardTitle>Learned Rules</CardTitle>
            <CardDescription>
              Rules automatically learned from your behavior
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {learnedRules.map(rule => (
                <div key={rule.id} className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{rule.description}</p>
                      <p className="text-xs text-gray-600 mt-1">
                        Confidence: {rule.confidence}% • Based on {rule.examples} examples
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => approveRule(rule.id)}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => rejectRule(rule.id)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </TabsContent>
    
    {/* Preferences Tab */}
    <TabsContent value="preferences">
      <div className="space-y-6">
        {/* Math Depth */}
        <Card>
          <CardHeader>
            <CardTitle>Math Depth Tolerance</CardTitle>
            <CardDescription>
              How much mathematical content are you comfortable with?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Slider 
                value={[profile.mathDepthMax]}
                onValueChange={([v]) => updateProfile({ mathDepthMax: v })}
                min={0}
                max={1}
                step={0.1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-600">
                <span>Minimal</span>
                <span>Moderate</span>
                <span>Heavy</span>
              </div>
              <p className="text-sm text-gray-600">
                Current: {(profile.mathDepthMax * 100).toFixed(0)}% - 
                {profile.mathDepthMax < 0.3 ? " Only practical papers" :
                 profile.mathDepthMax < 0.7 ? " Some theory OK" :
                 " Theoretical papers welcome"}
              </p>
            </div>
          </CardContent>
        </Card>
        
        {/* Exploration Rate */}
        <Card>
          <CardHeader>
            <CardTitle>Exploration Rate</CardTitle>
            <CardDescription>
              How many "spicy" papers to include to test your boundaries?
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Slider 
                value={[profile.explorationRate]}
                onValueChange={([v]) => updateProfile({ explorationRate: v })}
                min={0}
                max={0.3}
                step={0.05}
                className="w-full"
              />
              <p className="text-sm text-gray-600">
                Current: {(profile.explorationRate * 100).toFixed(0)}% - 
                About {Math.ceil(profile.targetToday * profile.explorationRate)} papers per day
              </p>
            </div>
          </CardContent>
        </Card>
        
        {/* Noise Cap & Targets */}
        <Card>
          <CardHeader>
            <CardTitle>Daily Limits & Targets</CardTitle>
            <CardDescription>
              Configure how many papers to show
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Noise Cap (max per day)
              </Label>
              <Input 
                type="number"
                value={profile.noiseCap}
                onChange={(e) => updateProfile({ noiseCap: parseInt(e.target.value) })}
                min={5}
                max={100}
              />
              <p className="text-xs text-gray-600 mt-1">
                Never show more than this many papers per day
              </p>
            </div>
            
            <div>
              <Label className="text-sm font-medium mb-2 block">
                Today Target
              </Label>
              <Input 
                type="number"
                value={profile.targetToday}
                onChange={(e) => updateProfile({ targetToday: parseInt(e.target.value) })}
                min={5}
                max={50}
              />
            </div>
            
            <div>
              <Label className="text-sm font-medium mb-2 block">
                7-Day Target
              </Label>
              <Input 
                type="number"
                value={profile.target7d}
                onChange={(e) => updateProfile({ target7d: parseInt(e.target.value) })}
                min={10}
                max={100}
              />
            </div>
          </CardContent>
        </Card>
        
        {/* Digest Timing */}
        <Card>
          <CardHeader>
            <CardTitle>Digest Generation</CardTitle>
            <CardDescription>
              When to generate your daily digest
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Label>Generate after:</Label>
                <Input 
                  type="time"
                  value="06:00"
                  className="w-32"
                />
              </div>
              
              <Button variant="outline" onClick={runDigestNow}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Run Now
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </TabsContent>
    
    {/* AI Models Tab */}
    <TabsContent value="ai">
      <div className="space-y-6">
        {/* Embeddings */}
        <Card>
          <CardHeader>
            <CardTitle>Embeddings</CardTitle>
            <CardDescription>
              Choose between local or cloud embeddings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Use Local Embeddings</p>
                <p className="text-sm text-gray-600">
                  Free, private, but requires local model (~500MB)
                </p>
              </div>
              <Switch 
                checked={profile.useLocalEmbeddings}
                onCheckedChange={(v) => updateProfile({ useLocalEmbeddings: v })}
              />
            </div>
            
            {!profile.useLocalEmbeddings && (
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Cloud Provider
                </Label>
                <Select value={embeddingProvider} onValueChange={setEmbeddingProvider}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="google">Google (text-embedding-004)</SelectItem>
                    <SelectItem value="openai">OpenAI (text-embedding-3-small)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* LLMs */}
        <Card>
          <CardHeader>
            <CardTitle>Language Models</CardTitle>
            <CardDescription>
              Choose between local or cloud LLMs for summaries and critiques
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium">Use Local LLM</p>
                <p className="text-sm text-gray-600">
                  Free, private, but may be slower/lower quality
                </p>
              </div>
              <Switch 
                checked={profile.useLocalLLM}
                onCheckedChange={(v) => updateProfile({ useLocalLLM: v })}
              />
            </div>
            
            {profile.useLocalLLM ? (
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Local Model (ollama)
                </Label>
                <Select value={localModel} onValueChange={setLocalModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="llama3.2">Llama 3.2</SelectItem>
                    <SelectItem value="mistral">Mistral</SelectItem>
                    <SelectItem value="qwen2.5">Qwen 2.5</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-600 mt-1">
                  Note: Critique B/C always use cloud for quality
                </p>
              </div>
            ) : (
              <div>
                <Label className="text-sm font-medium mb-2 block">
                  Cloud Provider
                </Label>
                <Select value={llmProvider} onValueChange={setLlmProvider}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gemini-flash">Gemini 2.0 Flash (fast)</SelectItem>
                    <SelectItem value="gemini-pro">Gemini 2.0 Pro (quality)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Cost Estimate */}
        <Card>
          <CardHeader>
            <CardTitle>Estimated Daily Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Embeddings:</span>
                <span className="font-medium">
                  {profile.useLocalEmbeddings ? "$0.00" : "$0.10"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Summaries:</span>
                <span className="font-medium">
                  {profile.useLocalLLM ? "$0.00" : "$0.50"}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Critiques (avg):</span>
                <span className="font-medium">$1.50</span>
              </div>
              <Separator />
              <div className="flex justify-between text-base font-semibold">
                <span>Total:</span>
                <span>
                  ${(
                    (profile.useLocalEmbeddings ? 0 : 0.10) +
                    (profile.useLocalLLM ? 0 : 0.50) +
                    1.50
                  ).toFixed(2)}/day
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </TabsContent>
  </Tabs>
</div>
```

---

## 10. API Specification

### 10.1 tRPC Router

```typescript
// server/routers/_app.ts

import { router } from "../trpc";
import { papersRouter } from "./papers";
import { briefingsRouter } from "./briefings";
import { analysesRouter } from "./analyses";
import { notebooksRouter } from "./notebooks";
import { profileRouter } from "./profile";
import { trendsRouter } from "./trends";

export const appRouter = router({
  papers: papersRouter,
  briefings: briefingsRouter,
  analyses: analysesRouter,
  notebooks: notebooksRouter,
  profile: profileRouter,
  trends: trendsRouter,
});

export type AppRouter = typeof appRouter;
```

### 10.2 Papers Router

```typescript
// server/routers/papers.ts

export const papersRouter = router({
  // Get papers for a briefing
  getForBriefing: protectedProcedure
    .input(z.object({
      window: z.enum(["today", "7d", "30d", "180d", "365d", "quarter"]),
    }))
    .query(async ({ ctx, input }) => {
      const briefing = await ctx.prisma.briefing.findFirst({
        where: {
          userId: ctx.session.user.id,
          window: input.window,
        },
        orderBy: { briefingDate: "desc" },
        include: {
          // Include papers with all relations
        },
      });
      
      return briefing;
    }),
  
  // Get paper detail
  getById: protectedProcedure
    .input(z.object({ paperId: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.prisma.paper.findUnique({
        where: { id: input.paperId },
        include: {
          enriched: true,
          scores: true,
          summaries: true,
          analyses: {
            where: { userId: ctx.session.user.id },
          },
        },
      });
    }),
  
  // Find similar papers
  findSimilar: protectedProcedure
    .input(z.object({
      paperId: z.string(),
      limit: z.number().default(5),
      windowDays: z.number().default(180),
    }))
    .query(async ({ ctx, input }) => {
      // Vector similarity search
      const paper = await ctx.prisma.paper.findUnique({
        where: { id: input.paperId },
        include: { enriched: true },
      });
      
      if (!paper?.enriched?.embedding) {
        return [];
      }
      
      // Use pgvector similarity
      const similar = await ctx.prisma.$queryRaw`
        SELECT p.*, pe.embedding <=> ${paper.enriched.embedding}::vector AS distance
        FROM "Paper" p
        JOIN "PaperEnriched" pe ON pe."paperId" = p.id
        WHERE p.id != ${input.paperId}
          AND p."pubDate" >= NOW() - INTERVAL '${input.windowDays} days'
        ORDER BY distance
        LIMIT ${input.limit}
      `;
      
      return similar;
    }),
  
  // Provide feedback
  provideFeedback: protectedProcedure
    .input(z.object({
      paperId: z.string(),
      action: z.enum([
        "save", "hide", "open", "dwell", "critique",
        "less_like_this", "thumbs_up", "thumbs_down"
      ]),
      context: z.any().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      // Store feedback
      await ctx.prisma.feedback.create({
        data: {
          userId: ctx.session.user.id,
          paperId: input.paperId,
          action: input.action,
          weight: getFeedbackWeight(input.action),
          context: input.context,
        },
      });
      
      // Trigger profile update
      await ctx.boss.send("update:profile", {
        userId: ctx.session.user.id,
      });
      
      return { success: true };
    }),
});
```

### 10.3 Briefings Router

```typescript
// server/routers/briefings.ts

export const briefingsRouter = router({
  // Get latest briefing
  getLatest: protectedProcedure
    .input(z.object({
      window: z.enum(["today", "7d", "30d"]),
    }))
    .query(async ({ ctx, input }) => {
      return await ctx.prisma.briefing.findFirst({
        where: {
          userId: ctx.session.user.id,
          window: input.window,
        },
        orderBy: { briefingDate: "desc" },
      });
    }),
  
  // Generate new briefing (manual trigger)
  generate: protectedProcedure
    .input(z.object({
      window: z.enum(["today", "7d"]),
    }))
    .mutation(async ({ ctx, input }) => {
      // Queue briefing generation job
      await ctx.boss.send("generate:digest", {
        userId: ctx.session.user.id,
        window: input.window,
      });
      
      return { queued: true };
    }),
});
```

### 10.4 Analyses Router

```typescript
// server/routers/analyses.ts

export const analysesRouter = router({
  // Get analysis for paper
  getForPaper: protectedProcedure
    .input(z.object({
      paperId: z.string(),
      depth: z.enum(["A", "B", "C"]).optional(),
    }))
    .query(async ({ ctx, input }) => {
      return await ctx.prisma.analysis.findFirst({
        where: {
          userId: ctx.session.user.id,
          paperId: input.paperId,
          ...(input.depth && { depth: input.depth }),
        },
        orderBy: { generatedAt: "desc" },
      });
    }),
  
  // Generate critique
  generate: protectedProcedure
    .input(z.object({
      paperId: z.string(),
      depth: z.enum(["A", "B", "C"]),
    }))
    .mutation(async ({ ctx, input }) => {
      // Queue analysis job
      const job = await ctx.boss.send("critique:paper", {
        paperId: input.paperId,
        userId: ctx.session.user.id,
        depth: input.depth,
      });
      
      return { jobId: job.id };
    }),
  
  // Check analysis status
  checkStatus: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ ctx, input }) => {
      const job = await ctx.boss.getJobById(input.jobId);
      return {
        state: job.state,
        progress: job.data?.progress,
      };
    }),
});
```

### 10.5 Notebooks Router

```typescript
// server/routers/notebooks.ts

export const notebooksRouter = router({
  // List all notebooks
  list: protectedProcedure
    .query(async ({ ctx }) => {
      return await ctx.prisma.notebook.findMany({
        where: { userId: ctx.session.user.id },
        include: {
          items: {
            include: {
              paper: {
                include: { enriched: true },
              },
            },
          },
          synthesis: true,
        },
        orderBy: { updatedAt: "desc" },
      });
    }),
  
  // Create notebook
  create: protectedProcedure
    .input(z.object({
      title: z.string(),
      description: z.string().optional(),
      purpose: z.enum(["reference", "synthesis", "tracking"]).optional(),
      isContinuous: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      return await ctx.prisma.notebook.create({
        data: {
          userId: ctx.session.user.id,
          ...input,
        },
      });
    }),
  
  // Add paper to notebook
  addPaper: protectedProcedure
    .input(z.object({
      notebookId: z.string(),
      paperId: z.string(),
      notes: z.string().optional(),
      tags: z.array(z.string()).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.prisma.notebookItem.create({
        data: {
          notebookId: input.notebookId,
          paperId: input.paperId,
          userNotes: input.notes,
          tags: input.tags || [],
        },
      });
      
      // Check if continuous synthesis enabled
      const notebook = await ctx.prisma.notebook.findUnique({
        where: { id: input.notebookId },
      });
      
      if (notebook?.isContinuous) {
        // Trigger synthesis
        await ctx.boss.send("synthesize:collection", {
          notebookId: input.notebookId,
        });
      }
      
      return item;
    }),
  
  // Generate synthesis
  synthesize: protectedProcedure
    .input(z.object({ notebookId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.boss.send("synthesize:collection", {
        notebookId: input.notebookId,
      });
      
      return { queued: true };
    }),
  
  // Export notebook
  export: protectedProcedure
    .input(z.object({
      notebookId: z.string(),
      format: z.enum(["markdown", "pdf"]),
    }))
    .mutation(async ({ ctx, input }) => {
      const notebook = await ctx.prisma.notebook.findUnique({
        where: { id: input.notebookId },
        include: {
          items: {
            include: {
              paper: {
                include: {
                  summaries: true,
                  analyses: {
                    where: { userId: ctx.session.user.id },
                  },
                },
              },
            },
          },
          synthesis: true,
        },
      });
      
      if (!notebook) {
        throw new Error("Notebook not found");
      }
      
      if (input.format === "markdown") {
        const markdown = generateMarkdownExport(notebook);
        return { content: markdown, filename: `${notebook.title}.md` };
      } else {
        // Generate PDF
        const pdfBuffer = await generatePDFExport(notebook);
        // Upload to S3
        const url = await uploadToS3(pdfBuffer, `exports/${notebook.id}.pdf`);
        return { url, filename: `${notebook.title}.pdf` };
      }
    }),
});
```

---

## 11. Local-First Implementation

### 11.1 Pluggable AI Interface

```typescript
// lib/ai/interface.ts

export interface EmbeddingProvider {
  name: string;
  generateEmbedding(text: string): Promise<number[]>;
  dimensions: number;
}

export interface LLMProvider {
  name: string;
  generate(prompt: string, options?: LLMOptions): Promise<string>;
  supportsJSON: boolean;
  supportsStreaming: boolean;
}

interface LLMOptions {
  temperature?: number;
  maxTokens?: number;
  format?: "text" | "json";
  stream?: boolean;
}
```

### 11.2 Local Embeddings (ollama)

```typescript
// lib/ai/embeddings/local.ts

import fetch from "node-fetch";

export class LocalEmbeddingProvider implements EmbeddingProvider {
  name = "local-ollama";
  dimensions = 768;
  
  private ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
  private model = "all-minilm"; // or nomic-embed-text
  
  async generateEmbedding(text: string): Promise<number[]> {
    const response = await fetch(`${this.ollamaUrl}/api/embeddings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        prompt: text,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Ollama embedding failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.embedding;
  }
}
```

### 11.3 Cloud Embeddings (Google)

```typescript
// lib/ai/embeddings/google.ts

import { GoogleGenerativeAI } from "@google/generative-ai";

export class GoogleEmbeddingProvider implements EmbeddingProvider {
  name = "google-embedding";
  dimensions = 768;
  
  private client: GoogleGenerativeAI;
  private model = "text-embedding-004";
  
  constructor() {
    this.client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  }
  
  async generateEmbedding(text: string): Promise<number[]> {
    const model = this.client.getGenerativeModel({ model: this.model });
    const result = await model.embedContent(text);
    return result.embedding.values;
  }
}
```

### 11.4 Local LLM (ollama)

```typescript
// lib/ai/llm/local.ts

export class LocalLLMProvider implements LLMProvider {
  name = "local-ollama";
  supportsJSON = true;
  supportsStreaming = true;
  
  private ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
  private model = process.env.LOCAL_MODEL || "llama3.2";
  
  async generate(prompt: string, options: LLMOptions = {}): Promise<string> {
    const response = await fetch(`${this.ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.model,
        prompt,
        temperature: options.temperature || 0.7,
        format: options.format === "json" ? "json" : undefined,
        stream: false,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Ollama generation failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.response;
  }
}
```

### 11.5 Cloud LLM (Gemini)

```typescript
// lib/ai/llm/gemini.ts

import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiLLMProvider implements LLMProvider {
  name = "gemini";
  supportsJSON = true;
  supportsStreaming = true;
  
  private client: GoogleGenerativeAI;
  private model: string;
  
  constructor(modelName: "gemini-2.0-flash" | "gemini-2.0-pro" = "gemini-2.0-flash") {
    this.client = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    this.model = modelName;
  }
  
  async generate(prompt: string, options: LLMOptions = {}): Promise<string> {
    const model = this.client.getGenerativeModel({
      model: this.model,
      generationConfig: {
        temperature: options.temperature || 0.7,
        maxOutputTokens: options.maxTokens || 2048,
        ...(options.format === "json" && {
          responseMimeType: "application/json",
        }),
      },
    });
    
    const result = await model.generateContent(prompt);
    return result.response.text();
  }
}
```

### 11.6 AI Factory (Router)

```typescript
// lib/ai/factory.ts

export class AIFactory {
  static getEmbeddingProvider(config: {
    useLocal: boolean;
  }): EmbeddingProvider {
    if (config.useLocal) {
      return new LocalEmbeddingProvider();
    } else {
      // Could add OpenAI provider here too
      return new GoogleEmbeddingProvider();
    }
  }
  
  static getLLMProvider(config: {
    useLocal: boolean;
    localModel?: string;
    cloudModel?: "gemini-2.0-flash" | "gemini-2.0-pro";
    forceCloud?: boolean; // For Critique B/C
  }): LLMProvider {
    // Force cloud for high-quality tasks
    if (config.forceCloud || !config.useLocal) {
      return new GeminiLLMProvider(config.cloudModel || "gemini-2.0-flash");
    } else {
      return new LocalLLMProvider();
    }
  }
  
  static async testConnection(provider: EmbeddingProvider | LLMProvider): Promise<boolean> {
    try {
      if ("generateEmbedding" in provider) {
        await provider.generateEmbedding("test");
      } else {
        await provider.generate("test");
      }
      return true;
    } catch (error) {
      console.error(`Connection test failed for ${provider.name}:`, error);
      return false;
    }
  }
}
```

### 11.7 Usage in Agents

```typescript
// agents/enricher-agent.ts

async function enrichPaper(paper: Paper, userId: string) {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
  });
  
  // Get appropriate embedding provider
  const embeddingProvider = AIFactory.getEmbeddingProvider({
    useLocal: profile.useLocalEmbeddings,
  });
  
  // Generate embedding
  const text = `${paper.title}\n\n${paper.abstract}`;
  const embedding = await embeddingProvider.generateEmbedding(text);
  
  // Store enriched data
  await prisma.paperEnriched.create({
    data: {
      paperId: paper.id,
      embedding,
      // ... other fields
    },
  });
}

// agents/analyst-agent.ts

async function generateFastCritique(
  paper: Paper,
  userId: string
): Promise<Analysis> {
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
  });
  
  // Use local LLM for fast critiques (Depth A)
  const llmProvider = AIFactory.getLLMProvider({
    useLocal: profile.useLocalLLM,
  });
  
  const prompt = buildCritiquePrompt(paper, "A");
  const response = await llmProvider.generate(prompt, {
    temperature: 0.3,
    maxTokens: 2000,
  });
  
  return parseAndStoreAnalysis(response, paper.id, userId, "A");
}

async function generateDeepCritique(
  paper: Paper,
  userId: string
): Promise<Analysis> {
  // Always use cloud for deep critiques (Depth C)
  const llmProvider = AIFactory.getLLMProvider({
    useLocal: false,
    cloudModel: "gemini-2.0-pro",
    forceCloud: true,
  });
  
  const pdfText = await downloadAndParsePDF(paper.pdfUrl, paper.id);
  const prompt = buildDeepCritiquePrompt(paper, pdfText);
  
  const response = await llmProvider.generate(prompt, {
    temperature: 0.4,
    maxTokens: 4000,
  });
  
  return parseAndStoreAnalysis(response, paper.id, userId, "C");
}
```

---

## 12. Cost Analysis & Optimization

### 12.1 Cost Breakdown (Daily)

**Scenario 1: Full Local (Target: $0/day)**
```
Embeddings:  Local (ollama)               $0.00
Summaries:   Local (ollama, 20 papers)    $0.00
Critiques:   Local A (5 papers)           $0.00
             Cloud C (1 paper)             $0.80
Total:                                     $0.80/day
```

**Scenario 2: Hybrid (Target: $2-3/day)**
```
Embeddings:  Local (ollama)               $0.00
Summaries:   Cloud Flash (20 papers)      $0.30
Critiques:   Cloud A (5 papers)           $0.50
             Cloud B (2 papers)            $1.20
             Cloud C (1 paper)             $0.80
Total:                                     $2.80/day
```

**Scenario 3: Full Cloud (Max: $5/day)**
```
Embeddings:  Cloud (500 papers/day)       $0.25
Summaries:   Cloud Flash (20 papers)      $0.30
Critiques:   Cloud A (10 papers)          $1.00
             Cloud B (3 papers)            $1.80
             Cloud C (2 papers)            $1.60
Total:                                     $4.95/day
```

### 12.2 Cost Per Operation

**Gemini 2.0 Flash:**
- Input: $0.075 / 1M tokens
- Output: $0.30 / 1M tokens
- Context window: 1M tokens

**Gemini 2.0 Pro:**
- Input: $1.25 / 1M tokens
- Output: $5.00 / 1M tokens
- Context window: 2M tokens

**Estimated Token Usage:**
```typescript
const OPERATION_COSTS = {
  // Embeddings
  embedding_local: 0,
  embedding_google: 0.0005, // per embedding
  
  // Summaries (abstract-only)
  summary_skim_local: 0,
  summary_skim_flash: 0.015, // ~500 tokens in, 200 out
  
  // Critiques
  critique_a_local: 0,
  critique_a_flash: 0.10, // ~3K tokens in, 1K out
  critique_b_pro: 0.60,   // ~15K tokens in, 2K out
  critique_c_pro: 0.80,   // ~30K tokens in, 3K out
  
  // Synthesis
  synthesis_pro: 0.50,    // ~20K tokens in, 2K out
};
```

### 12.3 Optimization Strategies

**1. Aggressive Caching**
```typescript
// Cache embeddings by content hash
async function getCachedEmbedding(text: string): Promise<number[] | null> {
  const hash = hashText(text);
  return await redis.get(`embedding:${hash}`);
}

// Cache summaries by paper version
async function getCachedSummary(
  arxivId: string,
  version: number
): Promise<Summary | null> {
  return await prisma.summary.findFirst({
    where: {
      paper: { arxivId, version },
      summaryType: "skim",
    },
  });
}
```

**2. Batching**
```typescript
// Batch embedding generation
async function batchGenerateEmbeddings(
  papers: Paper[]
): Promise<Map<string, number[]>> {
  const texts = papers.map(p => `${p.title}\n\n${p.abstract}`);
  
  // Local: process in parallel
  if (useLocal) {
    const embeddings = await Promise.all(
      texts.map(t => embeddingProvider.generateEmbedding(t))
    );
    return new Map(papers.map((p, i) => [p.id, embeddings[i]]));
  }
  
  // Cloud: use batch API if available
  // Otherwise chunk to avoid rate limits
  const chunks = chunkArray(texts, 10);
  const results = new Map();
  
  for (const chunk of chunks) {
    const embeddings = await Promise.all(
      chunk.map(t => embeddingProvider.generateEmbedding(t))
    );
    // Add to results map...
  }
  
  return results;
}
```

**3. Lazy PDF Downloads**
```typescript
// Only download PDFs when explicitly needed (Critique B/C)
async function downloadPDFIfNeeded(
  paperId: string,
  pdfUrl: string,
  depth: "A" | "B" | "C"
): Promise<string | null> {
  if (depth === "A") {
    return null; // Abstract-only
  }
  
  // Check cache first
  const cached = await s3.getObject({
    Bucket: "arxiv-papers",
    Key: `pdfs/${paperId}.pdf`,
  });
  
  if (cached) {
    return parsePDF(cached.Body);
  }
  
  // Download and cache
  const response = await fetch(pdfUrl);
  const buffer = await response.arrayBuffer();
  
  await s3.putObject({
    Bucket: "arxiv-papers",
    Key: `pdfs/${paperId}.pdf`,
    Body: buffer,
  });
  
  return parsePDF(buffer);
}
```

**4. Rate Limiting & Throttling**
```typescript
// lib/rate-limiter.ts

import Bottleneck from "bottleneck";

export const arxivLimiter = new Bottleneck({
  minTime: 3000, // 3 seconds between requests
  maxConcurrent: 1,
});

export const geminiLimiter = new Bottleneck({
  reservoir: 60, // 60 requests
  reservoirRefreshAmount: 60,
  reservoirRefreshInterval: 60 * 1000, // per minute
  maxConcurrent: 5,
});

export const ollamaLimiter = new Bottleneck({
  maxConcurrent: 3, // Based on local GPU capability
});
```

**5. Progressive Enhancement**
```typescript
// Start with cheap operations, upgrade on demand
async function processNewPaper(paper: Paper, userId: string) {
  // Stage 1: Minimal (always run, ~$0)
  await enrichPaper(paper, userId); // Local embeddings
  await classifyPaper(paper); // Rule-based + local LLM
  await scorePaper(paper, userId);
  
  // Stage 2: Skim summary (if high score, ~$0.01)
  const score = await getScore(paper.id, userId);
  if (score.finalScore > 0.5) {
    await generateSkimSummary(paper); // Local LLM
  }
  
  // Stage 3: Critique (only on explicit request, $0.10-$0.80)
  // User-triggered, not automatic
}
```

---

## 13. Implementation Roadmap

### Phase 0: Foundation (Week 1)
**Goal:** Basic infrastructure and data pipeline

**Tasks:**
- [ ] Initialize Next.js project with TypeScript
- [ ] Set up Prisma with PostgreSQL
- [ ] Enable pgvector extension
- [ ] Create initial schema and migrations
- [ ] Set up NextAuth.js (email provider)
- [ ] Implement tRPC routers (basic CRUD)
- [ ] Docker Compose for local development
- [ ] Set up pg-boss for job queue

**Deliverable:** Authenticated app with database and job queue

---

### Phase 1: Ingestion & Enrichment (Week 2)
**Goal:** Papers flowing from arXiv to database

**Tasks:**
- [ ] Implement Scout Agent
  - [ ] OAI-PMH ListSets endpoint
  - [ ] Atom feed parsing
  - [ ] Rate limiting (3s between requests)
  - [ ] Supersedence logic
- [ ] Implement Enricher Agent (Tier 0)
  - [ ] Local embedding generation (ollama setup)
  - [ ] Math depth estimation
  - [ ] Keyword extraction
- [ ] Settings: Sources & Categories
  - [ ] Fetch and cache arXiv categories
  - [ ] Category selection UI
  - [ ] Source toggles
- [ ] Basic paper list view

**Deliverable:** Papers ingesting from arXiv with basic metadata

---

### Phase 2: Personalization & Scoring (Week 3)
**Goal:** User-specific filtering and recommendations

**Tasks:**
- [ ] Implement Classifier Agent
  - [ ] Topic classification (local LLM)
  - [ ] Facet tagging
- [ ] Implement Ranker Agent
  - [ ] Signal computation (N, E, V, P, L, M)
  - [ ] Scoring formula
  - [ ] Feature attribution generation
- [ ] Implement Personalization Agent
  - [ ] Vector similarity
  - [ ] Rule application
  - [ ] Exploration strategy
- [ ] User Profile Management
  - [ ] Include/exclude rules UI
  - [ ] Lab boosts
  - [ ] Math depth slider
  - [ ] Exploration rate slider
- [ ] Feedback system
  - [ ] Save, hide, dismiss actions
  - [ ] Profile vector updates

**Deliverable:** Personalized paper rankings per user

---

### Phase 3: Briefings & UI (Week 4)
**Goal:** Daily digest generation and core UI

**Tasks:**
- [ ] Implement Recommender Agent
  - [ ] Digest generation (Today/7d)
  - [ ] Noise cap and targets
  - [ ] "Why shown" explanations
- [ ] Three-pane layout
  - [ ] Navigation pane
  - [ ] Briefing/list pane with filters
  - [ ] Detail pane
- [ ] Paper Card component
  - [ ] Score badges
  - [ ] Topic chips
  - [ ] Why-shown display
  - [ ] Action buttons
- [ ] Scheduled digest generation
  - [ ] pg-boss cron job (after 6am)
  - [ ] Manual "Run Now" trigger
- [ ] Hotkeys (J/K/S/H/C)

**Deliverable:** Users can view daily briefings with personalized papers

---

### Phase 4: Summaries (Week 5)
**Goal:** AI-generated summaries for papers

**Tasks:**
- [ ] Implement summary generation
  - [ ] Skim summary (What's New + Key Points)
  - [ ] Local LLM integration
  - [ ] Fallback to cloud (Gemini Flash)
- [ ] Summary display in UI
  - [ ] In paper cards (collapsed)
  - [ ] In detail pane (expanded)
- [ ] Caching strategy
  - [ ] Cache by paper version
  - [ ] Reuse across users (non-personalized content)

**Deliverable:** Papers have AI-generated TL;DR summaries

---

### Phase 5: Critical Analysis (Week 6-7)
**Goal:** On-demand deep analysis

**Tasks:**
- [ ] Implement Analyst Agent
  - [ ] PDF download and parsing
  - [ ] Critique Depth A (Fast)
    - [ ] Local LLM by default
    - [ ] 5-8 bullet structure
  - [ ] Critique Depth B (Compare)
    - [ ] Vector similarity search for neighbors
    - [ ] Comparison table generation
    - [ ] Cloud LLM (Gemini Pro)
  - [ ] Critique Depth C (Deep)
    - [ ] Full PDF analysis
    - [ ] Compute/data cost estimation
    - [ ] SOTA comparability warnings
    - [ ] Cloud LLM (Gemini Pro)
- [ ] Analysis UI
  - [ ] "Generate Critique" dropdown (A/B/C)
  - [ ] Progress indicator
  - [ ] Markdown rendering
  - [ ] Verdict display
  - [ ] Regenerate option
- [ ] Background job processing
  - [ ] pg-boss worker
  - [ ] Job status tracking
  - [ ] Notifications (optional)

**Deliverable:** Users can request deep critiques on any paper

---

### Phase 6: Collections & Notebooks (Week 8)
**Goal:** Organize papers into collections

**Tasks:**
- [ ] Collections system
  - [ ] Create/edit/delete notebooks
  - [ ] Add/remove papers
  - [ ] User notes and tags
  - [ ] Continuous mode toggle
- [ ] Implement Synthesizer Agent
  - [ ] Cross-document analysis
  - [ ] Pattern extraction
  - [ ] Contradiction highlighting
  - [ ] Design patterns (if applicable)
  - [ ] Cloud LLM (Gemini Pro)
- [ ] Collections UI
  - [ ] Collection list in navigation
  - [ ] Collection detail view
  - [ ] Synthesis display
  - [ ] "Generate Synthesis" button
- [ ] Export functionality
  - [ ] Markdown export
  - [ ] PDF export (Puppeteer)
  - [ ] NotebookLM integration (Google Drive sync)

**Deliverable:** Users can organize papers and generate syntheses

---

### Phase 7: Trends & Analytics (Week 9)
**Goal:** Macro-level insights

**Tasks:**
- [ ] Trend computation
  - [ ] Topic velocity (EMA)
  - [ ] Week-over-week growth
  - [ ] Emerging topic detection (≥30% WoW, ≥6 papers)
  - [ ] Technique co-occurrence graph
- [ ] SOTA benchmark board
  - [ ] Parse claims from papers
  - [ ] Track state-of-the-art results
  - [ ] Comparability warnings
- [ ] Trends UI
  - [ ] Topic heatmap
  - [ ] Velocity sparklines
  - [ ] Emerging topics list
  - [ ] Technique graph visualization
  - [ ] SOTA leaderboard
- [ ] Scheduled trend updates
  - [ ] Daily computation job
  - [ ] Weekly technique graph refresh

**Deliverable:** Users can monitor research trends over time

---

### Phase 8: Polish & Optimization (Week 10)
**Goal:** Production readiness

**Tasks:**
- [ ] Performance optimization
  - [ ] Query optimization (explain analyze)
  - [ ] Add missing indexes
  - [ ] Implement caching strategy
  - [ ] Lazy loading for large lists
- [ ] Error handling
  - [ ] Graceful degradation
  - [ ] Retry logic with exponential backoff
  - [ ] User-friendly error messages
- [ ] Observability
  - [ ] OpenTelemetry instrumentation
  - [ ] Prometheus metrics
  - [ ] Grafana dashboards
  - [ ] Structured logging (Pino)
- [ ] Testing
  - [ ] Unit tests (Vitest)
  - [ ] Integration tests (agents)
  - [ ] E2E tests (Playwright)
- [ ] Documentation
  - [ ] User guide
  - [ ] API documentation
  - [ ] Deployment guide
  - [ ] Architecture diagrams

**Deliverable:** Production-ready system with monitoring

---

### Phase 9: Beta & Iteration (Week 11-12)
**Goal:** Real-world validation

**Tasks:**
- [ ] Deploy to production environment
- [ ] Invite beta users (family/colleagues)
- [ ] Collect feedback
- [ ] Monitor usage patterns
- [ ] Iterate on UI/UX
- [ ] Tune scoring weights
- [ ] Fix bugs
- [ ] Optimize costs

**Deliverable:** Validated product with real users

---

## 14. Deployment

### 14.1 Docker Compose (Development & Single-Node)

```yaml
# docker-compose.yml

version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg16
    environment:
      POSTGRES_USER: arxiv_curator
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: arxiv_curator
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init.sql:/docker-entrypoint-initdb.d/init.sql
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U arxiv_curator"]
      interval: 10s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio:latest
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER:-minioadmin}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD:-minioadmin}
    volumes:
      - minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3

  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: runner
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://arxiv_curator:${POSTGRES_PASSWORD}@postgres:5432/arxiv_curator
      S3_ENDPOINT: http://minio:9000
      S3_ACCESS_KEY: ${MINIO_ROOT_USER:-minioadmin}
      S3_SECRET_KEY: ${MINIO_ROOT_PASSWORD:-minioadmin}
      S3_BUCKET: arxiv-papers
      NEXTAUTH_URL: ${NEXTAUTH_URL:-http://localhost:3000}
      NEXTAUTH_SECRET: ${NEXTAUTH_SECRET}
      GEMINI_API_KEY: ${GEMINI_API_KEY}
      OLLAMA_URL: ${OLLAMA_URL:-http://host.docker.internal:11434}
    ports:
      - "3000:3000"
    depends_on:
      postgres:
        condition: service_healthy
      minio:
        condition: service_healthy
    volumes:
      - ./logs:/app/logs
    restart: unless-stopped

  worker:
    build:
      context: .
      dockerfile: Dockerfile
      target: runner
    command: npm run worker
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://arxiv_curator:${POSTGRES_PASSWORD}@postgres:5432/arxiv_curator
      S3_ENDPOINT: http://minio:9000
      S3_ACCESS_KEY: ${MINIO_ROOT_USER:-minioadmin}
      S3_SECRET_KEY: ${MINIO_ROOT_PASSWORD:-minioadmin}
      S3_BUCKET: arxiv-papers
      GEMINI_API_KEY: ${GEMINI_API_KEY}
      OLLAMA_URL: ${OLLAMA_URL:-http://host.docker.internal:11434}
    depends_on:
      postgres:
        condition: service_healthy
      minio:
        condition: service_healthy
    deploy:
      replicas: 2
    restart: unless-stopped

volumes:
  postgres_data:
  minio_data:
```

### 14.2 Dockerfile

```dockerfile
# Dockerfile

# Stage 1: Dependencies
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --only=production

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build Next.js app
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy necessary files
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
```

### 14.3 Kubernetes Deployment

```yaml
# k8s/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: arxiv-curator

---
# k8s/postgres.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
  namespace: arxiv-curator
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 50Gi
  storageClassName: standard

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: postgres
  namespace: arxiv-curator
spec:
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: pgvector/pgvector:pg16
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_DB
          value: arxiv_curator
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: arxiv-curator-secrets
              key: postgres-user
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: arxiv-curator-secrets
              key: postgres-password
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
      volumes:
      - name: postgres-storage
        persistentVolumeClaim:
          claimName: postgres-pvc

---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: arxiv-curator
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
    targetPort: 5432

---
# k8s/minio.yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: minio-pvc
  namespace: arxiv-curator
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 100Gi
  storageClassName: standard

---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: minio
  namespace: arxiv-curator
spec:
  replicas: 1
  selector:
    matchLabels:
      app: minio
  template:
    metadata:
      labels:
        app: minio
    spec:
      containers:
      - name: minio
        image: minio/minio:latest
        args:
        - server
        - /data
        - --console-address
        - ":9001"
        ports:
        - containerPort: 9000
        - containerPort: 9001
        env:
        - name: MINIO_ROOT_USER
          valueFrom:
            secretKeyRef:
              name: arxiv-curator-secrets
              key: minio-root-user
        - name: MINIO_ROOT_PASSWORD
          valueFrom:
            secretKeyRef:
              name: arxiv-curator-secrets
              key: minio-root-password
        volumeMounts:
        - name: minio-storage
          mountPath: /data
        resources:
          requests:
            memory: "1Gi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
      volumes:
      - name: minio-storage
        persistentVolumeClaim:
          claimName: minio-pvc

---
apiVersion: v1
kind: Service
metadata:
  name: minio
  namespace: arxiv-curator
spec:
  selector:
    app: minio
  ports:
  - name: api
    port: 9000
    targetPort: 9000
  - name: console
    port: 9001
    targetPort: 9001

---
# k8s/app.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: arxiv-curator-app
  namespace: arxiv-curator
spec:
  replicas: 2
  selector:
    matchLabels:
      app: arxiv-curator-app
  template:
    metadata:
      labels:
        app: arxiv-curator-app
    spec:
      containers:
      - name: app
        image: your-registry/arxiv-curator:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: arxiv-curator-secrets
              key: database-url
        - name: NEXTAUTH_SECRET
          valueFrom:
            secretKeyRef:
              name: arxiv-curator-secrets
              key: nextauth-secret
        - name: GEMINI_API_KEY
          valueFrom:
            secretKeyRef:
              name: arxiv-curator-secrets
              key: gemini-api-key
        - name: S3_ENDPOINT
          value: "http://minio:9000"
        - name: S3_ACCESS_KEY
          valueFrom:
            secretKeyRef:
              name: arxiv-curator-secrets
              key: minio-root-user
        - name: S3_SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: arxiv-curator-secrets
              key: minio-root-password
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "2Gi"
            cpu: "2000m"
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /api/ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5

---
apiVersion: v1
kind: Service
metadata:
  name: arxiv-curator-app
  namespace: arxiv-curator
spec:
  selector:
    app: arxiv-curator-app
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer

---
# k8s/worker.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: arxiv-curator-worker
  namespace: arxiv-curator
spec:
  replicas: 3
  selector:
    matchLabels:
      app: arxiv-curator-worker
  template:
    metadata:
      labels:
        app: arxiv-curator-worker
    spec:
      containers:
      - name: worker
        image: your-registry/arxiv-curator:latest
        command: ["npm", "run", "worker"]
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: arxiv-curator-secrets
              key: database-url
        - name: GEMINI_API_KEY
          valueFrom:
            secretKeyRef:
              name: arxiv-curator-secrets
              key: gemini-api-key
        - name: S3_ENDPOINT
          value: "http://minio:9000"
        - name: S3_ACCESS_KEY
          valueFrom:
            secretKeyRef:
              name: arxiv-curator-secrets
              key: minio-root-user
        - name: S3_SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: arxiv-curator-secrets
              key: minio-root-password
        resources:
          requests:
            memory: "1Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"

---
# k8s/cronjob.yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: arxiv-curator-digest
  namespace: arxiv-curator
spec:
  schedule: "0 6 * * *" # After 6am daily
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: digest-generator
            image: your-registry/arxiv-curator:latest
            command: ["npm", "run", "generate-digests"]
            env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: arxiv-curator-secrets
                  key: database-url
          restartPolicy: OnFailure
```

### 14.4 Environment Variables

```bash
# .env.example

# Database
DATABASE_URL=postgresql://arxiv_curator:password@localhost:5432/arxiv_curator

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-random-secret-here

# S3 Storage
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=arxiv-papers

# AI APIs
GEMINI_API_KEY=your-gemini-api-key
OPENAI_API_KEY=your-openai-api-key # Optional

# Local AI
OLLAMA_URL=http://localhost:11434

# App Config
NODE_ENV=development
PORT=3000
```

---

## 15. Success Metrics

### 15.1 User Engagement

**Daily Active Usage:**
- Target: 80% of users review briefings at least 5 days/week
- Measure: Daily active user percentage
- Tracking: Login events, briefing view events

**Papers Reviewed:**
- Target: Users review average of 12-18 papers/session
- Measure: Average papers viewed per session
- Tracking: Paper click events, time spent per paper

**Time Saved:**
- Baseline: 2+ hours/day manual scanning
- Target: 10-15 minutes/day with app
- Measure: Session duration
- User survey: "How much time does this save you?"

**Feedback Rate:**
- Target: >50% of viewed papers receive some feedback
- Measure: Feedback actions / paper views
- Tracking: Save, hide, dismiss, thumbs up/down events

### 15.2 System Performance

**Ingestion Lag:**
- Target: <6 hours from arXiv publication to availability
- Measure: Time between paper.pubDate and paper.createdAt
- Alert: >12 hours lag

**Digest Generation:**
- Target: <30 seconds for Today, <60 seconds for 7d
- Measure: Job duration in pg-boss
- Alert: >2 minutes

**Analysis Generation:**
- Target: 
  - Depth A: <60 seconds
  - Depth B: <2 minutes
  - Depth C: <5 minutes
- Measure: Job duration by depth
- Alert: 2x target exceeded

**API Response Time:**
- Target: p95 <500ms for tRPC calls
- Measure: Response time distribution
- Alert: p95 >1000ms

### 15.3 AI Quality

**Relevance Precision:**
- Target: >80% of "Must Read" papers rated useful
- Measure: (thumbs_up + save) / (thumbs_up + thumbs_down + save + hide)
- User survey: Weekly "How relevant were recommendations?"

**False Positive Rate:**
- Target: <20% immediate dismissals
- Measure: Dismissals within 30s of card display / total cards
- Tracking: Hide/dismiss actions with timestamps

**Exploration Success:**
- Target: >30% of exploration papers get positive feedback
- Measure: Positive actions on exploration papers / total exploration papers
- Insight: Are boundary-testing picks valuable?

**Synthesis Usefulness:**
- Target: >4.0/5.0 average rating
- Measure: User ratings on synthesis quality
- User feedback: "Was this synthesis helpful?"

### 15.4 Learning Effectiveness

**Profile Convergence:**
- Target: <2 weeks (14 days) to stable preferences
- Measure: Days until feedback rate stabilizes
- Tracking: Moving average of feedback variance

**Improvement Over Time:**
- Target: +20% relevance precision from Week 1 to Week 4
- Measure: Weekly relevance precision comparison
- Insight: Is the system learning effectively?

**Rule Accuracy:**
- Target: >70% of auto-learned rules confirmed by user
- Measure: Approved rules / total suggested rules
- Tracking: Rule approval events

### 15.5 Cost Efficiency

**Daily Cost per User:**
- Target: <$5/day per user
- Measure: Total API costs / active users
- Alert: >$7/day average over 7 days

**Local vs Cloud Usage:**
- Measure: % of operations using local models
- Insight: Cost optimization opportunity
- Tracking: Provider usage by operation type

---

## 16. Risk Mitigation

### 16.1 Technical Risks

**Risk: arXiv API Rate Limiting**
- **Impact:** High - could halt ingestion
- **Probability:** Medium
- **Mitigation:**
  - Global rate limiter (3s between requests)
  - Single ingest worker
  - Exponential backoff on errors
  - Cache category list (refresh daily)
- **Contingency:** Manual ingestion mode, reduce poll frequency

**Risk: Local Model Performance Issues**
- **Impact:** Medium - slower/lower quality
- **Probability:** Medium
- **Mitigation:**
  - Automatic fallback to cloud on timeout
  - User-configurable routing
  - Clear expectations in UI ("Local may be slower")
- **Contingency:** Default to cloud for all users

**Risk: PostgreSQL Performance Degradation**
- **Impact:** High - app unusable
- **Probability:** Low
- **Mitigation:**
  - Proper indexing (especially vector indexes)
  - Query optimization
  - Connection pooling
  - Regular VACUUM and ANALYZE
- **Contingency:** Read replicas for heavy queries

**Risk: S3 Storage Costs**
- **Impact:** Medium - unexpected bills
- **Probability:** Low
- **Mitigation:**
  - Lifecycle policies (delete old PDFs after 90 days)
  - Compression for JSON artifacts
  - Monitor storage growth
- **Contingency:** Purge old artifacts, use CDN caching

### 16.2 Data Quality Risks

**Risk: Noisy Abstracts Leading to Poor Recommendations**
- **Impact:** High - low user satisfaction
- **Probability:** Medium
- **Mitigation:**
  - Conservative ranking (higher evidence weight)
  - Exploration quota to test boundaries
  - User feedback loop for corrections
- **Contingency:** Manual curation mode, user-defined filters

**Risk: SOTA Claims Incomparability**
- **Impact:** Medium - misleading trends
- **Probability:** High
- **Mitigation:**
  - Comparability warnings on SOTA board
  - Note different datasets/splits
  - Avoid overclaiming in summaries
- **Contingency:** Disable SOTA board, show only velocity

**Risk: Over-Personalization (Filter Bubble)**
- **Impact:** Medium - miss important work
- **Probability:** Medium
- **Mitigation:**
  - Default 15% exploration rate
  - "Field Highlights" section (high significance, low personal fit)
  - Trend pages for breadth awareness
- **Contingency:** Manual topic discovery mode

### 16.3 Operational Risks

**Risk: Cost Overruns**
- **Impact:** High - budget exceeded
- **Probability:** Medium
- **Mitigation:**
  - Hard budget gates in code
  - Local-first routing by default
  - Usage monitoring and alerts
  - Per-user cost tracking
- **Contingency:** Disable auto-analyses, increase local usage

**Risk: Worker Process Crashes**
- **Impact:** Medium - delayed processing
- **Probability:** Low
- **Mitigation:**
  - Process manager (PM2 or Docker restart policies)
  - Job retries in pg-boss
  - Health checks and alerting
- **Contingency:** Manual job triggering, horizontal scaling

**Risk: Database Migration Failures**
- **Impact:** High - data loss or corruption
- **Probability:** Low
- **Mitigation:**
  - Test migrations on staging
  - Automated backups before migration
  - Rollback procedures
- **Contingency:** Restore from backup, manual data fixes

---

## 17. Appendix

### 17.1 Glossary

**Terms:**
- **arXiv:** Open-access repository of electronic preprints
- **OAI-PMH:** Open Archives Initiative Protocol for Metadata Harvesting
- **Embedding:** Vector representation of text for semantic similarity
- **LOF:** Local Outlier Factor, anomaly detection algorithm
- **EMA:** Exponential Moving Average
- **Tier 0:** Abstract-only processing (cheap, fast)
- **Tier 1:** PDF-based analysis (expensive, high-quality)
- **pg-boss:** PostgreSQL-based job queue
- **pgvector:** PostgreSQL extension for vector similarity search
- **ollama:** Local LLM runtime

### 17.2 Reference Links

**Technologies:**
- Next.js: https://nextjs.org/
- Prisma: https://www.prisma.io/
- pgvector: https://github.com/pgvector/pgvector
- pg-boss: https://github.com/timgit/pg-boss
- LangGraph: https://langchain-ai.github.io/langgraphjs/
- ollama: https://ollama.com/
- Gemini API: https://ai.google.dev/

**arXiv:**
- arXiv API: https://arxiv.org/help/api/
- OAI-PMH: https://arxiv.org/help/oa/
- Category Taxonomy: https://arxiv.org/category_taxonomy

### 17.3 Future Enhancements (Post-MVP)

**Short-term (v2):**
- Chat/command bar interface
- Multi-user collaboration (shared notebooks)
- Email digest summaries
- Slack/Discord notifications
- Mobile responsive improvements
- Author following
- Citation network visualization
- Paper alerts (specific topics)

**Medium-term (v3):**
- Integration with more sources (OpenAlex, PubMed)
- Conference proceeding tracking (NeurIPS, ICML, etc.)
- Advanced bandit algorithms (Thompson Sampling)
- Collaborative filtering (learn from similar users)
- Paper recommendation system (similar to Netflix)
- Reading list generation
- Automated literature reviews

**Long-term (v4+):**
- Mobile apps (React Native)
- Browser extension (one-click save)
- Integration with reference managers (Zotero, Mendeley)
- Academic writing assistant
- Research proposal generator
- Grant application support
- Peer review assistance

### 17.4 Acceptance Criteria (MVP)

**Must Have:**
- [ ] Settings: toggle sources, select arXiv categories, configure personalization
- [ ] Daily digest "Today" shows 10-20 high-signal papers
- [ ] Each paper has "Why shown" attribution with feature breakdown
- [ ] Can generate Critique A in <60s
- [ ] Can save papers to collections
- [ ] Can export collections as Markdown/PDF
- [ ] New arXiv versions supersede old versions and purge artifacts
- [ ] System respects rate limits (≤1 req/3s for arXiv)
- [ ] Costs stay ≤$5/day per user
- [ ] Works with local embeddings and LLMs (ollama)

**Should Have:**
- [ ] Can generate Critique B/C (cloud required)
- [ ] Trend heatmap and velocity
- [ ] Exploration picks clearly labeled
- [ ] Learned rules displayed for review/approval
- [ ] Keyboard shortcuts (J/K/S/H/C)
- [ ] Mobile responsive (basic)

**Nice to Have:**
- [ ] Chat/command interface
- [ ] Email notifications
- [ ] NotebookLM sync
- [ ] Advanced trend analysis (emerging topics, technique graph)

---

## Conclusion

**ArXiv Curator** is a comprehensive, cost-conscious, AI-powered research paper curation platform designed specifically for your needs. By combining aggressive personalization, transparent scoring, local-first AI, and on-demand deep analysis, it transforms the overwhelming task of staying current with AI research from hours of daily work into minutes of focused review.

The system is architected for:
- **Personal use first**, with multi-tenancy ready for future expansion
- **Local-first AI** to minimize costs while maintaining flexibility
- **TypeScript-only** implementation using Next.js and modern Node.js
- **Pull-based workflow** with on-demand digest generation
- **Deterministic, explainable recommendations** with feature attributions
- **Tiered analysis** (Fast/Compare/Deep) to balance cost and quality

**Implementation timeline:** 10-12 weeks from foundation to beta

**Target cost:** $0.80-5.00/day depending on local vs cloud usage

**Key differentiators:**
- Pluggable AI providers (local or cloud)
- Transparent "why shown" explanations
- Three-tier critique system
- Collection synthesis with pattern extraction
- Supersedence handling for paper versions
- Pull-on-demand workflow (not pushy)

This design document serves as the complete specification for building ArXiv Curator. All architectural decisions, data models, APIs, and UI components are defined and ready for implementation.

**Next steps:**
1. Review and approve this final design
2. Set up development environment (Docker Compose)
3. Initialize Next.js project with Prisma
4. Begin Phase 0: Foundation

Ready to build!