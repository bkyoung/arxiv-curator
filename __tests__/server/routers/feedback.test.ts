/**
 * Feedback Router Tests
 *
 * Tests for feedback tRPC endpoints with auth protection
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TRPCError } from '@trpc/server';

// Mock Prisma
const mockPrismaFeedback = new Map<string, any>();
const mockPrismaPapers = new Map<string, any>();

vi.mock('@/server/db', () => ({
  prisma: {
    userFeedback: {
      create: vi.fn(async ({ data }) => {
        const feedback = {
          id: `feedback-${mockPrismaFeedback.size + 1}`,
          createdAt: new Date(),
          ...data,
        };
        mockPrismaFeedback.set(feedback.id, feedback);
        return feedback;
      }),
      findMany: vi.fn(async ({ where, orderBy, take }) => {
        let feedback = Array.from(mockPrismaFeedback.values());

        if (where?.userId) {
          feedback = feedback.filter((f) => f.userId === where.userId);
        }
        if (where?.action) {
          feedback = feedback.filter((f) => f.action === where.action);
        }

        if (orderBy?.createdAt === 'desc') {
          feedback.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }

        if (take) {
          feedback = feedback.slice(0, take);
        }

        return feedback;
      }),
    },

    paper: {
      findUnique: vi.fn(async ({ where }) => {
        return mockPrismaPapers.get(where.id) || null;
      }),
    },
  },
}));

// Mock feedback functions
vi.mock('@/server/lib/feedback', () => ({
  recordFeedback: vi.fn(async ({ userId, paperId, action }) => {
    return {
      id: `feedback-${mockPrismaFeedback.size + 1}`,
      userId,
      paperId,
      action,
      createdAt: new Date(),
    };
  }),
  updateUserVectorFromFeedback: vi.fn(async () => {}),
  getFeedbackHistory: vi.fn(async ({ userId, action, limit }) => {
    let feedback = Array.from(mockPrismaFeedback.values()).filter(
      (f) => f.userId === userId
    );

    if (action) {
      feedback = feedback.filter((f) => f.action === action);
    }

    if (limit) {
      feedback = feedback.slice(0, limit);
    }

    return feedback;
  }),
}));

import { feedbackRouter } from '@/server/routers/feedback';

describe('Feedback Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrismaFeedback.clear();
    mockPrismaPapers.clear();
  });

  describe('Authentication', () => {
    it('should require authentication for save mutation', async () => {
      const caller = feedbackRouter.createCaller({
        req: {},
        res: {},
        user: null,
      } as any);

      await expect(
        caller.save({ paperId: 'paper-1' })
      ).rejects.toThrow('Authentication required');
    });

    it('should require authentication for dismiss mutation', async () => {
      const caller = feedbackRouter.createCaller({
        req: {},
        res: {},
        user: null,
      } as any);

      await expect(
        caller.dismiss({ paperId: 'paper-1' })
      ).rejects.toThrow('Authentication required');
    });

    it('should require authentication for thumbsUp mutation', async () => {
      const caller = feedbackRouter.createCaller({
        req: {},
        res: {},
        user: null,
      } as any);

      await expect(
        caller.thumbsUp({ paperId: 'paper-1' })
      ).rejects.toThrow('Authentication required');
    });

    it('should require authentication for thumbsDown mutation', async () => {
      const caller = feedbackRouter.createCaller({
        req: {},
        res: {},
        user: null,
      } as any);

      await expect(
        caller.thumbsDown({ paperId: 'paper-1' })
      ).rejects.toThrow('Authentication required');
    });

    it('should require authentication for hide mutation', async () => {
      const caller = feedbackRouter.createCaller({
        req: {},
        res: {},
        user: null,
      } as any);

      await expect(
        caller.hide({ paperId: 'paper-1' })
      ).rejects.toThrow('Authentication required');
    });

    it('should require authentication for getHistory query', async () => {
      const caller = feedbackRouter.createCaller({
        req: {},
        res: {},
        user: null,
      } as any);

      await expect(
        caller.getHistory({})
      ).rejects.toThrow('Authentication required');
    });
  });

  describe('save mutation', () => {
    it('should record save feedback for authenticated user', async () => {
      const caller = feedbackRouter.createCaller({
        req: {},
        res: {},
        user: { id: 'user-1', email: 'test@test.com' },
      } as any);

      const result = await caller.save({ paperId: 'paper-1' });

      expect(result.userId).toBe('user-1');
      expect(result.paperId).toBe('paper-1');
      expect(result.action).toBe('save');
    });
  });

  describe('dismiss mutation', () => {
    it('should record dismiss feedback for authenticated user', async () => {
      const caller = feedbackRouter.createCaller({
        req: {},
        res: {},
        user: { id: 'user-1', email: 'test@test.com' },
      } as any);

      const result = await caller.dismiss({ paperId: 'paper-1' });

      expect(result.userId).toBe('user-1');
      expect(result.paperId).toBe('paper-1');
      expect(result.action).toBe('dismiss');
    });
  });

  describe('thumbsUp mutation', () => {
    it('should record thumbs up feedback for authenticated user', async () => {
      const caller = feedbackRouter.createCaller({
        req: {},
        res: {},
        user: { id: 'user-1', email: 'test@test.com' },
      } as any);

      const result = await caller.thumbsUp({ paperId: 'paper-1' });

      expect(result.userId).toBe('user-1');
      expect(result.paperId).toBe('paper-1');
      expect(result.action).toBe('thumbs_up');
    });
  });

  describe('thumbsDown mutation', () => {
    it('should record thumbs down feedback for authenticated user', async () => {
      const caller = feedbackRouter.createCaller({
        req: {},
        res: {},
        user: { id: 'user-1', email: 'test@test.com' },
      } as any);

      const result = await caller.thumbsDown({ paperId: 'paper-1' });

      expect(result.userId).toBe('user-1');
      expect(result.paperId).toBe('paper-1');
      expect(result.action).toBe('thumbs_down');
    });
  });

  describe('hide mutation', () => {
    it('should record hide feedback for authenticated user', async () => {
      const caller = feedbackRouter.createCaller({
        req: {},
        res: {},
        user: { id: 'user-1', email: 'test@test.com' },
      } as any);

      const result = await caller.hide({ paperId: 'paper-1' });

      expect(result.userId).toBe('user-1');
      expect(result.paperId).toBe('paper-1');
      expect(result.action).toBe('hide');
    });
  });

  describe('getHistory query', () => {
    beforeEach(() => {
      // Add some test feedback
      mockPrismaFeedback.set('feedback-1', {
        id: 'feedback-1',
        userId: 'user-1',
        paperId: 'paper-1',
        action: 'save',
        createdAt: new Date('2025-01-01'),
      });

      mockPrismaFeedback.set('feedback-2', {
        id: 'feedback-2',
        userId: 'user-1',
        paperId: 'paper-2',
        action: 'thumbs_up',
        createdAt: new Date('2025-01-02'),
      });

      mockPrismaFeedback.set('feedback-3', {
        id: 'feedback-3',
        userId: 'user-2',
        paperId: 'paper-3',
        action: 'save',
        createdAt: new Date('2025-01-03'),
      });
    });

    it('should return feedback history for authenticated user', async () => {
      const caller = feedbackRouter.createCaller({
        req: {},
        res: {},
        user: { id: 'user-1', email: 'test@test.com' },
      } as any);

      const result = await caller.getHistory({});

      expect(result).toHaveLength(2);
      expect(result.every((f) => f.userId === 'user-1')).toBe(true);
    });

    it('should filter by action when specified', async () => {
      const caller = feedbackRouter.createCaller({
        req: {},
        res: {},
        user: { id: 'user-1', email: 'test@test.com' },
      } as any);

      const result = await caller.getHistory({ action: 'save' });

      expect(result).toHaveLength(1);
      expect(result[0].action).toBe('save');
    });

    it('should limit results when specified', async () => {
      const caller = feedbackRouter.createCaller({
        req: {},
        res: {},
        user: { id: 'user-1', email: 'test@test.com' },
      } as any);

      const result = await caller.getHistory({ limit: 1 });

      expect(result).toHaveLength(1);
    });
  });
});
