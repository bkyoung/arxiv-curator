import { describe, it, expect } from 'vitest';
import {
  calculateEvidenceScore,
  calculateCosineSimilarity,
  calculatePersonalFitScore,
} from '@/server/lib/scoring';
import type { EvidenceSignals, PersonalFitInput } from '@/server/lib/scoring';

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

  describe('calculateCosineSimilarity', () => {
    it('should return 1.0 for identical vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [1, 0, 0];
      const similarity = calculateCosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(1.0, 5);
    });

    it('should return 0.5 for orthogonal vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [0, 1, 0];
      const similarity = calculateCosineSimilarity(vec1, vec2);
      // Raw cosine: 0.0, normalized: (0+1)/2 = 0.5
      expect(similarity).toBeCloseTo(0.5, 5);
    });

    it('should return 0.0 for opposite vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [-1, 0, 0];
      const similarity = calculateCosineSimilarity(vec1, vec2);
      // Raw cosine: -1.0, normalized: (-1+1)/2 = 0.0
      expect(similarity).toBeCloseTo(0.0, 5);
    });

    it('should calculate correct similarity for arbitrary vectors', () => {
      const vec1 = [1, 2, 3];
      const vec2 = [4, 5, 6];
      // Raw cosine: (1*4 + 2*5 + 3*6) / (sqrt(14) * sqrt(77)) ≈ 0.9746
      // Normalized: (0.9746 + 1) / 2 ≈ 0.9873
      const similarity = calculateCosineSimilarity(vec1, vec2);
      expect(similarity).toBeCloseTo(0.9873, 3);
    });

    it('should handle zero vectors', () => {
      const vec1 = [0, 0, 0];
      const vec2 = [1, 2, 3];
      const similarity = calculateCosineSimilarity(vec1, vec2);
      expect(similarity).toBe(0);
    });

    it('should normalize result to [0, 1] range', () => {
      const vec1 = [1, -1, 0];
      const vec2 = [-1, 1, 0];
      const similarity = calculateCosineSimilarity(vec1, vec2);
      // Raw cosine would be -1.0, normalized to 0.0
      expect(similarity).toBeGreaterThanOrEqual(0);
      expect(similarity).toBeLessThanOrEqual(1);
    });
  });

  describe('calculatePersonalFitScore', () => {
    it('should calculate score based on vector similarity alone when no rules', () => {
      const input: PersonalFitInput = {
        paperEmbedding: [1, 0, 0],
        userEmbedding: [1, 0, 0], // Identical = similarity 1.0
        paperTopics: ['agents'],
        includedTopics: [],
        excludedTopics: [],
        includedKeywords: [],
        excludedKeywords: [],
        paperText: 'An agent system',
      };

      const score = calculatePersonalFitScore(input);
      // P = 0.7 × 1.0 + 0.3 × 0 = 0.7
      expect(score).toBeCloseTo(0.7, 5);
    });

    it('should apply topic inclusion bonus', () => {
      const input: PersonalFitInput = {
        paperEmbedding: [1, 0, 0],
        userEmbedding: [1, 0, 0],
        paperTopics: ['agents', 'rag'],
        includedTopics: ['agents'], // +0.2 bonus
        excludedTopics: [],
        includedKeywords: [],
        excludedKeywords: [],
        paperText: 'An agent system',
      };

      const score = calculatePersonalFitScore(input);
      // P = 0.7 × 1.0 + 0.3 × 0.2 = 0.76
      expect(score).toBeCloseTo(0.76, 5);
    });

    it('should apply multiple topic inclusion bonuses', () => {
      const input: PersonalFitInput = {
        paperEmbedding: [1, 0, 0],
        userEmbedding: [1, 0, 0],
        paperTopics: ['agents', 'rag', 'planning'],
        includedTopics: ['agents', 'rag'], // +0.4 bonus (2 × 0.2)
        excludedTopics: [],
        includedKeywords: [],
        excludedKeywords: [],
        paperText: 'An agent system with RAG',
      };

      const score = calculatePersonalFitScore(input);
      // P = 0.7 × 1.0 + 0.3 × 0.4 = 0.82
      expect(score).toBeCloseTo(0.82, 5);
    });

    it('should apply keyword inclusion bonus', () => {
      const input: PersonalFitInput = {
        paperEmbedding: [1, 0, 0],
        userEmbedding: [1, 0, 0],
        paperTopics: ['agents'],
        includedTopics: [],
        excludedTopics: [],
        includedKeywords: ['planning'], // +0.1 bonus
        excludedKeywords: [],
        paperText: 'An agent system for planning tasks',
      };

      const score = calculatePersonalFitScore(input);
      // P = 0.7 × 1.0 + 0.3 × 0.1 = 0.73
      expect(score).toBeCloseTo(0.73, 5);
    });

    it('should combine topic and keyword bonuses', () => {
      const input: PersonalFitInput = {
        paperEmbedding: [1, 0, 0],
        userEmbedding: [1, 0, 0],
        paperTopics: ['agents'],
        includedTopics: ['agents'], // +0.2
        excludedTopics: [],
        includedKeywords: ['planning'], // +0.1
        excludedKeywords: [],
        paperText: 'An agent system for planning',
      };

      const score = calculatePersonalFitScore(input);
      // P = 0.7 × 1.0 + 0.3 × 0.3 = 0.79
      expect(score).toBeCloseTo(0.79, 5);
    });

    it('should cap rule bonus at 1.0', () => {
      const input: PersonalFitInput = {
        paperEmbedding: [1, 0, 0],
        userEmbedding: [1, 0, 0],
        paperTopics: ['agents', 'rag', 'planning', 'tools', 'llm'],
        includedTopics: ['agents', 'rag', 'planning', 'tools', 'llm'], // Would be +1.0
        excludedTopics: [],
        includedKeywords: ['search', 'retrieval', 'generation'], // Would be +0.3
        excludedKeywords: [],
        paperText: 'search retrieval generation',
      };

      const score = calculatePersonalFitScore(input);
      // Rule bonus capped at 1.0
      // P = 0.7 × 1.0 + 0.3 × 1.0 = 1.0
      expect(score).toBe(1.0);
    });

    it('should handle low vector similarity with high rule bonus', () => {
      const input: PersonalFitInput = {
        paperEmbedding: [1, 0, 0],
        userEmbedding: [0, 1, 0], // Orthogonal = normalized similarity 0.5
        paperTopics: ['agents', 'rag'],
        includedTopics: ['agents', 'rag'], // +0.4 bonus
        excludedTopics: [],
        includedKeywords: [],
        excludedKeywords: [],
        paperText: 'An agent system',
      };

      const score = calculatePersonalFitScore(input);
      // P = 0.7 × 0.5 + 0.3 × 0.4 = 0.35 + 0.12 = 0.47
      expect(score).toBeCloseTo(0.47, 5);
    });

    it('should return score in range [0, 1]', () => {
      const input: PersonalFitInput = {
        paperEmbedding: [1, 2, 3],
        userEmbedding: [4, 5, 6],
        paperTopics: ['agents'],
        includedTopics: ['agents'],
        excludedTopics: [],
        includedKeywords: ['test'],
        excludedKeywords: [],
        paperText: 'test',
      };

      const score = calculatePersonalFitScore(input);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });
  });
});
