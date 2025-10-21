/**
 * Analyst Agent
 *
 * Generate critical analysis at three depth levels (A/B/C)
 * Phase 5: Critical Analysis
 */

import { prisma } from '@/server/db';
import { Prisma } from '@prisma/client';
import { generateCritiqueOllama, generateCritiqueGemini } from '@/server/lib/llm/critique';
import {
  downloadAndParsePDF,
  extractIntro,
  extractConclusion,
} from '@/server/lib/pdf-parser';

export interface GenerateCritiqueInput {
  paperId: string;
  userId: string;
  depth: 'A' | 'B' | 'C';
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

export interface SimilarPaper {
  id: string;
  title: string;
  abstract: string;
  authors: string[];
  pubDate: Date;
  similarity: number;
  summary?: {
    whatsNew: string;
    keyPoints: string[];
  };
}

/**
 * Find similar papers using pgvector cosine similarity
 */
export async function findSimilarPapers(
  embedding: number[],
  limit: number,
  dayRange: number,
  excludePaperId?: string
): Promise<SimilarPaper[]> {
  if (embedding.length === 0) {
    return [];
  }

  // Convert embedding to pgvector format
  const embeddingString = `[${embedding.join(',')}]`;

  // Calculate date threshold
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - dayRange);

  // Build query with optional exclude condition
  const excludeCondition = excludePaperId
    ? Prisma.sql`AND p.id != ${excludePaperId}`
    : Prisma.empty;

  // pgvector cosine similarity search using <=> operator
  // Lower distance = higher similarity
  const results = await prisma.$queryRaw<
    Array<{
      id: string;
      title: string;
      abstract: string;
      authors: string[];
      pubDate: Date;
      similarity: number;
      whatsNew: string | null;
      keyPoints: string[] | null;
    }>
  >`
    SELECT
      p.id,
      p.title,
      p.abstract,
      p.authors,
      p."pubDate",
      1 - (pe.embedding <=> ${embeddingString}::vector) as similarity,
      s."whatsNew",
      s."keyPoints"
    FROM "Paper" p
    INNER JOIN "PaperEnriched" pe ON pe."paperId" = p.id
    LEFT JOIN "Summary" s ON s."paperId" = p.id AND s."summaryType" = 'QUICK'
    WHERE p."pubDate" >= ${dateThreshold}
      ${excludeCondition}
    ORDER BY pe.embedding <=> ${embeddingString}::vector ASC
    LIMIT ${limit}
  `;

  // Transform results to SimilarPaper format
  return results.map((row) => {
    const paper: SimilarPaper = {
      id: row.id,
      title: row.title,
      abstract: row.abstract,
      authors: row.authors,
      pubDate: row.pubDate,
      similarity: row.similarity,
    };

    // Include summary if available
    if (row.whatsNew && row.keyPoints) {
      paper.summary = {
        whatsNew: row.whatsNew,
        keyPoints: row.keyPoints,
      };
    }

    return paper;
  });
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

  if (depth === 'A') {
    return await generateFastCritique(paper, userId);
  } else if (depth === 'B') {
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
    const llmOutput = await generateCritiqueOllama({ prompt });
    response = llmOutput.markdown;
  } else {
    const llmOutput = await generateCritiqueGemini({ prompt });
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
      depth: 'A',
      claimsEvidence,
      limitations,
      // neighborComparison is null for Depth A (only used for Depth B)
      verdict,
      confidence,
      markdownContent: response,
    },
  });

  return analysis as GenerateCritiqueOutput;
}

/**
 * Depth B: Comparative critique (PDF + 3 similar papers)
 */
async function generateComparativeCritique(
  paper: any,
  userId: string
): Promise<GenerateCritiqueOutput> {
  // Depth B always requires PDF
  if (!paper.pdfUrl) {
    throw new Error('PDF required for Depth B critique');
  }

  // Download and parse full PDF
  const pdfText = await downloadAndParsePDF(paper.pdfUrl, paper.id);

  // Find 3 similar papers using embedding
  if (!paper.enriched?.embedding) {
    throw new Error('Paper embedding required for Depth B critique');
  }

  const neighbors = await findSimilarPapers(
    paper.enriched.embedding,
    3, // limit
    180, // dayRange (6 months)
    paper.id // exclude current paper
  );

  // Build comparative prompt including neighbor summaries
  const prompt = buildComparativeCritiquePrompt(paper, pdfText, neighbors);

  // Depth B always uses cloud LLM (Gemini) regardless of user preference
  const llmOutput = await generateCritiqueGemini({ prompt });
  const response = llmOutput.markdown;

  // Parse response
  const claimsEvidence = extractClaimsTable(response);
  const limitations = extractLimitations(response);
  const verdict = extractVerdict(response);
  const confidence = extractConfidence(response);
  const comparisonTable = extractComparisonTable(response);

  // Store neighborComparison as JSON
  const neighborComparison = {
    neighbors: neighbors.map((n) => ({
      id: n.id,
      title: n.title,
      similarity: n.similarity,
    })),
    comparisonTable,
  };

  // Store in DB
  const analysis = await prisma.analysis.create({
    data: {
      paperId: paper.id,
      userId,
      depth: 'B',
      claimsEvidence,
      limitations,
      neighborComparison,
      verdict,
      confidence,
      markdownContent: response,
    },
  });

  return analysis as GenerateCritiqueOutput;
}

/**
 * Depth C: Deep critique (Full PDF analysis)
 */
async function generateDeepCritique(
  paper: any,
  userId: string
): Promise<GenerateCritiqueOutput> {
  // Depth C always requires PDF
  if (!paper.pdfUrl) {
    throw new Error('PDF required for Depth C critique');
  }

  // Download and parse full PDF
  const pdfText = await downloadAndParsePDF(paper.pdfUrl, paper.id);

  // Build deep critique prompt with full PDF context
  const prompt = buildDeepCritiquePrompt(paper, pdfText);

  // Depth C always uses cloud LLM (Gemini) regardless of user preference
  const llmOutput = await generateCritiqueGemini({ prompt });
  const response = llmOutput.markdown;

  // Parse response
  const claimsEvidence = extractClaimsTable(response);
  const limitations = extractLimitations(response);
  const verdict = extractVerdict(response);
  const confidence = extractConfidence(response);

  // Store in DB (no neighborComparison for Depth C)
  const analysis = await prisma.analysis.create({
    data: {
      paperId: paper.id,
      userId,
      depth: 'C',
      claimsEvidence,
      limitations,
      verdict,
      confidence,
      markdownContent: response,
    },
  });

  return analysis as GenerateCritiqueOutput;
}

/**
 * Build prompt for fast critique (Depth A)
 */
function buildFastCritiquePrompt(
  paper: any,
  intro: string | null,
  conclusion: string | null
): string {
  return `You are a research reviewer providing a fast critical analysis.

Paper: ${paper.title}
Authors: ${paper.authors.join(', ')}
Abstract: ${paper.abstract}
${intro ? `\nIntroduction:\n${intro}` : ''}
${conclusion ? `\nConclusion:\n${conclusion}` : ''}

Generate a structured critique with the following sections:

## Core Contribution
What problem does this solve? What's the proposed solution? (2-3 sentences)

## Key Claims & Evidence
| Claim | Evidence | Assessment |
|-------|----------|------------|
| [Main claim 1] | [Evidence from paper] | Supported / Weak / Missing |
| [Main claim 2] | [Evidence from paper] | Supported / Weak / Missing |
| [Main claim 3] | [Evidence from paper] | Supported / Weak / Missing |

Include 2-4 key claims.

## Quick Assessment
**Strengths** (2-3 bullets):
- [Strength 1]
- [Strength 2]
- [Strength 3]

**Limitations** (2-3 bullets):
- [Limitation 1]
- [Limitation 2]
- [Limitation 3]

## Verdict
**Overall**: [Promising | Solid Incremental | Over-claimed]
**Confidence**: [0.0 - 1.0]
**Reasoning**: [1-2 sentences explaining the verdict]

## Bottom Line
[One sentence takeaway for practitioners]
`;
}

/**
 * Build prompt for comparative critique (Depth B)
 */
function buildComparativeCritiquePrompt(
  paper: any,
  pdfText: string,
  neighbors: SimilarPaper[]
): string {
  // Truncate PDF if too long (20,000 chars as decided)
  const truncatedPDF = pdfText.length > 20000 ? pdfText.slice(0, 20000) + '\n\n[PDF truncated to 20,000 characters]' : pdfText;

  // Build neighbor summaries section
  let neighborsSection = '';
  neighbors.forEach((neighbor, idx) => {
    neighborsSection += `\n### Neighbor ${idx + 1}: ${neighbor.title}\n`;
    neighborsSection += `Authors: ${neighbor.authors.join(', ')}\n`;
    neighborsSection += `Similarity: ${(neighbor.similarity * 100).toFixed(1)}%\n`;
    neighborsSection += `Abstract: ${neighbor.abstract}\n`;
    if (neighbor.summary) {
      neighborsSection += `What's New: ${neighbor.summary.whatsNew}\n`;
      neighborsSection += `Key Points: ${neighbor.summary.keyPoints.join(', ')}\n`;
    }
  });

  return `You are a research reviewer providing a comparative critical analysis.

Paper to Review: ${paper.title}
Authors: ${paper.authors.join(', ')}
Abstract: ${paper.abstract}

Full PDF Content:
${truncatedPDF}

Similar Recent Papers:${neighborsSection}

Generate a structured comparative critique with the following sections:

## Core Contribution
What problem does this solve? What's the proposed solution? (2-3 sentences)

## Key Claims & Evidence
| Claim | Evidence | Assessment |
|-------|----------|------------|
| [Main claim 1] | [Evidence from paper] | Supported / Weak / Missing |
| [Main claim 2] | [Evidence from paper] | Supported / Weak / Missing |
| [Main claim 3] | [Evidence from paper] | Supported / Weak / Missing |

Include 2-4 key claims.

## Comparison vs Prior Work
| Aspect | Current Paper | ${neighbors[0]?.title || 'N/A'} | ${neighbors[1]?.title || 'N/A'} | ${neighbors[2]?.title || 'N/A'} |
|--------|---------------|------------|------------|------------|
| Approach | [Describe approach] | [Describe] | [Describe] | [Describe] |
| Key Results | [Summarize results] | [Summarize] | [Summarize] | [Summarize] |
| Claims | [Main claims] | [Claims] | [Claims] | [Claims] |
| Limitations | [Limitations] | [Limitations] | [Limitations] | [Limitations] |

## Relative Positioning
How does this work compare to similar recent work? Is it incremental or novel? Does it build on, contradict, or extend prior work?

## Quick Assessment
**Strengths** (2-3 bullets):
- [Strength 1]
- [Strength 2]
- [Strength 3]

**Limitations** (2-3 bullets):
- [Limitation 1]
- [Limitation 2]
- [Limitation 3]

## Verdict
**Overall**: [Promising | Solid Incremental | Over-claimed]
**Confidence**: [0.0 - 1.0]
**Reasoning**: [1-2 sentences explaining the verdict]

## Bottom Line
[One sentence takeaway for practitioners]
`;
}

/**
 * Build prompt for deep critique (Depth C)
 */
function buildDeepCritiquePrompt(paper: any, pdfText: string): string {
  // Truncate PDF if too long (20,000 chars as decided)
  const truncatedPDF = pdfText.length > 20000 ? pdfText.slice(0, 20000) + '\n\n[PDF truncated to 20,000 characters]' : pdfText;

  return `You are a research reviewer providing a comprehensive deep critical analysis.

Paper to Review: ${paper.title}
Authors: ${paper.authors.join(', ')}
Abstract: ${paper.abstract}

Full PDF Content:
${truncatedPDF}

Generate a structured deep critique with the following sections:

## Core Contribution
What problem does this solve? What's the proposed solution? (2-3 sentences)

## Key Claims & Evidence
| Claim | Evidence | Assessment |
|-------|----------|------------|
| [Main claim 1] | [Evidence from paper] | Supported / Weak / Missing |
| [Main claim 2] | [Evidence from paper] | Supported / Weak / Missing |
| [Main claim 3] | [Evidence from paper] | Supported / Weak / Missing |

Include 3-5 key claims with detailed evidence assessment.

## Methodology Review
- **Soundness of approach**: Is the methodology theoretically sound?
- **Alternative methods**: Were alternative approaches considered?
- **Methodological flaws**: Any shortcuts or questionable assumptions?

## Experimental Design
- **Comprehensiveness**: Are experiments thorough and cover edge cases?
- **Baselines**: Are comparisons to appropriate baselines?
- **Statistical significance**: Are results statistically significant?

## Reproducibility Assessment
- **Implementation details**: Are implementation details sufficient to reproduce?
- **Code/data availability**: Is code and data publicly available?
- **Reproducibility**: Can results likely be reproduced by other researchers?

## Compute & Data Costs
- **Resource requirements**: What computational resources are needed?
- **Accessibility**: Can typical academic labs run these experiments?
- **Data requirements**: Is the data accessible to researchers?

## SOTA Comparability
- **Fair comparisons**: Are comparisons to state-of-the-art methods fair?
- **Missing baselines**: Are any important baselines missing?
- **SOTA claims**: Are claims of SOTA performance justified?

## Quick Assessment
**Strengths** (3-5 bullets):
- [Strength 1]
- [Strength 2]
- [Strength 3]

**Limitations** (3-5 bullets):
- [Limitation 1]
- [Limitation 2]
- [Limitation 3]

## Verdict
**Overall**: [Promising | Solid Incremental | Over-claimed]
**Confidence**: [0.0 - 1.0]
**Reasoning**: [2-3 sentences explaining the verdict based on methodology, experiments, and reproducibility]

## Bottom Line
[One sentence takeaway for practitioners and researchers]
`;
}

/**
 * Extract claims-evidence table from markdown
 */
export function extractClaimsTable(markdown: string): string {
  const match = markdown.match(
    /## Key Claims & Evidence\s+([\s\S]+?)(?=\n##|$)/i
  );
  return match?.[1]?.trim() ?? 'No claims table found';
}

/**
 * Extract limitations list from markdown
 */
export function extractLimitations(markdown: string): string[] {
  const match = markdown.match(/\*\*Limitations\*\*[:\s]+([\s\S]+?)(?=\n##|$)/i);
  if (!match) return [];

  const limitationsText = match[1];
  const bullets = limitationsText.match(/^[\s]*-\s+(.+)$/gm) ?? [];
  return bullets.map((b) => b.replace(/^[\s]*-\s+/, '').trim());
}

/**
 * Extract verdict from markdown
 */
export function extractVerdict(markdown: string): string {
  const match = markdown.match(/\*\*Overall\*\*:\s*(.+)/i);
  return match?.[1]?.trim() ?? 'Unknown';
}

/**
 * Extract confidence (0.0 - 1.0) from markdown
 */
export function extractConfidence(markdown: string): number {
  const match = markdown.match(/\*\*Confidence\*\*:\s*([\d.]+)/i);
  return match?.[1] ? parseFloat(match[1]) : 0.5;
}

/**
 * Extract comparison table from markdown (Depth B only)
 */
export function extractComparisonTable(markdown: string): string | null {
  const match = markdown.match(/## Comparison vs Prior Work\s+([\s\S]+?)(?=\n##|$)/i);
  return match?.[1]?.trim() ?? null;
}
