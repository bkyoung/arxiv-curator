/**
 * Settings tRPC Router
 *
 * API endpoints for user settings and configuration
 */

import { router, publicProcedure } from '@/server/trpc';
import { prisma } from '@/server/db';
import { z } from 'zod';

export const settingsRouter = router({
  /**
   * Get all arXiv categories
   */
  getCategories: publicProcedure.query(async () => {
    const categories = await prisma.arxivCategory.findMany({
      where: {
        id: {
          startsWith: 'cs.',
        },
      },
      orderBy: {
        id: 'asc',
      },
    });

    return categories;
  }),

  /**
   * Get user profile settings
   *
   * For Phase 1, we'll use a default/global profile
   * Phase 2+ will add user-specific profiles
   */
  getProfile: publicProcedure.query(async () => {
    // Try to find existing profile or return defaults
    const profile = await prisma.userProfile.findFirst();

    if (profile) {
      return profile;
    }

    // Return default configuration
    return {
      id: 'default',
      userId: 'default',
      arxivCategories: ['cs.AI', 'cs.CL', 'cs.LG'],
      sourcesEnabled: ['arxiv'],
      useLocalEmbeddings: true,
      useLocalLLM: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }),

  /**
   * Update arXiv category preferences
   */
  updateCategories: publicProcedure
    .input(z.object({ categories: z.array(z.string()) }))
    .mutation(async ({ input }) => {
      // For Phase 1, update or create a single global profile
      const existing = await prisma.userProfile.findFirst();

      if (existing) {
        return await prisma.userProfile.update({
          where: { id: existing.id },
          data: {
            arxivCategories: input.categories,
            updatedAt: new Date(),
          },
        });
      } else {
        return await prisma.userProfile.create({
          data: {
            userId: 'default',
            arxivCategories: input.categories,
            sourcesEnabled: ['arxiv'],
            useLocalEmbeddings: true,
            useLocalLLM: true,
          },
        });
      }
    }),

  /**
   * Update processing preferences (local vs cloud)
   */
  updateProcessing: publicProcedure
    .input(
      z.object({
        useLocalEmbeddings: z.boolean(),
        useLocalLLM: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      const existing = await prisma.userProfile.findFirst();

      if (existing) {
        return await prisma.userProfile.update({
          where: { id: existing.id },
          data: {
            useLocalEmbeddings: input.useLocalEmbeddings,
            useLocalLLM: input.useLocalLLM,
            updatedAt: new Date(),
          },
        });
      } else {
        return await prisma.userProfile.create({
          data: {
            userId: 'default',
            arxivCategories: ['cs.AI', 'cs.CL', 'cs.LG'],
            sourcesEnabled: ['arxiv'],
            useLocalEmbeddings: input.useLocalEmbeddings,
            useLocalLLM: input.useLocalLLM,
          },
        });
      }
    }),
});
