/**
 * Enricher Agent
 *
 * Responsible for Tier 0 enrichment of papers (abstract-only processing)
 */

import { prisma } from '@/server/db';
import { generateEmbedding } from '@/server/lib/embeddings';
import { classifyPaper } from '@/server/lib/classifier';
import type { Paper, PaperEnriched } from '@prisma/client';

export interface EvidenceSignals {
  hasCode: boolean;
  hasData: boolean;
  hasBaselines: boolean;
  hasAblations: boolean;
  hasMultipleEvals: boolean;
}

/**
 * Estimate mathematical depth of a paper
 *
 * @param title - Paper title
 * @param abstract - Paper abstract
 * @returns Math depth score (0.0-1.0)
 */
export function estimateMathDepth(title: string, abstract: string): number {
  const text = `${title} ${abstract}`.toLowerCase();

  // Count LaTeX commands
  const latexCommands = text.match(/\\[a-z]+/g) || [];
  const latexDensity = latexCommands.length / text.length;

  // Theory keywords
  const theoryKeywords = [
    'theorem',
    'proof',
    'lemma',
    'corollary',
    'convergence',
    'optimization',
    'gradient descent',
    'loss function',
    'regularization',
  ];

  const keywordMatches = theoryKeywords.filter((k) => text.includes(k)).length;
  const keywordScore = keywordMatches / theoryKeywords.length;

  // Combine: 60% LaTeX density, 40% keyword score
  const score = 0.6 * latexDensity * 100 + 0.4 * keywordScore;

  return Math.min(1.0, score);
}

/**
 * Detect evidence quality signals from abstract
 *
 * @param abstract - Paper abstract
 * @returns Evidence signals object
 */
export function detectEvidenceSignals(abstract: string): EvidenceSignals {
  const lowerAbstract = abstract.toLowerCase();

  return {
    hasCode: /github|code available|open.?source/i.test(abstract),
    hasData: /dataset|data available/i.test(abstract),
    hasBaselines: /baseline|compared to|compare against/i.test(abstract),
    hasAblations: /ablation|ablated/i.test(abstract),
    hasMultipleEvals: (abstract.match(/dataset|benchmark/gi) || []).length >= 2,
  };
}

/**
 * Enrich a paper with Tier 0 metadata
 *
 * @param paper - Paper to enrich
 * @param useLocalEmbeddings - Use local embeddings (default: true)
 * @param useLocalLLM - Use local LLM for classification (default: true)
 * @returns Enriched paper metadata
 */
export async function enrichPaper(
  paper: Paper,
  useLocalEmbeddings: boolean = true,
  useLocalLLM: boolean = true
): Promise<PaperEnriched> {
  console.log(`[Enricher] Enriching paper ${paper.arxivId}...`);

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

  console.log(
    `[Enricher] Enriched ${paper.arxivId}: ` +
      `topics=${topics.join(',')}, facets=${facets.join(',')}, mathDepth=${mathDepth.toFixed(2)}`
  );

  return enriched;
}
