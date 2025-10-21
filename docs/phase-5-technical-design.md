# Phase 5: Critical Analysis - Technical Design

**Phase**: 5
**Name**: Critical Analysis
**Timeline**: Weeks 6-7 (Serial Development)
**Status**: Not Started
**Dependencies**: Phase 4 (Summaries) ✅

---

## 1. Overview

### 1.1 Purpose

Phase 5 adds deep critical analysis capabilities to help researchers evaluate paper quality, identify overstated claims, and assess reproducibility. Instead of reading entire papers to determine their merit, users can request on-demand critiques at three depth levels—from quick 60-second abstract analysis to comprehensive 5-minute PDF reviews.

**Key Value**: Transform paper evaluation from hours of careful reading into minutes of structured critical assessment.

### 1.2 Goals

1. **PDF Infrastructure**: Download, cache, and parse arXiv PDFs for full-text analysis
2. **Three-Tier Critique System**: Depth A (fast), Depth B (comparative), Depth C (deep)
3. **Analyst Agent**: Generate structured critiques with claims assessment, limitations, and verdicts
4. **Async Job Processing**: Use pg-boss to run long-running analyses in the background
5. **UI Integration**: "Generate Critique" dropdown with real-time progress tracking

### 1.3 Non-Goals (Deferred to Later Phases)

- LangGraph.js workflow orchestration (optional for Phase 5, can defer to Phase 6)
- Auto-analysis for all briefing papers (defer to Phase 6)
- User feedback on critique quality (Phase 8+)
- Multi-paper synthesis (Phase 6)
- Citation graph analysis (Future)

---

## 2. Architecture

### 2.1 System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                Phase 5: Critical Analysis                         │
└──────────────────────────────────────────────────────────────────┘

                        ┌──────────────────┐
                        │   User clicks    │
                        │ "Generate        │
                        │  Critique" (A/B/C)│
                        └────────┬─────────┘
                                 │
                                 ▼
                   ┌─────────────────────────┐
                   │  tRPC: requestAnalysis  │
                   │  (paperId, depth)       │
                   └────────┬────────────────┘
                            │
                            ▼
                   ┌─────────────────────────┐
                   │   Enqueue pg-boss Job   │
                   │   "critique:paper"      │
                   └────────┬────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────────┐
        │          Worker Process (Node.js)         │
        │                                            │
        │  ┌─────────────────────────────────────┐  │
        │  │   Critique Job Handler              │  │
        │  │                                     │  │
        │  │   1. Load Paper                    │  │
        │  │   2. Download PDF (if needed)      │  │
        │  │   3. Parse PDF → Text              │  │
        │  │   4. Call Analyst Agent            │  │
        │  │      - Depth A: Abstract + Intro   │  │
        │  │      - Depth B: + 3 Neighbors      │  │
        │  │      - Depth C: Full PDF           │  │
        │  │   5. Store Analysis in DB          │  │
        │  │   6. Mark Job Complete             │  │
        │  └─────────────────────────────────────┘  │
        └───────────────┬───────────────────────────┘
                        │
                        ▼
            ┌────────────────────────┐
            │  Analysis Stored in DB │
            │  (markdown + metadata) │
            └────────┬───────────────┘
                     │
                     ▼
          ┌─────────────────────────┐
          │   UI: AnalysisPanel     │
          │   - Markdown rendering  │
          │   - Verdict badge       │
          │   - Confidence display  │
          │   - Depth indicator     │
          └─────────────────────────┘
```

### 2.2 Component Interaction Flow

#### 2.2.1 Depth A (Fast Critique) - 60 seconds

```
User clicks "Fast (A)" in PaperDetailView
    ↓
tRPC: requestAnalysis(paperId, depth="A")
    ↓
Check if Analysis exists (paperId + userId + depth="A")
    ↓
If exists: Return cached analysis
    ↓
If not: Enqueue pg-boss job → "critique:paper"
    ↓
Worker picks up job
    ↓
Load Paper (abstract, title, authors)
    ↓
Optionally: Download PDF, extract intro/conclusion
    ↓
generateFastCritique(paper, userId)
    ↓
Call Local LLM (Ollama: gemma3:27b)
    ↓
Prompt: "Generate 5-8 bullet critique..."
    ↓
Parse LLM response
    ↓
Extract: claimsEvidence, limitations, verdict, confidence
    ↓
Store Analysis in DB (depth="A")
    ↓
Mark job as completed
    ↓
UI polls job status → detects completion
    ↓
UI fetches Analysis and displays in AnalysisPanel
```

#### 2.2.2 Depth B (Comparative Critique) - 2 minutes

```
User clicks "Compare (B)" in PaperDetailView
    ↓
tRPC: requestAnalysis(paperId, depth="B")
    ↓
Enqueue pg-boss job → "critique:paper" (depth="B")
    ↓
Worker picks up job
    ↓
Load Paper + Enriched data (embedding)
    ↓
Download PDF (if not cached)
    ↓
findSimilarPapers(embedding, limit=3, dayRange=180)
    ↓
Load 3 most similar papers with summaries
    ↓
generateComparativeCritique(paper, neighbors, userId)
    ↓
Call Cloud LLM (Gemini: gemini-2.5-flash)
    ↓
Prompt: "Compare this paper vs 3 neighbors..."
    ↓
Parse LLM response (includes comparison table)
    ↓
Extract: claimsEvidence, limitations, verdict, confidence, neighborComparison
    ↓
Store Analysis in DB (depth="B", includes neighborComparison JSON)
    ↓
Mark job as completed
    ↓
UI displays Analysis with comparison table
```

#### 2.2.3 Depth C (Deep Critique) - 5 minutes

```
User clicks "Deep (C)" in PaperDetailView
    ↓
tRPC: requestAnalysis(paperId, depth="C")
    ↓
Enqueue pg-boss job → "critique:paper" (depth="C")
    ↓
Worker picks up job
    ↓
Load Paper
    ↓
downloadAndParsePDF(paper.pdfUrl, paper.id)
    ↓
extractTextFromPDF(pdfBuffer)
    ↓
Extract sections: intro, methodology, experiments, conclusion
    ↓
generateDeepCritique(paper, pdfText, userId)
    ↓
Call Cloud LLM (Gemini: gemini-2.5-flash)
    ↓
Prompt: "Full analysis of paper including methodology review..."
    ↓
Parse LLM response (15-20 bullets)
    ↓
Extract: claimsEvidence, limitations, verdict, confidence, methodologyReview, reproducibilityAssessment
    ↓
Store Analysis in DB (depth="C")
    ↓
Mark job as completed
    ↓
UI displays comprehensive Analysis
```

---

## 3. Database Schema

### 3.1 Analysis Model (Already Exists)

The `Analysis` model is already defined in `prisma/schema.prisma` (lines 268-288):

```prisma
model Analysis {
  id      String @id @default(cuid())
  paperId String
  userId  String

  depth String // "A", "B", "C"

  claimsEvidence     String  @db.Text
  limitations        String[]
  neighborComparison Json? // Only for Depth B
  verdict            String  @db.Text
  confidence         Float
  markdownContent    String  @db.Text

  generatedAt DateTime @default(now())

  paper Paper @relation(fields: [paperId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([paperId, userId, depth])
}
```

**Key Fields**:
- `depth`: "A" (fast), "B" (compare), "C" (deep)
- `claimsEvidence`: JSON string of claims-evidence table
- `limitations`: Array of identified limitations
- `neighborComparison`: JSON object with comparison table (Depth B only)
- `verdict`: Overall assessment (e.g., "Promising", "Solid Incremental", "Over-claimed")
- `confidence`: Float (0.0 - 1.0) representing confidence in verdict
- `markdownContent`: Full critique in markdown format

**No migration needed** - schema already in place.

---

## 4. PDF Infrastructure

### 4.1 PDF Parser Module

**File**: `server/lib/pdf-parser.ts`

```typescript
import { S3 } from '@aws-sdk/client-s3';
import pdfParse from 'pdf-parse';

/**
 * Download PDF from arXiv and cache in MinIO
 */
export async function downloadPDF(
  pdfUrl: string,
  paperId: string
): Promise<Buffer> {
  const s3 = getS3Client();
  const bucket = 'arxiv-pdfs';
  const key = `${paperId}.pdf`;

  // Check cache first
  try {
    const obj = await s3.getObject({ Bucket: bucket, Key: key });
    return Buffer.from(await obj.Body!.transformToByteArray());
  } catch (err) {
    // Not in cache, download from arXiv
  }

  // Download from arXiv
  const response = await fetch(pdfUrl);
  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  // Cache in MinIO
  await s3.putObject({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: 'application/pdf',
  });

  return buffer;
}

/**
 * Extract text from PDF buffer
 */
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  const data = await pdfParse(pdfBuffer);
  return data.text;
}

/**
 * Extract introduction section (heuristic)
 */
export function extractIntro(pdfText: string): string | null {
  // Look for "Introduction" heading
  const introMatch = pdfText.match(
    /(?:1\s+)?Introduction\s+([\s\S]{1,3000}?)(?:\n\d+\s+\w+|\nReferences|\nConclusion)/i
  );
  return introMatch?.[1]?.trim() ?? null;
}

/**
 * Extract conclusion section (heuristic)
 */
export function extractConclusion(pdfText: string): string | null {
  // Look for "Conclusion" heading
  const conclusionMatch = pdfText.match(
    /(?:\d+\s+)?Conclusion[s]?\s+([\s\S]{1,2000}?)(?:\nReferences|\nAcknowledgments?|\n\[1\])/i
  );
  return conclusionMatch?.[1]?.trim() ?? null;
}

/**
 * Extract methodology section (heuristic, optional)
 */
export function extractMethodology(pdfText: string): string | null {
  const methodMatch = pdfText.match(
    /(?:\d+\s+)?(?:Method|Methodology|Approach)\s+([\s\S]{1,4000}?)(?:\n\d+\s+\w+|\nExperiments|\nResults)/i
  );
  return methodMatch?.[1]?.trim() ?? null;
}

/**
 * Download and parse PDF (high-level wrapper)
 */
export async function downloadAndParsePDF(
  pdfUrl: string,
  paperId: string
): Promise<string> {
  const buffer = await downloadPDF(pdfUrl, paperId);
  return await extractTextFromPDF(buffer);
}
```

**Key Design Decisions**:
1. **Caching**: PDFs cached in MinIO bucket `arxiv-pdfs` to avoid re-downloads
2. **Section Extraction**: Heuristic-based (regex patterns), not perfect but good enough
3. **Error Handling**: Graceful fallback to abstract-only if PDF unavailable or malformed

---

## 5. Analyst Agent

### 5.1 Agent Structure

**File**: `server/agents/analyst.ts`

```typescript
import { prisma } from '@/server/db';
import { generateSummaryOllama } from '@/server/lib/llm/ollama';
import { generateSummaryGemini } from '@/server/lib/llm/gemini';
import { downloadAndParsePDF, extractIntro, extractConclusion } from '@/server/lib/pdf-parser';

export interface GenerateCritiqueInput {
  paperId: string;
  userId: string;
  depth: "A" | "B" | "C";
}

export interface GenerateCritiqueOutput {
  id: string;
  depth: string;
  claimsEvidence: string;
  limitations: string[];
  neighborComparison: any | null;
  verdict: string;
  confidence: number;
  markdownContent: string;
  generatedAt: Date;
}

/**
 * Generate critique at requested depth
 */
export async function generateCritique(
  input: GenerateCritiqueInput
): Promise<GenerateCritiqueOutput> {
  const { paperId, userId, depth } = input;

  const paper = await prisma.paper.findUnique({
    where: { id: paperId },
    include: { enriched: true },
  });

  if (!paper) {
    throw new Error(`Paper not found: ${paperId}`);
  }

  if (depth === "A") {
    return await generateFastCritique(paper, userId);
  } else if (depth === "B") {
    return await generateComparativeCritique(paper, userId);
  } else {
    return await generateDeepCritique(paper, userId);
  }
}

/**
 * Depth A: Fast critique (abstract + optional intro/conclusion)
 */
async function generateFastCritique(
  paper: any,
  userId: string
): Promise<GenerateCritiqueOutput> {
  // Get user's LLM preference
  const userProfile = await prisma.userProfile.findUnique({
    where: { userId },
  });

  const useLocal = userProfile?.useLocalLLM ?? true;

  // Optionally extract intro/conclusion from PDF
  let intro: string | null = null;
  let conclusion: string | null = null;

  if (paper.pdfUrl) {
    try {
      const pdfText = await downloadAndParsePDF(paper.pdfUrl, paper.id);
      intro = extractIntro(pdfText);
      conclusion = extractConclusion(pdfText);
    } catch (err) {
      // Fallback to abstract-only if PDF unavailable
      console.warn(`PDF parsing failed for ${paper.id}:`, err);
    }
  }

  // Build prompt
  const prompt = buildFastCritiquePrompt(paper, intro, conclusion);

  // Call LLM
  let response: string;
  if (useLocal) {
    const llmOutput = await generateCritiqueOllama(prompt);
    response = llmOutput.markdown;
  } else {
    const llmOutput = await generateCritiqueGemini(prompt);
    response = llmOutput.markdown;
  }

  // Parse response
  const claimsEvidence = extractClaimsTable(response);
  const limitations = extractLimitations(response);
  const verdict = extractVerdict(response);
  const confidence = extractConfidence(response);

  // Store in DB
  const analysis = await prisma.analysis.create({
    data: {
      paperId: paper.id,
      userId,
      depth: "A",
      claimsEvidence,
      limitations,
      neighborComparison: null,
      verdict,
      confidence,
      markdownContent: response,
    },
  });

  return analysis;
}

/**
 * Depth B: Comparative critique (A + 3 neighbors)
 */
async function generateComparativeCritique(
  paper: any,
  userId: string
): Promise<GenerateCritiqueOutput> {
  // Find 3 most similar papers
  const neighbors = await findSimilarPapers(
    paper.enriched.embedding,
    3,
    180
  );

  // Download PDF
  const pdfText = await downloadAndParsePDF(paper.pdfUrl, paper.id);

  // Build prompt with neighbors
  const prompt = buildComparativeCritiquePrompt(paper, pdfText, neighbors);

  // Always use cloud LLM for Depth B
  const llmOutput = await generateCritiqueGemini(prompt);

  // Parse response
  const claimsEvidence = extractClaimsTable(llmOutput.markdown);
  const limitations = extractLimitations(llmOutput.markdown);
  const verdict = extractVerdict(llmOutput.markdown);
  const confidence = extractConfidence(llmOutput.markdown);
  const neighborComparison = extractComparisonTable(llmOutput.markdown);

  // Store in DB
  const analysis = await prisma.analysis.create({
    data: {
      paperId: paper.id,
      userId,
      depth: "B",
      claimsEvidence,
      limitations,
      neighborComparison,
      verdict,
      confidence,
      markdownContent: llmOutput.markdown,
    },
  });

  return analysis;
}

/**
 * Depth C: Deep critique (full PDF)
 */
async function generateDeepCritique(
  paper: any,
  userId: string
): Promise<GenerateCritiqueOutput> {
  // Download and parse full PDF
  const pdfText = await downloadAndParsePDF(paper.pdfUrl, paper.id);

  // Build prompt with full PDF
  const prompt = buildDeepCritiquePrompt(paper, pdfText);

  // Always use cloud LLM for Depth C
  const llmOutput = await generateCritiqueGemini(prompt);

  // Parse response
  const claimsEvidence = extractClaimsTable(llmOutput.markdown);
  const limitations = extractLimitations(llmOutput.markdown);
  const verdict = extractVerdict(llmOutput.markdown);
  const confidence = extractConfidence(llmOutput.markdown);

  // Store in DB
  const analysis = await prisma.analysis.create({
    data: {
      paperId: paper.id,
      userId,
      depth: "C",
      claimsEvidence,
      limitations,
      neighborComparison: null,
      verdict,
      confidence,
      markdownContent: llmOutput.markdown,
    },
  });

  return analysis;
}

/**
 * Find similar papers using pgvector
 */
async function findSimilarPapers(
  embedding: number[],
  limit: number,
  dayRange: number
): Promise<any[]> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - dayRange);

  // Use raw SQL for pgvector cosine similarity
  const results = await prisma.$queryRaw`
    SELECT p.id, p.title, p.abstract, p.authors, p."pubDate",
           1 - (pe.embedding <=> ${JSON.stringify(embedding)}::vector) as similarity
    FROM "Paper" p
    JOIN "PaperEnriched" pe ON p.id = pe."paperId"
    WHERE p."pubDate" >= ${cutoffDate}
    ORDER BY pe.embedding <=> ${JSON.stringify(embedding)}::vector
    LIMIT ${limit + 1}
  `;

  // Filter out the query paper itself (if present) and return top N
  return results.slice(0, limit);
}
```

### 5.2 Prompt Templates

**Depth A Prompt** (Fast Critique):
```typescript
function buildFastCritiquePrompt(
  paper: any,
  intro: string | null,
  conclusion: string | null
): string {
  return `You are a research reviewer providing a fast critical analysis.

Paper: ${paper.title}
Authors: ${paper.authors.join(", ")}
Abstract: ${paper.abstract}
${intro ? `\nIntroduction:\n${intro}` : ""}
${conclusion ? `\nConclusion:\n${conclusion}` : ""}

Generate a structured critique with the following sections:

## Core Contribution
What problem does this solve? What's the proposed solution?

## Key Claims & Evidence
| Claim | Evidence | Assessment |
|-------|----------|------------|
| [Main claim 1] | [Evidence from paper] | Supported / Weak / Missing |
| [Main claim 2] | [Evidence from paper] | Supported / Weak / Missing |

## Quick Assessment
**Strengths** (2-3 bullets):
- ...

**Limitations** (2-3 bullets):
- ...

## Verdict
**Overall**: [Promising | Solid Incremental | Over-claimed]
**Confidence**: [0.0 - 1.0]
**Reasoning**: ...

## Bottom Line
One sentence takeaway for practitioners.
`;
}
```

**Depth B Prompt** (Comparative Critique):
```typescript
function buildComparativeCritiquePrompt(
  paper: any,
  pdfText: string,
  neighbors: any[]
): string {
  const neighborsText = neighbors
    .map(
      (n, i) => `
### Neighbor ${i + 1}: ${n.title}
Authors: ${n.authors.join(", ")}
Abstract: ${n.abstract}
Similarity: ${(n.similarity * 100).toFixed(1)}%
`
    )
    .join("\n");

  return `You are a research reviewer providing comparative analysis.

Current Paper: ${paper.title}
Abstract: ${paper.abstract}

Similar Papers (last 180 days):
${neighborsText}

Generate a comparative critique:

[Include Depth A sections: Core Contribution, Claims & Evidence, Quick Assessment]

## Comparison vs Prior Work
| Aspect | Current Paper | Neighbor 1 | Neighbor 2 | Neighbor 3 |
|--------|---------------|------------|------------|------------|
| Approach | ... | ... | ... | ... |
| Key Results | ... | ... | ... | ... |
| Claims | ... | ... | ... | ... |
| Limitations | ... | ... | ... | ... |

## Relative Positioning
How does this work compare to similar recent work? Is it incremental or novel?

## Verdict
[Same as Depth A, but with comparative context]
`;
}
```

**Depth C Prompt** (Deep Critique):
```typescript
function buildDeepCritiquePrompt(paper: any, pdfText: string): string {
  return `You are a research reviewer providing comprehensive deep analysis.

Paper: ${paper.title}
Full Text:
${pdfText.slice(0, 20000)} [truncated if needed]

Generate a comprehensive critique:

[Include Depth A sections]

## Methodology Review
- Is the methodology sound and well-described?
- Are there alternative approaches that should have been considered?
- Are there methodological flaws or shortcuts?

## Experimental Design
- Are experiments comprehensive and fair?
- Are baselines appropriate and SOTA?
- Are ablations sufficient to validate claims?
- Is statistical significance reported?

## Reproducibility Assessment
- Are implementation details sufficient?
- Is code/data available?
- Can results be reproduced?

## Compute & Data Costs
- What compute resources are required?
- What data requirements exist?
- Is this accessible to typical researchers?

## SOTA Comparability
- Are comparisons to SOTA fair and comprehensive?
- Are there missing baselines?
- Are claims of "SOTA" justified?

## Verdict
[Same as Depth A, with full-paper context]
`;
}
```

### 5.3 Response Parsers

```typescript
/**
 * Extract claims-evidence table from markdown
 */
function extractClaimsTable(markdown: string): string {
  const match = markdown.match(
    /## Key Claims & Evidence\s+([\s\S]+?)(?=\n##|$)/i
  );
  return match?.[1]?.trim() ?? "No claims table found";
}

/**
 * Extract limitations list
 */
function extractLimitations(markdown: string): string[] {
  const match = markdown.match(/\*\*Limitations\*\*[:\s]+([\s\S]+?)(?=\n##|$)/i);
  if (!match) return [];

  const limitationsText = match[1];
  const bullets = limitationsText.match(/^[\s]*-\s+(.+)$/gm) ?? [];
  return bullets.map((b) => b.replace(/^[\s]*-\s+/, "").trim());
}

/**
 * Extract verdict
 */
function extractVerdict(markdown: string): string {
  const match = markdown.match(/\*\*Overall\*\*:\s*(.+)/i);
  return match?.[1]?.trim() ?? "Unknown";
}

/**
 * Extract confidence (0.0 - 1.0)
 */
function extractConfidence(markdown: string): number {
  const match = markdown.match(/\*\*Confidence\*\*:\s*([\d.]+)/i);
  return match?.[1] ? parseFloat(match[1]) : 0.5;
}

/**
 * Extract comparison table (Depth B)
 */
function extractComparisonTable(markdown: string): any {
  const match = markdown.match(
    /## Comparison vs Prior Work\s+([\s\S]+?)(?=\n##|$)/i
  );
  if (!match) return null;

  // Parse markdown table into JSON (simple implementation)
  const tableText = match[1];
  // TODO: Implement markdown table parser or store raw markdown
  return { raw: tableText };
}
```

---

## 6. tRPC Analysis Router

**File**: `server/routers/analysis.ts`

```typescript
import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { prisma } from '@/server/db';

export const analysisRouter = router({
  /**
   * Request a new analysis (enqueues job)
   */
  requestAnalysis: protectedProcedure
    .input(
      z.object({
        paperId: z.string(),
        depth: z.enum(["A", "B", "C"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { paperId, depth } = input;
      const userId = ctx.session.user.id;

      // Check if analysis already exists
      const existing = await prisma.analysis.findFirst({
        where: {
          paperId,
          userId,
          depth,
        },
      });

      if (existing) {
        return {
          analysis: existing,
          jobId: null,
          status: "completed" as const,
        };
      }

      // Enqueue job
      const job = await ctx.boss.send("critique:paper", {
        paperId,
        userId,
        depth,
      });

      return {
        analysis: null,
        jobId: job.id,
        status: "pending" as const,
      };
    }),

  /**
   * Get existing analysis
   */
  getAnalysis: protectedProcedure
    .input(
      z.object({
        paperId: z.string(),
        depth: z.enum(["A", "B", "C"]),
      })
    )
    .query(async ({ ctx, input }) => {
      const { paperId, depth } = input;
      const userId = ctx.session.user.id;

      const analysis = await prisma.analysis.findFirst({
        where: {
          paperId,
          userId,
          depth,
        },
      });

      return analysis;
    }),

  /**
   * Get job status
   */
  getJobStatus: protectedProcedure
    .input(z.object({ jobId: z.string() }))
    .query(async ({ ctx, input }) => {
      const job = await ctx.boss.getJobById(input.jobId);

      if (!job) {
        return { status: "not_found" as const };
      }

      return {
        status: job.state as "created" | "active" | "completed" | "failed",
        progress: job.data?.progress ?? 0,
      };
    }),

  /**
   * Regenerate analysis (delete + re-enqueue)
   */
  regenerateAnalysis: protectedProcedure
    .input(
      z.object({
        paperId: z.string(),
        depth: z.enum(["A", "B", "C"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { paperId, depth } = input;
      const userId = ctx.session.user.id;

      // Delete existing
      await prisma.analysis.deleteMany({
        where: {
          paperId,
          userId,
          depth,
        },
      });

      // Enqueue new job
      const job = await ctx.boss.send("critique:paper", {
        paperId,
        userId,
        depth,
      });

      return {
        jobId: job.id,
        status: "pending" as const,
      };
    }),
});
```

---

## 7. Background Job Processing

**File**: `worker/jobs/critique-paper.ts`

```typescript
import type { Job } from 'pg-boss';
import { generateCritique } from '@/server/agents/analyst';

export interface CritiquePaperJobData {
  paperId: string;
  userId: string;
  depth: "A" | "B" | "C";
}

export async function handleCritiquePaperJob(
  job: Job<CritiquePaperJobData>
): Promise<void> {
  const { paperId, userId, depth } = job.data;

  console.log(
    `[critique-paper] Starting job ${job.id} for paper ${paperId} at depth ${depth}`
  );

  try {
    // Update progress: 10%
    await updateJobProgress(job.id, 10);

    // Generate critique
    const analysis = await generateCritique({
      paperId,
      userId,
      depth,
    });

    // Update progress: 100%
    await updateJobProgress(job.id, 100);

    console.log(`[critique-paper] Completed job ${job.id}: analysis ${analysis.id}`);
  } catch (err) {
    console.error(`[critique-paper] Failed job ${job.id}:`, err);
    throw err; // pg-boss will retry
  }
}

async function updateJobProgress(jobId: string, progress: number): Promise<void> {
  // pg-boss doesn't have built-in progress tracking
  // Could implement custom tracking in database if needed
  console.log(`[critique-paper] Job ${jobId} progress: ${progress}%`);
}
```

**Worker Registration** (`worker/index.ts`):
```typescript
import PgBoss from 'pg-boss';
import { handleCritiquePaperJob } from './jobs/critique-paper';

const boss = new PgBoss(process.env.DATABASE_URL!);

await boss.start();

// Register critique job handler
boss.work('critique:paper', {
  teamSize: 2,        // Process up to 2 jobs concurrently
  teamConcurrency: 1, // Each worker processes 1 job at a time
}, handleCritiquePaperJob);

console.log('Worker started. Listening for jobs...');
```

---

## 8. UI Components

### 8.1 Analysis Panel

**File**: `components/AnalysisPanel.tsx`

```typescript
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/app/_trpc/client";
import ReactMarkdown from "react-markdown";
import { Zap, GitCompare, FileSearch } from "lucide-react";

interface AnalysisPanelProps {
  paperId: string;
  depth: "A" | "B" | "C";
}

export function AnalysisPanel({ paperId, depth }: AnalysisPanelProps) {
  const { data: analysis, isLoading } = trpc.analysis.getAnalysis.useQuery({
    paperId,
    depth,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Critical Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!analysis) {
    return null;
  }

  const depthIcon = {
    A: <Zap className="h-4 w-4" />,
    B: <GitCompare className="h-4 w-4" />,
    C: <FileSearch className="h-4 w-4" />,
  };

  const depthLabel = {
    A: "Fast",
    B: "Comparative",
    C: "Deep",
  };

  const verdictColor = {
    Promising: "green",
    "Solid Incremental": "blue",
    "Over-claimed": "red",
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Critical Analysis</CardTitle>
          <div className="flex gap-2">
            <Badge variant="outline">
              {depthIcon[depth]}
              <span className="ml-1">{depthLabel[depth]}</span>
            </Badge>
            <Badge
              style={{
                backgroundColor: verdictColor[analysis.verdict] ?? "gray",
              }}
            >
              {analysis.verdict}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="prose max-w-none">
          <ReactMarkdown>{analysis.markdownContent}</ReactMarkdown>
        </div>

        {analysis.neighborComparison && (
          <div className="mt-4">
            <h4 className="font-semibold mb-2">Comparison Table</h4>
            <ReactMarkdown>{analysis.neighborComparison.raw}</ReactMarkdown>
          </div>
        )}

        <div className="mt-4 text-sm text-gray-500">
          Confidence: {(analysis.confidence * 100).toFixed(0)}% •
          Generated {new Date(analysis.generatedAt).toLocaleDateString()}
        </div>
      </CardContent>
    </Card>
  );
}
```

### 8.2 Generate Critique Dropdown

**Add to `components/PaperDetailView.tsx`**:

```typescript
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Sparkles, Zap, GitCompare, FileSearch, ChevronDown } from "lucide-react";
import { trpc } from "@/app/_trpc/client";
import { useState } from "react";

export function PaperDetailView({ paper }) {
  const [selectedDepth, setSelectedDepth] = useState<"A" | "B" | "C" | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);

  const requestAnalysis = trpc.analysis.requestAnalysis.useMutation({
    onSuccess: (data) => {
      if (data.jobId) {
        setJobId(data.jobId);
      }
    },
  });

  const handleGenerateCritique = (depth: "A" | "B" | "C") => {
    setSelectedDepth(depth);
    requestAnalysis.mutate({
      paperId: paper.id,
      depth,
    });
  };

  return (
    <div>
      {/* Existing Paper Detail Content */}

      {/* Generate Critique Dropdown */}
      <div className="mt-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Critique
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => handleGenerateCritique("A")}>
              <Zap className="h-4 w-4 mr-2" />
              Fast (A) - 5-8 bullets, ~60s
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleGenerateCritique("B")}>
              <GitCompare className="h-4 w-4 mr-2" />
              Compare (B) - + 3 neighbors, ~2min
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleGenerateCritique("C")}>
              <FileSearch className="h-4 w-4 mr-2" />
              Deep (C) - Full analysis, ~5min
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Progress Indicator */}
      {jobId && <JobProgressIndicator jobId={jobId} />}

      {/* Analysis Panel */}
      {selectedDepth && <AnalysisPanel paperId={paper.id} depth={selectedDepth} />}
    </div>
  );
}
```

---

## 9. Testing Strategy

### 9.1 Unit Tests (87+ tests)

**PDF Parser Tests** (19 tests):
- Download PDF from URL
- Cache PDF in MinIO
- Extract text from PDF buffer
- Extract introduction section
- Extract conclusion section
- Extract methodology section
- Handle malformed PDFs
- Handle missing PDFs

**Analyst Agent Tests** (28 tests):
- Depth A: Abstract-only critique
- Depth A: Abstract + intro/conclusion
- Depth A: Local LLM option
- Depth B: Find similar papers
- Depth B: Generate comparison table
- Depth B: Cloud LLM required
- Depth C: Full PDF analysis
- Depth C: Methodology review
- Depth C: Reproducibility assessment

**Response Parser Tests** (6 tests):
- Extract claims table
- Extract limitations
- Extract verdict
- Extract confidence
- Extract comparison table
- Handle malformed responses

**tRPC Router Tests** (19 tests):
- Request analysis (new)
- Request analysis (cached)
- Get analysis (exists)
- Get analysis (not exists)
- Get job status
- Regenerate analysis

**Job Handler Tests** (8 tests):
- Handle Depth A job
- Handle Depth B job
- Handle Depth C job
- Retry on failure
- Timeout handling

### 9.2 Integration Tests (5 tests)

- End-to-end Depth A critique (real local LLM)
- End-to-end Depth B critique (real cloud LLM)
- End-to-end Depth C critique (real cloud LLM)
- PDF download and parse flow (real arXiv PDF)
- Job queue flow (real pg-boss)

### 9.3 UI Component Tests (29 tests)

- Analysis Panel: Loading state
- Analysis Panel: Display markdown
- Analysis Panel: Display verdict badge
- Generate Critique Dropdown: All 3 options
- Progress Indicator: Poll job status
- Paper Detail View: Integration

---

## 10. Performance Targets

| Depth | Target Latency | LLM Provider | Estimated Cost |
|-------|----------------|--------------|----------------|
| A     | < 60 seconds   | Local (Ollama) | Free |
| B     | < 2 minutes    | Cloud (Gemini) | ~$0.02 per critique |
| C     | < 5 minutes    | Cloud (Gemini) | ~$0.10 per critique |

**PDF Operations**:
- Download: < 10 seconds (cache hit: < 100ms)
- Text extraction: < 5 seconds
- Section detection: < 1 second

---

## 11. Key Design Decisions

### 11.1 Why pg-boss for Background Jobs?

- **No Redis**: Uses PostgreSQL (one less service to manage)
- **ACID guarantees**: Job persistence and transactional safety
- **Simple**: Easy to set up and use
- **Good enough**: Performance sufficient for single-user workload

### 11.2 Why Three Depth Levels?

- **Depth A**: Fast triage (60s), local LLM, free
- **Depth B**: Comparative context (2min), cloud LLM, low cost
- **Depth C**: Comprehensive review (5min), cloud LLM, moderate cost

Gives users flexibility to choose speed vs depth vs cost.

### 11.3 Why Cache PDFs in MinIO?

- Avoid re-downloading same PDF (bandwidth savings)
- Faster access on re-analysis
- S3-compatible (easy to scale to cloud S3 later)

### 11.4 Why Heuristic Section Detection?

- Full PDF parsing (layout analysis) is complex and error-prone
- Heuristics work for 80%+ of papers
- Graceful degradation if sections not found (use full text)

---

## 12. Risk Mitigation

### 12.1 PDF Parsing Failures

**Risk**: Malformed PDFs, scanned images, encryption
**Mitigation**:
- Graceful fallback to abstract-only analysis
- Log errors for debugging
- Manual override to skip PDF

### 12.2 LLM Quality

**Risk**: Poor critiques, hallucinations, incorrect assessments
**Mitigation**:
- Extensive prompt engineering
- Few-shot examples
- Manual validation (sample 10+ papers)
- User feedback mechanism (Phase 8+)

### 12.3 Generation Time

**Risk**: Depth C takes > 10 minutes
**Mitigation**:
- Use fast cloud LLM (Gemini 2.5 Flash)
- Timeout jobs at 10 minutes
- Retry with shorter context if timeout

### 12.4 Cost Control

**Risk**: High cloud LLM costs for Depth B/C
**Mitigation**:
- Cache analyses (don't re-generate)
- Warn users of estimated cost
- Default to Depth A (free)

---

## 13. Future Enhancements (Post-Phase 5)

- **Auto-analysis**: Automatically run Depth A for all briefing papers
- **LangGraph Workflows**: More complex agent orchestration
- **User Feedback**: Rate critique quality, suggest improvements
- **Custom Prompts**: User-defined critique templates
- **Multi-paper Synthesis**: Cross-document analysis (Phase 6)

---

**Phase 5 Start Date**: TBD
**Phase 5 Target Completion**: TBD (7 days)
**Status**: Not Started
