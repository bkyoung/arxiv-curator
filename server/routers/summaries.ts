/**
 * Summaries tRPC Router
 *
 * API endpoints for summary generation and retrieval
 * Phase 4: Summaries
 */

import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { prisma } from '../db';
import { generateSummaryForPaper } from '../agents/summarizer';
import { TRPCError } from '@trpc/server';

export const summariesRouter = router({
  /**
   * Get summary for a paper
   * Returns existing summary if found, otherwise generates a new one
   */
  getSummary: publicProcedure
    .input(
      z.object({
        paperId: z.string().min(1, 'Paper ID is required'),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Must be logged in to view summaries',
        });
      }

      // Check for existing summary
      const existingSummary = await prisma.summary.findFirst({
        where: {
          paperId: input.paperId,
          summaryType: 'skim',
        },
      });

      if (existingSummary) {
        return {
          whatsNew: existingSummary.whatsNew,
          keyPoints: existingSummary.keyPoints,
          markdownContent: existingSummary.markdownContent,
          contentHash: existingSummary.contentHash,
          generatedAt: existingSummary.generatedAt,
        };
      }

      // Generate new summary
      const summary = await generateSummaryForPaper(
        input.paperId,
        ctx.user.id
      );

      return summary;
    }),

  /**
   * Regenerate summary for a paper
   * Deletes existing summary and generates a new one
   */
  regenerateSummary: publicProcedure
    .input(
      z.object({
        paperId: z.string().min(1, 'Paper ID is required'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Must be logged in to regenerate summaries',
        });
      }

      // Delete existing summary if present
      await prisma.summary.delete({
        where: {
          paperId_summaryType: {
            paperId: input.paperId,
            summaryType: 'skim',
          },
        },
      }).catch(() => {
        // Ignore error if summary doesn't exist
      });

      // Generate new summary
      const summary = await generateSummaryForPaper(
        input.paperId,
        ctx.user.id
      );

      return summary;
    }),
});
