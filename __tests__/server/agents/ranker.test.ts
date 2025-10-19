import { describe, it, expect, vi, beforeEach } from 'vitest';
import { rankPaper, scorePapers, scoreUnrankedPapers } from '@/server/agents/ranker';
import type { Paper, PaperEnriched } from '@prisma/client';

// Mock Prisma
vi.mock('@/server/db', () => ({
  prisma: {
    score: {
      upsert: vi.fn(),
    },
    paper: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
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

  describe('scorePapers', () => {
    const mockEnrichedPapers = [
      {
        id: 'paper-1',
        arxivId: '2401.12345',
        version: 1,
        title: 'Test Paper 1',
        authors: ['Alice'],
        abstract: 'Abstract 1',
        categories: ['cs.AI'],
        primaryCategory: 'cs.AI',
        pdfUrl: null,
        codeUrl: null,
        pubDate: new Date('2024-01-20'),
        updatedDate: new Date('2024-01-20'),
        rawMetadata: null,
        status: 'enriched' as const,
        createdAt: new Date('2024-01-20'),
        updatedAt: new Date('2024-01-20'),
        enriched: {
          id: 'enriched-1',
          paperId: 'paper-1',
          topics: ['agents'],
          facets: ['planning'],
          embedding: Array(384).fill(0.1),
          mathDepth: 0.1,
          hasCode: true,
          hasData: true,
          hasBaselines: true,
          hasAblations: true,
          hasMultipleEvals: true,
          enrichedAt: new Date('2024-01-20'),
        },
      },
      {
        id: 'paper-2',
        arxivId: '2401.12346',
        version: 1,
        title: 'Test Paper 2',
        authors: ['Bob'],
        abstract: 'Abstract 2',
        categories: ['cs.AI'],
        primaryCategory: 'cs.AI',
        pdfUrl: null,
        codeUrl: null,
        pubDate: new Date('2024-01-21'),
        updatedDate: new Date('2024-01-21'),
        rawMetadata: null,
        status: 'enriched' as const,
        createdAt: new Date('2024-01-21'),
        updatedAt: new Date('2024-01-21'),
        enriched: {
          id: 'enriched-2',
          paperId: 'paper-2',
          topics: ['rag'],
          facets: ['retrieval'],
          embedding: Array(384).fill(0.2),
          mathDepth: 0.2,
          hasCode: false,
          hasData: false,
          hasBaselines: true,
          hasAblations: false,
          hasMultipleEvals: false,
          enrichedAt: new Date('2024-01-21'),
        },
      },
    ];

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should batch score multiple papers', async () => {
      const { prisma } = await import('@/server/db');

      (prisma.paper.findMany as any).mockResolvedValue(mockEnrichedPapers);
      (prisma.score.upsert as any).mockResolvedValue({
        id: 'score-1',
        paperId: 'paper-1',
        novelty: 0.5,
        evidence: 1.0,
        velocity: 0.5,
        personalFit: 0,
        labPrior: 0,
        mathPenalty: 0,
        finalScore: 0.375,
        whyShown: {},
        createdAt: new Date(),
      });
      (prisma.paper.updateMany as any).mockResolvedValue({ count: 2 });

      const scores = await scorePapers(['paper-1', 'paper-2']);

      expect(prisma.paper.findMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['paper-1', 'paper-2'] },
          status: 'enriched',
        },
        include: { enriched: true },
      });

      expect(scores).toHaveLength(2);
      expect(prisma.paper.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['paper-1', 'paper-2'] } },
        data: { status: 'ranked' },
      });
    });

    it('should handle errors in individual papers gracefully', async () => {
      const { prisma } = await import('@/server/db');

      (prisma.paper.findMany as any).mockResolvedValue(mockEnrichedPapers);

      // First paper succeeds, second fails
      let callCount = 0;
      (prisma.score.upsert as any).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            id: 'score-1',
            paperId: 'paper-1',
            novelty: 0.5,
            evidence: 1.0,
            velocity: 0.5,
            personalFit: 0,
            labPrior: 0,
            mathPenalty: 0,
            finalScore: 0.375,
            whyShown: {},
            createdAt: new Date(),
          });
        }
        return Promise.reject(new Error('Database error'));
      });

      (prisma.paper.updateMany as any).mockResolvedValue({ count: 1 });

      const scores = await scorePapers(['paper-1', 'paper-2']);

      expect(scores).toHaveLength(2);
      expect(scores[0]).not.toBeNull();
      expect(scores[1]).toBeNull(); // Error in second paper

      // Only successful paper gets status update
      expect(prisma.paper.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['paper-1'] } },
        data: { status: 'ranked' },
      });
    });

    it('should return empty array when no enriched papers found', async () => {
      const { prisma } = await import('@/server/db');

      (prisma.paper.findMany as any).mockResolvedValue([]);

      const scores = await scorePapers(['paper-1', 'paper-2']);

      expect(scores).toEqual([]);
      expect(prisma.paper.updateMany).not.toHaveBeenCalled();
    });
  });

  describe('scoreUnrankedPapers', () => {
    const mockUnrankedPapers = [
      {
        id: 'paper-3',
        arxivId: '2401.12347',
        version: 1,
        title: 'Unranked Paper 1',
        authors: ['Charlie'],
        abstract: 'Abstract 3',
        categories: ['cs.AI'],
        primaryCategory: 'cs.AI',
        pdfUrl: null,
        codeUrl: null,
        pubDate: new Date('2024-01-22'),
        updatedDate: new Date('2024-01-22'),
        rawMetadata: null,
        status: 'enriched' as const,
        createdAt: new Date('2024-01-22'),
        updatedAt: new Date('2024-01-22'),
        enriched: {
          id: 'enriched-3',
          paperId: 'paper-3',
          topics: ['agents'],
          facets: ['planning'],
          embedding: Array(384).fill(0.3),
          mathDepth: 0.3,
          hasCode: true,
          hasData: false,
          hasBaselines: true,
          hasAblations: true,
          hasMultipleEvals: false,
          enrichedAt: new Date('2024-01-22'),
        },
      },
    ];

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it('should find and score all unranked papers', async () => {
      const { prisma } = await import('@/server/db');

      (prisma.paper.findMany as any).mockResolvedValue(mockUnrankedPapers);
      (prisma.score.upsert as any).mockResolvedValue({
        id: 'score-3',
        paperId: 'paper-3',
        novelty: 0.5,
        evidence: 0.65,
        velocity: 0.5,
        personalFit: 0,
        labPrior: 0,
        mathPenalty: 0,
        finalScore: 0.3125,
        whyShown: {},
        createdAt: new Date(),
      });
      (prisma.paper.updateMany as any).mockResolvedValue({ count: 1 });

      const scores = await scoreUnrankedPapers();

      expect(prisma.paper.findMany).toHaveBeenCalledWith({
        where: {
          status: 'enriched',
          scores: { none: {} },
        },
        include: { enriched: true },
      });

      expect(scores).toHaveLength(1);
      expect(scores[0]).not.toBeNull();

      expect(prisma.paper.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['paper-3'] } },
        data: { status: 'ranked' },
      });
    });

    it('should return empty array when no unranked papers exist', async () => {
      const { prisma } = await import('@/server/db');

      (prisma.paper.findMany as any).mockResolvedValue([]);

      const scores = await scoreUnrankedPapers();

      expect(scores).toEqual([]);
      expect(prisma.paper.updateMany).not.toHaveBeenCalled();
    });

    it('should handle errors in individual papers', async () => {
      const { prisma } = await import('@/server/db');

      const twoPapers = [
        ...mockUnrankedPapers,
        {
          ...mockUnrankedPapers[0],
          id: 'paper-4',
          arxivId: '2401.12348',
        },
      ];

      (prisma.paper.findMany as any).mockResolvedValue(twoPapers);

      let callCount = 0;
      (prisma.score.upsert as any).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Database error'));
        }
        return Promise.resolve({
          id: 'score-4',
          paperId: 'paper-4',
          novelty: 0.5,
          evidence: 0.5,
          velocity: 0.5,
          personalFit: 0,
          labPrior: 0,
          mathPenalty: 0,
          finalScore: 0.25,
          whyShown: {},
          createdAt: new Date(),
        });
      });

      (prisma.paper.updateMany as any).mockResolvedValue({ count: 1 });

      const scores = await scoreUnrankedPapers();

      expect(scores).toHaveLength(2);
      expect(scores[0]).toBeNull(); // Error in first paper
      expect(scores[1]).not.toBeNull(); // Success in second paper

      // Only successful paper gets status update
      expect(prisma.paper.updateMany).toHaveBeenCalledWith({
        where: { id: { in: ['paper-4'] } },
        data: { status: 'ranked' },
      });
    });
  });
});
