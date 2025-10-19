/**
 * Papers tRPC Router
 *
 * API endpoints for querying and managing papers
 */

import { router, publicProcedure } from '@/server/trpc';
import { prisma } from '@/server/db';
import { z } from 'zod';

export const papersRouter = router({
  /**
   * List papers with optional filters
   */
  list: publicProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(100).default(20),
        offset: z.number().min(0).default(0),
        categories: z.array(z.string()).optional(),
        dateFrom: z.date().optional(),
        dateTo: z.date().optional(),
        status: z.enum(['new', 'enriched', 'ranked']).optional(),
      })
    )
    .query(async ({ input }) => {
      const { limit, offset, categories, dateFrom, dateTo, status } = input;

      // Build where clause
      const where: any = {};

      if (categories && categories.length > 0) {
        where.categories = {
          hasSome: categories,
        };
      }

      if (dateFrom || dateTo) {
        where.pubDate = {};
        if (dateFrom) where.pubDate.gte = dateFrom;
        if (dateTo) where.pubDate.lte = dateTo;
      }

      if (status) {
        where.status = status;
      }

      // Query papers with enrichment data
      const [papers, total] = await Promise.all([
        prisma.paper.findMany({
          where,
          include: {
            enriched: true,
          },
          orderBy: {
            pubDate: 'desc',
          },
          take: limit,
          skip: offset,
        }),
        prisma.paper.count({ where }),
      ]);

      return {
        papers,
        total,
        hasMore: offset + papers.length < total,
      };
    }),

  /**
   * Get a single paper by ID
   */
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const paper = await prisma.paper.findUnique({
        where: { id: input.id },
        include: {
          enriched: true,
        },
      });

      if (!paper) {
        throw new Error('Paper not found');
      }

      return paper;
    }),

  /**
   * Get paper statistics
   */
  stats: publicProcedure.query(async () => {
    const [total, enriched, byCategory] = await Promise.all([
      prisma.paper.count(),
      prisma.paper.count({ where: { status: 'enriched' } }),
      prisma.paper.groupBy({
        by: ['primaryCategory'],
        _count: true,
        orderBy: {
          _count: {
            primaryCategory: 'desc',
          },
        },
        take: 10,
      }),
    ]);

    return {
      total,
      enriched,
      pending: total - enriched,
      topCategories: byCategory.map((cat) => ({
        category: cat.primaryCategory,
        count: cat._count,
      })),
    };
  }),
});
