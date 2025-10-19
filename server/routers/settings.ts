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

    // Return default configuration matching UserProfile schema
    return {
      id: 'default',
      userId: 'default',
      arxivCategories: ['cs.AI', 'cs.CL', 'cs.LG'],
      sourcesEnabled: ['arxiv'],
      useLocalEmbeddings: true,
      useLocalLLM: true,
      preferredLLM: 'gemini-2.0-flash',
      noiseCap: 50,
      targetToday: 15,
      target7d: 100,
      includeTopics: [],
      excludeTopics: [],
      includeKeywords: [],
      excludeKeywords: [],
      mathDepthMax: 0.5,
      explorationRate: 0.15,
      labBoosts: {},
      interestVector: [],
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

  /**
   * Update personalization settings (topics, keywords)
   */
  updatePersonalization: publicProcedure
    .input(
      z.object({
        includeTopics: z.array(z.string()).optional(),
        excludeTopics: z.array(z.string()).optional(),
        includeKeywords: z.array(z.string()).optional(),
        excludeKeywords: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input }) => {
      const existing = await prisma.userProfile.findFirst();

      if (!existing) {
        throw new Error('User profile not found');
      }

      return await prisma.userProfile.update({
        where: { id: existing.id },
        data: {
          includeTopics: input.includeTopics,
          excludeTopics: input.excludeTopics,
          includeKeywords: input.includeKeywords,
          excludeKeywords: input.excludeKeywords,
          updatedAt: new Date(),
        },
      });
    }),

  /**
   * Update lab preferences
   */
  updateLabPreferences: publicProcedure
    .input(
      z.object({
        labBoosts: z.record(z.string(), z.number()),
      })
    )
    .mutation(async ({ input }) => {
      const existing = await prisma.userProfile.findFirst();

      if (!existing) {
        throw new Error('User profile not found');
      }

      return await prisma.userProfile.update({
        where: { id: existing.id },
        data: {
          labBoosts: input.labBoosts,
          updatedAt: new Date(),
        },
      });
    }),

  /**
   * Update math sensitivity
   */
  updateMathSensitivity: publicProcedure
    .input(
      z.object({
        mathDepthMax: z.number().min(0).max(1),
      })
    )
    .mutation(async ({ input }) => {
      const existing = await prisma.userProfile.findFirst();

      if (!existing) {
        throw new Error('User profile not found');
      }

      return await prisma.userProfile.update({
        where: { id: existing.id },
        data: {
          mathDepthMax: input.mathDepthMax,
          updatedAt: new Date(),
        },
      });
    }),

  /**
   * Update exploration rate
   */
  updateExplorationRate: publicProcedure
    .input(
      z.object({
        explorationRate: z.number().min(0).max(0.3),
      })
    )
    .mutation(async ({ input }) => {
      const existing = await prisma.userProfile.findFirst();

      if (!existing) {
        throw new Error('User profile not found');
      }

      return await prisma.userProfile.update({
        where: { id: existing.id },
        data: {
          explorationRate: input.explorationRate,
          updatedAt: new Date(),
        },
      });
    }),
});
