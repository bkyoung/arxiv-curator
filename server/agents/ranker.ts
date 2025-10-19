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
} from '@/server/lib/scoring';
import { shouldExcludePaper } from '@/server/lib/rules';
import type { Paper, PaperEnriched, UserProfile } from '@prisma/client';

export interface RankingOptions {
  userProfile?: UserProfile | null;
}

/**
 * Rank a single paper by calculating its score
 *
 * Day 1: Evidence (E) signal only
 * Day 2: Evidence (E) + Personal Fit (P) signals
 * Future: Will add N, V, L, M signals
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

  // Calculate Evidence score
  const evidenceScore = calculateEvidenceScore({
    hasBaselines: paper.enriched.hasBaselines,
    hasAblations: paper.enriched.hasAblations,
    hasCode: paper.enriched.hasCode,
    hasData: paper.enriched.hasData,
    hasMultipleEvals: paper.enriched.hasMultipleEvals,
  });

  // Calculate Personal Fit score (Day 2)
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

  // Calculate final score
  // Day 1: finalScore = Evidence only
  // Day 2: finalScore = 0.5 × Evidence + 0.5 × PersonalFit
  // Future: Full weighted combination of all 6 signals
  const finalScore = userProfile
    ? 0.5 * evidenceScore + 0.5 * personalFitScore
    : evidenceScore;

  // Build why shown explanation
  const whyShown: Record<string, number> = {
    evidence: evidenceScore,
  };
  if (userProfile) {
    whyShown.personalFit = personalFitScore;
  }

  // Store score in database
  const score = await prisma.score.upsert({
    where: { paperId: paper.id },
    update: {
      evidence: evidenceScore,
      novelty: 0, // Placeholder for future implementation
      velocity: 0, // Placeholder for future implementation
      personalFit: personalFitScore,
      labPrior: 0, // Placeholder for future implementation
      mathPenalty: 0, // Placeholder for future implementation
      finalScore,
      whyShown,
    },
    create: {
      paperId: paper.id,
      evidence: evidenceScore,
      novelty: 0,
      velocity: 0,
      personalFit: personalFitScore,
      labPrior: 0,
      mathPenalty: 0,
      finalScore,
      whyShown,
    },
  });

  console.log(
    `[Ranker] Ranked ${paper.arxivId}: E=${evidenceScore.toFixed(2)}, P=${personalFitScore.toFixed(2)}, final=${finalScore.toFixed(2)}`
  );

  return score;
}
