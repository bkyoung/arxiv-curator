import { describe, it, expect } from 'vitest';
import { calculateEvidenceScore } from '@/server/lib/scoring';
import type { EvidenceSignals } from '@/server/lib/scoring';

describe('Scoring Library', () => {
  describe('calculateEvidenceScore', () => {
    it('should return 0 for paper with no evidence signals', () => {
      const signals: EvidenceSignals = {
        hasBaselines: false,
        hasAblations: false,
        hasCode: false,
        hasData: false,
        hasMultipleEvals: false,
      };

      const score = calculateEvidenceScore(signals);
      expect(score).toBe(0);
    });

    it('should return 0.3 for paper with only baselines', () => {
      const signals: EvidenceSignals = {
        hasBaselines: true,
        hasAblations: false,
        hasCode: false,
        hasData: false,
        hasMultipleEvals: false,
      };

      const score = calculateEvidenceScore(signals);
      expect(score).toBe(0.3);
    });

    it('should return 0.2 for paper with only ablations', () => {
      const signals: EvidenceSignals = {
        hasBaselines: false,
        hasAblations: true,
        hasCode: false,
        hasData: false,
        hasMultipleEvals: false,
      };

      const score = calculateEvidenceScore(signals);
      expect(score).toBe(0.2);
    });

    it('should return 0.2 for paper with only code', () => {
      const signals: EvidenceSignals = {
        hasBaselines: false,
        hasAblations: false,
        hasCode: true,
        hasData: false,
        hasMultipleEvals: false,
      };

      const score = calculateEvidenceScore(signals);
      expect(score).toBe(0.2);
    });

    it('should return 0.15 for paper with only data', () => {
      const signals: EvidenceSignals = {
        hasBaselines: false,
        hasAblations: false,
        hasCode: false,
        hasData: true,
        hasMultipleEvals: false,
      };

      const score = calculateEvidenceScore(signals);
      expect(score).toBe(0.15);
    });

    it('should return 0.15 for paper with only multiple evals', () => {
      const signals: EvidenceSignals = {
        hasBaselines: false,
        hasAblations: false,
        hasCode: false,
        hasData: false,
        hasMultipleEvals: true,
      };

      const score = calculateEvidenceScore(signals);
      expect(score).toBe(0.15);
    });

    it('should return 1.0 for paper with all evidence signals', () => {
      const signals: EvidenceSignals = {
        hasBaselines: true,
        hasAblations: true,
        hasCode: true,
        hasData: true,
        hasMultipleEvals: true,
      };

      const score = calculateEvidenceScore(signals);
      expect(score).toBe(1.0);
    });

    it('should correctly sum multiple signals', () => {
      const signals: EvidenceSignals = {
        hasBaselines: true, // 0.3
        hasAblations: false,
        hasCode: true, // 0.2
        hasData: false,
        hasMultipleEvals: true, // 0.15
      };

      const score = calculateEvidenceScore(signals);
      expect(score).toBe(0.65); // 0.3 + 0.2 + 0.15
    });

    it('should return score in range [0, 1]', () => {
      const signals: EvidenceSignals = {
        hasBaselines: true,
        hasAblations: true,
        hasCode: false,
        hasData: true,
        hasMultipleEvals: false,
      };

      const score = calculateEvidenceScore(signals);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should handle partial signals correctly', () => {
      const signals: EvidenceSignals = {
        hasBaselines: true, // 0.3
        hasAblations: true, // 0.2
        hasCode: false,
        hasData: false,
        hasMultipleEvals: false,
      };

      const score = calculateEvidenceScore(signals);
      expect(score).toBe(0.5); // 0.3 + 0.2
    });
  });
});
