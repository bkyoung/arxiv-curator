import { describe, it, expect, beforeEach, vi } from 'vitest';
import { generateDailyDigest, selectDiversePapers } from '../../../server/agents/recommender';
import { prisma } from '../../../server/db';

// Mock Prisma
vi.mock('../../../server/db', () => ({
  prisma: {
    userProfile: {
      findUnique: vi.fn(),
    },
    paper: {
      findMany: vi.fn(),
    },
    briefing: {
      create: vi.fn(),
      upsert: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

describe('Recommender Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateDailyDigest', () => {
    it('should generate briefing with correct paper count', async () => {
      // Mock user profile
      vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
        id: 'profile-1',
        userId: 'user-1',
        interestVector: JSON.parse('[' + Array(768).fill(0.5).join(',') + ']'),
        includeTopics: [],
        excludeTopics: [],
        includeKeywords: [],
        excludeKeywords: [],
        labBoosts: {},
        mathDepthMax: 1.0,
        explorationRate: 0.15,
        noiseCap: 15,
        targetToday: 15,
        target7d: 100,
        scoreThreshold: 0.5,
        digestEnabled: true,
        arxivCategories: ['cs.AI'],
        sourcesEnabled: { arxiv: true },
        useLocalEmbeddings: true,
        useLocalLLM: true,
        preferredLLM: 'gemini-2.0-flash',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock 50 scored papers
      const mockPapers = Array.from({ length: 50 }, (_, i) => ({
        id: `paper-${i}`,
        arxivId: `2401.${String(i).padStart(5, '0')}`,
        version: 1,
        title: `Paper ${i}`,
        authors: ['Author A', 'Author B'],
        abstract: 'Test abstract',
        categories: ['cs.AI'],
        primaryCategory: 'cs.AI',
        pdfUrl: 'https://arxiv.org/pdf/2401.00000',
        codeUrl: null,
        pubDate: new Date(),
        updatedDate: new Date(),
        rawMetadata: null,
        status: 'enriched',
        createdAt: new Date(),
        updatedAt: new Date(),
        enriched: {
          id: `enriched-${i}`,
          paperId: `paper-${i}`,
          topics: ['agents'],
          facets: ['planning'],
          embedding: Array(768).fill(0.5),
          mathDepth: 0.3,
          hasCode: false,
          hasData: false,
          hasBaselines: true,
          hasAblations: false,
          hasMultipleEvals: false,
          enrichedAt: new Date(),
        },
        scores: [{
          id: `score-${i}`,
          paperId: `paper-${i}`,
          novelty: 0.7,
          evidence: 0.8,
          velocity: 0.5,
          personalFit: 0.7,
          labPrior: 0.5,
          mathPenalty: 0.1,
          finalScore: 0.7,
          whyShown: null,
          createdAt: new Date(),
        }],
      }));

      vi.mocked(prisma.paper.findMany).mockResolvedValue(mockPapers as any);

      // Mock briefing creation
      vi.mocked(prisma.briefing.upsert).mockResolvedValue({
        id: 'briefing-1',
        userId: 'user-1',
        date: new Date(),
        paperIds: mockPapers.slice(0, 15).map(p => p.id),
        paperCount: 15,
        avgScore: 0.7,
        status: 'ready',
        generatedAt: new Date(),
        viewedAt: null,
      } as any);

      const briefing = await generateDailyDigest('user-1');

      expect(briefing.paperCount).toBe(15); // Default noise cap
      expect(briefing.paperIds).toHaveLength(15);
      expect(briefing.userId).toBe('user-1');
    });

    it('should apply material improvement filter', async () => {
      // Mock user profile with threshold 0.6
      vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
        id: 'profile-1',
        userId: 'user-1',
        interestVector: JSON.parse('[' + Array(768).fill(0.5).join(',') + ']'),
        includeTopics: [],
        excludeTopics: [],
        includeKeywords: [],
        excludeKeywords: [],
        labBoosts: {},
        mathDepthMax: 1.0,
        explorationRate: 0.15,
        noiseCap: 15,
        targetToday: 15,
        target7d: 100,
        scoreThreshold: 0.6, // Higher threshold
        digestEnabled: true,
        arxivCategories: ['cs.AI'],
        sourcesEnabled: { arxiv: true },
        useLocalEmbeddings: true,
        useLocalLLM: true,
        preferredLLM: 'gemini-2.0-flash',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock papers: 10 above threshold, 10 below
      const mockPapers = [
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `paper-high-${i}`,
          arxivId: `2401.${String(i).padStart(5, '0')}`,
          version: 1,
          title: `High Score Paper ${i}`,
          authors: ['Author A'],
          abstract: 'Test',
          categories: ['cs.AI'],
          primaryCategory: 'cs.AI',
          pdfUrl: 'https://arxiv.org/pdf',
          codeUrl: null,
          pubDate: new Date(),
          updatedDate: new Date(),
          rawMetadata: null,
          status: 'enriched',
          createdAt: new Date(),
          updatedAt: new Date(),
          enriched: {
            id: `enriched-high-${i}`,
            paperId: `paper-high-${i}`,
            topics: ['agents'],
            facets: [],
            embedding: Array(768).fill(0.5),
            mathDepth: 0.3,
            hasCode: true,
            hasData: false,
            hasBaselines: true,
            hasAblations: false,
            hasMultipleEvals: false,
            enrichedAt: new Date(),
          },
          scores: [{
            id: `score-high-${i}`,
            paperId: `paper-high-${i}`,
            novelty: 0.8,
            evidence: 0.9,
            velocity: 0.5,
            personalFit: 0.8,
            labPrior: 0.5,
            mathPenalty: 0.1,
            finalScore: 0.8, // Above threshold
            whyShown: null,
            createdAt: new Date(),
          }],
        })),
        ...Array.from({ length: 10 }, (_, i) => ({
          id: `paper-low-${i}`,
          arxivId: `2401.${String(10 + i).padStart(5, '0')}`,
          version: 1,
          title: `Low Score Paper ${i}`,
          authors: ['Author B'],
          abstract: 'Test',
          categories: ['cs.AI'],
          primaryCategory: 'cs.AI',
          pdfUrl: 'https://arxiv.org/pdf',
          codeUrl: null,
          pubDate: new Date(),
          updatedDate: new Date(),
          rawMetadata: null,
          status: 'enriched',
          createdAt: new Date(),
          updatedAt: new Date(),
          enriched: {
            id: `enriched-low-${i}`,
            paperId: `paper-low-${i}`,
            topics: ['applications'],
            facets: [],
            embedding: Array(768).fill(0.2),
            mathDepth: 0.3,
            hasCode: false,
            hasData: false,
            hasBaselines: false,
            hasAblations: false,
            hasMultipleEvals: false,
            enrichedAt: new Date(),
          },
          scores: [{
            id: `score-low-${i}`,
            paperId: `paper-low-${i}`,
            novelty: 0.3,
            evidence: 0.2,
            velocity: 0.5,
            personalFit: 0.4,
            labPrior: 0.5,
            mathPenalty: 0.1,
            finalScore: 0.3, // Below threshold
            whyShown: null,
            createdAt: new Date(),
          }],
        })),
      ];

      vi.mocked(prisma.paper.findMany).mockResolvedValue(mockPapers as any);

      vi.mocked(prisma.briefing.upsert).mockResolvedValue({
        id: 'briefing-1',
        userId: 'user-1',
        date: new Date(),
        paperIds: mockPapers.slice(0, 10).map(p => p.id),
        paperCount: 10,
        avgScore: 0.8,
        status: 'ready',
        generatedAt: new Date(),
        viewedAt: null,
      } as any);

      const briefing = await generateDailyDigest('user-1');

      // Should only include high-scoring papers
      expect(briefing.avgScore).toBeGreaterThanOrEqual(0.6);
      expect(briefing.paperCount).toBeLessThanOrEqual(10); // Only high-scoring papers
    });

    it('should apply exploration strategy', async () => {
      // Mock user profile with 20% exploration
      vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
        id: 'profile-1',
        userId: 'user-1',
        interestVector: JSON.parse('[' + Array(768).fill(1.0).join(',') + ']'),
        includeTopics: [],
        excludeTopics: [],
        includeKeywords: [],
        excludeKeywords: [],
        labBoosts: {},
        mathDepthMax: 1.0,
        explorationRate: 0.2, // 20% exploration
        noiseCap: 10,
        targetToday: 10,
        target7d: 100,
        scoreThreshold: 0.5,
        digestEnabled: true,
        arxivCategories: ['cs.AI'],
        sourcesEnabled: { arxiv: true },
        useLocalEmbeddings: true,
        useLocalLLM: true,
        preferredLLM: 'gemini-2.0-flash',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock 50 papers
      const mockPapers = Array.from({ length: 50 }, (_, i) => ({
        id: `paper-${i}`,
        arxivId: `2401.${String(i).padStart(5, '0')}`,
        version: 1,
        title: `Paper ${i}`,
        authors: ['Author A'],
        abstract: 'Test',
        categories: ['cs.AI'],
        primaryCategory: 'cs.AI',
        pdfUrl: 'https://arxiv.org/pdf',
        codeUrl: null,
        pubDate: new Date(),
        updatedDate: new Date(),
        rawMetadata: null,
        status: 'enriched',
        createdAt: new Date(),
        updatedAt: new Date(),
        enriched: {
          id: `enriched-${i}`,
          paperId: `paper-${i}`,
          topics: i < 40 ? ['agents'] : ['theory'], // Most are agents, some are theory
          facets: [],
          embedding: i < 40 ? Array(768).fill(1.0) : Array(768).fill(0.0), // Similar vs orthogonal
          mathDepth: 0.3,
          hasCode: false,
          hasData: false,
          hasBaselines: true,
          hasAblations: false,
          hasMultipleEvals: false,
          enrichedAt: new Date(),
        },
        scores: [{
          id: `score-${i}`,
          paperId: `paper-${i}`,
          novelty: 0.7,
          evidence: 0.8,
          velocity: 0.5,
          personalFit: 0.7,
          labPrior: 0.5,
          mathPenalty: 0.1,
          finalScore: 0.7,
          whyShown: null,
          createdAt: new Date(),
        }],
      }));

      vi.mocked(prisma.paper.findMany).mockResolvedValue(mockPapers as any);

      vi.mocked(prisma.briefing.upsert).mockResolvedValue({
        id: 'briefing-1',
        userId: 'user-1',
        date: new Date(),
        paperIds: mockPapers.slice(0, 10).map(p => p.id),
        paperCount: 10,
        avgScore: 0.7,
        status: 'ready',
        generatedAt: new Date(),
        viewedAt: null,
      } as any);

      const briefing = await generateDailyDigest('user-1');

      // 10 papers × 20% = 2 explore, 8 exploit
      expect(briefing.paperCount).toBe(10);
    });

    it('should handle user with no papers meeting threshold', async () => {
      // Mock user profile
      vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
        id: 'profile-1',
        userId: 'user-1',
        interestVector: JSON.parse('[' + Array(768).fill(0.5).join(',') + ']'),
        includeTopics: [],
        excludeTopics: [],
        includeKeywords: [],
        excludeKeywords: [],
        labBoosts: {},
        mathDepthMax: 1.0,
        explorationRate: 0.15,
        noiseCap: 15,
        targetToday: 15,
        target7d: 100,
        scoreThreshold: 0.9, // Very high threshold
        digestEnabled: true,
        arxivCategories: ['cs.AI'],
        sourcesEnabled: { arxiv: true },
        useLocalEmbeddings: true,
        useLocalLLM: true,
        preferredLLM: 'gemini-2.0-flash',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock papers that don't meet threshold
      vi.mocked(prisma.paper.findMany).mockResolvedValue([]);

      vi.mocked(prisma.briefing.upsert).mockResolvedValue({
        id: 'briefing-1',
        userId: 'user-1',
        date: new Date(),
        paperIds: [],
        paperCount: 0,
        avgScore: 0,
        status: 'ready',
        generatedAt: new Date(),
        viewedAt: null,
      } as any);

      const briefing = await generateDailyDigest('user-1');

      expect(briefing.paperCount).toBe(0);
      expect(briefing.paperIds).toHaveLength(0);
    });

    it('should respect noise cap setting', async () => {
      // Mock user profile with low noise cap
      vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
        id: 'profile-1',
        userId: 'user-1',
        interestVector: JSON.parse('[' + Array(768).fill(0.5).join(',') + ']'),
        includeTopics: [],
        excludeTopics: [],
        includeKeywords: [],
        excludeKeywords: [],
        labBoosts: {},
        mathDepthMax: 1.0,
        explorationRate: 0.15,
        noiseCap: 5, // Very low cap
        targetToday: 5,
        target7d: 100,
        scoreThreshold: 0.5,
        digestEnabled: true,
        arxivCategories: ['cs.AI'],
        sourcesEnabled: { arxiv: true },
        useLocalEmbeddings: true,
        useLocalLLM: true,
        preferredLLM: 'gemini-2.0-flash',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // Mock 50 papers
      const mockPapers = Array.from({ length: 50 }, (_, i) => ({
        id: `paper-${i}`,
        arxivId: `2401.${String(i).padStart(5, '0')}`,
        version: 1,
        title: `Paper ${i}`,
        authors: ['Author A'],
        abstract: 'Test',
        categories: ['cs.AI'],
        primaryCategory: 'cs.AI',
        pdfUrl: 'https://arxiv.org/pdf',
        codeUrl: null,
        pubDate: new Date(),
        updatedDate: new Date(),
        rawMetadata: null,
        status: 'enriched',
        createdAt: new Date(),
        updatedAt: new Date(),
        enriched: {
          id: `enriched-${i}`,
          paperId: `paper-${i}`,
          topics: ['agents'],
          facets: [],
          embedding: Array(768).fill(0.5),
          mathDepth: 0.3,
          hasCode: false,
          hasData: false,
          hasBaselines: true,
          hasAblations: false,
          hasMultipleEvals: false,
          enrichedAt: new Date(),
        },
        scores: [{
          id: `score-${i}`,
          paperId: `paper-${i}`,
          novelty: 0.7,
          evidence: 0.8,
          velocity: 0.5,
          personalFit: 0.7,
          labPrior: 0.5,
          mathPenalty: 0.1,
          finalScore: 0.7,
          whyShown: null,
          createdAt: new Date(),
        }],
      }));

      vi.mocked(prisma.paper.findMany).mockResolvedValue(mockPapers as any);

      vi.mocked(prisma.briefing.upsert).mockResolvedValue({
        id: 'briefing-1',
        userId: 'user-1',
        date: new Date(),
        paperIds: mockPapers.slice(0, 5).map(p => p.id),
        paperCount: 5,
        avgScore: 0.7,
        status: 'ready',
        generatedAt: new Date(),
        viewedAt: null,
      } as any);

      const briefing = await generateDailyDigest('user-1');

      expect(briefing.paperCount).toBe(5);
      expect(briefing.paperCount).toBeLessThanOrEqual(5);
    });
  });

  describe('selectDiversePapers', () => {
    it('should select papers orthogonal to user vector', () => {
      const userVector = Array(768).fill(0);
      userVector[0] = 1.0; // User interested in first dimension

      const candidates = [
        {
          id: 'paper-1',
          enriched: {
            embedding: (() => {
              const emb = Array(768).fill(0);
              emb[0] = 0.9; // Similar to user
              return emb;
            })(),
            topics: ['agents'],
          },
        },
        {
          id: 'paper-2',
          enriched: {
            embedding: (() => {
              const emb = Array(768).fill(0);
              emb[1] = 1.0; // Orthogonal to user
              return emb;
            })(),
            topics: ['theory'],
          },
        },
        {
          id: 'paper-3',
          enriched: {
            embedding: (() => {
              const emb = Array(768).fill(0);
              emb[2] = 1.0; // Orthogonal to user
              return emb;
            })(),
            topics: ['applications'],
          },
        },
      ];

      const selected = selectDiversePapers(candidates as any, 2, userVector);

      // Should pick the two orthogonal papers
      expect(selected).toHaveLength(2);
      expect(selected.map(p => p.id)).not.toContain('paper-1');
      expect(selected.map(p => p.id)).toContain('paper-2');
      expect(selected.map(p => p.id)).toContain('paper-3');
    });

    it('should handle empty candidates', () => {
      const userVector = Array(768).fill(0.5);
      const candidates: any[] = [];

      const selected = selectDiversePapers(candidates, 5, userVector);

      expect(selected).toHaveLength(0);
    });

    it('should handle request for more papers than available', () => {
      const userVector = Array(768).fill(0.5);
      const candidates = [
        {
          id: 'paper-1',
          enriched: {
            embedding: Array(768).fill(0.3),
            topics: ['agents'],
          },
        },
        {
          id: 'paper-2',
          enriched: {
            embedding: Array(768).fill(0.7),
            topics: ['theory'],
          },
        },
      ];

      const selected = selectDiversePapers(candidates as any, 10, userVector);

      // Should return all available papers
      expect(selected).toHaveLength(2);
    });
  });
});
