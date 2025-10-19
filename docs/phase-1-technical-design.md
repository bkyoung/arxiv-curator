# Phase 1: Ingestion & Enrichment - Technical Design

**Version**: 1.0
**Date**: 2025-01-19
**Status**: Implementation Ready
**Dependencies**: Phase 0 (Foundation) - Complete

---

## Executive Summary

Phase 1 implements the **data pipeline** that feeds all downstream features of ArXiv Curator. This phase establishes automated paper ingestion from arXiv, Tier 0 enrichment (abstract-only processing), and basic paper browsing capabilities.

**Core Deliverables**:
- Scout Agent: arXiv OAI-PMH client and Atom feed parser
- Enricher Agent: Embedding generation, classification, evidence detection
- Worker Process: LangGraph.js orchestration of agent workflows
- Settings UI: Source and category configuration
- Papers List UI: Basic unranked paper browsing

**Success Criteria**:
- Daily ingestion of 100-500 papers from configured categories
- Papers enriched with 768-dim embeddings and metadata
- Zero manual intervention required after initial setup
- Cost ≤ $0.50/day for ingestion + enrichment (using local models)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Scout Agent Design](#2-scout-agent-design)
3. [Enricher Agent Design](#3-enricher-agent-design)
4. [Worker Process & LangGraph](#4-worker-process--langgraph)
5. [Data Flow](#5-data-flow)
6. [API Design](#6-api-design)
7. [UI Components](#7-ui-components)
8. [Testing Strategy](#8-testing-strategy)
9. [Performance Considerations](#9-performance-considerations)
10. [Cost Analysis](#10-cost-analysis)
11. [Implementation Plan](#11-implementation-plan)

---

## 1. Architecture Overview

### 1.1 System Components

```
┌─────────────────────────────────────────────────────────┐
│                   Next.js Application                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Settings UI │  │  Papers UI   │  │  tRPC API    │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────────┐
│                   PostgreSQL + pgvector                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  Papers      │  │  Enriched    │  │  pg-boss     │  │
│  │  Table       │  │  Metadata    │  │  Jobs        │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────────┐
│                Worker Process (LangGraph.js)            │
│  ┌───────────────────────────────────────────────────┐  │
│  │  Scout Agent  →  Enricher Agent  →  [Complete]   │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────────┐
│                   arXiv API (External)                  │
│  ┌──────────────┐  ┌──────────────┐                    │
│  │  OAI-PMH     │  │  Atom Feed   │                    │
│  └──────────────┘  └──────────────┘                    │
└─────────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────────┐
│                  AI Services (Pluggable)                │
│  ┌──────────────┐  ┌──────────────┐                    │
│  │  ollama      │  │  Gemini /    │                    │
│  │  (local)     │  │  OpenAI      │                    │
│  └──────────────┘  └──────────────┘                    │
└─────────────────────────────────────────────────────────┘
```

### 1.2 Design Principles

**Rate Limit Compliance**
- Global rate limiter: 1 request per 3 seconds for arXiv
- Single connection to arXiv (maxConcurrent: 1)
- Exponential backoff on errors

**Local-First Processing**
- Default to local embeddings (ollama)
- Default to local LLMs for classification
- Cloud APIs as opt-in fallback

**Tier 0 Only**
- Process abstracts only (no PDF downloads)
- Fast, cheap enrichment
- Minimize latency and cost

**Idempotent Operations**
- Papers can be re-enriched safely
- Version supersedence handles updates
- No duplicate papers in database

---

## 2. Scout Agent Design

### 2.1 Responsibilities

The Scout Agent is responsible for:
1. Fetching arXiv category taxonomy
2. Ingesting recent papers via Atom feed
3. Ingesting historical papers via OAI-PMH (optional)
4. Detecting and handling paper version updates
5. Storing raw paper metadata

### 2.2 Implementation Details

**File**: `server/agents/scout.ts`

#### 2.2.1 Category Fetching

```typescript
import { XMLParser } from 'fast-xml-parser';
import { arxivLimiter } from '@/server/lib/rate-limiter';

interface ArxivCategory {
  id: string;           // e.g., "cs.AI"
  name: string;         // e.g., "Artificial Intelligence"
  description: string;
}

export async function fetchArxivCategories(): Promise<ArxivCategory[]> {
  const url = 'http://export.arxiv.org/oai2?verb=ListSets';

  const response = await arxivLimiter.schedule(() => fetch(url));
  const xml = await response.text();

  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml);

  const sets = parsed['OAI-PMH']['ListSets']['set'];
  const categories = (Array.isArray(sets) ? sets : [sets])
    .filter((s: any) => s.setSpec.startsWith('cs.'))
    .map((s: any) => ({
      id: s.setSpec,
      name: s.setName,
      description: '', // Enhanced in future phases
    }));

  // Store in database
  for (const cat of categories) {
    await prisma.arxivCategory.upsert({
      where: { id: cat.id },
      update: { name: cat.name, description: cat.description },
      create: cat,
    });
  }

  return categories;
}
```

#### 2.2.2 Atom Feed Parsing

```typescript
export async function ingestRecentPapers(
  categories: string[],
  maxResults: number = 100
): Promise<string[]> {
  const paperIds: string[] = [];

  for (const category of categories) {
    const url = `http://export.arxiv.org/api/query?` +
      `search_query=cat:${category}&` +
      `start=0&` +
      `max_results=${maxResults}&` +
      `sortBy=submittedDate&` +
      `sortOrder=descending`;

    const response = await arxivLimiter.schedule(() => fetch(url));
    const xml = await response.text();

    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(xml);

    const entries = parsed.feed.entry || [];
    const entryList = Array.isArray(entries) ? entries : [entries];

    for (const entry of entryList) {
      const paperId = await processPaperEntry(entry);
      if (paperId) {
        paperIds.push(paperId);
      }
    }
  }

  return paperIds;
}

async function processPaperEntry(entry: any): Promise<string | null> {
  // Extract arXiv ID and version
  const fullId = extractArxivId(entry.id);
  const { baseId, version } = parseArxivId(fullId);

  // Check for existing paper
  const existing = await prisma.paper.findUnique({
    where: { arxivId: baseId },
  });

  // Skip if same or older version
  if (existing && existing.version >= version) {
    return null;
  }

  // Handle supersedence
  if (existing) {
    await handleSupersedence(existing.id);
  }

  // Parse authors
  const authors = parseAuthors(entry.author);

  // Parse categories
  const categories = parseCategories(entry.category);

  // Extract PDF URL
  const pdfUrl = entry.link?.find((l: any) =>
    l['@_title'] === 'pdf'
  )?.['@_href'];

  // Create or update paper
  const paper = await prisma.paper.upsert({
    where: { arxivId: baseId },
    update: {
      version,
      title: entry.title,
      authors,
      abstract: entry.summary,
      categories,
      primaryCategory: categories[0],
      pdfUrl,
      pubDate: new Date(entry.published),
      updatedDate: new Date(entry.updated),
      rawMetadata: entry,
      status: 'new',
    },
    create: {
      arxivId: baseId,
      version,
      title: entry.title,
      authors,
      abstract: entry.summary,
      categories,
      primaryCategory: categories[0],
      pdfUrl,
      pubDate: new Date(entry.published),
      updatedDate: new Date(entry.updated),
      rawMetadata: entry,
      status: 'new',
    },
  });

  return paper.id;
}
```

#### 2.2.3 Helper Functions

```typescript
function extractArxivId(url: string): string {
  // Extract from URL like: http://arxiv.org/abs/2401.12345v2
  const match = url.match(/(\d{4}\.\d{4,5})(v\d+)?/);
  if (!match) throw new Error(`Invalid arXiv URL: ${url}`);
  return match[1] + (match[2] || 'v1');
}

function parseArxivId(fullId: string): { baseId: string; version: number } {
  const match = fullId.match(/^(.+?)v(\d+)$/);
  if (!match) {
    return { baseId: fullId, version: 1 };
  }
  return {
    baseId: match[1],
    version: parseInt(match[2], 10),
  };
}

function parseAuthors(authorData: any): any[] {
  const authors = Array.isArray(authorData) ? authorData : [authorData];
  return authors.map((a: any) => ({
    name: a.name,
  }));
}

function parseCategories(categoryData: any): string[] {
  const categories = Array.isArray(categoryData) ? categoryData : [categoryData];
  return categories.map((c: any) => c['@_term']);
}

async function handleSupersedence(paperId: string): Promise<void> {
  // In Phase 1, we don't download PDFs yet, so just log
  console.log(`Paper ${paperId} superseded by new version`);
  // In future phases, purge S3 artifacts here
}
```

### 2.3 Rate Limiting

**File**: `server/lib/rate-limiter.ts`

```typescript
import Bottleneck from 'bottleneck';

// Global rate limiter for arXiv
export const arxivLimiter = new Bottleneck({
  minTime: 3000, // 3 seconds between requests
  maxConcurrent: 1, // Single connection
});

// Exponential backoff strategy
arxivLimiter.on('failed', async (error, jobInfo) => {
  const id = jobInfo.options.id;
  console.warn(`Job ${id} failed: ${error}`);

  if (error instanceof Error && error.message.includes('503')) {
    // arXiv rate limit hit - wait longer
    const delay = jobInfo.retryCount * 10000; // 10s, 20s, 30s, ...
    console.log(`Retrying job ${id} in ${delay}ms`);
    return delay;
  }

  return 5000; // Default retry after 5s
});
```

---

## 3. Enricher Agent Design

### 3.1 Responsibilities

The Enricher Agent is responsible for:
1. Generating paper embeddings
2. Classifying papers into topics and facets
3. Estimating math depth
4. Detecting evidence signals
5. Storing enriched metadata

### 3.2 Implementation Details

**File**: `server/agents/enricher.ts`

#### 3.2.1 Main Enrichment Function

```typescript
import { generateEmbedding } from '@/server/lib/embeddings';
import { classifyPaper } from '@/server/agents/classifier';
import type { Paper, PaperEnriched } from '@prisma/client';

export async function enrichPaper(
  paper: Paper,
  useLocalEmbeddings: boolean = true,
  useLocalLLM: boolean = true
): Promise<PaperEnriched> {

  // 1. Generate embedding
  const text = `${paper.title}\n\n${paper.abstract}`;
  const embedding = await generateEmbedding(text, useLocalEmbeddings);

  // 2. Estimate math depth
  const mathDepth = estimateMathDepth(paper.title, paper.abstract);

  // 3. Classify topics and facets
  const { topics, facets } = await classifyPaper(paper, useLocalLLM);

  // 4. Detect evidence signals
  const signals = detectEvidenceSignals(paper.abstract);

  // 5. Store enriched data
  const enriched = await prisma.paperEnriched.upsert({
    where: { paperId: paper.id },
    update: {
      topics,
      facets,
      embedding,
      mathDepth,
      ...signals,
      enrichedAt: new Date(),
    },
    create: {
      paperId: paper.id,
      topics,
      facets,
      embedding,
      mathDepth,
      ...signals,
      enrichedAt: new Date(),
    },
  });

  // 6. Update paper status
  await prisma.paper.update({
    where: { id: paper.id },
    data: { status: 'enriched' },
  });

  return enriched;
}
```

#### 3.2.2 Math Depth Estimation

```typescript
export function estimateMathDepth(title: string, abstract: string): number {
  const text = `${title} ${abstract}`.toLowerCase();

  // Count LaTeX commands
  const latexCommands = text.match(/\\[a-z]+/g) || [];
  const latexDensity = latexCommands.length / text.length;

  // Theory keywords
  const theoryKeywords = [
    'theorem', 'proof', 'lemma', 'corollary', 'convergence',
    'optimization', 'gradient descent', 'loss function', 'regularization',
  ];
  const keywordMatches = theoryKeywords.filter(k => text.includes(k)).length;
  const keywordScore = keywordMatches / theoryKeywords.length;

  // Formula: weighted combination
  const score = 0.6 * latexDensity * 100 + 0.4 * keywordScore;

  return Math.min(1.0, score);
}
```

#### 3.2.3 Evidence Signal Detection

```typescript
interface EvidenceSignals {
  hasCode: boolean;
  hasData: boolean;
  hasBaselines: boolean;
  hasAblations: boolean;
  hasMultipleEvals: boolean;
}

export function detectEvidenceSignals(abstract: string): EvidenceSignals {
  const lowerAbstract = abstract.toLowerCase();

  return {
    hasCode: /github|code available|open.source/i.test(abstract),
    hasData: /dataset|data available/i.test(abstract),
    hasBaselines: /baseline|compared to/i.test(abstract),
    hasAblations: /ablation|ablated/i.test(abstract),
    hasMultipleEvals: (abstract.match(/dataset|benchmark/gi) || []).length >= 2,
  };
}
```

### 3.3 Embedding Generation

**File**: `server/lib/embeddings.ts`

```typescript
export async function generateEmbedding(
  text: string,
  useLocal: boolean = true
): Promise<number[]> {
  if (useLocal) {
    return generateLocalEmbedding(text);
  } else {
    return generateCloudEmbedding(text);
  }
}

// Local embedding via ollama
async function generateLocalEmbedding(text: string): Promise<number[]> {
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

  const response = await fetch(`${ollamaUrl}/api/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'all-minilm',
      prompt: text,
    }),
  });

  const data = await response.json();
  return data.embedding;
}

// Cloud embedding via Google or OpenAI
async function generateCloudEmbedding(text: string): Promise<number[]> {
  // Placeholder - implement based on env config
  // Could use Google text-embedding-004 or OpenAI text-embedding-3-small
  throw new Error('Cloud embeddings not implemented yet');
}
```

### 3.4 Classification

**File**: `server/agents/classifier.ts`

```typescript
import { callLLM } from '@/server/lib/llm';

interface Classification {
  topics: string[];
  facets: string[];
}

export async function classifyPaper(
  paper: any,
  useLocal: boolean = true
): Promise<Classification> {
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

Output ONLY valid JSON in this exact format:
{"topics": ["...", "..."], "facets": ["...", "..."]}
`.trim();

  const response = await callLLM(prompt, { useLocal, format: 'json' });

  try {
    const parsed = JSON.parse(response);
    return {
      topics: parsed.topics || [],
      facets: parsed.facets || [],
    };
  } catch (error) {
    console.error('Failed to parse classification:', response);
    return { topics: [], facets: [] };
  }
}
```

**File**: `server/lib/llm.ts`

```typescript
interface LLMOptions {
  useLocal?: boolean;
  format?: 'text' | 'json';
  model?: string;
}

export async function callLLM(
  prompt: string,
  options: LLMOptions = {}
): Promise<string> {
  const { useLocal = true, format = 'text', model } = options;

  if (useLocal) {
    return callOllamaLLM(prompt, { format, model: model || 'llama3.2' });
  } else {
    // Placeholder for cloud LLM calls
    throw new Error('Cloud LLMs not implemented yet');
  }
}

async function callOllamaLLM(
  prompt: string,
  options: { format?: string; model: string }
): Promise<string> {
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

  const response = await fetch(`${ollamaUrl}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: options.model,
      prompt,
      stream: false,
      format: options.format,
    }),
  });

  const data = await response.json();
  return data.response;
}
```

---

## 4. Worker Process & LangGraph

### 4.1 Worker Architecture

**File**: `worker/index.ts`

```typescript
import { startQueue, boss } from '@/server/queue';
import { scoutEnrichWorkflow } from './workflows/scout-enrich';

async function main() {
  console.log('Starting worker process...');

  // Start pg-boss
  await startQueue();

  // Register job handlers
  await boss.work('scout-papers', async (job) => {
    console.log('Processing scout-papers job:', job.id);
    const { categories, maxResults } = job.data;

    await scoutEnrichWorkflow(categories, maxResults);

    return { processed: true };
  });

  await boss.work('enrich-paper', async (job) => {
    console.log('Processing enrich-paper job:', job.id);
    const { paperId, useLocalEmbeddings, useLocalLLM } = job.data;

    const paper = await prisma.paper.findUnique({ where: { id: paperId } });
    if (!paper) {
      throw new Error(`Paper ${paperId} not found`);
    }

    await enrichPaper(paper, useLocalEmbeddings, useLocalLLM);

    return { enriched: true };
  });

  console.log('Worker ready. Waiting for jobs...');
}

main().catch((error) => {
  console.error('Worker error:', error);
  process.exit(1);
});
```

### 4.2 LangGraph Workflow

**File**: `worker/workflows/scout-enrich.ts`

```typescript
import { StateGraph, END } from '@langchain/langgraph';
import { ingestRecentPapers } from '@/server/agents/scout';
import { enrichPaper } from '@/server/agents/enricher';
import { prisma } from '@/server/db';

interface PipelineState {
  categories: string[];
  maxResults: number;
  paperIds: string[];
  enrichedCount: number;
}

export async function scoutEnrichWorkflow(
  categories: string[],
  maxResults: number = 100
): Promise<void> {

  // Define workflow graph
  const workflow = new StateGraph<PipelineState>({
    channels: {
      categories: { value: (x: string[], y: string[]) => y },
      maxResults: { value: (x: number, y: number) => y },
      paperIds: { value: (x: string[], y: string[]) => y },
      enrichedCount: { value: (x: number, y: number) => x + y },
    },
  });

  // Scout node
  workflow.addNode('scout', async (state: PipelineState) => {
    console.log(`Scouting papers for categories: ${state.categories.join(', ')}`);
    const paperIds = await ingestRecentPapers(state.categories, state.maxResults);
    console.log(`Scouted ${paperIds.length} papers`);
    return { paperIds };
  });

  // Enrich node
  workflow.addNode('enrich', async (state: PipelineState) => {
    console.log(`Enriching ${state.paperIds.length} papers`);
    let enrichedCount = 0;

    for (const paperId of state.paperIds) {
      const paper = await prisma.paper.findUnique({ where: { id: paperId } });
      if (!paper) continue;

      if (paper.status === 'new') {
        await enrichPaper(paper, true, true); // Use local models
        enrichedCount++;
      }
    }

    console.log(`Enriched ${enrichedCount} papers`);
    return { enrichedCount };
  });

  // Connect nodes
  workflow.addEdge('scout', 'enrich');
  workflow.addEdge('enrich', END);

  // Set entry point
  workflow.setEntryPoint('scout');

  // Compile and run
  const app = workflow.compile();
  await app.invoke({ categories, maxResults, paperIds: [], enrichedCount: 0 });
}
```

---

## 5. Data Flow

### 5.1 Ingestion Flow

```
1. User configures arXiv categories in Settings UI
   ↓
2. pg-boss schedules "scout-papers" job (every 6 hours)
   ↓
3. Worker picks up job, triggers Scout Agent
   ↓
4. Scout Agent fetches papers via Atom feed
   ↓
5. Papers stored with status="new"
   ↓
6. LangGraph workflow triggers Enricher Agent
   ↓
7. Enricher generates embeddings, classifies, detects signals
   ↓
8. Papers updated with status="enriched"
   ↓
9. Papers available in Papers List UI
```

### 5.2 Database State Transitions

```
Paper States:
┌─────┐     Enrich      ┌──────────┐
│ new │ ─────────────→ │ enriched │
└─────┘                 └──────────┘
                              ↓ (Phase 2)
                        ┌──────────┐
                        │  ranked  │
                        └──────────┘
```

---

## 6. API Design

### 6.1 tRPC Routers

**File**: `server/routers/papers.ts`

```typescript
import { router, publicProcedure } from '@/server/trpc';
import { z } from 'zod';

export const papersRouter = router({
  // List papers with filters
  list: publicProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
      categories: z.array(z.string()).optional(),
      dateFrom: z.date().optional(),
      dateTo: z.date().optional(),
      status: z.enum(['new', 'enriched', 'ranked']).optional(),
    }))
    .query(async ({ input }) => {
      const { limit, offset, categories, dateFrom, dateTo, status } = input;

      const where: any = {};
      if (categories && categories.length > 0) {
        where.categories = { hasSome: categories };
      }
      if (dateFrom || dateTo) {
        where.pubDate = {};
        if (dateFrom) where.pubDate.gte = dateFrom;
        if (dateTo) where.pubDate.lte = dateTo;
      }
      if (status) {
        where.status = status;
      }

      const [papers, total] = await Promise.all([
        prisma.paper.findMany({
          where,
          include: { enriched: true },
          orderBy: { pubDate: 'desc' },
          take: limit,
          skip: offset,
        }),
        prisma.paper.count({ where }),
      ]);

      return { papers, total };
    }),

  // Get single paper by ID
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const paper = await prisma.paper.findUnique({
        where: { id: input.id },
        include: { enriched: true },
      });

      if (!paper) {
        throw new Error(`Paper ${input.id} not found`);
      }

      return paper;
    }),
});
```

**File**: `server/routers/settings.ts`

```typescript
import { router, publicProcedure } from '@/server/trpc';
import { z } from 'zod';

export const settingsRouter = router({
  // Get arXiv categories
  getArxivCategories: publicProcedure
    .query(async () => {
      return await prisma.arxivCategory.findMany({
        orderBy: { id: 'asc' },
      });
    }),

  // Update user profile settings
  updateProfile: publicProcedure
    .input(z.object({
      userId: z.string(),
      arxivCategories: z.array(z.string()).optional(),
      useLocalEmbeddings: z.boolean().optional(),
      useLocalLLM: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { userId, ...updates } = input;

      return await prisma.userProfile.upsert({
        where: { userId },
        update: updates,
        create: { userId, ...updates },
      });
    }),

  // Trigger manual scout run
  triggerScout: publicProcedure
    .input(z.object({
      userId: z.string(),
    }))
    .mutation(async ({ input }) => {
      const profile = await prisma.userProfile.findUnique({
        where: { userId: input.userId },
      });

      if (!profile) {
        throw new Error('User profile not found');
      }

      const jobId = await boss.send('scout-papers', {
        categories: profile.arxivCategories,
        maxResults: 100,
      });

      return { jobId };
    }),
});
```

---

## 7. UI Components

### 7.1 Settings Page

**File**: `app/settings/page.tsx`

```typescript
'use client';

import { trpc } from '@/lib/trpc';
import { useState } from 'react';

export default function SettingsPage() {
  const { data: categories } = trpc.settings.getArxivCategories.useQuery();
  const { data: profile } = trpc.settings.getProfile.useQuery({ userId: 'current' });
  const updateProfile = trpc.settings.updateProfile.useMutation();

  const [selected, setSelected] = useState<string[]>(
    profile?.arxivCategories || []
  );
  const [useLocal, setUseLocal] = useState({
    embeddings: profile?.useLocalEmbeddings ?? true,
    llm: profile?.useLocalLLM ?? true,
  });

  const handleSave = async () => {
    await updateProfile.mutateAsync({
      userId: 'current',
      arxivCategories: selected,
      useLocalEmbeddings: useLocal.embeddings,
      useLocalLLM: useLocal.llm,
    });
  };

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">arXiv Categories</h2>
        <div className="grid grid-cols-2 gap-4">
          {categories?.map((cat) => (
            <label key={cat.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={selected.includes(cat.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelected([...selected, cat.id]);
                  } else {
                    setSelected(selected.filter((id) => id !== cat.id));
                  }
                }}
              />
              <span>{cat.name} ({cat.id})</span>
            </label>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-2xl font-semibold mb-4">Processing</h2>
        <label className="flex items-center gap-2 mb-2">
          <input
            type="checkbox"
            checked={useLocal.embeddings}
            onChange={(e) => setUseLocal({ ...useLocal, embeddings: e.target.checked })}
          />
          <span>Use local embeddings (ollama)</span>
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={useLocal.llm}
            onChange={(e) => setUseLocal({ ...useLocal, llm: e.target.checked })}
          />
          <span>Use local LLM for classification (ollama)</span>
        </label>
      </section>

      <button
        onClick={handleSave}
        className="px-4 py-2 bg-blue-600 text-white rounded"
      >
        Save Settings
      </button>
    </div>
  );
}
```

### 7.2 Papers List Page

**File**: `app/papers/page.tsx`

```typescript
'use client';

import { trpc } from '@/lib/trpc';

export default function PapersPage() {
  const { data, isLoading } = trpc.papers.list.useQuery({
    limit: 20,
    offset: 0,
    status: 'enriched',
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="container mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Papers</h1>

      <div className="space-y-6">
        {data?.papers.map((paper) => (
          <div key={paper.id} className="border rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-2">{paper.title}</h2>

            <div className="text-sm text-gray-600 mb-2">
              {paper.authors.map((a: any) => a.name).join(', ')}
            </div>

            <div className="text-sm text-gray-500 mb-4">
              {new Date(paper.pubDate).toLocaleDateString()} • {paper.categories.join(', ')}
            </div>

            <p className="text-gray-700 line-clamp-3">{paper.abstract}</p>

            {paper.enriched && (
              <div className="mt-4 flex gap-2">
                {paper.enriched.topics.map((topic) => (
                  <span key={topic} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                    {topic}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

## 8. Testing Strategy

### 8.1 Testing Philosophy

**Unit Tests: Mock All External Services**

All unit tests must use mocks for external dependencies:
- **Database (Prisma)**: Mock all database operations using in-memory implementations
- **External APIs**: Mock all HTTP requests (arXiv, ollama, cloud APIs)
- **LLMs**: Mock LLM responses with realistic snapshots of actual data
- **Embeddings**: Mock embedding generation with representative vectors

**Integration Tests: Real Services**

Integration tests (separate suite) will use actual services:
- Real PostgreSQL database (test environment)
- Real arXiv API (rate-limited, small datasets)
- Real ollama (if available, otherwise skip)
- End-to-end pipeline validation

**Rationale**: Unit tests should be fast, deterministic, and not fail due to external service issues. Integration tests validate real-world behavior.

### 8.2 Mock Data Strategy

All mock data must be **realistic snapshots** of actual responses:
- arXiv XML responses: Real structure from actual API calls
- LLM outputs: Actual formatted responses from ollama/Gemini
- Database records: Representative of production data

Mock data location: `__tests__/mocks/`

### 8.3 Unit Tests

**Scout Agent Tests**: `__tests__/server/agents/scout.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { fetchArxivCategories } from '@/server/agents/scout';
import { mockOAIPMHCategoriesResponse } from '../mocks/arxiv-responses';

// Mock fetch
global.fetch = vi.fn();

// Mock Prisma
vi.mock('@/server/db', () => ({
  prisma: mockPrisma,
}));

describe('Scout Agent', () => {
  it('should fetch and parse arXiv categories', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      text: async () => mockOAIPMHCategoriesResponse,
    });

    const categories = await fetchArxivCategories();
    expect(categories.length).toBe(4); // cs.*, not math.*
    expect(categories[0].id).toBe('cs');
  });
});
```

**Enricher Agent Tests**: `__tests__/server/agents/enricher.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { estimateMathDepth, detectEvidenceSignals } from '@/server/agents/enricher';

describe('Enricher Agent', () => {
  it('should estimate math depth correctly', () => {
    const highMath = estimateMathDepth(
      'A Novel Theorem',
      'We prove convergence using gradient descent with \\alpha regularization.'
    );
    expect(highMath).toBeGreaterThan(0.5);

    const lowMath = estimateMathDepth(
      'Agentic System Design',
      'We present a practical agentic system for tool use and planning.'
    );
    expect(lowMath).toBeLessThan(0.3);
  });

  it('should detect evidence signals', () => {
    const signals = detectEvidenceSignals(
      'We compare against strong baselines on 3 benchmarks. Code is available on GitHub. ' +
      'Ablation studies show the importance of our novel component.'
    );

    expect(signals.hasBaselines).toBe(true);
    expect(signals.hasAblations).toBe(true);
    expect(signals.hasCode).toBe(true);
    expect(signals.hasMultipleEvals).toBe(true);
  });
});
```

### 8.2 Integration Tests

**End-to-End Pipeline Test**: `__tests__/integration/scout-enrich.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { scoutEnrichWorkflow } from '@/worker/workflows/scout-enrich';

describe('Scout-Enrich Pipeline', () => {
  it('should ingest and enrich papers end-to-end', async () => {
    const categories = ['cs.AI'];
    await scoutEnrichWorkflow(categories, 5);

    const papers = await prisma.paper.findMany({
      where: { status: 'enriched', categories: { hasSome: categories } },
      take: 5,
    });

    expect(papers.length).toBeGreaterThan(0);
    expect(papers[0].status).toBe('enriched');
  }, 60000); // 60s timeout
});
```

---

## 9. Performance Considerations

### 9.1 Database Optimization

```sql
-- Critical indexes for Phase 1
CREATE INDEX papers_status_idx ON "Paper"(status);
CREATE INDEX papers_pubDate_desc_idx ON "Paper"(pubDate DESC);
CREATE INDEX papers_categories_idx ON "Paper" USING GIN(categories);

-- pgvector index (created later when we have embeddings)
CREATE INDEX papers_enriched_embedding_idx ON "PaperEnriched"
USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
```

### 9.2 Rate Limiting Impact

- With 1 request/3 seconds, ingesting 100 papers takes ~5 minutes
- Not a bottleneck for daily operation (scheduled every 6 hours)
- Manual "Run Now" button shows progress indicator

### 9.3 Embedding Performance

**Local (ollama)**:
- ~0.1s per embedding on modern CPU
- 100 papers = ~10 seconds

**Cloud (Google/OpenAI)**:
- ~0.05s per embedding via API
- 100 papers = ~5 seconds
- Cost: ~$0.01 per 100 papers

---

## 10. Cost Analysis

### 10.1 Daily Cost (Local-First)

**Assuming**:
- 200 papers/day
- Local embeddings (ollama)
- Local LLM classification (llama3.2)

**Costs**:
- arXiv API: $0 (free)
- Local embeddings: $0 (compute only)
- Local LLM: $0 (compute only)
- **Total: $0/day** (plus electricity)

### 10.2 Daily Cost (Cloud Fallback)

**Assuming**:
- 200 papers/day
- Cloud embeddings (text-embedding-004)
- Cloud LLM (Gemini 2.0 Flash)

**Costs**:
- arXiv API: $0
- Embeddings: $0.01
- LLM classification: $0.05 (200 × $0.00025)
- **Total: ~$0.06/day**

---

## 11. Implementation Plan

### 11.1 Development Order (TDD)

**Week 2, Day 1-2: Scout Agent**
1. Write tests for category fetching
2. Implement category fetching
3. Write tests for Atom parsing
4. Implement Atom parsing
5. Write tests for rate limiting
6. Implement rate limiter
7. Write tests for version supersedence
8. Implement supersedence logic

**Week 2, Day 3-4: Enricher Agent**
1. Write tests for math depth estimation
2. Implement math depth estimation
3. Write tests for evidence detection
4. Implement evidence detection
5. Write tests for embeddings (mocked)
6. Implement embedding generation
7. Write tests for classification (mocked)
8. Implement classification

**Week 2, Day 5: Worker & LangGraph**
1. Set up worker process
2. Write tests for LangGraph workflow
3. Implement Scout → Enrich workflow
4. Test end-to-end pipeline

**Week 2, Day 6: UI Components**
1. Implement Settings page
2. Implement Papers list page
3. Manual testing

**Week 2, Day 7: Integration & Polish**
1. Run full integration tests
2. Fix bugs
3. Documentation
4. Phase 1 completion summary

---

## Appendix

### A. Dependencies to Install

```bash
npm install @langchain/langgraph @langchain/core @langchain/community
npm install bottleneck
npm install fast-xml-parser
```

### B. Environment Variables

```bash
# .env.local additions for Phase 1
OLLAMA_BASE_URL="http://localhost:11434"

# Optional cloud APIs
GOOGLE_API_KEY="..."
OPENAI_API_KEY="..."
```

### C. ollama Setup

```bash
# Install ollama
# macOS: brew install ollama
# Linux: curl -fsSL https://ollama.com/install.sh | sh

# Pull models
ollama pull all-minilm    # Embeddings
ollama pull llama3.2      # Classification LLM
```

---

**End of Phase 1 Technical Design**

---

## 10. UI Guidelines

### 10.1 Technology Stack

- **Framework**: React 19 with Next.js 15 App Router
- **Styling**: Tailwind CSS 4
- **Components**: shadcn/ui (Radix UI primitives)
- **Icons**: Lucide React

### 10.2 Design Principles

**Simple, Functional, Professional**
- Prefer clarity and usability over visual effects
- Avoid heavy animations, glassmorphic effects, or overly decorative elements
- Focus on information density and clean typography
- Use consistent spacing and a clear hierarchy

**Component Usage**
- Always use shadcn components when an appropriate one exists
- Do not reinvent components that shadcn provides (Button, Card, Badge, Table, etc.)
- Use appropriate Lucide icons for visual hierarchy and context

**Color & Contrast**
- Use Tailwind's neutral color palette by default
- Ensure WCAG AA contrast compliance
- Use color purposefully (status indicators, CTAs, warnings)

### 10.3 Key Components

**shadcn Components Used**:
- `Card`, `CardHeader`, `CardTitle`, `CardContent`, `CardDescription` - Content containers
- `Button` - All interactive buttons
- `Badge` - Tags, categories, status indicators
- `Checkbox` - Settings toggles, multi-select
- `Label` - Form labels
- `Table` - Data tables (future use)
- `Separator` - Visual dividers
- `Select` - Dropdowns (future use)

**Lucide Icons Used**:
- `FileText` - Papers, documents
- `Settings2` - Configuration
- `Activity` - System status
- `Database` - Data sources
- `Cpu` - Processing
- `Calendar` - Dates
- `Users` - Authors
- `Tag` - Categories
- `ExternalLink` - External links
- `CheckCircle2` - Success states
- `Loader2` - Loading states (animated)
- `ChevronLeft`, `ChevronRight` - Navigation
- `BarChart3` - Statistics

### 10.4 Page Layouts

**Standard Layout Pattern**:
```tsx
<div className="container mx-auto py-8 px-4 max-w-{size}">
  {/* Header */}
  <div className="mb-8">
    <div className="flex items-center gap-3 mb-2">
      <Icon className="h-8 w-8" />
      <h1 className="text-3xl font-bold">Page Title</h1>
    </div>
    <p className="text-muted-foreground">Description</p>
  </div>

  {/* Content */}
  <div className="space-y-6">
    <Card>...</Card>
  </div>
</div>
```

**Responsive Breakpoints**:
- Mobile-first approach
- Use Tailwind's `sm:`, `md:`, `lg:` breakpoints
- Grid layouts: `grid gap-4 md:grid-cols-2`

### 10.5 States & Feedback

**Loading States**:
```tsx
{isLoading && (
  <div className="flex items-center gap-2">
    <Loader2 className="h-4 w-4 animate-spin" />
    Loading...
  </div>
)}
```

**Empty States**:
```tsx
<Card>
  <CardContent className="py-12">
    <div className="text-center">
      <Icon className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
      <h3 className="text-lg font-medium mb-2">No items found</h3>
      <p className="text-sm text-muted-foreground mb-4">Description</p>
      <Button>Action</Button>
    </div>
  </CardContent>
</Card>
```

**Success/Error States**:
```tsx
{success && (
  <div className="flex items-center gap-2 text-green-600">
    <CheckCircle2 className="h-4 w-4" />
    Success message
  </div>
)}
```

