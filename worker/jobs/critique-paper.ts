/**
 * Critique Paper Job Handler
 *
 * Background job for generating critical analysis at three depth levels (A/B/C)
 * Phase 5: Critical Analysis
 */

import { generateCritique } from '../../server/agents/analyst';

export interface CritiquePaperJobData {
  paperId: string;
  userId: string;
  depth: 'A' | 'B' | 'C';
}

/**
 * Handle critique generation job
 * Called by pg-boss worker
 */
export async function handleCritiquePaperJob(job: {
  id: string;
  data: CritiquePaperJobData;
}): Promise<void> {
  const { paperId, userId, depth } = job.data;

  console.log(`[Critique Job ${job.id}] Starting ${depth} critique for paper ${paperId}`);

  try {
    const result = await generateCritique({
      paperId,
      userId,
      depth,
    });

    console.log(
      `[Critique Job ${job.id}] Complete: Generated ${depth} critique (${result.id})`
    );
  } catch (error) {
    console.error(`[Critique Job ${job.id}] Failed:`, error);
    // Re-throw to let pg-boss handle retry
    throw error;
  }
}
