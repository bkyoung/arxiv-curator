/**
 * Vector Math Library Tests
 *
 * Tests for shared vector operations
 */

import { describe, it, expect } from 'vitest';
import {
  cosineSimilarity,
  magnitude,
  dotProduct,
  normalize,
} from '@/server/lib/vector-math';

describe('Vector Math Library', () => {
  describe('cosineSimilarity', () => {
    describe('raw mode (normalize=false)', () => {
      it('should return 1.0 for identical vectors', () => {
        const vec1 = [1, 0, 0];
        const vec2 = [1, 0, 0];
        const similarity = cosineSimilarity(vec1, vec2, false);
        expect(similarity).toBeCloseTo(1.0, 5);
      });

      it('should return 0.0 for orthogonal vectors', () => {
        const vec1 = [1, 0, 0];
        const vec2 = [0, 1, 0];
        const similarity = cosineSimilarity(vec1, vec2, false);
        expect(similarity).toBeCloseTo(0.0, 5);
      });

      it('should return -1.0 for opposite vectors', () => {
        const vec1 = [1, 0, 0];
        const vec2 = [-1, 0, 0];
        const similarity = cosineSimilarity(vec1, vec2, false);
        expect(similarity).toBeCloseTo(-1.0, 5);
      });

      it('should handle arbitrary vectors', () => {
        const vec1 = [1, 2, 3];
        const vec2 = [4, 5, 6];
        // (1*4 + 2*5 + 3*6) / (sqrt(14) * sqrt(77)) ≈ 0.9746
        const similarity = cosineSimilarity(vec1, vec2, false);
        expect(similarity).toBeCloseTo(0.9746, 3);
      });
    });

    describe('normalized mode (normalize=true)', () => {
      it('should return 1.0 for identical vectors', () => {
        const vec1 = [1, 0, 0];
        const vec2 = [1, 0, 0];
        const similarity = cosineSimilarity(vec1, vec2, true);
        expect(similarity).toBeCloseTo(1.0, 5);
      });

      it('should return 0.5 for orthogonal vectors', () => {
        const vec1 = [1, 0, 0];
        const vec2 = [0, 1, 0];
        const similarity = cosineSimilarity(vec1, vec2, true);
        // Raw: 0.0, normalized: (0+1)/2 = 0.5
        expect(similarity).toBeCloseTo(0.5, 5);
      });

      it('should return 0.0 for opposite vectors', () => {
        const vec1 = [1, 0, 0];
        const vec2 = [-1, 0, 0];
        const similarity = cosineSimilarity(vec1, vec2, true);
        // Raw: -1.0, normalized: (-1+1)/2 = 0.0
        expect(similarity).toBeCloseTo(0.0, 5);
      });

      it('should calculate correct similarity for arbitrary vectors', () => {
        const vec1 = [1, 2, 3];
        const vec2 = [4, 5, 6];
        // Raw: 0.9746, normalized: (0.9746+1)/2 ≈ 0.9873
        const similarity = cosineSimilarity(vec1, vec2, true);
        expect(similarity).toBeCloseTo(0.9873, 3);
      });

      it('should always return values in [0, 1] range', () => {
        const vec1 = [1, -1, 0];
        const vec2 = [-1, 1, 0];
        const similarity = cosineSimilarity(vec1, vec2, true);
        expect(similarity).toBeGreaterThanOrEqual(0);
        expect(similarity).toBeLessThanOrEqual(1);
      });
    });

    describe('edge cases', () => {
      it('should handle zero vectors', () => {
        const vec1 = [0, 0, 0];
        const vec2 = [1, 2, 3];
        const similarity = cosineSimilarity(vec1, vec2);
        expect(similarity).toBe(0);
      });

      it('should throw error for vectors of different lengths', () => {
        const vec1 = [1, 2];
        const vec2 = [1, 2, 3];
        expect(() => cosineSimilarity(vec1, vec2)).toThrow('Vectors must have the same length');
      });

      it('should handle high-dimensional vectors', () => {
        const vec1 = Array(100).fill(1);
        const vec2 = Array(100).fill(1);
        const similarity = cosineSimilarity(vec1, vec2);
        expect(similarity).toBeCloseTo(1.0, 5);
      });
    });
  });

  describe('magnitude', () => {
    it('should calculate magnitude of unit vector', () => {
      const vec = [1, 0, 0];
      expect(magnitude(vec)).toBeCloseTo(1.0, 5);
    });

    it('should calculate magnitude of arbitrary vector', () => {
      const vec = [3, 4]; // 3-4-5 triangle
      expect(magnitude(vec)).toBeCloseTo(5.0, 5);
    });

    it('should return 0 for zero vector', () => {
      const vec = [0, 0, 0];
      expect(magnitude(vec)).toBe(0);
    });

    it('should handle negative values', () => {
      const vec = [-3, -4];
      expect(magnitude(vec)).toBeCloseTo(5.0, 5);
    });
  });

  describe('dotProduct', () => {
    it('should calculate dot product of orthogonal vectors', () => {
      const vec1 = [1, 0, 0];
      const vec2 = [0, 1, 0];
      expect(dotProduct(vec1, vec2)).toBe(0);
    });

    it('should calculate dot product of parallel vectors', () => {
      const vec1 = [2, 3, 4];
      const vec2 = [2, 3, 4];
      // 2*2 + 3*3 + 4*4 = 4 + 9 + 16 = 29
      expect(dotProduct(vec1, vec2)).toBe(29);
    });

    it('should throw error for vectors of different lengths', () => {
      const vec1 = [1, 2];
      const vec2 = [1, 2, 3];
      expect(() => dotProduct(vec1, vec2)).toThrow('Vectors must have the same length');
    });

    it('should handle negative values', () => {
      const vec1 = [1, -2, 3];
      const vec2 = [4, 5, -6];
      // 1*4 + (-2)*5 + 3*(-6) = 4 - 10 - 18 = -24
      expect(dotProduct(vec1, vec2)).toBe(-24);
    });
  });

  describe('normalize', () => {
    it('should normalize a vector to unit length', () => {
      const vec = [3, 4];
      const normalized = normalize(vec);
      expect(normalized[0]).toBeCloseTo(0.6, 5); // 3/5
      expect(normalized[1]).toBeCloseTo(0.8, 5); // 4/5
      expect(magnitude(normalized)).toBeCloseTo(1.0, 5);
    });

    it('should handle already normalized vector', () => {
      const vec = [1, 0, 0];
      const normalized = normalize(vec);
      expect(normalized).toEqual([1, 0, 0]);
    });

    it('should handle zero vector', () => {
      const vec = [0, 0, 0];
      const normalized = normalize(vec);
      expect(normalized).toEqual([0, 0, 0]);
    });

    it('should handle negative values', () => {
      const vec = [-3, 4];
      const normalized = normalize(vec);
      expect(normalized[0]).toBeCloseTo(-0.6, 5);
      expect(normalized[1]).toBeCloseTo(0.8, 5);
    });
  });
});
