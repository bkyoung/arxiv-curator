import { prisma } from '../db';
import type { Paper, PaperEnriched, Score } from '@prisma/client';
import { cosineSimilarity } from '../lib/vector-math';

type PaperWithScoreAndEnriched = Paper & {
  enriched: PaperEnriched | null;
  scores: Score[];
};

/**
 * Select diverse papers for exploration
 * Chooses papers that are most orthogonal to user's interest vector
 */
export function selectDiversePapers(
  candidates: PaperWithScoreAndEnriched[],
  count: number,
  userVector: number[]
): PaperWithScoreAndEnriched[] {
  if (candidates.length === 0) {
    return [];
  }

  if (candidates.length <= count) {
    return candidates;
  }

  const selected: PaperWithScoreAndEnriched[] = [];
  const remaining = [...candidates];

  while (selected.length < count && remaining.length > 0) {
    // Calculate diversity scores (1 - similarity = orthogonality)
    const diversityScores = remaining.map((paper) => {
      if (!paper.enriched?.embedding) {
        return { paper, diversity: 0.5 }; // Default diversity if no embedding
      }

      const embedding = Array.isArray(paper.enriched.embedding)
        ? paper.enriched.embedding
        : JSON.parse(paper.enriched.embedding as any);

      const similarity = cosineSimilarity(embedding, userVector);
      const diversity = 1 - Math.abs(similarity); // More orthogonal = more diverse

      return { paper, diversity };
    });

    // Sort by diversity (descending)
    diversityScores.sort((a, b) => b.diversity - a.diversity);

    // Select most diverse paper
    const chosen = diversityScores[0].paper;
    selected.push(chosen);

    // Remove from candidates
    const idx = remaining.findIndex((p) => p.id === chosen.id);
    if (idx !== -1) {
      remaining.splice(idx, 1);
    }
  }

  return selected;
}

/**
 * Generate daily digest for a user
 *
 * Algorithm:
 * 1. Load user profile and preferences
 * 2. Fetch ranked papers from last 24 hours
 * 3. Apply material improvement filter (scoreThreshold)
 * 4. Apply noise cap (max papers)
 * 5. Apply exploration strategy (exploit/explore split)
 * 6. Create briefing record
 */
export async function generateDailyDigest(userId: string) {
  // 1. Load user profile
  const profile = await prisma.userProfile.findUnique({
    where: { userId },
  });

  if (!profile) {
    throw new Error(`User profile not found for userId: ${userId}`);
  }

  // Extract user interest vector
  const userVector = Array.isArray(profile.interestVector)
    ? (profile.interestVector as number[])
    : JSON.parse(profile.interestVector as any);

  // 2. Fetch ranked papers from last 24 hours
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  const papers = await prisma.paper.findMany({
    where: {
      pubDate: { gte: yesterday },
      status: 'enriched',
      scores: {
        some: {
          finalScore: { gte: profile.scoreThreshold },
        },
      },
    },
    include: {
      enriched: true,
      scores: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: {
      scores: {
        _count: 'desc', // Papers with scores
      },
    },
    take: 100, // Initial candidate pool
  });

  // Filter papers that actually have scores above threshold
  const qualifiedPapers = papers.filter(
    (paper) =>
      paper.scores.length > 0 &&
      paper.scores[0].finalScore >= profile.scoreThreshold
  );

  // Sort by score descending
  qualifiedPapers.sort(
    (a, b) => (b.scores[0]?.finalScore || 0) - (a.scores[0]?.finalScore || 0)
  );

  // 3. Apply noise cap
  const noiseCap = profile.noiseCap || 15;

  // 4. Apply exploration strategy
  const explorationRate = profile.explorationRate || 0.15;
  const exploitCount = Math.floor(noiseCap * (1 - explorationRate));
  const exploreCount = noiseCap - exploitCount;

  // 5. Select papers
  const exploitPapers = qualifiedPapers.slice(0, exploitCount); // Top scored

  // For exploration: select from lower-scored papers with diversity
  const exploreCandidates = qualifiedPapers.slice(exploitCount);
  const explorePapers = selectDiversePapers(
    exploreCandidates,
    exploreCount,
    userVector
  );

  const selectedPapers = [...exploitPapers, ...explorePapers];

  // Calculate average score
  const avgScore =
    selectedPapers.length > 0
      ? selectedPapers.reduce((sum, p) => sum + (p.scores[0]?.finalScore || 0), 0) /
        selectedPapers.length
      : 0;

  // 6. Create or update briefing record (idempotent)
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Start of day

  const briefing = await prisma.briefing.upsert({
    where: {
      userId_date: {
        userId,
        date: today,
      },
    },
    create: {
      userId,
      date: today,
      paperIds: selectedPapers.map((p) => p.id),
      paperCount: selectedPapers.length,
      avgScore,
      status: 'ready',
    },
    update: {
      // Re-generate if already exists (user may have manually triggered)
      paperIds: selectedPapers.map((p) => p.id),
      paperCount: selectedPapers.length,
      avgScore,
      status: 'ready',
      generatedAt: new Date(),
    },
  });

  return briefing;
}
