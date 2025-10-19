# Phase 0: Foundation - Technical Design

## Overview

Phase 0 establishes the foundational infrastructure for the ArXiv Curator platform. This includes the database, authentication, API layer, job queue, object storage, and development environment.

**Timeline**: Week 1
**Status**: In Progress

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Next.js 15 Application               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │   App Router │  │  API (tRPC)  │  │  Auth        │  │
│  │   (React 19) │  │  Routes      │  │  (Auth.js)   │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
│         ↓                  ↓                  ↓          │
│  ┌─────────────────────────────────────────────────┐   │
│  │         Server-side API Layer (tRPC)            │   │
│  └─────────────────────────────────────────────────┘   │
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

---

## Technology Stack

| Component | Technology | Version | Justification |
|-----------|-----------|---------|---------------|
| Runtime | Node.js | 20 LTS | Stable LTS, required for Next.js 15 |
| Framework | Next.js | 15.x | App Router, Server Components, React 19, Turbopack |
| Language | TypeScript | 5.x | Type safety, better DX |
| Database | PostgreSQL | 17+ | Latest stable, pgvector support, JSONB for flexible data |
| Vector Extension | pgvector | 0.8+ | Similarity search for embeddings |
| ORM | Prisma | 6.x | Type-safe queries, migrations, excellent DX |
| Auth | NextAuth.js (Auth.js) | 5.x | Latest version with improved DX and security |
| API Layer | tRPC | 11.x | End-to-end type safety, no code generation |
| Job Queue | pg-boss | 10.x | PostgreSQL-backed, ACID guarantees, simple |
| Object Storage | MinIO | Latest | S3-compatible, self-hosted, Docker-friendly |
| Container | Docker | Latest | Development environment consistency |

---

## Database Schema (Core Models)

### User
```prisma
model User {
  id            String    @id @default(cuid())
  name          String?
  email         String    @unique
  emailVerified DateTime?
  image         String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts      Account[]
  sessions      Session[]
  profile       UserProfile?
  feedback      Feedback[]
  analyses      Analysis[]
  notebooks     Notebook[]
}
```

**Rationale**: Standard NextAuth.js user model with relations to profile, feedback, and future features.

---

### Account (NextAuth.js)
```prisma
model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String? @db.Text
  access_token      String? @db.Text
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String? @db.Text
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
  @@index([userId])
}
```

**Rationale**: OAuth provider account storage for NextAuth.js.

---

### Session (NextAuth.js)
```prisma
model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

**Rationale**: Session management for NextAuth.js.

---

### VerificationToken (NextAuth.js)
```prisma
model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}
```

**Rationale**: Email verification tokens for NextAuth.js.

---

### UserProfile
```prisma
model UserProfile {
  id                   String   @id @default(cuid())
  userId               String   @unique

  // Personalization
  interestVector       Float[]  // 768-dim embedding for user interests
  includeTopics        String[] // Topics to boost (e.g., ["transformers", "diffusion"])
  excludeTopics        String[] // Topics to filter out
  includeKeywords      String[] // Keywords to boost
  excludeKeywords      String[] // Keywords to filter out
  labBoosts            Json     // Lab preferences: { "DeepMind": 0.05, "OpenAI": 0.03 }

  // Preferences
  mathDepthMax         Float    @default(1.0)  // 0.0-1.0 tolerance for math-heavy papers
  explorationRate      Float    @default(0.15) // 15% exploration picks
  noiseCap             Int      @default(50)   // Max papers per day
  targetToday          Int      @default(15)   // Target digest size (today)
  target7d             Int      @default(100)  // Target digest size (7 days)

  // Sources
  arxivCategories      String[] @default(["cs.AI", "cs.LG", "cs.CV", "cs.CL"])
  sourcesEnabled       Json     @default("{\"arxiv\": true, \"openAlex\": false, \"semanticScholar\": false}")

  // AI Model Preferences
  useLocalEmbeddings   Boolean  @default(true)
  useLocalLLM          Boolean  @default(true)
  preferredLLM         String   @default("gemini-2.0-flash") // gemini-2.0-flash, gpt-4o-mini, etc.

  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}
```

**Rationale**: User-specific preferences and learned profile. JSON used for flexible lab boosts and source configuration.

---

### Paper
```prisma
model Paper {
  id              String   @id @default(cuid())

  // arXiv identifiers
  arxivId         String   @unique // e.g., "2401.12345"
  version         Int      @default(1)

  // Core metadata
  title           String
  authors         String[] // Array of author names
  abstract        String   @db.Text

  // arXiv-specific
  categories      String[] // e.g., ["cs.AI", "cs.LG"]
  primaryCategory String   // e.g., "cs.AI"

  // URLs
  pdfUrl          String?
  codeUrl         String?

  // Dates
  pubDate         DateTime // Original publication date
  updatedDate     DateTime // Last update date

  // Raw metadata (full arXiv response for reference)
  rawMetadata     Json?

  // Processing status
  status          String   @default("pending") // pending, enriched, failed

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relations
  enriched        PaperEnriched?
  scores          Score[]
  feedback        Feedback[]
  summaries       Summary[]
  analyses        Analysis[]
  notebookItems   NotebookItem[]

  @@index([arxivId, version])
  @@index([pubDate])
  @@index([status])
  @@index([primaryCategory])
}
```

**Rationale**: Core paper metadata from arXiv. Arrays for authors/categories, JSONB for raw metadata flexibility.

---

### PaperEnriched
```prisma
model PaperEnriched {
  id                String   @id @default(cuid())
  paperId           String   @unique

  // Computed features
  topics            String[] // e.g., ["transformers", "attention", "nlp"]
  facets            String[] // e.g., ["architecture", "training", "evaluation"]
  embedding         Float[]  // 768-dim vector (all-MiniLM-L6-v2 or text-embedding-004)

  // Signals
  mathDepth         Float    @default(0.0) // 0.0-1.0 estimate of mathematical complexity
  hasCode           Boolean  @default(false)
  hasData           Boolean  @default(false)
  hasBaselines      Boolean  @default(false)
  hasAblations      Boolean  @default(false)
  hasMultipleEvals  Boolean  @default(false)

  enrichedAt        DateTime @default(now())

  paper Paper @relation(fields: [paperId], references: [id], onDelete: Cascade)

  @@index([paperId])
}
```

**Rationale**: Computed enrichment data. Separate table for clean separation of concerns. Vector stored as Float[] for pgvector indexing.

**Note**: pgvector index will be added via raw SQL migration:
```sql
CREATE INDEX papers_enriched_embedding_idx
ON "PaperEnriched"
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

---

### Score
```prisma
model Score {
  id            String   @id @default(cuid())
  paperId       String

  // Signal components (0.0-1.0 each)
  novelty       Float    @default(0.0)
  evidence      Float    @default(0.0)
  velocity      Float    @default(0.0)
  personalFit   Float    @default(0.0)
  labPrior      Float    @default(0.0) // 0.0-0.05 range
  mathPenalty   Float    @default(0.0) // 0.0-0.3 range (subtracted)

  // Final score
  finalScore    Float    @default(0.0)

  // Feature attribution for "Why Shown" (JSON)
  whyShown      Json?    // { "novelty": 0.28, "evidence": 0.30, ... }

  createdAt     DateTime @default(now())

  paper Paper @relation(fields: [paperId], references: [id], onDelete: Cascade)

  @@index([paperId])
  @@index([finalScore])
}
```

**Rationale**: Multi-signal scoring system. Separate table allows score history. JSON for flexible attribution explanations.

---

### Feedback
```prisma
model Feedback {
  id        String   @id @default(cuid())
  userId    String
  paperId   String

  // Feedback type
  action    String   // "save", "dismiss", "thumbs_up", "thumbs_down", "hide"
  weight    Float    @default(1.0) // Weight for learning (e.g., 1.0 = save, -1.0 = dismiss)
  context   String?  // Optional context (e.g., "from_briefing", "from_search")

  createdAt DateTime @default(now())

  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)
  paper Paper @relation(fields: [paperId], references: [id], onDelete: Cascade)

  @@unique([userId, paperId, action]) // Prevent duplicate feedback
  @@index([userId])
  @@index([paperId])
  @@index([createdAt])
}
```

**Rationale**: User feedback for learning. Weight allows exponential moving average updates to user profile.

---

## Environment Variables

```bash
# Database
DATABASE_URL="postgresql://postgres:password@localhost:5432/arxiv_curator"

# NextAuth.js
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<generated-secret>"

# MinIO (S3-compatible storage)
MINIO_ENDPOINT="localhost"
MINIO_PORT="9000"
MINIO_ACCESS_KEY="minioadmin"
MINIO_SECRET_KEY="minioadmin"
MINIO_USE_SSL="false"
MINIO_BUCKET="arxiv-curator"

# AI Services (Phase 1+, placeholder for now)
# OPENAI_API_KEY=""
# GOOGLE_API_KEY=""
# OLLAMA_BASE_URL="http://localhost:11434"
```

---

## Docker Compose Configuration

```yaml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg17
    container_name: arxiv-curator-postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
      POSTGRES_DB: arxiv_curator
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 10s
      timeout: 5s
      retries: 5

  minio:
    image: minio/minio:latest
    container_name: arxiv-curator-minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"  # API
      - "9001:9001"  # Console
    volumes:
      - minio_data:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  minio_data:
```

**Rationale**:
- `pgvector/pgvector:pg17` provides PostgreSQL 17 with pgvector 0.8+ extension pre-installed
- MinIO provides S3-compatible storage for development
- Healthchecks ensure services are ready before app starts
- Named volumes persist data across container restarts

---

## tRPC Router Structure

```typescript
// src/server/routers/_app.ts
import { router } from '../trpc';
import { healthRouter } from './health';

export const appRouter = router({
  health: healthRouter,
  // Future routers will be added here:
  // papers: papersRouter,
  // briefings: briefingsRouter,
  // etc.
});

export type AppRouter = typeof appRouter;
```

**Rationale**: Modular router structure. Start with health check endpoint, add feature routers in later phases.

---

## NextAuth.js (Auth.js v5) Configuration

```typescript
// src/lib/auth.ts
import NextAuth from 'next-auth';
import { PrismaAdapter } from '@auth/prisma-adapter';
import Credentials from 'next-auth/providers/credentials';
import { prisma } from '@/server/db';
import { compare } from 'bcryptjs';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: {
    strategy: 'jwt',
  },
  pages: {
    signIn: '/auth/signin',
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user) {
          return null;
        }

        // Note: Password hashing to be implemented in user registration
        // For now, this is a placeholder
        return user;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
});
```

**Rationale**:
- Auth.js v5 (NextAuth.js v5) with improved API and security
- JWT strategy for stateless sessions
- PrismaAdapter for database persistence
- Credentials provider for email/password (OAuth can be added later)
- Session callback adds user ID to session

---

## pg-boss Configuration

```typescript
// src/server/queue.ts
import PgBoss from 'pg-boss';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

export const boss = new PgBoss({
  connectionString,
  schema: 'pgboss', // Separate schema for job tables
});

export async function startQueue() {
  await boss.start();
  console.log('pg-boss started');
}

export async function stopQueue() {
  await boss.stop();
  console.log('pg-boss stopped');
}

// Job type definitions (for type safety)
export type JobName =
  | 'scout-papers'          // Phase 1
  | 'enrich-paper'          // Phase 1
  | 'score-paper'           // Phase 2
  | 'generate-briefing'     // Phase 3
  | 'generate-summary'      // Phase 4
  | 'analyze-paper'         // Phase 5
  | 'synthesize-notebook';  // Phase 6

export interface JobData {
  'scout-papers': { date: string };
  'enrich-paper': { paperId: string };
  'score-paper': { paperId: string; userId: string };
  'generate-briefing': { userId: string; date: string };
  'generate-summary': { paperId: string };
  'analyze-paper': { paperId: string; userId: string; depth: 'A' | 'B' | 'C' };
  'synthesize-notebook': { notebookId: string };
}
```

**Rationale**:
- pg-boss uses PostgreSQL as backend (no Redis needed)
- Type-safe job names and data
- Separate schema (`pgboss`) keeps job tables isolated
- Job types defined upfront for planning (implementation in later phases)

---

## MinIO S3 Client Configuration

```typescript
// src/server/storage.ts
import { S3Client } from '@aws-sdk/client-s3';

const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
const port = process.env.MINIO_PORT || '9000';
const accessKeyId = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const secretAccessKey = process.env.MINIO_SECRET_KEY || 'minioadmin';
const useSSL = process.env.MINIO_USE_SSL === 'true';

export const s3Client = new S3Client({
  endpoint: `${useSSL ? 'https' : 'http'}://${endpoint}:${port}`,
  region: 'us-east-1', // MinIO ignores region, but SDK requires it
  credentials: {
    accessKeyId,
    secretAccessKey,
  },
  forcePathStyle: true, // Required for MinIO
});

export const BUCKET_NAME = process.env.MINIO_BUCKET || 'arxiv-curator';
```

**Rationale**:
- AWS SDK v3 for S3 compatibility
- `forcePathStyle: true` required for MinIO
- Environment-based configuration

---

## Testing Strategy (TDD)

### Unit Tests
- **Prisma models**: Ensure CRUD operations work
- **tRPC routers**: Test endpoint logic
- **Auth**: Test authentication flow
- **Job queue**: Test job enqueueing/processing

### Integration Tests
- **Database**: Test migrations, pgvector extension
- **MinIO**: Test bucket creation, file upload
- **NextAuth**: Test login flow end-to-end

### Test Framework
- **Vitest**: Fast, Vite-powered test runner
- **Testing Library**: Component/UI testing
- **Prisma Test Helpers**: In-memory database for tests

### Example Test Structure
```typescript
// __tests__/server/health.test.ts
import { describe, it, expect } from 'vitest';
import { appRouter } from '@/server/routers/_app';
import { createCallerFactory } from '@/server/trpc';

describe('Health Router', () => {
  it('should return healthy status', async () => {
    const createCaller = createCallerFactory(appRouter);
    const caller = createCaller({});

    const result = await caller.health.check();

    expect(result).toEqual({ status: 'healthy' });
  });
});
```

---

## Acceptance Criteria

Phase 0 is complete when:

- [ ] **Infrastructure**
  - [ ] Docker Compose starts PostgreSQL 16 with pgvector
  - [ ] Docker Compose starts MinIO
  - [ ] Database migrations run successfully
  - [ ] pgvector extension enabled

- [ ] **Next.js Application**
  - [ ] Next.js 14 app with TypeScript and App Router
  - [ ] Development server runs at `http://localhost:3000`
  - [ ] Environment variables loaded correctly

- [ ] **Database & ORM**
  - [ ] Prisma schema defines all core models
  - [ ] Migrations create tables successfully
  - [ ] Prisma Client generates types
  - [ ] Can create/read User records

- [ ] **Authentication**
  - [ ] NextAuth.js configured with Credentials provider
  - [ ] User can register (placeholder implementation)
  - [ ] User can login
  - [ ] Session persists across requests

- [ ] **API Layer**
  - [ ] tRPC router configured
  - [ ] Health check endpoint: `/api/trpc/health.check` returns `{ status: 'healthy' }`
  - [ ] tRPC client works from React components

- [ ] **Job Queue**
  - [ ] pg-boss tables created in `pgboss` schema
  - [ ] Can enqueue test job
  - [ ] Can process test job

- [ ] **Object Storage**
  - [ ] MinIO bucket created (`arxiv-curator`)
  - [ ] Can upload test file
  - [ ] Can download test file

- [ ] **Testing**
  - [ ] Unit tests pass for health router
  - [ ] Integration tests pass for database
  - [ ] Test coverage >80% for Phase 0 code

- [ ] **Code Quality**
  - [ ] Linting passes (`npm run lint`)
  - [ ] Formatting passes (as per user's formatter)
  - [ ] Build succeeds (`npm run build`)
  - [ ] No TypeScript errors

---

## Implementation Order (TDD Workflow)

1. **Set up Next.js project** + TypeScript + Tailwind
2. **Write test**: Health check endpoint should return `{ status: 'healthy' }`
3. **Implement**: tRPC health router
4. **Configure Docker Compose**: PostgreSQL + MinIO
5. **Write test**: Database connection should succeed
6. **Implement**: Prisma client initialization
7. **Write test**: Core models should be creatable
8. **Implement**: Prisma schema + migrations
9. **Write test**: NextAuth login should work
10. **Implement**: NextAuth.js configuration
11. **Write test**: Job should be enqueueable
12. **Implement**: pg-boss setup
13. **Write test**: File should be uploadable to MinIO
14. **Implement**: S3 client configuration
15. **Verify all acceptance criteria**

---

## File Structure

```
arxiv-curator/
├── .env.local                    # Environment variables
├── docker-compose.yml            # PostgreSQL + MinIO
├── package.json
├── tsconfig.json
├── next.config.js
├── tailwind.config.ts
├── prisma/
│   ├── schema.prisma             # Database schema
│   └── migrations/
│       └── 20250119_init/        # Initial migration
│           └── migration.sql
├── src/
│   ├── app/                      # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── api/
│   │       ├── auth/[...nextauth]/route.ts
│   │       └── trpc/[trpc]/route.ts
│   ├── lib/
│   │   └── auth.ts               # NextAuth config
│   ├── server/
│   │   ├── db.ts                 # Prisma client
│   │   ├── trpc.ts               # tRPC setup
│   │   ├── queue.ts              # pg-boss setup
│   │   ├── storage.ts            # MinIO S3 client
│   │   └── routers/
│   │       ├── _app.ts           # Root router
│   │       └── health.ts         # Health check router
│   └── types/
│       └── next-auth.d.ts        # NextAuth type extensions
├── __tests__/
│   ├── server/
│   │   ├── health.test.ts
│   │   ├── db.test.ts
│   │   └── queue.test.ts
│   └── integration/
│       ├── auth.test.ts
│       └── storage.test.ts
└── docs/
    ├── DESIGN_SPEC.md
    ├── IMPLEMENTATION_ROADMAP.md
    └── phase-0-technical-design.md  # This file
```

---

## Dependencies

```json
{
  "dependencies": {
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@prisma/client": "^6.1.0",
    "@trpc/server": "^11.0.0",
    "@trpc/client": "^11.0.0",
    "@trpc/react-query": "^11.0.0",
    "@trpc/next": "^11.0.0",
    "@tanstack/react-query": "^5.62.0",
    "next-auth": "^5.0.0-beta.25",
    "@auth/prisma-adapter": "^2.7.4",
    "pg-boss": "^10.1.6",
    "@aws-sdk/client-s3": "^3.705.0",
    "bcryptjs": "^2.4.3",
    "zod": "^3.24.1",
    "superjson": "^2.2.2"
  },
  "devDependencies": {
    "@types/node": "^22.10.2",
    "@types/react": "^19.0.6",
    "@types/react-dom": "^19.0.2",
    "@types/bcryptjs": "^2.4.6",
    "typescript": "^5.7.2",
    "prisma": "^6.1.0",
    "vitest": "^2.1.8",
    "@testing-library/react": "^16.1.0",
    "@testing-library/jest-dom": "^6.6.3",
    "tailwindcss": "^3.4.17",
    "autoprefixer": "^10.4.20",
    "postcss": "^8.4.49",
    "eslint": "^9.17.0",
    "eslint-config-next": "^15.1.0"
  }
}
```

---

## Next Steps (After Phase 0)

Once Phase 0 acceptance criteria are met:

1. **Phase 1: Ingestion & Enrichment**
   - Scout Agent (arXiv OAI-PMH client)
   - Enricher Agent (embeddings, classification)

2. **Deploy to development environment**
   - Test infrastructure under load
   - Validate data flow

---

**End of Phase 0 Technical Design**
