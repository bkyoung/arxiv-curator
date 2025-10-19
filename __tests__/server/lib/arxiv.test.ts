import { describe, it, expect } from 'vitest';
import {
  extractArxivId,
  parseArxivId,
  parseAuthors,
  parseCategories,
} from '@/server/lib/arxiv';

describe('arXiv Utilities', () => {
  describe('extractArxivId', () => {
    it('should extract arXiv ID from URL', () => {
      const url = 'http://arxiv.org/abs/2401.12345v2';
      expect(extractArxivId(url)).toBe('2401.12345v2');
    });

    it('should extract arXiv ID without version', () => {
      const url = 'http://arxiv.org/abs/2401.12345';
      expect(extractArxivId(url)).toBe('2401.12345v1');
    });

    it('should handle old-style arXiv IDs', () => {
      const url = 'http://arxiv.org/abs/cs/0501001v1';
      expect(extractArxivId(url)).toBe('cs/0501001v1');
    });

    it('should throw error on invalid URL', () => {
      const url = 'http://example.com/invalid';
      expect(() => extractArxivId(url)).toThrow('Invalid arXiv URL');
    });
  });

  describe('parseArxivId', () => {
    it('should parse arXiv ID with version', () => {
      const result = parseArxivId('2401.12345v2');
      expect(result).toEqual({ baseId: '2401.12345', version: 2 });
    });

    it('should parse arXiv ID without version', () => {
      const result = parseArxivId('2401.12345');
      expect(result).toEqual({ baseId: '2401.12345', version: 1 });
    });

    it('should handle old-style arXiv IDs', () => {
      const result = parseArxivId('cs/0501001v3');
      expect(result).toEqual({ baseId: 'cs/0501001', version: 3 });
    });
  });

  describe('parseAuthors', () => {
    it('should parse single author', () => {
      const authorData = { name: 'John Doe' };
      const result = parseAuthors(authorData);
      expect(result).toEqual(['John Doe']);
    });

    it('should parse multiple authors', () => {
      const authorData = [
        { name: 'John Doe' },
        { name: 'Jane Smith' },
      ];
      const result = parseAuthors(authorData);
      expect(result).toEqual(['John Doe', 'Jane Smith']);
    });

    it('should handle author with affiliation', () => {
      const authorData = {
        name: 'John Doe',
        'arxiv:affiliation': { '#text': 'MIT' },
      };
      const result = parseAuthors(authorData);
      expect(result).toEqual(['John Doe']);
    });
  });

  describe('parseCategories', () => {
    it('should parse single category', () => {
      const categoryData = { '@_term': 'cs.AI' };
      const result = parseCategories(categoryData);
      expect(result).toEqual(['cs.AI']);
    });

    it('should parse multiple categories', () => {
      const categoryData = [
        { '@_term': 'cs.AI' },
        { '@_term': 'cs.LG' },
        { '@_term': 'cs.CL' },
      ];
      const result = parseCategories(categoryData);
      expect(result).toEqual(['cs.AI', 'cs.LG', 'cs.CL']);
    });

    it('should filter out non-CS categories if needed', () => {
      const categoryData = [
        { '@_term': 'cs.AI' },
        { '@_term': 'stat.ML' },
        { '@_term': 'cs.LG' },
      ];
      const result = parseCategories(categoryData);
      // Should include all for now
      expect(result).toEqual(['cs.AI', 'stat.ML', 'cs.LG']);
    });
  });
});
