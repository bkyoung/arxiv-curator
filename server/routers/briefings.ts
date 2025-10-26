import { z } from 'zod';
import { router, publicProcedure } from '../trpc';
import { prisma } from '../db';
import { generateDailyDigest } from '../agents/recommender';
import { TRPCError } from '@trpc/server';

export const briefingsRouter = router({
  /**
   * Get today's briefing for the current user
   * Generates a new briefing if one doesn't exist
   */
  getLatest: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Must be logged in to view briefings',
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of day

    // Try to find existing briefing for today
    let briefing = await prisma.briefing.findUnique({
      where: {
        userId_date: {
          userId: ctx.user.id,
          date: today,
        },
      },
    });

    // Generate if not exists
    if (!briefing) {
      briefing = await generateDailyDigest(ctx.user.id);
    }

    // Load papers with feedback
    const papers = await prisma.paper.findMany({
      where: { id: { in: briefing.paperIds } },
      include: {
        enriched: true,
        scores: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        feedback: {
          where: { userId: ctx.user.id },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    // Mark as viewed
    if (!briefing.viewedAt) {
      await prisma.briefing.update({
        where: { id: briefing.id },
        data: { viewedAt: new Date(), status: 'viewed' },
      });
    }

    return {
      ...briefing,
      papers,
    };
  }),

  /**
   * Get briefing for a specific date
   */
  getByDate: publicProcedure
    .input(z.object({ date: z.date() }))
    .query(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Must be logged in to view briefings',
        });
      }

      const briefing = await prisma.briefing.findUnique({
        where: {
          userId_date: {
            userId: ctx.user.id,
            date: input.date,
          },
        },
      });

      if (!briefing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No briefing found for this date',
        });
      }

      // Load papers with feedback
      const papers = await prisma.paper.findMany({
        where: { id: { in: briefing.paperIds } },
        include: {
          enriched: true,
          scores: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          feedback: {
            where: { userId: ctx.user.id },
            orderBy: { createdAt: 'desc' },
          },
        },
      });

      return {
        ...briefing,
        papers,
      };
    }),

  /**
   * List all briefings for the current user
   */
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(30).default(7),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ input, ctx }) => {
      if (!ctx.user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Must be logged in to view briefings',
        });
      }

      const briefings = await prisma.briefing.findMany({
        where: { userId: ctx.user.id },
        orderBy: { date: 'desc' },
        take: input.limit,
        skip: input.offset,
      });

      const total = await prisma.briefing.count({
        where: { userId: ctx.user.id },
      });

      return {
        briefings,
        total,
        hasMore: total > input.offset + input.limit,
      };
    }),

  /**
   * Manually generate a new briefing (for testing/development)
   */
  generateNow: publicProcedure.mutation(async ({ ctx }) => {
    if (!ctx.user) {
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Must be logged in to generate briefing',
      });
    }

    const briefing = await generateDailyDigest(ctx.user.id);
    return briefing;
  }),
});
