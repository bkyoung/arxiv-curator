/**
 * Papers Router Tests (Mocked)
 *
 * Tests for papers tRPC endpoints with mocked Prisma
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Prisma
const mockPrismaPapers = new Map<string, any>();
const mockPrismaEnriched = new Map<string, any>();

vi.mock('@/server/db', () => ({
  prisma: {
    paper: {
      findMany: vi.fn(async ({ where, include, orderBy, take, skip }) => {
        let papers = Array.from(mockPrismaPapers.values());

        // Apply filters
        if (where?.categories?.hasSome) {
          papers = papers.filter((p) =>
            p.categories.some((cat: string) => where.categories.hasSome.includes(cat))
          );
        }
        if (where?.status) {
          papers = papers.filter((p) => p.status === where.status);
        }
        if (where?.pubDate?.gte) {
          papers = papers.filter((p) => new Date(p.pubDate) >= new Date(where.pubDate.gte));
        }
        if (where?.pubDate?.lte) {
          papers = papers.filter((p) => new Date(p.pubDate) <= new Date(where.pubDate.lte));
        }

        // Apply sorting
        if (orderBy?.pubDate === 'desc') {
          papers.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
        }

        // Apply pagination
        const offset = skip || 0;
        const limit = take || papers.length;
        papers = papers.slice(offset, offset + limit);

        // Include enriched data
        if (include?.enriched) {
          papers = papers.map((p) => ({
            ...p,
            enriched: mockPrismaEnriched.get(p.id) || null,
          }));
        }

        return papers;
      }),

      findUnique: vi.fn(async ({ where, include }) => {
        const paper = mockPrismaPapers.get(where.id);
        if (!paper) return null;

        if (include?.enriched) {
          return {
            ...paper,
            enriched: mockPrismaEnriched.get(paper.id) || null,
          };
        }

        return paper;
      }),

      count: vi.fn(async (params) => {
        let papers = Array.from(mockPrismaPapers.values());
        const where = params?.where;

        if (where?.categories?.hasSome) {
          papers = papers.filter((p) =>
            p.categories.some((cat: string) => where.categories.hasSome.includes(cat))
          );
        }
        if (where?.status) {
          papers = papers.filter((p) => p.status === where.status);
        }

        return papers.length;
      }),

      groupBy: vi.fn(async ({ by, _count, orderBy, take }) => {
        const papers = Array.from(mockPrismaPapers.values());
        const grouped = new Map<string, number>();

        papers.forEach((paper) => {
          const key = paper[by[0]];
          grouped.set(key, (grouped.get(key) || 0) + 1);
        });

        let result = Array.from(grouped.entries()).map(([category, count]) => ({
          primaryCategory: category,
          _count: count,
        }));

        if (orderBy?._count?.primaryCategory === 'desc') {
          result.sort((a, b) => b._count - a._count);
        }

        if (take) {
          result = result.slice(0, take);
        }

        return result;
      }),
    },
  },
}));

import { papersRouter } from '@/server/routers/papers';

describe('Papers Router (Mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrismaPapers.clear();
    mockPrismaEnriched.clear();
  });

  describe('list', () => {
    it('should return paginated papers with enrichment data', async () => {
      // Create test papers
      const paper1 = {
        id: 'paper-1',
        arxivId: '2401.00001',
        title: 'Test Paper 1',
        authors: ['Alice'],
        abstract: 'Abstract 1',
        categories: ['cs.AI'],
        primaryCategory: 'cs.AI',
        status: 'enriched',
        pubDate: new Date('2024-01-15'),
        updatedDate: new Date('2024-01-15'),
        pdfUrl: 'https://arxiv.org/pdf/2401.00001',
        version: 1,
        rawMetadata: {},
        codeUrl: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const enriched1 = {
        id: 'enriched-1',
        paperId: 'paper-1',
        topics: ['agents'],
        facets: ['planning'],
        embedding: new Array(384).fill(0.1),
        mathDepth: 0.2,
        hasCode: true,
        hasData: false,
        hasBaselines: true,
        hasAblations: false,
        hasMultipleEvals: true,
        enrichedAt: new Date(),
      };

      mockPrismaPapers.set(paper1.id, paper1);
      mockPrismaEnriched.set(paper1.id, enriched1);

      const caller = papersRouter.createCaller({ req: {}, res: {} } as any);
      const result = await caller.list({ limit: 20, offset: 0 });

      expect(result.papers).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.hasMore).toBe(false);
      expect(result.papers[0].id).toBe('paper-1');
      expect(result.papers[0].enriched).toBeDefined();
      expect(result.papers[0].enriched?.topics).toContain('agents');
    });

    it('should filter by categories', async () => {
      const paper1 = {
        id: 'paper-1',
        arxivId: '2401.00001',
        categories: ['cs.AI', 'cs.LG'],
        primaryCategory: 'cs.AI',
        status: 'enriched',
        pubDate: new Date(),
      } as any;

      const paper2 = {
        id: 'paper-2',
        arxivId: '2401.00002',
        categories: ['cs.CL'],
        primaryCategory: 'cs.CL',
        status: 'enriched',
        pubDate: new Date(),
      } as any;

      mockPrismaPapers.set(paper1.id, paper1);
      mockPrismaPapers.set(paper2.id, paper2);

      const caller = papersRouter.createCaller({ req: {}, res: {} } as any);
      const result = await caller.list({
        limit: 20,
        offset: 0,
        categories: ['cs.AI'],
      });

      expect(result.papers).toHaveLength(1);
      expect(result.papers[0].id).toBe('paper-1');
    });

    it('should filter by status', async () => {
      const paper1 = {
        id: 'paper-1',
        status: 'enriched',
        pubDate: new Date(),
      } as any;

      const paper2 = {
        id: 'paper-2',
        status: 'new',
        pubDate: new Date(),
      } as any;

      mockPrismaPapers.set(paper1.id, paper1);
      mockPrismaPapers.set(paper2.id, paper2);

      const caller = papersRouter.createCaller({ req: {}, res: {} } as any);
      const result = await caller.list({
        limit: 20,
        offset: 0,
        status: 'enriched',
      });

      expect(result.papers).toHaveLength(1);
      expect(result.papers[0].status).toBe('enriched');
    });

    it('should handle pagination', async () => {
      // Create 3 papers
      for (let i = 1; i <= 3; i++) {
        mockPrismaPapers.set(`paper-${i}`, {
          id: `paper-${i}`,
          arxivId: `2401.0000${i}`,
          status: 'enriched',
          pubDate: new Date(`2024-01-${15 + i}`),
        } as any);
      }

      const caller = papersRouter.createCaller({ req: {}, res: {} } as any);

      // First page
      const page1 = await caller.list({ limit: 2, offset: 0 });
      expect(page1.papers).toHaveLength(2);
      expect(page1.hasMore).toBe(true);

      // Second page
      const page2 = await caller.list({ limit: 2, offset: 2 });
      expect(page2.papers).toHaveLength(1);
      expect(page2.hasMore).toBe(false);
    });
  });

  describe('getById', () => {
    it('should return paper with enrichment data', async () => {
      const paper = {
        id: 'paper-1',
        arxivId: '2401.00001',
        title: 'Test Paper',
      } as any;

      const enriched = {
        id: 'enriched-1',
        paperId: 'paper-1',
        topics: ['agents'],
      } as any;

      mockPrismaPapers.set(paper.id, paper);
      mockPrismaEnriched.set(paper.id, enriched);

      const caller = papersRouter.createCaller({ req: {}, res: {} } as any);
      const result = await caller.getById({ id: 'paper-1' });

      expect(result.id).toBe('paper-1');
      expect(result.enriched).toBeDefined();
      expect(result.enriched?.topics).toContain('agents');
    });

    it('should throw error if paper not found', async () => {
      const caller = papersRouter.createCaller({ req: {}, res: {} } as any);

      await expect(caller.getById({ id: 'nonexistent' })).rejects.toThrow('Paper not found');
    });
  });

  describe('stats', () => {
    it('should return paper statistics', async () => {
      // Create test papers
      mockPrismaPapers.set('paper-1', {
        id: 'paper-1',
        status: 'enriched',
        primaryCategory: 'cs.AI',
      } as any);

      mockPrismaPapers.set('paper-2', {
        id: 'paper-2',
        status: 'enriched',
        primaryCategory: 'cs.AI',
      } as any);

      mockPrismaPapers.set('paper-3', {
        id: 'paper-3',
        status: 'pending',
        primaryCategory: 'cs.LG',
      } as any);

      const caller = papersRouter.createCaller({ req: {}, res: {} } as any);
      const result = await caller.stats();

      expect(result.total).toBe(3);
      expect(result.pending).toBe(1);
      expect(result.enriched).toBe(2);
      expect(result.ranked).toBe(0);
      expect(result.topCategories).toHaveLength(2);
      expect(result.topCategories[0].category).toBe('cs.AI');
      expect(result.topCategories[0].count).toBe(2);
    });
  });
});
