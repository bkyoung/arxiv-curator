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
