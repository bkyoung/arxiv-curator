import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rankPaper } from '@/server/agents/ranker';
import type { Paper, PaperEnriched } from '@prisma/client';

// Mock Prisma
vi.mock('@/server/db', () => ({
  prisma: {
    score: {
      upsert: vi.fn(),
    },
  },
}));

describe('Ranker Agent', () => {
  describe('rankPaper', () => {
    const mockPaper: Paper & { enriched: PaperEnriched | null } = {
      id: 'paper-1',
      arxivId: '2401.12345',
      version: 1,
      title: 'Test Paper on Agentic Systems',
      authors: ['Alice Smith'],
      abstract: 'We present a system for agentic planning with strong baselines.',
      categories: ['cs.AI'],
      primaryCategory: 'cs.AI',
      pdfUrl: null,
      codeUrl: null,
      pubDate: new Date('2024-01-20'),
      updatedDate: new Date('2024-01-20'),
      rawMetadata: null,
      status: 'enriched',
      createdAt: new Date('2024-01-20'),
      updatedAt: new Date('2024-01-20'),
      enriched: {
        id: 'enriched-1',
        paperId: 'paper-1',
        topics: ['agents', 'planning'],
        facets: ['planning', 'tool_use'],
        embedding: Array(384).fill(0),
        mathDepth: 0.1,
        hasCode: true,
        hasData: true,
        hasBaselines: true,
        hasAblations: true,
        hasMultipleEvals: true,
        enrichedAt: new Date('2024-01-20'),
      },
    };

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should calculate Evidence score for paper with all signals', async () => {
      const { prisma } = await import('@/server/db');

      (prisma.score.upsert as any).mockResolvedValue({
        id: 'score-1',
        paperId: 'paper-1',
        novelty: 0,
        evidence: 1.0,
        velocity: 0,
        personalFit: 0,
        labPrior: 0,
        mathPenalty: 0,
        finalScore: 1.0,
        whyShown: { evidence: 1.0 },
        createdAt: new Date(),
      });

      await rankPaper(mockPaper);

      expect(prisma.score.upsert).toHaveBeenCalledWith({
        where: { paperId: 'paper-1' },
        update: expect.objectContaining({
          evidence: 1.0, // All signals present
        }),
        create: expect.objectContaining({
          paperId: 'paper-1',
          evidence: 1.0,
        }),
      });
    });

    it('should calculate Evidence score for paper with partial signals', async () => {
      const partialPaper = {
        ...mockPaper,
        enriched: {
          ...mockPaper.enriched!,
          hasCode: true,
          hasData: false,
          hasBaselines: true,
          hasAblations: false,
          hasMultipleEvals: false,
        },
      };

      const { prisma } = await import('@/server/db');

      (prisma.score.upsert as any).mockResolvedValue({
        id: 'score-2',
        paperId: 'paper-1',
        novelty: 0,
        evidence: 0.5, // 0.3 (baselines) + 0.2 (code)
        velocity: 0,
        personalFit: 0,
        labPrior: 0,
        mathPenalty: 0,
        finalScore: 0.5,
        whyShown: { evidence: 0.5 },
        createdAt: new Date(),
      });

      await rankPaper(partialPaper);

      expect(prisma.score.upsert).toHaveBeenCalledWith({
        where: { paperId: 'paper-1' },
        update: expect.objectContaining({
          evidence: 0.5, // baselines (0.3) + code (0.2)
        }),
        create: expect.objectContaining({
          paperId: 'paper-1',
          evidence: 0.5,
        }),
      });
    });

    it('should calculate Evidence score of 0 for paper with no signals', async () => {
      const noEvidencePaper = {
        ...mockPaper,
        enriched: {
          ...mockPaper.enriched!,
          hasCode: false,
          hasData: false,
          hasBaselines: false,
          hasAblations: false,
          hasMultipleEvals: false,
        },
      };

      const { prisma } = await import('@/server/db');

      (prisma.score.upsert as any).mockResolvedValue({
        id: 'score-3',
        paperId: 'paper-1',
        novelty: 0,
        evidence: 0,
        velocity: 0,
        personalFit: 0,
        labPrior: 0,
        mathPenalty: 0,
        finalScore: 0,
        whyShown: { evidence: 0 },
        createdAt: new Date(),
      });

      await rankPaper(noEvidencePaper);

      expect(prisma.score.upsert).toHaveBeenCalledWith({
        where: { paperId: 'paper-1' },
        update: expect.objectContaining({
          evidence: 0,
        }),
        create: expect.objectContaining({
          paperId: 'paper-1',
          evidence: 0,
        }),
      });
    });

    it('should throw error if paper has no enrichment data', async () => {
      const unenrichedPaper = {
        ...mockPaper,
        enriched: null,
      };

      await expect(rankPaper(unenrichedPaper)).rejects.toThrow(
        'Paper 2401.12345 has not been enriched'
      );
    });

    it('should calculate multi-signal final score (Day 3 - all signals)', async () => {
      const { prisma } = await import('@/server/db');

      (prisma.score.upsert as any).mockResolvedValue({
        id: 'score-4',
        paperId: 'paper-1',
        novelty: 0.5,
        evidence: 0.65,
        velocity: 0.5,
        personalFit: 0,
        labPrior: 0,
        mathPenalty: 0,
        finalScore: 0.3125, // Weighted formula
        whyShown: {
          novelty: 0.5,
          evidence: 0.65,
          velocity: 0.5,
          personalFit: 0,
          labPrior: 0,
          mathPenalty: 0,
        },
        createdAt: new Date(),
      });

      await rankPaper({
        ...mockPaper,
        enriched: {
          ...mockPaper.enriched!,
          hasBaselines: true, // 0.3
          hasAblations: false,
          hasCode: true, // 0.2
          hasData: false,
          hasMultipleEvals: true, // 0.15
        },
      });

      expect(prisma.score.upsert).toHaveBeenCalledWith({
        where: { paperId: 'paper-1' },
        update: expect.objectContaining({
          novelty: 0.5, // No user profile = placeholder
          evidence: 0.65, // 0.3 + 0.2 + 0.15
          velocity: 0.5, // Placeholder
          personalFit: 0, // No user profile
          labPrior: 0, // Placeholder (no affiliation data)
          mathPenalty: 0, // No user profile
          finalScore: 0.3125, // 0.2×0.5 + 0.25×0.65 + 0.1×0.5 + 0.3×0 + 0.1×0 - 0.05×0
        }),
        create: expect.objectContaining({
          paperId: 'paper-1',
          novelty: 0.5,
          evidence: 0.65,
          velocity: 0.5,
          personalFit: 0,
          labPrior: 0,
          mathPenalty: 0,
          finalScore: 0.3125,
        }),
      });
    });
  });
});
