/**
 * Feedback tRPC Router
 *
 * Handles user feedback actions and history retrieval
 * Phase 2: Personalization & Scoring
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
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
  save: protectedProcedure
    .input(
      z.object({
        paperId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return handleFeedback(ctx.user.id, input.paperId, 'save');
    }),

  /**
   * Record dismiss feedback
   */
  dismiss: protectedProcedure
    .input(
      z.object({
        paperId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return handleFeedback(ctx.user.id, input.paperId, 'dismiss');
    }),

  /**
   * Record thumbs up feedback
   */
  thumbsUp: protectedProcedure
    .input(
      z.object({
        paperId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return handleFeedback(ctx.user.id, input.paperId, 'thumbs_up');
    }),

  /**
   * Record thumbs down feedback
   */
  thumbsDown: protectedProcedure
    .input(
      z.object({
        paperId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return handleFeedback(ctx.user.id, input.paperId, 'thumbs_down');
    }),

  /**
   * Record hide feedback
   */
  hide: protectedProcedure
    .input(
      z.object({
        paperId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      return handleFeedback(ctx.user.id, input.paperId, 'hide');
    }),

  /**
   * Get feedback history for a user
   */
  getHistory: protectedProcedure
    .input(
      z.object({
        action: z.string().optional(),
        limit: z.number().optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      return await getFeedbackHistory({
        userId: ctx.user.id,
        action: input.action,
        limit: input.limit,
      });
    }),

  /**
   * Remove (delete) a specific feedback entry
   */
  remove: protectedProcedure
    .input(
      z.object({
        feedbackId: z.string(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Verify the feedback belongs to the user before deleting
      const feedback = await prisma.feedback.findUnique({
        where: { id: input.feedbackId },
      });

      if (!feedback) {
        throw new Error('Feedback not found');
      }

      if (feedback.userId !== ctx.user.id) {
        throw new Error('Unauthorized: You can only delete your own feedback');
      }

      // Delete the feedback
      await prisma.feedback.delete({
        where: { id: input.feedbackId },
      });

      return { success: true };
    }),
});
