# ArXiv Curator

AI-powered research paper curation system for arXiv. Transform overwhelming daily feeds of hundreds/thousands of papers into a curated digest of 10-20 high-signal papers personalized to your research interests.

**Status**: Phase 2 (Personalization & Scoring) - ✅ Complete

## Features

- **Aggressive Personalization**: Learned preferences + explicit rules for topic filtering
- **Multi-Signal Ranking**: Novelty, Evidence, Velocity, Personal Fit, Lab Prior
- **On-Demand Analysis**: Three-tier critique system (Fast/Compare/Deep)
- **Collection Synthesis**: Organize papers into actionable insights
- **Cost-Conscious**: ≤$5/day target with local-first LLM/embedding options
- **Transparent**: "Why Shown" explanations for every recommendation

## Prerequisites

- **Node.js** 20 LTS or higher
- **Docker** and Docker Compose
- **npm** (comes with Node.js)

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd arxiv-curator
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env.local
# Edit .env.local with your configuration
```

### 3. Start Infrastructure

```bash
# Start PostgreSQL and MinIO
docker-compose up -d

# Verify services are running
docker ps
```

### 4. Run Database Migrations

```bash
npx prisma migrate dev
```

### 5. Seed Database

```bash
# Create default user and profile
npx prisma db seed
```

This creates a default user (`user-1`) and profile needed for the application to function properly.

### 6. Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the application.

## Project Structure

```
arxiv-curator/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   └── trpc/         # tRPC endpoints
│   ├── layout.tsx        # Root layout with providers
│   └── page.tsx          # Homepage
├── server/                # Backend logic
│   ├── db.ts             # Prisma client singleton
│   ├── env.ts            # Environment variable validation
│   ├── queue.ts          # pg-boss job queue
│   ├── storage.ts        # MinIO S3 client
│   ├── trpc.ts           # tRPC configuration
│   ├── agents/           # AI agents
│   │   ├── scout.ts      # arXiv ingestion agent
│   │   └── enricher.ts   # Paper enrichment agent
│   ├── lib/              # Server utilities
│   │   ├── arxiv.ts      # arXiv API client
│   │   ├── embeddings.ts # Embedding generation
│   │   ├── classifier.ts # LLM classification
│   │   └── rate-limiter.ts # API rate limiting
│   └── routers/          # tRPC routers
│       ├── _app.ts       # Root router
│       ├── health.ts     # Health check endpoint
│       ├── papers.ts     # Papers CRUD & queries
│       └── settings.ts   # User settings
├── lib/                   # Shared utilities
│   ├── trpc.tsx          # tRPC React provider
│   └── utils.ts          # Utility functions (cn, etc.)
├── worker/                # Background workers
│   ├── index.ts          # Worker process entry point
│   └── workflows/        # LangGraph.js workflows
│       └── scout-enrich.ts # Scout → Enrich pipeline
├── components/            # Reusable UI components
│   └── ui/               # shadcn/ui components
├── prisma/                # Database schema & migrations
│   ├── schema.prisma     # Prisma schema (17 models)
│   └── migrations/       # Migration files
├── __tests__/             # Test files
│   ├── server/           # Server-side tests (agents, routers, lib)
│   └── app/              # UI component tests
├── docs/                  # Documentation
│   ├── DESIGN_SPEC.md    # Full design specification
│   ├── IMPLEMENTATION_ROADMAP.md  # 10-week roadmap
│   ├── phase-0-technical-design.md
│   └── PHASE_0_COMPLETION.md
└── docker-compose.yml     # PostgreSQL + MinIO services
```

## Tech Stack

| Component | Technology | Version |
|-----------|-----------|---------|
| Framework | Next.js | 15.x |
| Runtime | React | 19.x |
| Language | TypeScript | 5.x |
| Database | PostgreSQL | 17+ |
| Vector Search | pgvector | 0.8+ |
| ORM | Prisma | 6.x |
| API Layer | tRPC | 11.x |
| Auth | Auth.js (NextAuth v5) | 5.x beta |
| Job Queue | pg-boss | 10.x |
| Storage | MinIO (S3) | Latest |
| Testing | Vitest | 3.x |

## Available Scripts

```bash
npm run dev          # Start development server (with Turbopack)
npm run build        # Build for production
npm run start        # Start production server
npm test             # Run tests in watch mode
npm run test:run     # Run tests once
npm run lint         # Run ESLint
```

## Testing

```bash
# Run all tests
npm run test:run

# Run specific test file
npm test -- health.test.ts

# Run tests with coverage
npm test -- --coverage
```

Current test coverage: **149 tests passing** across 15 test files
- Scout Agent (5 unit + 5 integration)
- Enricher Agent (11 unit + 8 integration)
- Scout-Enrich Workflow (6 tests)
- Ranker Agent (18 tests)
- arXiv library (13 tests)
- Rate limiter (3 tests)
- Scoring library (45 tests)
- Feedback system (17 tests)
- Rules engine (10 tests)
- Embeddings & Classification (tested in agent tests)
- tRPC routers - Papers (7 tests), Settings (8 tests)
- UI components - Settings page (7 tests), Papers page (7 tests)
- Database connectivity (3 tests)
- Health endpoint (3 tests)
- Job queue (3 tests)
- Storage (3 tests)

## Docker Services

The project uses Docker Compose to run:

- **PostgreSQL 17** with pgvector extension (port 5433)
- **MinIO** S3-compatible storage (ports 9000, 9001)

```bash
# Start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

## Database

### Migrations

```bash
# Create a new migration
npx prisma migrate dev --name migration_name

# Apply migrations
npx prisma migrate deploy

# Reset database (DEV ONLY)
npx prisma migrate reset
```

### Seeding

```bash
# Seed database with default user and profile
npx prisma db seed

# This creates:
# - Default user with ID 'user-1'
# - Default user profile with empty interest vector
# - Default preferences (categories, settings, etc.)
```

**Note**: The seed script is required for the application to work properly. Run it after migrations.

### Prisma Studio

```bash
# Open Prisma Studio (database GUI)
npx prisma studio
```

## Environment Variables

See `.env.example` for all available configuration options.

**Required**:
- `DATABASE_URL` - PostgreSQL connection string
- `MINIO_ACCESS_KEY` - MinIO access key
- `MINIO_SECRET_KEY` - MinIO secret key

**Optional** (for Phase 1+):
- `AUTH_SECRET` - NextAuth.js secret (generate with `openssl rand -base64 32`)
- `OPENAI_API_KEY` - OpenAI API key
- `GOOGLE_API_KEY` - Google AI API key
- `OLLAMA_BASE_URL` - Local Ollama instance URL

## Phase 0: Foundation ✅

The following infrastructure is complete and tested:

- ✅ PostgreSQL 17 with pgvector extension
- ✅ Prisma ORM with comprehensive schema (17 models)
- ✅ tRPC v11 API layer with full type safety
- ✅ MinIO S3-compatible storage
- ✅ pg-boss job queue (PostgreSQL-backed)
- ✅ Environment variable validation (Zod)
- ✅ Health check endpoint (database + storage)
- ✅ tRPC React provider
- ✅ Docker Compose development environment

## Phase 1: Ingestion & Enrichment ✅

Data pipeline and UI foundation complete:

**Scout Agent** (arXiv Ingestion):
- ✅ OAI-PMH category fetcher
- ✅ Atom feed parser for recent papers
- ✅ Rate limiter (1 req/3sec for arXiv compliance)
- ✅ Paper version supersedence handling
- ✅ Comprehensive test coverage (10 tests)

**Enricher Agent** (Tier 0 Processing):
- ✅ Embedding generation (local ollama + cloud fallback)
- ✅ Math depth estimation (LaTeX density + theory keywords)
- ✅ Topic/facet classification (zero-shot LLM)
- ✅ Evidence signal detection (baselines, ablations, code, data)
- ✅ Comprehensive test coverage (19 tests)

**Worker Process**:
- ✅ LangGraph.js workflow orchestration
- ✅ Scout → Enrich pipeline
- ✅ Job queue integration with pg-boss
- ✅ Workflow tests (6 tests)

**UI Pages** (shadcn/ui + React 19):
- ✅ Settings page (category selection, local/cloud routing)
- ✅ Papers page (list view with enrichment badges, pagination)
- ✅ Updated homepage with quick action cards
- ✅ UI component tests (14 tests)
- ✅ tRPC router tests (15 tests)

**Phase 1 Total**: 92 tests passing across initial test files

**Phase 2 Total**: 149 tests passing across 15 test files (including all Phase 1 + Phase 2 tests)

## Roadmap

**Phase 1** (Week 2): Ingestion & Enrichment ✅
- ✅ Scout Agent (arXiv OAI-PMH/Atom client)
- ✅ Enricher Agent (embeddings, classification, evidence detection)
- ✅ Worker process (LangGraph.js workflow orchestration)
- ✅ Settings UI (category selection, local/cloud routing)
- ✅ Papers UI (list view with enrichment badges)

**Phase 2** (Week 3): Personalization & Scoring ✅
- ✅ Multi-signal ranking algorithm (Novelty, Evidence, Personal Fit, Lab Prior, Math Penalty)
- ✅ User profile learning (EMA-based interest vector updates)
- ✅ Feedback system (save, dismiss, thumbs up/down, hide)
- ✅ Rules engine (topic/keyword include/exclude)
- ✅ Scoring library (45 tests)
- ✅ Feedback integration (17 tests)
- ✅ Ranker agent (18 tests)

**Phase 3** (Week 4): Briefings & Core UI
- Daily digest generation
- Three-pane layout
- Paper cards with explanations

**Phase 4+**: Summaries, Analysis, Collections, Trends, Polish, Beta

See `docs/IMPLEMENTATION_ROADMAP.md` for the complete 12-week plan.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js 15 Application               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   App Router │  │  API (tRPC)  │  │  Auth        │  │
│  │   (React 19) │  │  Routes      │  │  (Auth.js)   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────────┐
│                   PostgreSQL 17 + pgvector              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   Prisma     │  │  pg-boss     │  │  Vector      │  │
│  │   Tables     │  │  (Jobs)      │  │  Search      │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────────┐
│              MinIO (S3-Compatible Storage)              │
│              (PDFs, artifacts, exports)                 │
└─────────────────────────────────────────────────────────┘
```

## API Documentation

### Health Check

```typescript
// GET /api/trpc/health.check
{
  "status": "healthy" | "degraded",
  "timestamp": "2025-01-19T12:00:00.000Z",
  "services": {
    "database": "connected" | "disconnected",
    "storage": "connected" | "disconnected"
  }
}
```

### Using tRPC from React

```typescript
'use client';
import { trpc } from '@/lib/trpc';

export default function MyComponent() {
  const { data, isLoading } = trpc.health.check.useQuery();

  if (isLoading) return <div>Loading...</div>;

  return <div>Status: {data.status}</div>;
}
```

## Contributing

This is a personal project following the serial development roadmap. Phase 0 is complete; Phase 1 begins next.

## License

MIT

## Support

For issues or questions, please check the documentation in the `docs/` directory:
- `DESIGN_SPEC.md` - Full technical specification
- `IMPLEMENTATION_ROADMAP.md` - Development timeline
- `PHASE_0_COMPLETION.md` - Phase 0 summary

---

**Built with Next.js 15, React 19, TypeScript, and modern best practices.**
