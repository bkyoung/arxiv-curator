/**
 * Scoring Library
 *
 * Multi-signal scoring functions for Phase 2 personalization
 */

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
 * Calculate cosine similarity between two vectors
 *
 * Normalized to [0, 1] range (raw cosine is [-1, 1])
 *
 * @param vec1 - First vector
 * @param vec2 - Second vector
 * @returns Similarity score in range [0, 1]
 */
export function calculateCosineSimilarity(
  vec1: number[],
  vec2: number[]
): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same length');
  }

  // Handle zero vectors
  const magnitude1 = Math.sqrt(vec1.reduce((sum, val) => sum + val * val, 0));
  const magnitude2 = Math.sqrt(vec2.reduce((sum, val) => sum + val * val, 0));

  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }

  // Calculate dot product
  const dotProduct = vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);

  // Cosine similarity (raw range: [-1, 1])
  const cosineSim = dotProduct / (magnitude1 * magnitude2);

  // Normalize to [0, 1] range: (cos + 1) / 2
  return (cosineSim + 1) / 2;
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
  // Calculate vector similarity
  const vectorSimilarity = calculateCosineSimilarity(
    input.paperEmbedding,
    input.userEmbedding
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
