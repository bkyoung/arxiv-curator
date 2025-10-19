/**
 * Feedback tRPC Router
 *
 * Handles user feedback actions and history retrieval
 * Phase 2: Personalization & Scoring
 */

import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { prisma } from '@/server/db';
import {
  recordFeedback,
  updateUserVectorFromFeedback,
  getFeedbackHistory,
} from '@/server/lib/feedback';

type FeedbackAction = 'save' | 'dismiss' | 'thumbs_up' | 'thumbs_down' | 'hide';

/**
 * Common handler for all feedback actions
 * Consolidates duplicated logic from individual endpoints
 */
async function handleFeedback(
  userId: string,
  paperId: string,
  action: FeedbackAction
) {
  // Record feedback
  const feedback = await recordFeedback({
    userId,
    paperId,
    action,
  });

  // Update user vector if paper has embedding
  const paper = await prisma.paper.findUnique({
    where: { id: paperId },
    include: { enriched: true },
  });

  if (paper?.enriched?.embedding) {
    await updateUserVectorFromFeedback({
      userId,
      paperEmbedding: paper.enriched.embedding as number[],
      action,
    });
  }

  return feedback;
}

export const feedbackRouter = router({
  /**
   * Record save feedback
   */
  save: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        paperId: z.string(),
      })
    )
    .mutation(async ({ input }) =>
      handleFeedback(input.userId, input.paperId, 'save')
    ),

  /**
   * Record dismiss feedback
   */
  dismiss: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        paperId: z.string(),
      })
    )
    .mutation(async ({ input }) =>
      handleFeedback(input.userId, input.paperId, 'dismiss')
    ),

  /**
   * Record thumbs up feedback
   */
  thumbsUp: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        paperId: z.string(),
      })
    )
    .mutation(async ({ input }) =>
      handleFeedback(input.userId, input.paperId, 'thumbs_up')
    ),

  /**
   * Record thumbs down feedback
   */
  thumbsDown: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        paperId: z.string(),
      })
    )
    .mutation(async ({ input }) =>
      handleFeedback(input.userId, input.paperId, 'thumbs_down')
    ),

  /**
   * Record hide feedback
   */
  hide: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        paperId: z.string(),
      })
    )
    .mutation(async ({ input }) =>
      handleFeedback(input.userId, input.paperId, 'hide')
    ),

  /**
   * Get feedback history for a user
   */
  getHistory: publicProcedure
    .input(
      z.object({
        userId: z.string(),
        action: z.string().optional(),
        limit: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      return await getFeedbackHistory(input);
    }),
});
