/**
 * Paper Helpers Tests
 *
 * Tests for shared paper display utilities
 */

import { describe, it, expect } from 'vitest';
import {
  getEvidenceBadges,
  getTopWhyShownSignals,
  formatAuthors,
  getScorePercent,
} from '@/lib/paper-helpers';
import { Code, BarChart2, FlaskConical, Database } from 'lucide-react';
import type { BriefingPaper } from '@/types/briefing';

describe('Paper Helpers', () => {
  describe('getEvidenceBadges', () => {
    it('should return all evidence badges when includeData=true', () => {
      const paper = {
        enriched: {
          hasCode: true,
          hasBaselines: true,
          hasAblations: true,
          hasData: true,
        },
      } as BriefingPaper;

      const badges = getEvidenceBadges(paper, true);

      expect(badges).toHaveLength(4);
      expect(badges[0]).toEqual({ label: 'Code', icon: Code });
      expect(badges[1]).toEqual({ label: 'Baselines', icon: BarChart2 });
      expect(badges[2]).toEqual({ label: 'Ablations', icon: FlaskConical });
      expect(badges[3]).toEqual({ label: 'Data', icon: Database });
    });

    it('should exclude Data badge when includeData=false', () => {
      const paper = {
        enriched: {
          hasCode: true,
          hasBaselines: true,
          hasAblations: true,
          hasData: true,
        },
      } as BriefingPaper;

      const badges = getEvidenceBadges(paper, false);

      expect(badges).toHaveLength(3);
      expect(badges.find((b) => b.label === 'Data')).toBeUndefined();
    });

    it('should return only badges for true signals', () => {
      const paper = {
        enriched: {
          hasCode: true,
          hasBaselines: false,
          hasAblations: true,
          hasData: false,
        },
      } as BriefingPaper;

      const badges = getEvidenceBadges(paper, true);

      expect(badges).toHaveLength(2);
      expect(badges[0].label).toBe('Code');
      expect(badges[1].label).toBe('Ablations');
    });

    it('should return empty array when no signals are true', () => {
      const paper = {
        enriched: {
          hasCode: false,
          hasBaselines: false,
          hasAblations: false,
          hasData: false,
        },
      } as BriefingPaper;

      const badges = getEvidenceBadges(paper);
      expect(badges).toEqual([]);
    });

    it('should return empty array when enriched is null', () => {
      const paper = {
        enriched: null,
      } as BriefingPaper;

      const badges = getEvidenceBadges(paper);
      expect(badges).toEqual([]);
    });
  });

  describe('getTopWhyShownSignals', () => {
    it('should return top N signals sorted by weight', () => {
      const score = {
        whyShown: {
          personalFit: 0.8,
          evidence: 0.6,
          novelty: 0.3,
          labPrior: 0.1,
        },
      };

      const signals = getTopWhyShownSignals(score, 2);

      expect(signals).toEqual(['personalFit', 'evidence']);
    });

    it('should return all signals if limit is greater than count', () => {
      const score = {
        whyShown: {
          personalFit: 0.8,
          evidence: 0.6,
        },
      };

      const signals = getTopWhyShownSignals(score, 5);

      expect(signals).toHaveLength(2);
      expect(signals).toEqual(['personalFit', 'evidence']);
    });

    it('should return empty array when whyShown is undefined', () => {
      const score = {};
      const signals = getTopWhyShownSignals(score, 2);
      expect(signals).toEqual([]);
    });

    it('should return empty array when score is undefined', () => {
      const signals = getTopWhyShownSignals(undefined, 2);
      expect(signals).toEqual([]);
    });

    it('should return empty array when whyShown is an array', () => {
      const score = {
        whyShown: ['signal1', 'signal2'],
      };
      const signals = getTopWhyShownSignals(score, 2);
      expect(signals).toEqual([]);
    });

    it('should return empty array when whyShown is not an object', () => {
      const score = {
        whyShown: 'invalid',
      };
      const signals = getTopWhyShownSignals(score, 2);
      expect(signals).toEqual([]);
    });

    it('should handle equal weights correctly', () => {
      const score = {
        whyShown: {
          signal1: 0.5,
          signal2: 0.5,
          signal3: 0.3,
        },
      };

      const signals = getTopWhyShownSignals(score, 2);
      expect(signals).toHaveLength(2);
      // Either signal1 or signal2 could be first
      expect(['signal1', 'signal2']).toContain(signals[0]);
    });
  });

  describe('formatAuthors', () => {
    it('should return all authors when count is less than maxDisplay', () => {
      const authors = ['Alice', 'Bob'];
      const formatted = formatAuthors(authors, 3);
      expect(formatted).toBe('Alice, Bob');
    });

    it('should truncate and add "+N more" when count exceeds maxDisplay', () => {
      const authors = ['Alice', 'Bob', 'Charlie', 'David', 'Eve'];
      const formatted = formatAuthors(authors, 3);
      expect(formatted).toBe('Alice, Bob, Charlie +2 more');
    });

    it('should handle exactly maxDisplay authors', () => {
      const authors = ['Alice', 'Bob', 'Charlie'];
      const formatted = formatAuthors(authors, 3);
      expect(formatted).toBe('Alice, Bob, Charlie');
    });

    it('should handle single author', () => {
      const authors = ['Alice'];
      const formatted = formatAuthors(authors, 3);
      expect(formatted).toBe('Alice');
    });

    it('should handle empty array', () => {
      const authors: string[] = [];
      const formatted = formatAuthors(authors, 3);
      expect(formatted).toBe('');
    });

    it('should use default maxDisplay of 3', () => {
      const authors = ['Alice', 'Bob', 'Charlie', 'David'];
      const formatted = formatAuthors(authors);
      expect(formatted).toBe('Alice, Bob, Charlie +1 more');
    });
  });

  describe('getScorePercent', () => {
    it('should convert score to percentage', () => {
      const score = { finalScore: 0.75 };
      expect(getScorePercent(score)).toBe(75);
    });

    it('should round to nearest integer', () => {
      const score = { finalScore: 0.756 };
      expect(getScorePercent(score)).toBe(76);
    });

    it('should handle 0 score', () => {
      const score = { finalScore: 0 };
      expect(getScorePercent(score)).toBe(0);
    });

    it('should handle 1.0 score', () => {
      const score = { finalScore: 1.0 };
      expect(getScorePercent(score)).toBe(100);
    });

    it('should return 0 when score is undefined', () => {
      expect(getScorePercent(undefined)).toBe(0);
    });

    it('should return 0 when finalScore is undefined', () => {
      const score = {};
      expect(getScorePercent(score)).toBe(0);
    });

    it('should handle very small scores', () => {
      const score = { finalScore: 0.001 };
      expect(getScorePercent(score)).toBe(0);
    });

    it('should handle rounding edge cases', () => {
      const score1 = { finalScore: 0.445 }; // Should round to 44
      const score2 = { finalScore: 0.455 }; // Should round to 46
      expect(getScorePercent(score1)).toBe(45);
      expect(getScorePercent(score2)).toBe(46);
    });
  });
});
