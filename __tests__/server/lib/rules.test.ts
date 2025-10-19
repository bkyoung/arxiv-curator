import { describe, it, expect } from 'vitest';
import { shouldExcludePaper } from '@/server/lib/rules';

describe('Rules Engine', () => {
  describe('shouldExcludePaper', () => {
    it('should not exclude paper with no exclusion rules', () => {
      const result = shouldExcludePaper({
        paperTopics: ['agents', 'rag'],
        excludedTopics: [],
        excludedKeywords: [],
        paperText: 'An agent system with RAG',
      });

      expect(result).toBe(false);
    });

    it('should exclude paper matching excluded topic', () => {
      const result = shouldExcludePaper({
        paperTopics: ['agents', 'theory'],
        excludedTopics: ['theory'],
        excludedKeywords: [],
        paperText: 'An agent system',
      });

      expect(result).toBe(true);
    });

    it('should exclude paper matching multiple excluded topics', () => {
      const result = shouldExcludePaper({
        paperTopics: ['agents', 'theory', 'optimization'],
        excludedTopics: ['theory', 'math'],
        excludedKeywords: [],
        paperText: 'An agent system',
      });

      expect(result).toBe(true);
    });

    it('should not exclude paper with non-matching excluded topics', () => {
      const result = shouldExcludePaper({
        paperTopics: ['agents', 'applications'],
        excludedTopics: ['theory', 'math'],
        excludedKeywords: [],
        paperText: 'An agent system',
      });

      expect(result).toBe(false);
    });

    it('should exclude paper matching excluded keyword', () => {
      const result = shouldExcludePaper({
        paperTopics: ['agents'],
        excludedTopics: [],
        excludedKeywords: ['theorem'],
        paperText: 'We prove a convergence theorem',
      });

      expect(result).toBe(true);
    });

    it('should exclude paper matching excluded keyword (case insensitive)', () => {
      const result = shouldExcludePaper({
        paperTopics: ['agents'],
        excludedTopics: [],
        excludedKeywords: ['THEOREM'],
        paperText: 'We prove a convergence theorem',
      });

      expect(result).toBe(true);
    });

    it('should not exclude paper with non-matching excluded keywords', () => {
      const result = shouldExcludePaper({
        paperTopics: ['agents'],
        excludedTopics: [],
        excludedKeywords: ['theorem', 'proof'],
        paperText: 'We present a practical system',
      });

      expect(result).toBe(false);
    });

    it('should exclude paper matching either topic OR keyword exclusion', () => {
      const result = shouldExcludePaper({
        paperTopics: ['agents', 'theory'],
        excludedTopics: ['theory'],
        excludedKeywords: ['lemma'],
        paperText: 'An agent system',
      });

      expect(result).toBe(true);
    });

    it('should handle empty paper topics', () => {
      const result = shouldExcludePaper({
        paperTopics: [],
        excludedTopics: ['theory'],
        excludedKeywords: [],
        paperText: 'A paper',
      });

      expect(result).toBe(false);
    });

    it('should handle empty paper text', () => {
      const result = shouldExcludePaper({
        paperTopics: ['agents'],
        excludedTopics: [],
        excludedKeywords: ['theorem'],
        paperText: '',
      });

      expect(result).toBe(false);
    });

    it('should match partial keywords', () => {
      const result = shouldExcludePaper({
        paperTopics: ['agents'],
        excludedTopics: [],
        excludedKeywords: ['theor'],
        paperText: 'We present theoretical analysis',
      });

      expect(result).toBe(true);
    });
  });
});
