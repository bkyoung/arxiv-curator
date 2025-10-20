# Phase 4: Summaries - Technical Design

**Phase**: 4
**Name**: Summaries
**Timeline**: Week 5 (Serial Development)
**Status**: In Progress
**Dependencies**: Phase 3 (Briefings & Core UI) ✅

---

## 1. Overview

### 1.1 Purpose

Phase 4 adds AI-generated paper summaries to accelerate the paper review process. Instead of reading full abstracts, users receive concise "What's New" summaries (2-3 sentences) and actionable "Key Points" (3-5 bullets), reducing per-paper review time from 2-3 minutes to under 30 seconds.

**Key Value**: Transform abstract reading from a slow, cognitive-heavy task into rapid insight extraction.

### 1.2 Goals

1. **Generate High-Quality Summaries**: Use LLMs to create concise, accurate summaries
2. **Dual LLM Support**: Integrate both local (Ollama) and cloud (Google Gemini) LLMs
3. **Intelligent Caching**: Cache summaries by content hash to avoid regeneration
4. **Seamless UI Integration**: Display summaries in paper detail view without disruption
5. **Auto-Summarization**: Automatically summarize top 10 papers in each briefing

### 1.3 Non-Goals (Deferred to Later Phases)

- Full PDF analysis (Phase 5-6)
- Comparative summaries across multiple papers (Phase 6)
- User-customizable summary styles (Future)
- Multi-language summaries (Future)
- Summary quality ratings/feedback (Future)

---

## 2. Architecture

### 2.1 System Overview

```
┌──────────────────────────────────────────────────────────────┐
│               Phase 4: Summary Generation                     │
└──────────────────────────────────────────────────────────────┘

┌─────────────┐       ┌──────────────┐       ┌─────────────┐
│   Paper     │       │  Summarizer  │       │   Summary   │
│   Abstract  │──────▶│    Agent     │──────▶│   (Cached)  │
└─────────────┘       └──────────────┘       └─────────────┘
                             │
                             │ Uses
                             ▼
                  ┌──────────────────────┐
                  │   LLM Provider       │
                  │  ┌───────────────┐   │
                  │  │ Local (Ollama)│   │
                  │  │ llama3.2      │   │
                  │  └───────────────┘   │
                  │         OR           │
                  │  ┌───────────────┐   │
                  │  │ Cloud (Gemini)│   │
                  │  │ 2.0-flash-exp │   │
                  │  └───────────────┘   │
                  └──────────────────────┘
                             │
                             │ Returns
                             ▼
                  ┌──────────────────────┐
                  │  Structured Output   │
                  │  - whatsNew (string) │
                  │  - keyPoints (array) │
                  └──────────────────────┘
                             │
                             │ Displayed in
                             ▼
                  ┌──────────────────────┐
                  │   Summary Panel UI   │
                  │  (Paper Detail View) │
                  └──────────────────────┘
```

### 2.2 Component Interaction Flow

**Summary Generation Flow**:
1. User views paper detail
2. UI requests summary via tRPC (`summaries.getSummary`)
3. Summarizer Agent checks cache (content hash of abstract)
4. If cached: return immediately
5. If not cached:
   - Load user's LLM preference (local vs cloud)
   - Call appropriate LLM provider with abstract
   - Parse structured response
   - Store in database with content hash
   - Return summary
6. UI displays "What's New" + "Key Points" in accordion

**Auto-Summarization Flow** (Briefing Generation):
1. Recommender Agent creates daily briefing
2. Enqueue pg-boss job: `generate-summaries` with briefing ID
3. Worker picks up job:
   - Load top 10 papers from briefing
   - Generate summaries in parallel (concurrency: 3)
   - Cache all summaries
4. Next time user views papers, summaries are instant (cache hit)

---

## 3. Data Model

### 3.1 Summary Model

```prisma
model Summary {
  id              String   @id @default(cuid())
  paperId         String
  summaryType     String   @default("skim") // "skim" for Phase 4, "deep" for Phase 5+

  // Structured content
  whatsNew        String   // 2-3 sentence summary
  keyPoints       String[] // Array of 3-5 bullet points

  // Full markdown (for extensibility)
  markdownContent String   @db.Text

  // Caching
  contentHash     String   // SHA-256 of abstract (for cache key)

  // Metadata
  generatedAt     DateTime @default(now())

  paper Paper @relation(fields: [paperId], references: [id], onDelete: Cascade)

  @@unique([paperId, summaryType])
  @@index([paperId])
  @@index([contentHash])
}
```

**Design Decisions**:
- `summaryType` allows for multiple summary types per paper (e.g., "skim" vs "deep")
- `contentHash` enables cache hits across different papers with identical abstracts
- `keyPoints` stored as array for structured access
- `markdownContent` stores full formatted summary for display

### 3.2 Paper Model Extension

**No changes required** - Summary relation is one-to-many (Paper → Summary[])

---

## 4. LLM Integration Layer

### 4.1 Unified LLM Interface

**Purpose**: Abstract away LLM provider differences, allow easy switching

```typescript
// server/lib/llm.ts

export type LLMProvider = 'local' | 'cloud';

export interface GenerateSummaryInput {
  abstract: string;
  title: string;
  authors: string[];
}

export interface GenerateSummaryOutput {
  whatsNew: string;
  keyPoints: string[];
}

export async function generateSummary(
  input: GenerateSummaryInput,
  provider: LLMProvider
): Promise<GenerateSummaryOutput> {
  if (provider === 'local') {
    return generateSummaryOllama(input);
  } else {
    return generateSummaryGemini(input);
  }
}
```

### 4.2 Ollama Integration (Local LLM)

**Model**: `llama3.2` (3B parameters, fast inference)

```typescript
// server/lib/llm/ollama.ts

import { Ollama } from 'ollama';

const ollama = new Ollama({
  host: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
});

export async function generateSummaryOllama(
  input: GenerateSummaryInput
): Promise<GenerateSummaryOutput> {
  const prompt = buildSummaryPrompt(input);

  const response = await ollama.chat({
    model: 'llama3.2',
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT_SUMMARY,
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
    format: 'json', // Request JSON output
    options: {
      temperature: 0.3, // Low temperature for consistency
      top_p: 0.9,
    },
  });

  const parsed = JSON.parse(response.message.content);

  return {
    whatsNew: parsed.whats_new,
    keyPoints: parsed.key_points,
  };
}
```

### 4.3 Google Gemini Integration (Cloud LLM)

**Model**: `gemini-2.0-flash-exp` (fast, cost-effective)

```typescript
// server/lib/llm/gemini.ts

import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

export async function generateSummaryGemini(
  input: GenerateSummaryInput
): Promise<GenerateSummaryOutput> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      temperature: 0.3,
      topP: 0.9,
      responseMimeType: 'application/json',
    },
  });

  const prompt = buildSummaryPrompt(input);

  const result = await model.generateContent([
    { text: SYSTEM_PROMPT_SUMMARY },
    { text: prompt },
  ]);

  const response = result.response.text();
  const parsed = JSON.parse(response);

  return {
    whatsNew: parsed.whats_new,
    keyPoints: parsed.key_points,
  };
}
```

### 4.4 Prompt Template

```typescript
const SYSTEM_PROMPT_SUMMARY = `You are a research paper summarization assistant.
Your job is to read a paper's title and abstract and generate:
1. A "What's New" summary (2-3 sentences) explaining the key contribution
2. A list of 3-5 "Key Points" highlighting specific claims or findings

Be concise, specific, and technical. Focus on novelty and contributions.

Output format (JSON):
{
  "whats_new": "2-3 sentence summary here",
  "key_points": [
    "First key point",
    "Second key point",
    "Third key point"
  ]
}`;

function buildSummaryPrompt(input: GenerateSummaryInput): string {
  return `Title: ${input.title}

Authors: ${input.authors.join(', ')}

Abstract:
${input.abstract}

Generate a concise summary following the output format.`;
}
```

---

## 5. Summary Generation Agent

### 5.1 Core Algorithm

```typescript
// server/agents/summarizer.ts

import { prisma } from '../db';
import { generateSummary } from '../lib/llm';
import crypto from 'crypto';

export async function generatePaperSummary(
  paperId: string,
  userId: string
): Promise<Summary> {
  // 1. Load paper
  const paper = await prisma.paper.findUnique({
    where: { id: paperId },
  });

  if (!paper) {
    throw new Error('Paper not found');
  }

  // 2. Generate content hash (for caching)
  const contentHash = crypto
    .createHash('sha256')
    .update(paper.abstract)
    .digest('hex');

  // 3. Check for existing summary (cache hit)
  const existing = await prisma.summary.findFirst({
    where: {
      contentHash,
      summaryType: 'skim',
    },
  });

  if (existing) {
    console.log(`[Summarizer] Cache hit for paper ${paperId}`);
    return existing;
  }

  console.log(`[Summarizer] Generating summary for paper ${paperId}`);

  // 4. Load user's LLM preference
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
  });

  const provider = profile?.useLocalLLM ? 'local' : 'cloud';

  // 5. Generate summary via LLM
  const result = await generateSummary(
    {
      title: paper.title,
      abstract: paper.abstract,
      authors: paper.authors,
    },
    provider
  );

  // 6. Build markdown content
  const markdownContent = `## What's New

${result.whatsNew}

## Key Points

${result.keyPoints.map(point => `- ${point}`).join('\n')}
`;

  // 7. Save to database
  const summary = await prisma.summary.create({
    data: {
      paperId,
      summaryType: 'skim',
      whatsNew: result.whatsNew,
      keyPoints: result.keyPoints,
      markdownContent,
      contentHash,
    },
  });

  console.log(`[Summarizer] Summary generated and cached`);

  return summary;
}
```

### 5.2 Bulk Summarization

**Purpose**: Efficiently summarize multiple papers in parallel

```typescript
// server/lib/bulk-summarize.ts

import pLimit from 'p-limit';

export async function summarizeTopPapers(
  briefingId: string
): Promise<BulkSummaryResult> {
  // 1. Load briefing
  const briefing = await prisma.briefing.findUnique({
    where: { id: briefingId },
  });

  if (!briefing) {
    throw new Error('Briefing not found');
  }

  // 2. Get top 10 papers
  const papers = await prisma.paper.findMany({
    where: {
      id: { in: briefing.paperIds.slice(0, 10) },
    },
    include: {
      scores: {
        where: { userId: briefing.userId },
        orderBy: { scoredAt: 'desc' },
        take: 1,
      },
    },
  });

  // Sort by score to get actual top 10
  papers.sort((a, b) => {
    const scoreA = a.scores[0]?.finalScore || 0;
    const scoreB = b.scores[0]?.finalScore || 0;
    return scoreB - scoreA;
  });

  const topPapers = papers.slice(0, 10);

  // 3. Generate summaries in parallel (max 3 concurrent)
  const limit = pLimit(3);

  const results = await Promise.allSettled(
    topPapers.map(paper =>
      limit(() => generatePaperSummary(paper.id, briefing.userId))
    )
  );

  // 4. Collect results
  const succeeded = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;

  console.log(
    `[BulkSummarize] Briefing ${briefingId}: ${succeeded} succeeded, ${failed} failed`
  );

  return {
    briefingId,
    total: topPapers.length,
    succeeded,
    failed,
    summaries: results
      .filter((r): r is PromiseFulfilledResult<Summary> => r.status === 'fulfilled')
      .map(r => r.value),
  };
}

export interface BulkSummaryResult {
  briefingId: string;
  total: number;
  succeeded: number;
  failed: number;
  summaries: Summary[];
}
```

---

## 6. API Specifications

### 6.1 Summaries Router

**File**: `server/routers/summaries.ts`

```typescript
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { prisma } from '../db';
import { generatePaperSummary } from '../agents/summarizer';

export const summariesRouter = router({
  /**
   * Get summary for a paper (generate if not exists)
   */
  getSummary: protectedProcedure
    .input(z.object({ paperId: z.string() }))
    .query(async ({ input, ctx }) => {
      // Check if summary exists
      let summary = await prisma.summary.findFirst({
        where: {
          paperId: input.paperId,
          summaryType: 'skim',
        },
      });

      // Generate if not exists
      if (!summary) {
        summary = await generatePaperSummary(input.paperId, ctx.user.id);
      }

      return summary;
    }),

  /**
   * Regenerate summary (delete and recreate)
   */
  regenerateSummary: protectedProcedure
    .input(z.object({ paperId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      // Delete existing summary
      await prisma.summary.deleteMany({
        where: {
          paperId: input.paperId,
          summaryType: 'skim',
        },
      });

      // Generate new summary
      const summary = await generatePaperSummary(input.paperId, ctx.user.id);

      return summary;
    }),
});
```

---

## 7. UI Components

### 7.1 Summary Panel Component

```typescript
// components/SummaryPanel.tsx

'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface SummaryPanelProps {
  paperId: string;
}

export function SummaryPanel({ paperId }: SummaryPanelProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  const { data: summary, isLoading, error, refetch } = trpc.summaries.getSummary.useQuery({
    paperId,
  });

  const regenerateMutation = trpc.summaries.regenerateSummary.useMutation({
    onSuccess: () => refetch(),
  });

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-sm text-destructive">
            Failed to load summary: {error.message}
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">AI Summary</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                regenerateMutation.mutate({ paperId });
              }}
              disabled={regenerateMutation.isLoading}
            >
              <RefreshCw className={cn(
                "h-4 w-4",
                regenerateMutation.isLoading && "animate-spin"
              )} />
            </Button>
            {isExpanded ? <ChevronUp /> : <ChevronDown />}
          </div>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ) : summary ? (
            <div className="space-y-4">
              {/* What's New */}
              <div>
                <h3 className="text-sm font-semibold mb-2">What's New</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {summary.whatsNew}
                </p>
              </div>

              {/* Key Points */}
              <div>
                <h3 className="text-sm font-semibold mb-2">Key Points</h3>
                <ul className="list-disc list-inside space-y-1">
                  {summary.keyPoints.map((point, idx) => (
                    <li key={idx} className="text-sm text-muted-foreground">
                      {point}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </CardContent>
      )}
    </Card>
  );
}
```

### 7.2 Integration into Paper Detail View

```typescript
// components/PaperDetailView.tsx (Updated)

export function PaperDetailView({ paper, ... }: PaperDetailViewProps) {
  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* ... existing header, actions, score ... */}

      {/* NEW: AI Summary Panel */}
      <SummaryPanel paperId={paper.id} />

      {/* ... existing abstract, metadata ... */}
    </div>
  );
}
```

---

## 8. Worker Job for Auto-Summarization

### 8.1 Summary Generation Job

```typescript
// worker/jobs/generate-summaries.ts

import { summarizeTopPapers } from '../../server/lib/bulk-summarize';

export async function generateSummariesJob(briefingId: string) {
  console.log(`[Job] Generating summaries for briefing ${briefingId}`);

  try {
    const result = await summarizeTopPapers(briefingId);

    console.log(
      `[Job] Complete: ${result.succeeded}/${result.total} summaries generated`
    );

    return result;
  } catch (error) {
    console.error(`[Job] Failed to generate summaries:`, error);
    throw error;
  }
}
```

### 8.2 Worker Registration

```typescript
// worker/index.ts (Updated)

import { generateSummariesJob } from './jobs/generate-summaries';

// ... existing setup ...

// Register summary generation job
await boss.work('generate-summaries', async (job) => {
  return await generateSummariesJob(job.data.briefingId);
});

console.log('[Worker] Summary generation job registered');
```

### 8.3 Integration with Recommender

```typescript
// server/agents/recommender.ts (Updated)

export async function generateDailyDigest(userId: string): Promise<Briefing> {
  // ... existing digest generation logic ...

  const briefing = await prisma.briefing.upsert({
    // ... existing upsert logic ...
  });

  // NEW: Enqueue summary generation job (async, non-blocking)
  if (process.env.NODE_ENV === 'production' || process.env.ENABLE_AUTO_SUMMARY === 'true') {
    try {
      const boss = getPgBoss(); // Singleton instance
      await boss.send('generate-summaries', { briefingId: briefing.id });
      console.log(`[Recommender] Enqueued summary generation for briefing ${briefing.id}`);
    } catch (error) {
      // Log but don't fail briefing creation
      console.error(`[Recommender] Failed to enqueue summary job:`, error);
    }
  }

  return briefing;
}
```

---

## 9. Testing Strategy

### 9.1 Unit Tests (Mocked LLM Calls)

**LLM Service Tests** (`__tests__/server/lib/llm.test.ts`):
```typescript
describe('LLM Service', () => {
  describe('generateSummary', () => {
    it('should call ollama for local provider', async () => {
      const mockOllama = vi.fn().mockResolvedValue({
        whatsNew: 'Summary',
        keyPoints: ['Point 1', 'Point 2'],
      });

      vi.mock('../../../server/lib/llm/ollama', () => ({
        generateSummaryOllama: mockOllama,
      }));

      const result = await generateSummary(mockInput, 'local');

      expect(mockOllama).toHaveBeenCalledWith(mockInput);
      expect(result.whatsNew).toBe('Summary');
    });

    it('should call gemini for cloud provider', async () => {
      // Similar test for cloud provider
    });
  });
});
```

**Summarizer Agent Tests** (`__tests__/server/agents/summarizer.test.ts`):
```typescript
describe('Summarizer Agent', () => {
  describe('generatePaperSummary', () => {
    it('should return cached summary if exists', async () => {
      const mockSummary = createMockSummary();
      mockPrisma.summary.findFirst.mockResolvedValue(mockSummary);

      const result = await generatePaperSummary('paper-1', 'user-1');

      expect(result).toEqual(mockSummary);
      expect(mockLLM.generateSummary).not.toHaveBeenCalled(); // Cache hit
    });

    it('should generate summary if not cached', async () => {
      mockPrisma.summary.findFirst.mockResolvedValue(null); // Cache miss
      mockLLM.generateSummary.mockResolvedValue({
        whatsNew: 'New summary',
        keyPoints: ['Point 1', 'Point 2', 'Point 3'],
      });

      const result = await generatePaperSummary('paper-1', 'user-1');

      expect(mockLLM.generateSummary).toHaveBeenCalled();
      expect(result.whatsNew).toBe('New summary');
      expect(mockPrisma.summary.create).toHaveBeenCalled(); // Saved to DB
    });
  });
});
```

### 9.2 Integration Tests

**End-to-End Summary Generation** (`__tests__/integration/summary-flow.test.ts`):
```typescript
describe('Summary Generation Integration', () => {
  it('should generate and retrieve summary via API', async () => {
    // 1. Create paper
    const paper = await createPaper({
      title: 'Test Paper',
      abstract: 'This is a test abstract...',
    });

    // 2. Create user
    const user = await createUser();

    // 3. Request summary via tRPC
    const caller = createCaller({ user });
    const summary = await caller.summaries.getSummary({ paperId: paper.id });

    // 4. Verify summary generated
    expect(summary).toBeDefined();
    expect(summary.whatsNew).toBeTruthy();
    expect(summary.keyPoints).toHaveLength.greaterThan(2);

    // 5. Request again (cache hit)
    const cached = await caller.summaries.getSummary({ paperId: paper.id });
    expect(cached.id).toBe(summary.id);
  });
});
```

---

## 10. Performance Considerations

### 10.1 LLM Response Time Targets

**Local (Ollama llama3.2)**:
- Target: < 5 seconds per summary
- Hardware: M1/M2 Mac or equivalent
- Optimization: Use smaller model (3B parameters)

**Cloud (Gemini 2.0 Flash)**:
- Target: < 3 seconds per summary
- Network: Depends on latency to Google AI
- Optimization: Parallel requests (max 3 concurrent)

### 10.2 Caching Strategy

**Content Hash**:
```typescript
const contentHash = crypto
  .createHash('sha256')
  .update(paper.abstract)
  .digest('hex');
```

**Cache Hit Rate**:
- Papers with identical abstracts (e.g., same paper on arXiv)
- Expected hit rate: 30-50% after 1 week of usage

**Cache Lookup Performance**:
- Indexed on `contentHash`
- Target: < 100ms for cache hit

### 10.3 Bulk Generation

**Parallel Processing**:
```typescript
const limit = pLimit(3); // Max 3 concurrent LLM calls
```

**Target Performance**:
- 10 papers in < 30 seconds (with concurrency)
- ~3 seconds per paper (parallel processing)

---

## 11. Error Handling

### 11.1 LLM Errors

**Ollama Unavailable**:
```typescript
try {
  return await generateSummaryOllama(input);
} catch (error) {
  if (error.code === 'ECONNREFUSED') {
    throw new TRPCError({
      code: 'SERVICE_UNAVAILABLE',
      message: 'Local LLM (Ollama) is not running. Please start Ollama or switch to cloud LLM in settings.',
    });
  }
  throw error;
}
```

**Gemini Rate Limiting**:
```typescript
// Exponential backoff retry
import pRetry from 'p-retry';

const result = await pRetry(
  () => generateSummaryGemini(input),
  {
    retries: 3,
    onFailedAttempt: (error) => {
      if (error.statusCode === 429) {
        console.log(`[Gemini] Rate limited, retrying...`);
      }
    },
  }
);
```

### 11.2 UI Error States

```typescript
if (error) {
  return (
    <Card className="border-destructive">
      <CardContent>
        <p className="text-sm text-destructive">
          {error.message || 'Failed to generate summary'}
        </p>
        <Button onClick={() => refetch()}>Retry</Button>
      </CardContent>
    </Card>
  );
}
```

---

## 12. Migration Plan

### 12.1 Prisma Schema Changes

```prisma
// Add Summary model
model Summary {
  id              String   @id @default(cuid())
  paperId         String
  summaryType     String   @default("skim")
  whatsNew        String
  keyPoints       String[]
  markdownContent String   @db.Text
  contentHash     String
  generatedAt     DateTime @default(now())

  paper Paper @relation(fields: [paperId], references: [id], onDelete: Cascade)

  @@unique([paperId, summaryType])
  @@index([paperId])
  @@index([contentHash])
}
```

**Run Migration**:
```bash
npx prisma migrate dev --name phase_4_summaries
```

---

## 13. Success Metrics

### 13.1 Quantitative Metrics

- **Generation Time**: < 5s (local), < 3s (cloud)
- **Cache Hit Rate**: > 30% after 1 week
- **Bulk Generation**: 10 papers in < 30 seconds
- **Test Coverage**: 80+ new tests passing
- **Summary Quality**: 80%+ satisfaction (manual review)

### 13.2 Qualitative Validation

- "What's New" is concise (2-3 sentences) and captures key contribution
- "Key Points" are specific and actionable
- UI integration feels seamless
- Error messages are clear and helpful

---

**End of Phase 4 Technical Design**
