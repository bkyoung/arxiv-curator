import { describe, it, expect } from 'vitest';
import {
  calculateEvidenceScore,
  calculateCosineSimilarity,
  calculatePersonalFitScore,
  calculateNoveltyScore,
  calculateLabPriorScore,
  calculateMathPenalty,
} from '@/server/lib/scoring';
import type {
  EvidenceSignals,
  PersonalFitInput,
  NoveltyInput,
  LabPriorInput,
  MathPenaltyInput,
} from '@/server/lib/scoring';

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

  describe('calculateNoveltyScore', () => {
    it('should return high novelty for paper far from user centroid', () => {
      const input: NoveltyInput = {
        paperEmbedding: [1, 0, 0],
        userCentroid: [0, 1, 0], // Orthogonal = high distance
        paperText: 'quantum computing blockchain',
        userHistoricalKeywords: ['machine learning', 'neural networks'],
      };

      const score = calculateNoveltyScore(input);
      // High centroid distance + novel keywords = high novelty
      expect(score).toBeGreaterThan(0.5);
    });

    it('should return low novelty for paper close to user centroid', () => {
      const input: NoveltyInput = {
        paperEmbedding: [1, 0, 0],
        userCentroid: [1, 0, 0], // Identical = low distance
        paperText: 'machine learning neural networks',
        userHistoricalKeywords: ['machine learning', 'neural networks'],
      };

      const score = calculateNoveltyScore(input);
      // Low centroid distance + familiar keywords = low novelty
      expect(score).toBeLessThan(0.3);
    });

    it('should calculate centroid distance correctly', () => {
      const input: NoveltyInput = {
        paperEmbedding: [1, 0, 0],
        userCentroid: [0, 1, 0], // Orthogonal vectors
        paperText: '',
        userHistoricalKeywords: [],
      };

      const score = calculateNoveltyScore(input);
      // Pure centroid distance for orthogonal vectors
      // Cosine similarity = 0.5 (normalized), distance = 1 - 0.5 = 0.5
      // N = 0.5 × 0.5 + 0.5 × 0 = 0.25
      expect(score).toBeCloseTo(0.25, 2);
    });

    it('should detect novel keywords', () => {
      const input: NoveltyInput = {
        paperEmbedding: [1, 0, 0],
        userCentroid: [1, 0, 0], // Same vector
        paperText: 'quantum computing entanglement',
        userHistoricalKeywords: ['machine learning', 'deep learning'],
      };

      const score = calculateNoveltyScore(input);
      // Low centroid distance but high keyword novelty
      // All keywords are novel (3 novel / 3 total = 1.0)
      // N = 0.5 × 0 + 0.5 × 1.0 = 0.5
      expect(score).toBeCloseTo(0.5, 2);
    });

    it('should handle empty user history', () => {
      const input: NoveltyInput = {
        paperEmbedding: [1, 0, 0],
        userCentroid: [0, 0, 0], // Zero vector (no history)
        paperText: 'some paper text',
        userHistoricalKeywords: [],
      };

      const score = calculateNoveltyScore(input);
      // No user history = treat as novel
      expect(score).toBe(1.0);
    });

    it('should normalize score to [0, 1] range', () => {
      const input: NoveltyInput = {
        paperEmbedding: [1, 2, 3],
        userCentroid: [4, 5, 6],
        paperText: 'test keywords',
        userHistoricalKeywords: ['other', 'words'],
      };

      const score = calculateNoveltyScore(input);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should combine centroid distance and keyword novelty equally', () => {
      const input: NoveltyInput = {
        paperEmbedding: [1, 0, 0],
        userCentroid: [0, 1, 0], // Centroid distance = 0.5
        paperText: 'word1 word2',
        userHistoricalKeywords: ['word1'], // 1 familiar, 1 novel = 0.5 novelty
      };

      const score = calculateNoveltyScore(input);
      // N = 0.5 × 0.5 + 0.5 × 0.5 = 0.5
      expect(score).toBeCloseTo(0.5, 2);
    });
  });

  describe('calculateLabPriorScore', () => {
    it('should return 1.0 when author matches boosted lab', () => {
      const input: LabPriorInput = {
        authors: ['John Doe', 'Jane Smith'],
        boostedLabs: ['OpenAI', 'DeepMind'],
        authorAffiliations: {
          'John Doe': 'OpenAI',
          'Jane Smith': 'Stanford University',
        },
      };

      const score = calculateLabPriorScore(input);
      expect(score).toBe(1.0);
    });

    it('should return 0.0 when no author matches boosted labs', () => {
      const input: LabPriorInput = {
        authors: ['John Doe', 'Jane Smith'],
        boostedLabs: ['OpenAI', 'DeepMind'],
        authorAffiliations: {
          'John Doe': 'Stanford University',
          'Jane Smith': 'MIT',
        },
      };

      const score = calculateLabPriorScore(input);
      expect(score).toBe(0.0);
    });

    it('should return 1.0 when multiple authors match boosted labs', () => {
      const input: LabPriorInput = {
        authors: ['John Doe', 'Jane Smith'],
        boostedLabs: ['OpenAI', 'DeepMind'],
        authorAffiliations: {
          'John Doe': 'OpenAI',
          'Jane Smith': 'DeepMind',
        },
      };

      const score = calculateLabPriorScore(input);
      // At least one match = 1.0
      expect(score).toBe(1.0);
    });

    it('should be case insensitive', () => {
      const input: LabPriorInput = {
        authors: ['John Doe'],
        boostedLabs: ['openai'],
        authorAffiliations: {
          'John Doe': 'OpenAI',
        },
      };

      const score = calculateLabPriorScore(input);
      expect(score).toBe(1.0);
    });

    it('should handle empty boosted labs', () => {
      const input: LabPriorInput = {
        authors: ['John Doe'],
        boostedLabs: [],
        authorAffiliations: {
          'John Doe': 'OpenAI',
        },
      };

      const score = calculateLabPriorScore(input);
      expect(score).toBe(0.0);
    });

    it('should handle missing affiliation data', () => {
      const input: LabPriorInput = {
        authors: ['John Doe', 'Jane Smith'],
        boostedLabs: ['OpenAI'],
        authorAffiliations: {
          'John Doe': 'OpenAI',
          // Jane Smith missing
        },
      };

      const score = calculateLabPriorScore(input);
      // John matches
      expect(score).toBe(1.0);
    });

    it('should handle partial lab name matches', () => {
      const input: LabPriorInput = {
        authors: ['John Doe'],
        boostedLabs: ['Google'],
        authorAffiliations: {
          'John Doe': 'Google Research',
        },
      };

      const score = calculateLabPriorScore(input);
      // Substring match should work
      expect(score).toBe(1.0);
    });
  });

  describe('calculateMathPenalty', () => {
    it('should return 0 for zero math depth', () => {
      const input: MathPenaltyInput = {
        mathDepth: 0,
        userSensitivity: 0.5,
      };

      const penalty = calculateMathPenalty(input);
      expect(penalty).toBe(0);
    });

    it('should return max penalty for high math depth and high sensitivity', () => {
      const input: MathPenaltyInput = {
        mathDepth: 1.0,
        userSensitivity: 1.0,
      };

      const penalty = calculateMathPenalty(input);
      expect(penalty).toBe(1.0); // Full penalty
    });

    it('should return no penalty for zero sensitivity', () => {
      const input: MathPenaltyInput = {
        mathDepth: 1.0,
        userSensitivity: 0.0,
      };

      const penalty = calculateMathPenalty(input);
      expect(penalty).toBe(0);
    });

    it('should calculate penalty proportionally', () => {
      const input: MathPenaltyInput = {
        mathDepth: 0.5,
        userSensitivity: 0.5,
      };

      const penalty = calculateMathPenalty(input);
      // M = mathDepth × sensitivity = 0.5 × 0.5 = 0.25
      expect(penalty).toBeCloseTo(0.25, 5);
    });

    it('should handle default user sensitivity of 0.5', () => {
      const input: MathPenaltyInput = {
        mathDepth: 0.8,
        userSensitivity: 0.5, // Default
      };

      const penalty = calculateMathPenalty(input);
      // M = 0.8 × 0.5 = 0.4
      expect(penalty).toBeCloseTo(0.4, 5);
    });

    it('should cap penalty at 1.0', () => {
      const input: MathPenaltyInput = {
        mathDepth: 1.5, // Could be > 1 from enricher
        userSensitivity: 1.0,
      };

      const penalty = calculateMathPenalty(input);
      expect(penalty).toBeLessThanOrEqual(1.0);
    });

    it('should be in range [0, 1]', () => {
      const input: MathPenaltyInput = {
        mathDepth: 0.7,
        userSensitivity: 0.6,
      };

      const penalty = calculateMathPenalty(input);
      expect(penalty).toBeGreaterThanOrEqual(0);
      expect(penalty).toBeLessThanOrEqual(1);
    });
  });
});
