/**
 * Prisma Database Seed Script
 *
 * Seeds the database with a default user and profile for development
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Starting database seed...');

  // Create default user with fixed ID for development
  const user = await prisma.user.upsert({
    where: { id: 'user-1' },
    update: {},
    create: {
      id: 'user-1',
      email: 'dev@arxiv-curator.local',
      name: 'Development User',
    },
  });

  console.log('[Seed] Created/updated user:', user.email);

  // Create default user profile
  const profile = await prisma.userProfile.upsert({
    where: { userId: 'user-1' },
    update: {},
    create: {
      userId: 'user-1',
      // Default preferences (same as schema defaults)
      interestVector: [],
      includeTopics: [],
      excludeTopics: [],
      includeKeywords: [],
      excludeKeywords: [],
      labBoosts: {},
      mathDepthMax: 1.0,
      explorationRate: 0.15,
      noiseCap: 15,
      targetToday: 15,
      target7d: 100,
      arxivCategories: ['cs.AI', 'cs.LG', 'cs.CV', 'cs.CL'],
      sourcesEnabled: { arxiv: true, openAlex: false, semanticScholar: false },
      useLocalEmbeddings: true,
      useLocalLLM: true,
      preferredLLM: 'gemini-2.0-flash',
    },
  });

  console.log('[Seed] Created/updated user profile for:', user.email);
  console.log('[Seed] Database seed complete!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('[Seed] Error:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
