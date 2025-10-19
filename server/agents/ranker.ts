/**
 * Ranker Agent
 *
 * Responsible for scoring papers using multi-signal algorithm
 * Phase 2: Personalization & Scoring
 */

import { prisma } from '@/server/db';
import { calculateEvidenceScore } from '@/server/lib/scoring';
import type { Paper, PaperEnriched } from '@prisma/client';

/**
 * Rank a single paper by calculating its score
 *
 * Day 1 implementation: Only Evidence (E) signal
 * Future: Will add N, V, P, L, M signals
 *
 * @param paper - Paper with enrichment data
 * @returns Score record
 */
export async function rankPaper(
  paper: Paper & { enriched: PaperEnriched | null }
) {
  console.log(`[Ranker] Ranking paper ${paper.arxivId}...`);

  // Validate enrichment data exists
  if (!paper.enriched) {
    throw new Error(`Paper ${paper.arxivId} has not been enriched`);
  }

  // Calculate Evidence score (Day 1)
  const evidenceScore = calculateEvidenceScore({
    hasBaselines: paper.enriched.hasBaselines,
    hasAblations: paper.enriched.hasAblations,
    hasCode: paper.enriched.hasCode,
    hasData: paper.enriched.hasData,
    hasMultipleEvals: paper.enriched.hasMultipleEvals,
  });

  // For Day 1: Final score = Evidence score only
  // Future: Will add weighted combination of all signals
  const finalScore = evidenceScore;

  // Store score in database
  const score = await prisma.score.upsert({
    where: { paperId: paper.id },
    update: {
      evidence: evidenceScore,
      novelty: 0, // Placeholder for future implementation
      velocity: 0, // Placeholder for future implementation
      personalFit: 0, // Placeholder for future implementation
      labPrior: 0, // Placeholder for future implementation
      mathPenalty: 0, // Placeholder for future implementation
      finalScore,
      whyShown: {
        evidence: evidenceScore,
      },
    },
    create: {
      paperId: paper.id,
      evidence: evidenceScore,
      novelty: 0,
      velocity: 0,
      personalFit: 0,
      labPrior: 0,
      mathPenalty: 0,
      finalScore,
      whyShown: {
        evidence: evidenceScore,
      },
    },
  });

  console.log(
    `[Ranker] Ranked ${paper.arxivId}: evidence=${evidenceScore.toFixed(2)}, final=${finalScore.toFixed(2)}`
  );

  return score;
}
