/**
 * Scoring Library
 *
 * Multi-signal scoring functions for Phase 2 personalization
 */

import { cosineSimilarity } from './vector-math';

export interface EvidenceSignals {
  hasBaselines: boolean;
  hasAblations: boolean;
  hasCode: boolean;
  hasData: boolean;
  hasMultipleEvals: boolean;
}

export interface PersonalFitInput {
  paperEmbedding: number[];
  userEmbedding: number[];
  paperTopics: string[];
  includedTopics: string[];
  excludedTopics: string[];
  includedKeywords: string[];
  excludedKeywords: string[];
  paperText: string;
}

export interface NoveltyInput {
  paperEmbedding: number[];
  userCentroid: number[];
  paperText: string;
  userHistoricalKeywords: string[];
}

export interface LabPriorInput {
  authors: string[];
  boostedLabs: string[];
  authorAffiliations: Record<string, string>;
}

export interface MathPenaltyInput {
  mathDepth: number;
  userSensitivity: number;
}

/**
 * Calculate Evidence score (E) from paper's evidence signals
 *
 * Evidence signal weights:
 * - hasBaselines: 0.3
 * - hasAblations: 0.2
 * - hasCode: 0.2
 * - hasData: 0.15
 * - hasMultipleEvals: 0.15
 * Total max: 1.0
 *
 * @param signals - Evidence signals from PaperEnriched
 * @returns Evidence score in range [0, 1]
 */
export function calculateEvidenceScore(signals: EvidenceSignals): number {
  let score = 0;

  if (signals.hasBaselines) score += 0.3;
  if (signals.hasAblations) score += 0.2;
  if (signals.hasCode) score += 0.2;
  if (signals.hasData) score += 0.15;
  if (signals.hasMultipleEvals) score += 0.15;

  return score;
}


/**
 * Calculate Personal Fit score (P)
 *
 * Formula: P = 0.7 × cosine_similarity + 0.3 × rule_bonuses
 *
 * Rule bonuses:
 * - Topic match: +0.2 per matched topic
 * - Keyword match: +0.1 per matched keyword
 * - Rule bonus capped at 1.0
 *
 * @param input - Personal fit inputs
 * @returns Personal fit score in range [0, 1]
 */
export function calculatePersonalFitScore(input: PersonalFitInput): number {
  // Calculate vector similarity (normalized to [0, 1])
  const vectorSimilarity = cosineSimilarity(
    input.paperEmbedding,
    input.userEmbedding,
    true
  );

  // Calculate rule bonuses
  let ruleBonus = 0;

  // Topic inclusion bonuses
  for (const topic of input.paperTopics) {
    if (input.includedTopics.includes(topic)) {
      ruleBonus += 0.2;
    }
  }

  // Keyword inclusion bonuses
  const lowerText = input.paperText.toLowerCase();
  for (const keyword of input.includedKeywords) {
    if (lowerText.includes(keyword.toLowerCase())) {
      ruleBonus += 0.1;
    }
  }

  // Cap rule bonus at 1.0
  ruleBonus = Math.min(ruleBonus, 1.0);

  // Combine: 70% vector similarity + 30% rule bonuses
  const personalFit = 0.7 * vectorSimilarity + 0.3 * ruleBonus;

  return personalFit;
}

/**
 * Calculate Novelty score (N)
 *
 * Measures how novel/different a paper is from user's historical interests
 *
 * Formula: N = 0.5 × centroid_distance + 0.5 × keyword_novelty
 *
 * Centroid distance: Cosine distance from user's interest centroid
 * Keyword novelty: Ratio of novel keywords to total keywords
 *
 * @param input - Novelty inputs
 * @returns Novelty score in range [0, 1]
 */
export function calculateNoveltyScore(input: NoveltyInput): number {
  // Check if user has any history
  const hasHistory =
    input.userCentroid.some((val) => val !== 0) ||
    input.userHistoricalKeywords.length > 0;

  if (!hasHistory) {
    // No user history = treat everything as novel
    return 1.0;
  }

  // Calculate centroid distance
  let centroidDistance = 0;
  if (input.userCentroid.some((val) => val !== 0)) {
    const similarity = cosineSimilarity(
      input.paperEmbedding,
      input.userCentroid,
      true
    );
    // Distance = 1 - similarity
    centroidDistance = 1 - similarity;
  } else {
    // Zero centroid = max distance
    centroidDistance = 1.0;
  }

  // Calculate keyword novelty
  let keywordNovelty = 0;
  if (input.paperText.trim().length > 0) {
    // Simple keyword extraction: split by whitespace and lowercase
    const paperKeywords = input.paperText
      .toLowerCase()
      .split(/\s+/)
      .filter((word) => word.length > 0);

    if (paperKeywords.length > 0) {
      if (input.userHistoricalKeywords.length === 0) {
        // No historical keywords = treat all paper keywords as novel
        keywordNovelty = 1.0;
      } else {
        // Pre-process historical keywords for efficient matching
        const historicalKeywordsLower = input.userHistoricalKeywords.map((k) =>
          k.toLowerCase()
        );

        const novelKeywords = paperKeywords.filter((paperKeyword) => {
          // Check if this paper keyword appears in any historical keyword (substring match)
          // This allows fuzzy matching: "machine" matches "machine learning"
          return !historicalKeywordsLower.some((historicalKeyword) =>
            historicalKeyword.includes(paperKeyword)
          );
        });

        keywordNovelty = novelKeywords.length / paperKeywords.length;
      }
    }
  }

  // Combine: 50% centroid distance + 50% keyword novelty
  const novelty = 0.5 * centroidDistance + 0.5 * keywordNovelty;

  return novelty;
}

/**
 * Calculate Lab Prior score (L)
 *
 * Binary signal: 1.0 if any author is from a boosted lab, 0.0 otherwise
 *
 * @param input - Lab prior inputs
 * @returns Lab prior score (0.0 or 1.0)
 */
export function calculateLabPriorScore(input: LabPriorInput): number {
  if (input.boostedLabs.length === 0) {
    return 0.0;
  }

  // Normalize boosted labs to lowercase for case-insensitive matching
  const boostedLabsLower = input.boostedLabs.map((lab) => lab.toLowerCase());

  // Check if any author is from a boosted lab
  for (const author of input.authors) {
    const affiliation = input.authorAffiliations[author];
    if (affiliation) {
      const affiliationLower = affiliation.toLowerCase();

      // Check if affiliation contains any boosted lab (substring match)
      for (const lab of boostedLabsLower) {
        if (affiliationLower.includes(lab)) {
          return 1.0; // Match found
        }
      }
    }
  }

  return 0.0; // No match
}

/**
 * Calculate Math Penalty (M)
 *
 * Penalty for math-heavy papers based on user sensitivity
 *
 * Formula: M = min(mathDepth × userSensitivity, 1.0)
 *
 * @param input - Math penalty inputs
 * @returns Penalty score in range [0, 1]
 */
export function calculateMathPenalty(input: MathPenaltyInput): number {
  const penalty = input.mathDepth * input.userSensitivity;

  // Cap at 1.0
  return Math.min(penalty, 1.0);
}
