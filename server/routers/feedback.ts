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
    .mutation(async ({ input }) => {
      // Record feedback
      const feedback = await recordFeedback({
        userId: input.userId,
        paperId: input.paperId,
        action: 'save',
      });

      // Update user vector
      const paper = await prisma.paper.findUnique({
        where: { id: input.paperId },
        include: { enriched: true },
      });

      if (paper?.enriched?.embedding) {
        await updateUserVectorFromFeedback({
          userId: input.userId,
          paperEmbedding: paper.enriched.embedding as number[],
          action: 'save',
        });
      }

      return feedback;
    }),

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
    .mutation(async ({ input }) => {
      // Record feedback
      const feedback = await recordFeedback({
        userId: input.userId,
        paperId: input.paperId,
        action: 'dismiss',
      });

      // Update user vector
      const paper = await prisma.paper.findUnique({
        where: { id: input.paperId },
        include: { enriched: true },
      });

      if (paper?.enriched?.embedding) {
        await updateUserVectorFromFeedback({
          userId: input.userId,
          paperEmbedding: paper.enriched.embedding as number[],
          action: 'dismiss',
        });
      }

      return feedback;
    }),

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
    .mutation(async ({ input }) => {
      // Record feedback
      const feedback = await recordFeedback({
        userId: input.userId,
        paperId: input.paperId,
        action: 'thumbs_up',
      });

      // Update user vector
      const paper = await prisma.paper.findUnique({
        where: { id: input.paperId },
        include: { enriched: true },
      });

      if (paper?.enriched?.embedding) {
        await updateUserVectorFromFeedback({
          userId: input.userId,
          paperEmbedding: paper.enriched.embedding as number[],
          action: 'thumbs_up',
        });
      }

      return feedback;
    }),

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
    .mutation(async ({ input }) => {
      // Record feedback
      const feedback = await recordFeedback({
        userId: input.userId,
        paperId: input.paperId,
        action: 'thumbs_down',
      });

      // Update user vector
      const paper = await prisma.paper.findUnique({
        where: { id: input.paperId },
        include: { enriched: true },
      });

      if (paper?.enriched?.embedding) {
        await updateUserVectorFromFeedback({
          userId: input.userId,
          paperEmbedding: paper.enriched.embedding as number[],
          action: 'thumbs_down',
        });
      }

      return feedback;
    }),

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
    .mutation(async ({ input }) => {
      // Record feedback
      const feedback = await recordFeedback({
        userId: input.userId,
        paperId: input.paperId,
        action: 'hide',
      });

      // Update user vector
      const paper = await prisma.paper.findUnique({
        where: { id: input.paperId },
        include: { enriched: true },
      });

      if (paper?.enriched?.embedding) {
        await updateUserVectorFromFeedback({
          userId: input.userId,
          paperEmbedding: paper.enriched.embedding as number[],
          action: 'hide',
        });
      }

      return feedback;
    }),

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
