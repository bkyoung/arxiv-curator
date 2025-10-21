/**
 * Analysis tRPC Router
 *
 * API endpoints for critical analysis generation and retrieval
 * Phase 5: Critical Analysis
 */

import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { prisma } from '../db';
import { boss } from '../queue';

export const analysisRouter = router({
  /**
   * Request analysis for a paper
   * Returns cached analysis if found, otherwise enqueues a job and returns job ID
   */
  requestAnalysis: protectedProcedure
    .input(
      z.object({
        paperId: z.string().min(1, 'Paper ID is required'),
        depth: z.enum(['A', 'B', 'C']),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Check for existing analysis
      const existingAnalysis = await prisma.analysis.findFirst({
        where: {
          paperId: input.paperId,
          depth: input.depth,
        },
      });

      if (existingAnalysis) {
        return {
          cached: true,
          analysis: existingAnalysis,
        };
      }

      // Enqueue background job for critique generation
      const jobId = await boss.send('critique-paper', {
        paperId: input.paperId,
        userId: ctx.user.id,
        depth: input.depth,
      });

      return {
        cached: false,
        jobId,
      };
    }),

  /**
   * Get analysis for a paper
   * Returns existing analysis if found, otherwise returns null
   */
  getAnalysis: protectedProcedure
    .input(
      z.object({
        paperId: z.string().min(1, 'Paper ID is required'),
        depth: z.enum(['A', 'B', 'C']),
      })
    )
    .query(async ({ input }) => {
      const analysis = await prisma.analysis.findFirst({
        where: {
          paperId: input.paperId,
          depth: input.depth,
        },
      });

      return analysis;
    }),

  /**
   * Get job status
   * Returns job state from pg-boss
   */
  getJobStatus: protectedProcedure
    .input(
      z.object({
        jobId: z.string().min(1, 'Job ID is required'),
      })
    )
    .query(async ({ input }) => {
      const job = await boss.getJobById('critique-paper', input.jobId);
      return job;
    }),

  /**
   * Regenerate analysis for a paper
   * Deletes existing analysis and enqueues a new job
   */
  regenerateAnalysis: protectedProcedure
    .input(
      z.object({
        paperId: z.string().min(1, 'Paper ID is required'),
        depth: z.enum(['A', 'B', 'C']),
      })
    )
    .mutation(async ({ input, ctx }) => {
      // Delete existing analysis if present
      await prisma.analysis.deleteMany({
        where: {
          paperId: input.paperId,
          depth: input.depth,
        },
      });

      // Enqueue new job
      const jobId = await boss.send('critique-paper', {
        paperId: input.paperId,
        userId: ctx.user.id,
        depth: input.depth,
      });

      return { jobId };
    }),
});
