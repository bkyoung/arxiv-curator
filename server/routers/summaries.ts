/**
 * Summaries tRPC Router
 *
 * API endpoints for summary generation and retrieval
 * Phase 4: Summaries
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { prisma } from '../db';
import { generateSummaryForPaper } from '../agents/summarizer';

export const summariesRouter = router({
  /**
   * Get summary for a paper
   * Returns existing summary if found, otherwise generates a new one
   */
  getSummary: protectedProcedure
    .input(
      z.object({
        paperId: z.string().min(1, 'Paper ID is required'),
      })
    )
    .query(async ({ input, ctx }) => {
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
  regenerateSummary: protectedProcedure
    .input(
      z.object({
        paperId: z.string().min(1, 'Paper ID is required'),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Delete existing summary if present (deleteMany doesn't error if not found)
      await prisma.summary.deleteMany({
        where: {
          paperId: input.paperId,
          summaryType: 'skim',
        },
      });

      // Generate new summary
      const summary = await generateSummaryForPaper(
        input.paperId,
        ctx.user.id
      );

      return summary;
    }),
});
