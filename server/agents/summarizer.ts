/**
 * Summarizer Agent
 *
 * Generates AI summaries for research papers with content-hash based caching
 * Phase 4: Summaries
 */

import { createHash } from 'crypto';
import { prisma } from '@/server/db';
import { generateSummary, type LLMProvider } from '@/server/lib/llm';

export interface SummaryResult {
  whatsNew: string;
  keyPoints: string[];
  markdownContent: string;
  contentHash: string;
  generatedAt: Date;
}

/**
 * Generate a content hash from an abstract
 *
 * @param abstract - Paper abstract text
 * @returns SHA-256 hex hash
 */
function generateContentHash(abstract: string): string {
  return createHash('sha256').update(abstract).digest('hex');
}

/**
 * Format summary as markdown
 *
 * @param whatsNew - What's new summary
 * @param keyPoints - Key points array
 * @returns Markdown formatted string
 */
function formatAsMarkdown(whatsNew: string, keyPoints: string[]): string {
  const keyPointsMarkdown = keyPoints.map((point) => `- ${point}`).join('\n');

  return `## What's New

${whatsNew}

## Key Points

${keyPointsMarkdown}`;
}

/**
 * Generate summary for a paper with intelligent caching
 *
 * This function:
 * 1. Computes content hash from abstract
 * 2. Checks cache for existing summary
 * 3. Returns cached summary if found
 * 4. Otherwise, calls LLM to generate new summary
 * 5. Persists summary to database
 *
 * @param paperId - Paper ID
 * @param userId - User ID (for LLM preference)
 * @returns Summary result
 */
export async function generateSummaryForPaper(
  paperId: string,
  userId: string
): Promise<SummaryResult> {
  // Load paper
  const paper = await prisma.paper.findUnique({
    where: { id: paperId },
  });

  if (!paper) {
    throw new Error('Paper not found');
  }

  // Load user profile for LLM preference
  const userProfile = await prisma.userProfile.findUnique({
    where: { userId },
  });

  if (!userProfile) {
    throw new Error('User profile not found');
  }

  // Generate content hash
  const contentHash = generateContentHash(paper.abstract);

  // Check cache
  const cachedSummary = await prisma.summary.findFirst({
    where: {
      paperId,
      summaryType: 'skim',
      contentHash,
    },
  });

  // Cache hit - return cached summary
  if (cachedSummary) {
    return {
      whatsNew: cachedSummary.whatsNew,
      keyPoints: cachedSummary.keyPoints,
      markdownContent: cachedSummary.markdownContent,
      contentHash: cachedSummary.contentHash,
      generatedAt: cachedSummary.generatedAt,
    };
  }

  // Cache miss - generate new summary

  // Determine LLM provider
  const provider: LLMProvider = userProfile.useLocalLLM ? 'local' : 'cloud';

  // Call LLM
  const llmOutput = await generateSummary(
    {
      title: paper.title,
      abstract: paper.abstract,
      authors: paper.authors,
    },
    provider
  );

  // Format as markdown
  const markdownContent = formatAsMarkdown(
    llmOutput.whatsNew,
    llmOutput.keyPoints
  );

  // Persist to database (upsert to handle abstract changes)
  const summary = await prisma.summary.upsert({
    where: {
      paperId_summaryType: {
        paperId,
        summaryType: 'skim',
      },
    },
    create: {
      paperId,
      summaryType: 'skim',
      whatsNew: llmOutput.whatsNew,
      keyPoints: llmOutput.keyPoints,
      markdownContent,
      contentHash,
    },
    update: {
      whatsNew: llmOutput.whatsNew,
      keyPoints: llmOutput.keyPoints,
      markdownContent,
      contentHash,
      generatedAt: new Date(),
    },
  });

  return {
    whatsNew: summary.whatsNew,
    keyPoints: summary.keyPoints,
    markdownContent: summary.markdownContent,
    contentHash: summary.contentHash,
    generatedAt: summary.generatedAt,
  };
}
