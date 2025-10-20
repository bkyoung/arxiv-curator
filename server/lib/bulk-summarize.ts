/**
 * Bulk Summarization
 *
 * Parallel summary generation with concurrency control
 * Phase 4: Summaries
 */

import { prisma } from '@/server/db';
import { generateSummaryForPaper } from '@/server/agents/summarizer';

export interface BulkSummarizationResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: Array<{
    paperId: string;
    error: string;
  }>;
}

/**
 * Run tasks in parallel with concurrency limit
 *
 * @param tasks - Array of async tasks to execute
 * @param concurrency - Max number of concurrent tasks
 * @returns Array of results
 */
async function pLimit<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  const executing: Set<Promise<any>> = new Set();

  for (const task of tasks) {
    const p = Promise.resolve().then(async () => {
      const result = await task();
      results.push(result);
      executing.delete(p);
    });

    executing.add(p);

    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }

  await Promise.all(executing);
  return results;
}

/**
 * Summarize top papers from a briefing
 *
 * Generates summaries for all papers in a briefing with:
 * - Parallel processing (concurrency limit: 3)
 * - Error tracking and graceful degradation
 * - Progress reporting
 *
 * @param briefingId - Briefing ID
 * @returns Summarization results
 */
export async function summarizeTopPapers(
  briefingId: string
): Promise<BulkSummarizationResult> {
  // Load briefing
  const briefing = await prisma.briefing.findUnique({
    where: { id: briefingId },
  });

  if (!briefing) {
    throw new Error('Briefing not found');
  }

  // Handle empty briefing
  if (briefing.paperIds.length === 0) {
    return {
      total: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
    };
  }

  // Load papers
  const papers = await prisma.paper.findMany({
    where: { id: { in: briefing.paperIds } },
  });

  // Create summarization tasks
  const tasks = papers.map((paper) => async () => {
    try {
      await generateSummaryForPaper(paper.id, briefing.userId);
      return { success: true, paperId: paper.id };
    } catch (error) {
      return {
        success: false,
        paperId: paper.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  });

  // Execute with concurrency limit
  const results = await pLimit(tasks, 3);

  // Aggregate results
  const succeeded = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const errors = results
    .filter((r) => !r.success)
    .map((r) => ({
      paperId: r.paperId,
      error: (r as any).error,
    }));

  return {
    total: papers.length,
    succeeded,
    failed,
    errors,
  };
}
