/**
 * Settings tRPC Router
 *
 * API endpoints for user settings and configuration
 */

import { router, publicProcedure, protectedProcedure } from '@/server/trpc';
import { prisma } from '@/server/db';
import { z } from 'zod';

/**
 * Get the current user profile for single-user system
 *
 * This helper encapsulates the single-user logic and makes it easy to
 * migrate to multi-user support later by updating this function to
 * accept a userId parameter.
 *
 * @returns Current user profile or null if not found
 */
async function getCurrentUserProfile() {
  // For single-user system, use 'user-1' (created by seed script)
  const profile = await prisma.userProfile.findUnique({
    where: { userId: 'user-1' },
  });

  return profile;
}

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
   */
  getProfile: publicProcedure.query(async () => {
    const profile = await getCurrentUserProfile();

    if (!profile) {
      throw new Error(
        'User profile not found. Please run database seed: npx prisma db seed'
      );
    }

    return profile;
  }),

  /**
   * Update arXiv category preferences
   */
  updateCategories: protectedProcedure
    .input(z.object({ categories: z.array(z.string()) }))
    .mutation(async ({ input, ctx }) => {
      const profile = await prisma.userProfile.findUnique({
        where: { userId: ctx.user.id },
      });

      if (!profile) {
        throw new Error('User profile not found');
      }

      return await prisma.userProfile.update({
        where: { id: profile.id },
        data: {
          arxivCategories: input.categories,
          updatedAt: new Date(),
        },
      });
    }),

  /**
   * Update processing preferences (local vs cloud)
   */
  updateProcessing: protectedProcedure
    .input(
      z.object({
        useLocalEmbeddings: z.boolean(),
        useLocalLLM: z.boolean(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const profile = await prisma.userProfile.findUnique({
        where: { userId: ctx.user.id },
      });

      if (!profile) {
        throw new Error('User profile not found');
      }

      return await prisma.userProfile.update({
        where: { id: profile.id },
        data: {
          useLocalEmbeddings: input.useLocalEmbeddings,
          useLocalLLM: input.useLocalLLM,
          updatedAt: new Date(),
        },
      });
    }),

  /**
   * Update personalization settings (topics, keywords)
   */
  updatePersonalization: protectedProcedure
    .input(
      z.object({
        includeTopics: z.array(z.string()).optional(),
        excludeTopics: z.array(z.string()).optional(),
        includeKeywords: z.array(z.string()).optional(),
        excludeKeywords: z.array(z.string()).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const profile = await prisma.userProfile.findUnique({
        where: { userId: ctx.user.id },
      });

      if (!profile) {
        throw new Error('User profile not found');
      }

      return await prisma.userProfile.update({
        where: { id: profile.id },
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
  updateLabPreferences: protectedProcedure
    .input(
      z.object({
        labBoosts: z.record(z.string(), z.number()),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const profile = await prisma.userProfile.findUnique({
        where: { userId: ctx.user.id },
      });

      if (!profile) {
        throw new Error('User profile not found');
      }

      return await prisma.userProfile.update({
        where: { id: profile.id },
        data: {
          labBoosts: input.labBoosts,
          updatedAt: new Date(),
        },
      });
    }),

  /**
   * Update math sensitivity
   */
  updateMathSensitivity: protectedProcedure
    .input(
      z.object({
        mathDepthMax: z.number().min(0).max(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const profile = await prisma.userProfile.findUnique({
        where: { userId: ctx.user.id },
      });

      if (!profile) {
        throw new Error('User profile not found');
      }

      return await prisma.userProfile.update({
        where: { id: profile.id },
        data: {
          mathDepthMax: input.mathDepthMax,
          updatedAt: new Date(),
        },
      });
    }),

  /**
   * Update exploration rate
   */
  updateExplorationRate: protectedProcedure
    .input(
      z.object({
        explorationRate: z.number().min(0).max(0.3),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const profile = await prisma.userProfile.findUnique({
        where: { userId: ctx.user.id },
      });

      if (!profile) {
        throw new Error('User profile not found');
      }

      return await prisma.userProfile.update({
        where: { id: profile.id },
        data: {
          explorationRate: input.explorationRate,
          updatedAt: new Date(),
        },
      });
    }),

  /**
   * Update briefing preferences
   */
  updatePreferences: protectedProcedure
    .input(
      z.object({
        digestEnabled: z.boolean(),
        noiseCap: z.number().min(10).max(20),
        scoreThreshold: z.number().min(0.3).max(0.7),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const profile = await prisma.userProfile.findUnique({
        where: { userId: ctx.user.id },
      });

      if (!profile) {
        throw new Error('User profile not found');
      }

      return await prisma.userProfile.update({
        where: { id: profile.id },
        data: {
          digestEnabled: input.digestEnabled,
          noiseCap: input.noiseCap,
          scoreThreshold: input.scoreThreshold,
          updatedAt: new Date(),
        },
      });
    }),
});
