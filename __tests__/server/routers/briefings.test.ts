/**
 * Briefings Router Tests (Mocked)
 *
 * Tests for briefings tRPC endpoints with mocked Prisma and Recommender
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Briefings storage
const mockPrismaBriefings = new Map<string, any>();
const mockPrismaPapers = new Map<string, any>();

// Mock Recommender Agent
vi.mock('@/server/agents/recommender', () => ({
  generateDailyDigest: vi.fn(async (userId: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return {
      id: `briefing-${userId}-${today.getTime()}`,
      userId,
      date: today,
      paperIds: ['paper-1', 'paper-2', 'paper-3'],
      paperCount: 3,
      avgScore: 0.75,
      status: 'ready',
      generatedAt: new Date(),
      viewedAt: null,
    };
  }),
}));

// Mock Prisma
vi.mock('@/server/db', () => ({
  prisma: {
    briefing: {
      findUnique: vi.fn(async ({ where }) => {
        if (where.id) {
          return mockPrismaBriefings.get(where.id);
        }
        if (where.userId_date) {
          const { userId, date } = where.userId_date;
          const key = `${userId}-${new Date(date).toISOString().split('T')[0]}`;
          return mockPrismaBriefings.get(key);
        }
        return null;
      }),

      findMany: vi.fn(async ({ where, orderBy, take, skip }) => {
        let briefings = Array.from(mockPrismaBriefings.values());

        // Apply filters
        if (where?.userId) {
          briefings = briefings.filter((b) => b.userId === where.userId);
        }

        // Apply sorting
        if (orderBy?.date === 'desc') {
          briefings.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }

        // Apply pagination
        const offset = skip || 0;
        const limit = take || briefings.length;
        briefings = briefings.slice(offset, offset + limit);

        return briefings;
      }),

      count: vi.fn(async ({ where }) => {
        let briefings = Array.from(mockPrismaBriefings.values());

        if (where?.userId) {
          briefings = briefings.filter((b) => b.userId === where.userId);
        }

        return briefings.length;
      }),

      create: vi.fn(async ({ data }) => {
        const briefing = {
          id: `briefing-${Date.now()}`,
          ...data,
          generatedAt: new Date(),
          viewedAt: null,
        };
        const key = `${data.userId}-${new Date(data.date).toISOString().split('T')[0]}`;
        mockPrismaBriefings.set(key, briefing);
        return briefing;
      }),

      update: vi.fn(async ({ where, data }) => {
        const briefing = mockPrismaBriefings.get(where.id);
        if (!briefing) return null;

        const updated = { ...briefing, ...data };
        mockPrismaBriefings.set(where.id, updated);
        return updated;
      }),
    },

    paper: {
      findMany: vi.fn(async ({ where, include }) => {
        let papers = [];

        if (where?.id?.in) {
          papers = where.id.in.map((id: string) => mockPrismaPapers.get(id)).filter(Boolean);
        } else {
          papers = Array.from(mockPrismaPapers.values());
        }

        // Handle feedback filtering if included
        if (include?.feedback?.where?.userId) {
          const userId = include.feedback.where.userId;
          papers = papers.map(paper => ({
            ...paper,
            feedback: paper.feedback ? paper.feedback.filter((f: any) => f.userId === userId) : [],
          }));
        }

        return papers;
      }),
    },
  },
}));

// Import after mocks
import { briefingsRouter } from '@/server/routers/briefings';

describe('Briefings Router', () => {
  beforeEach(() => {
    // Clear storage
    mockPrismaBriefings.clear();
    mockPrismaPapers.clear();

    // Clear mocks
    vi.clearAllMocks();

    // Add mock papers
    ['paper-1', 'paper-2', 'paper-3'].forEach((id) => {
      mockPrismaPapers.set(id, {
        id,
        arxivId: `2401.${id.split('-')[1].padStart(5, '0')}`,
        version: 1,
        title: `Paper ${id}`,
        authors: ['Author A', 'Author B'],
        abstract: 'Test abstract',
        categories: ['cs.AI'],
        primaryCategory: 'cs.AI',
        pdfUrl: 'https://arxiv.org/pdf/test',
        codeUrl: null,
        pubDate: new Date(),
        updatedDate: new Date(),
        rawMetadata: null,
        status: 'enriched',
        createdAt: new Date(),
        updatedAt: new Date(),
        enriched: {
          id: `enriched-${id}`,
          paperId: id,
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
          id: `score-${id}`,
          paperId: id,
          novelty: 0.7,
          evidence: 0.8,
          velocity: 0.5,
          personalFit: 0.7,
          labPrior: 0.5,
          mathPenalty: 0.1,
          finalScore: 0.75,
          whyShown: null,
          createdAt: new Date(),
        }],
      });
    });
  });

  describe('getLatest', () => {
    it('should return existing briefing for today', async () => {
      const caller = briefingsRouter.createCaller({
        user: { id: 'user-1', email: 'test@test.com' }
      } as any);

      // Create today's briefing
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const key = `user-1-${today.toISOString().split('T')[0]}`;

      mockPrismaBriefings.set(key, {
        id: 'briefing-1',
        userId: 'user-1',
        date: today,
        paperIds: ['paper-1', 'paper-2'],
        paperCount: 2,
        avgScore: 0.8,
        status: 'ready',
        generatedAt: new Date(),
        viewedAt: null,
      });

      const result = await caller.getLatest();

      expect(result.id).toBe('briefing-1');
      expect(result.paperCount).toBe(2);
      expect(result.papers).toHaveLength(2);
    });

    it('should generate new briefing if none exists', async () => {
      const caller = briefingsRouter.createCaller({
        user: { id: 'user-1', email: 'test@test.com' }
      } as any);

      const result = await caller.getLatest();

      expect(result.userId).toBe('user-1');
      expect(result.paperCount).toBe(3);
      expect(result.papers).toHaveLength(3);
    });

    it('should mark briefing as viewed', async () => {
      const caller = briefingsRouter.createCaller({
        user: { id: 'user-1', email: 'test@test.com' }
      } as any);

      // Create today's briefing (not viewed)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const key = `user-1-${today.toISOString().split('T')[0]}`;

      mockPrismaBriefings.set(key, {
        id: 'briefing-1',
        userId: 'user-1',
        date: today,
        paperIds: ['paper-1', 'paper-2'],
        paperCount: 2,
        avgScore: 0.8,
        status: 'ready',
        generatedAt: new Date(),
        viewedAt: null,
      });

      await caller.getLatest();

      // Verify update was called to mark as viewed
      const { prisma } = await import('@/server/db');
      expect(prisma.briefing.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'briefing-1' },
          data: expect.objectContaining({
            viewedAt: expect.any(Date),
            status: 'viewed',
          }),
        })
      );
    });

    it('should include papers with enrichment and scores', async () => {
      const caller = briefingsRouter.createCaller({
        user: { id: 'user-1', email: 'test@test.com' }
      } as any);

      // Create today's briefing
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const key = `user-1-${today.toISOString().split('T')[0]}`;

      mockPrismaBriefings.set(key, {
        id: 'briefing-1',
        userId: 'user-1',
        date: today,
        paperIds: ['paper-1'],
        paperCount: 1,
        avgScore: 0.75,
        status: 'ready',
        generatedAt: new Date(),
        viewedAt: null,
      });

      const result = await caller.getLatest();

      expect(result.papers[0]).toHaveProperty('enriched');
      expect(result.papers[0]).toHaveProperty('scores');
      expect(result.papers[0].enriched.topics).toContain('agents');
      expect(result.papers[0].scores[0].finalScore).toBe(0.75);
    });

    it('should include feedback data for papers', async () => {
      const caller = briefingsRouter.createCaller({
        user: { id: 'user-1', email: 'test@test.com' }
      } as any);

      // Create today's briefing
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const key = `user-1-${today.toISOString().split('T')[0]}`;

      mockPrismaBriefings.set(key, {
        id: 'briefing-1',
        userId: 'user-1',
        date: today,
        paperIds: ['paper-1', 'paper-2'],
        paperCount: 2,
        avgScore: 0.75,
        status: 'ready',
        generatedAt: new Date(),
        viewedAt: null,
      });

      // Add feedback to mock papers
      const paper1 = mockPrismaPapers.get('paper-1');
      const paper2 = mockPrismaPapers.get('paper-2');

      paper1.feedback = [{
        id: 'feedback-1',
        userId: 'user-1',
        paperId: 'paper-1',
        action: 'thumbs_up',
        weight: 1.0,
        context: null,
        createdAt: new Date(),
      }];

      paper2.feedback = [{
        id: 'feedback-2',
        userId: 'user-1',
        paperId: 'paper-2',
        action: 'save',
        weight: 1.0,
        context: null,
        createdAt: new Date(),
      }];

      const result = await caller.getLatest();

      // Verify feedback is included
      expect(result.papers[0]).toHaveProperty('feedback');
      expect(result.papers[1]).toHaveProperty('feedback');
      expect(result.papers[0].feedback).toHaveLength(1);
      expect(result.papers[0].feedback[0].action).toBe('thumbs_up');
      expect(result.papers[1].feedback[0].action).toBe('save');
    });

    it('should only include current user\'s feedback', async () => {
      const caller = briefingsRouter.createCaller({
        user: { id: 'user-1', email: 'test@test.com' }
      } as any);

      // Create today's briefing
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const key = `user-1-${today.toISOString().split('T')[0]}`;

      mockPrismaBriefings.set(key, {
        id: 'briefing-1',
        userId: 'user-1',
        date: today,
        paperIds: ['paper-1'],
        paperCount: 1,
        avgScore: 0.75,
        status: 'ready',
        generatedAt: new Date(),
        viewedAt: null,
      });

      // Add feedback from different users
      const paper1 = mockPrismaPapers.get('paper-1');
      paper1.feedback = [
        {
          id: 'feedback-1',
          userId: 'user-1',
          paperId: 'paper-1',
          action: 'thumbs_up',
          weight: 1.0,
          context: null,
          createdAt: new Date(),
        },
        {
          id: 'feedback-2',
          userId: 'user-2',
          paperId: 'paper-1',
          action: 'thumbs_down',
          weight: 1.0,
          context: null,
          createdAt: new Date(),
        },
      ];

      const result = await caller.getLatest();

      // Verify only user-1's feedback is included
      expect(result.papers[0].feedback).toHaveLength(1);
      expect(result.papers[0].feedback[0].userId).toBe('user-1');
      expect(result.papers[0].feedback[0].action).toBe('thumbs_up');
    });
  });

  describe('getByDate', () => {
    it('should return briefing for specific date', async () => {
      const caller = briefingsRouter.createCaller({
        user: { id: 'user-1', email: 'test@test.com' }
      } as any);

      // Create briefing for specific date
      const date = new Date('2025-01-15');
      const key = `user-1-${date.toISOString().split('T')[0]}`;

      mockPrismaBriefings.set(key, {
        id: 'briefing-old',
        userId: 'user-1',
        date,
        paperIds: ['paper-1', 'paper-2', 'paper-3'],
        paperCount: 3,
        avgScore: 0.7,
        status: 'viewed',
        generatedAt: new Date('2025-01-15T06:30:00Z'),
        viewedAt: new Date('2025-01-15T08:00:00Z'),
      });

      const result = await caller.getByDate({ date });

      expect(result.id).toBe('briefing-old');
      expect(result.paperCount).toBe(3);
      expect(result.papers).toHaveLength(3);
    });

    it('should throw error if briefing not found', async () => {
      const caller = briefingsRouter.createCaller({
        user: { id: 'user-1', email: 'test@test.com' }
      } as any);

      const date = new Date('2025-01-15');

      await expect(caller.getByDate({ date })).rejects.toThrow('No briefing found for this date');
    });
  });

  describe('list', () => {
    it('should return list of briefings ordered by date', async () => {
      const caller = briefingsRouter.createCaller({
        user: { id: 'user-1', email: 'test@test.com' }
      } as any);

      // Create multiple briefings
      const dates = [
        new Date('2025-01-15'),
        new Date('2025-01-16'),
        new Date('2025-01-17'),
      ];

      dates.forEach((date, i) => {
        const key = `user-1-${date.toISOString().split('T')[0]}`;
        mockPrismaBriefings.set(key, {
          id: `briefing-${i}`,
          userId: 'user-1',
          date,
          paperIds: ['paper-1'],
          paperCount: 1,
          avgScore: 0.75,
          status: 'viewed',
          generatedAt: new Date(date),
          viewedAt: new Date(date),
        });
      });

      const result = await caller.list({});

      expect(result.briefings).toHaveLength(3);
      expect(result.total).toBe(3);
      expect(result.hasMore).toBe(false);

      // Should be ordered newest first
      expect(new Date(result.briefings[0].date).getTime()).toBeGreaterThan(
        new Date(result.briefings[1].date).getTime()
      );
    });

    it('should support pagination', async () => {
      const caller = briefingsRouter.createCaller({
        user: { id: 'user-1', email: 'test@test.com' }
      } as any);

      // Create 10 briefings
      for (let i = 0; i < 10; i++) {
        const date = new Date('2025-01-01');
        date.setDate(date.getDate() + i);
        const key = `user-1-${date.toISOString().split('T')[0]}`;
        mockPrismaBriefings.set(key, {
          id: `briefing-${i}`,
          userId: 'user-1',
          date,
          paperIds: ['paper-1'],
          paperCount: 1,
          avgScore: 0.75,
          status: 'viewed',
          generatedAt: new Date(date),
          viewedAt: new Date(date),
        });
      }

      const result = await caller.list({ limit: 5, offset: 0 });

      expect(result.briefings).toHaveLength(5);
      expect(result.total).toBe(10);
      expect(result.hasMore).toBe(true);
    });

    it('should only return briefings for current user', async () => {
      const caller = briefingsRouter.createCaller({
        user: { id: 'user-1', email: 'test@test.com' }
      } as any);

      // Create briefings for different users
      const date = new Date('2025-01-15');

      mockPrismaBriefings.set(`user-1-${date.toISOString().split('T')[0]}`, {
        id: 'briefing-user-1',
        userId: 'user-1',
        date,
        paperIds: ['paper-1'],
        paperCount: 1,
        avgScore: 0.75,
        status: 'viewed',
        generatedAt: new Date(),
        viewedAt: new Date(),
      });

      mockPrismaBriefings.set(`user-2-${date.toISOString().split('T')[0]}`, {
        id: 'briefing-user-2',
        userId: 'user-2',
        date,
        paperIds: ['paper-1'],
        paperCount: 1,
        avgScore: 0.75,
        status: 'viewed',
        generatedAt: new Date(),
        viewedAt: new Date(),
      });

      const result = await caller.list({});

      expect(result.briefings).toHaveLength(1);
      expect(result.briefings[0].userId).toBe('user-1');
    });
  });

  describe('generateNow', () => {
    it('should generate new briefing on demand', async () => {
      const caller = briefingsRouter.createCaller({
        user: { id: 'user-1', email: 'test@test.com' }
      } as any);

      const result = await caller.generateNow();

      expect(result.userId).toBe('user-1');
      expect(result.paperCount).toBe(3);
      expect(result.status).toBe('ready');
    });

    it('should call generateDailyDigest with correct user ID', async () => {
      const caller = briefingsRouter.createCaller({
        user: { id: 'user-1', email: 'test@test.com' }
      } as any);

      await caller.generateNow();

      const { generateDailyDigest } = await import('@/server/agents/recommender');
      expect(generateDailyDigest).toHaveBeenCalledWith('user-1');
    });
  });
});
