/**
 * Ranker Agent
 *
 * Responsible for scoring papers using multi-signal algorithm
 * Phase 2: Personalization & Scoring
 */

import { prisma } from '@/server/db';
import {
  calculateEvidenceScore,
  calculatePersonalFitScore,
  calculateNoveltyScore,
  calculateLabPriorScore,
  calculateMathPenalty,
} from '@/server/lib/scoring';
import { shouldExcludePaper } from '@/server/lib/rules';
import type { Paper, PaperEnriched, UserProfile } from '@prisma/client';

export interface RankingOptions {
  userProfile?: UserProfile | null;
}

/**
 * Rank a single paper by calculating its score
 *
 * Multi-signal scoring algorithm:
 * - N (Novelty): 20% - How different from user's interests
 * - E (Evidence): 25% - Quality indicators (baselines, ablations, code, etc.)
 * - V (Velocity): 10% - Topic momentum (placeholder 0.5 for now)
 * - P (Personal Fit): 30% - Vector similarity + rule bonuses
 * - L (Lab Prior): 10% - Boosted labs (placeholder 0.0 until affiliation data available)
 * - M (Math Penalty): 5% - Penalty for math-heavy papers
 *
 * Final score: 0.20×N + 0.25×E + 0.10×V + 0.30×P + 0.10×L - 0.05×M
 *
 * @param paper - Paper with enrichment data
 * @param options - Ranking options (user profile for personalization)
 * @returns Score record or null if paper is excluded
 */
export async function rankPaper(
  paper: Paper & { enriched: PaperEnriched | null },
  options: RankingOptions = {}
) {
  console.log(`[Ranker] Ranking paper ${paper.arxivId}...`);

  // Validate enrichment data exists
  if (!paper.enriched) {
    throw new Error(`Paper ${paper.arxivId} has not been enriched`);
  }

  const { userProfile } = options;
  const paperText = `${paper.title} ${paper.abstract}`;

  // Check exclusion rules (Day 2)
  if (userProfile) {
    const excluded = shouldExcludePaper({
      paperTopics: paper.enriched.topics,
      excludedTopics: userProfile.excludeTopics,
      excludedKeywords: userProfile.excludeKeywords,
      paperText,
    });

    if (excluded) {
      console.log(`[Ranker] Paper ${paper.arxivId} excluded by user rules`);
      return null; // Hard filter - don't score excluded papers
    }
  }

  // Calculate Evidence score (E)
  const evidenceScore = calculateEvidenceScore({
    hasBaselines: paper.enriched.hasBaselines,
    hasAblations: paper.enriched.hasAblations,
    hasCode: paper.enriched.hasCode,
    hasData: paper.enriched.hasData,
    hasMultipleEvals: paper.enriched.hasMultipleEvals,
  });

  // Calculate Novelty score (N)
  let noveltyScore = 0;
  if (userProfile && userProfile.interestVector) {
    const userEmbedding = userProfile.interestVector as number[];
    const paperEmbedding = paper.enriched.embedding as number[];

    // TODO: Store and use user's historical keywords for better novelty detection
    // For now, use empty array as placeholder
    noveltyScore = calculateNoveltyScore({
      paperEmbedding,
      userCentroid: userEmbedding, // Use current interest vector as centroid
      paperText,
      userHistoricalKeywords: [], // Placeholder - need to track keyword history
    });
  } else {
    // No user profile = treat as moderately novel
    noveltyScore = 0.5;
  }

  // Calculate Velocity score (V)
  // TODO: Implement velocity tracking in Phase 7
  const velocityScore = 0.5; // Placeholder

  // Calculate Personal Fit score (P)
  let personalFitScore = 0;
  if (userProfile && userProfile.interestVector) {
    const userEmbedding = userProfile.interestVector as number[];
    const paperEmbedding = paper.enriched.embedding as number[];

    personalFitScore = calculatePersonalFitScore({
      paperEmbedding,
      userEmbedding,
      paperTopics: paper.enriched.topics,
      includedTopics: userProfile.includeTopics,
      excludedTopics: userProfile.excludeTopics,
      includedKeywords: userProfile.includeKeywords,
      excludedKeywords: userProfile.excludeKeywords,
      paperText,
    });
  }

  // Calculate Lab Prior score (L)
  // TODO: Add author affiliation data to enable lab matching
  // For now, use placeholder 0.0
  const labPriorScore = 0.0; // Placeholder - need affiliation data

  // Calculate Math Penalty (M)
  let mathPenalty = 0;
  if (userProfile) {
    // mathDepthMax is tolerance (0-1), convert to sensitivity
    const sensitivity = 1 - userProfile.mathDepthMax;
    mathPenalty = calculateMathPenalty({
      mathDepth: paper.enriched.mathDepth,
      userSensitivity: sensitivity,
    });
  }

  // Calculate final score using weighted formula
  // Formula: 0.20×N + 0.25×E + 0.10×V + 0.30×P + 0.10×L - 0.05×M
  const finalScore =
    0.2 * noveltyScore +
    0.25 * evidenceScore +
    0.1 * velocityScore +
    0.3 * personalFitScore +
    0.1 * labPriorScore -
    0.05 * mathPenalty;

  // Clamp final score to [0, 1] range
  const clampedScore = Math.max(0, Math.min(1, finalScore));

  // Build why shown explanation
  const whyShown: Record<string, number> = {
    novelty: noveltyScore,
    evidence: evidenceScore,
    velocity: velocityScore,
    personalFit: personalFitScore,
    labPrior: labPriorScore,
    mathPenalty: mathPenalty,
  };

  // Store score in database
  const score = await prisma.score.upsert({
    where: { paperId: paper.id },
    update: {
      novelty: noveltyScore,
      evidence: evidenceScore,
      velocity: velocityScore,
      personalFit: personalFitScore,
      labPrior: labPriorScore,
      mathPenalty: mathPenalty,
      finalScore: clampedScore,
      whyShown,
    },
    create: {
      paperId: paper.id,
      novelty: noveltyScore,
      evidence: evidenceScore,
      velocity: velocityScore,
      personalFit: personalFitScore,
      labPrior: labPriorScore,
      mathPenalty: mathPenalty,
      finalScore: clampedScore,
      whyShown,
    },
  });

  console.log(
    `[Ranker] Ranked ${paper.arxivId}: N=${noveltyScore.toFixed(2)}, E=${evidenceScore.toFixed(2)}, V=${velocityScore.toFixed(2)}, P=${personalFitScore.toFixed(2)}, L=${labPriorScore.toFixed(2)}, M=${mathPenalty.toFixed(2)}, final=${clampedScore.toFixed(2)}`
  );

  return score;
}

/**
 * Batch score multiple papers
 *
 * @param paperIds - Array of paper IDs to score
 * @param options - Ranking options (user profile for personalization)
 * @returns Array of scores (null for excluded papers)
 */
export async function scorePapers(
  paperIds: string[],
  options: RankingOptions = {}
) {
  console.log(`[Ranker] Batch scoring ${paperIds.length} papers...`);

  // Fetch papers with enrichment data
  const papers = await prisma.paper.findMany({
    where: {
      id: { in: paperIds },
      status: 'enriched',
    },
    include: {
      enriched: true,
    },
  });

  console.log(`[Ranker] Found ${papers.length} enriched papers to score`);

  // Score each paper
  const scores = await Promise.all(
    papers.map(async (paper) => {
      try {
        return await rankPaper(paper, options);
      } catch (error) {
        console.error(`[Ranker] Error scoring paper ${paper.arxivId}:`, error);
        return null;
      }
    })
  );

  // Update paper status to "ranked" for successfully scored papers
  const scoredPaperIds = scores
    .map((score, i) => (score ? papers[i].id : null))
    .filter((id): id is string => id !== null);

  if (scoredPaperIds.length > 0) {
    await prisma.paper.updateMany({
      where: { id: { in: scoredPaperIds } },
      data: { status: 'ranked' },
    });

    console.log(`[Ranker] Marked ${scoredPaperIds.length} papers as ranked`);
  }

  const successCount = scores.filter((s) => s !== null).length;
  console.log(
    `[Ranker] Batch scoring complete: ${successCount}/${papers.length} papers scored`
  );

  return scores;
}

/**
 * Score all enriched papers that haven't been scored yet
 *
 * @param options - Ranking options (user profile for personalization)
 * @returns Array of scores
 */
export async function scoreUnrankedPapers(options: RankingOptions = {}) {
  console.log(`[Ranker] Finding unranked papers...`);

  // Find enriched papers without scores
  const papers = await prisma.paper.findMany({
    where: {
      status: 'enriched',
      scores: {
        none: {},
      },
    },
    include: {
      enriched: true,
    },
  });

  console.log(`[Ranker] Found ${papers.length} unranked papers`);

  if (papers.length === 0) {
    return [];
  }

  // Score all papers
  const scores = await Promise.all(
    papers.map(async (paper) => {
      try {
        return await rankPaper(paper, options);
      } catch (error) {
        console.error(`[Ranker] Error scoring paper ${paper.arxivId}:`, error);
        return null;
      }
    })
  );

  // Update status for scored papers
  const scoredPaperIds = scores
    .map((score, i) => (score ? papers[i].id : null))
    .filter((id): id is string => id !== null);

  if (scoredPaperIds.length > 0) {
    await prisma.paper.updateMany({
      where: { id: { in: scoredPaperIds } },
      data: { status: 'ranked' },
    });
  }

  const successCount = scores.filter((s) => s !== null).length;
  console.log(
    `[Ranker] Scored ${successCount}/${papers.length} unranked papers`
  );

  return scores;
}
