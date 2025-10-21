/**
 * Analysis Router Tests (Mocked)
 *
 * Tests for analysis tRPC endpoints with mocked Prisma and pg-boss
 * Phase 5: Critical Analysis
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Analysis storage
const mockPrismaAnalyses = new Map<string, any>();
const mockPrismaPapers = new Map<string, any>();
const mockJobs = new Map<string, any>();

// Mock pg-boss (using factory function to avoid hoisting issues)
vi.mock('@/server/queue', () => {
  const mockJobsLocal = new Map<string, any>();

  return {
    boss: {
      send: vi.fn(async (queueName: string, data: any) => {
        const jobId = `job-${Date.now()}-${Math.random()}`;
        const job = {
          id: jobId,
          name: queueName,
          data,
          state: 'created',
          createdOn: new Date(),
        };
        mockJobsLocal.set(jobId, job);
        // Also store in outer map for test access
        mockJobs.set(jobId, job);
        return jobId;
      }),

      getJobById: vi.fn(async (queueName: string, jobId: string) => {
        return mockJobsLocal.get(jobId) || mockJobs.get(jobId) || null;
      }),
    },
  };
});

// Mock Prisma
vi.mock('@/server/db', () => ({
  prisma: {
    analysis: {
      findFirst: vi.fn(async ({ where }) => {
        const key = `${where.paperId}-${where.depth}`;
        return mockPrismaAnalyses.get(key);
      }),

      create: vi.fn(async ({ data }) => {
        const analysis = {
          id: `analysis-${Date.now()}`,
          ...data,
          generatedAt: new Date(),
        };
        const key = `${data.paperId}-${data.depth}`;
        mockPrismaAnalyses.set(key, analysis);
        return analysis;
      }),

      deleteMany: vi.fn(async ({ where }) => {
        const key = `${where.paperId}-${where.depth}`;
        mockPrismaAnalyses.delete(key);
        return { count: 1 };
      }),
    },

    paper: {
      findUnique: vi.fn(async ({ where }) => {
        return mockPrismaPapers.get(where.id);
      }),
    },
  },
}));

// Import after mocks
import { analysisRouter } from '@/server/routers/analysis';
import { boss } from '@/server/queue';

describe('Analysis Router', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
  };

  const mockPaper = {
    id: 'paper-123',
    arxivId: '2401.00001',
    version: 1,
    title: 'Test Paper on Transformers',
    authors: ['Author A', 'Author B'],
    abstract: 'Test abstract about transformers',
    categories: ['cs.AI'],
    primaryCategory: 'cs.AI',
    pdfUrl: 'https://arxiv.org/pdf/test.pdf',
    pubDate: new Date(),
    enriched: {
      embedding: [0.1, 0.2, 0.3],
    },
  };

  const mockAnalysis = {
    id: 'analysis-123',
    paperId: 'paper-123',
    userId: 'user-123',
    depth: 'A',
    claimsEvidence: '| Claim | Evidence | Assessment |\n| Test | Test | Supported |',
    limitations: ['Limitation 1', 'Limitation 2'],
    neighborComparison: null,
    verdict: 'Promising',
    confidence: 0.85,
    markdownContent: 'Mock markdown content',
    generatedAt: new Date(),
  };

  beforeEach(() => {
    mockPrismaAnalyses.clear();
    mockPrismaPapers.clear();
    mockJobs.clear();
    vi.clearAllMocks();
  });

  describe('requestAnalysis', () => {
    it('should return cached analysis if exists', async () => {
      mockPrismaPapers.set('paper-123', mockPaper);
      mockPrismaAnalyses.set('paper-123-A', mockAnalysis);

      const caller = analysisRouter.createCaller({ user: mockUser });
      const result = await caller.requestAnalysis({
        paperId: 'paper-123',
        depth: 'A',
      });

      expect(result.cached).toBe(true);
      expect(result.analysis).toEqual(mockAnalysis);
      expect(result.jobId).toBeUndefined();
      expect(boss.send).not.toHaveBeenCalled();
    });

    it('should enqueue job if analysis does not exist', async () => {
      mockPrismaPapers.set('paper-123', mockPaper);

      const caller = analysisRouter.createCaller({ user: mockUser });
      const result = await caller.requestAnalysis({
        paperId: 'paper-123',
        depth: 'B',
      });

      expect(result.cached).toBe(false);
      expect(result.jobId).toBeDefined();
      expect(result.analysis).toBeUndefined();
      expect(boss.send).toHaveBeenCalledWith('critique-paper', {
        paperId: 'paper-123',
        userId: 'user-123',
        depth: 'B',
      });
    });

    it('should reject invalid depth values', async () => {
      const caller = analysisRouter.createCaller({ user: mockUser });

      await expect(
        caller.requestAnalysis({
          paperId: 'paper-123',
          depth: 'D' as any,
        })
      ).rejects.toThrow();
    });

    it('should require authentication', async () => {
      const caller = analysisRouter.createCaller({ user: null as any });

      await expect(
        caller.requestAnalysis({
          paperId: 'paper-123',
          depth: 'A',
        })
      ).rejects.toThrow();
    });

    it('should validate paperId is not empty', async () => {
      const caller = analysisRouter.createCaller({ user: mockUser });

      await expect(
        caller.requestAnalysis({
          paperId: '',
          depth: 'A',
        })
      ).rejects.toThrow();
    });

    it('should handle all three depth levels', async () => {
      mockPrismaPapers.set('paper-123', mockPaper);

      const caller = analysisRouter.createCaller({ user: mockUser });

      for (const depth of ['A', 'B', 'C'] as const) {
        const result = await caller.requestAnalysis({
          paperId: 'paper-123',
          depth,
        });

        expect(result.cached).toBe(false);
        expect(result.jobId).toBeDefined();
        expect(boss.send).toHaveBeenCalledWith('critique-paper', {
          paperId: 'paper-123',
          userId: 'user-123',
          depth,
        });
      }
    });
  });

  describe('getAnalysis', () => {
    it('should return analysis if exists', async () => {
      mockPrismaAnalyses.set('paper-123-A', mockAnalysis);

      const caller = analysisRouter.createCaller({ user: mockUser });
      const result = await caller.getAnalysis({
        paperId: 'paper-123',
        depth: 'A',
      });

      expect(result).toEqual(mockAnalysis);
    });

    it('should return null if analysis does not exist', async () => {
      const caller = analysisRouter.createCaller({ user: mockUser });
      const result = await caller.getAnalysis({
        paperId: 'paper-123',
        depth: 'B',
      });

      expect(result).toBeFalsy(); // Can be null or undefined
    });

    it('should require authentication', async () => {
      const caller = analysisRouter.createCaller({ user: null as any });

      await expect(
        caller.getAnalysis({
          paperId: 'paper-123',
          depth: 'A',
        })
      ).rejects.toThrow();
    });

    it('should validate input parameters', async () => {
      const caller = analysisRouter.createCaller({ user: mockUser });

      await expect(
        caller.getAnalysis({
          paperId: '',
          depth: 'A',
        })
      ).rejects.toThrow();
    });
  });

  describe('getJobStatus', () => {
    it('should return job status for created job', async () => {
      const jobId = await boss.send('critique-paper', { test: 'data' });

      const caller = analysisRouter.createCaller({ user: mockUser });
      const result = await caller.getJobStatus({ jobId });

      expect(result).toBeDefined();
      expect(result?.state).toBe('created');
    });

    it('should return null for non-existent job', async () => {
      const caller = analysisRouter.createCaller({ user: mockUser });
      const result = await caller.getJobStatus({ jobId: 'non-existent-job' });

      expect(result).toBeNull();
    });

    it('should handle active job state', async () => {
      const jobId = await boss.send('critique-paper', { test: 'data' });
      const job = mockJobs.get(jobId);
      if (job) job.state = 'active';

      const caller = analysisRouter.createCaller({ user: mockUser });
      const result = await caller.getJobStatus({ jobId });

      expect(result?.state).toBe('active');
    });

    it('should handle completed job state', async () => {
      const jobId = await boss.send('critique-paper', { test: 'data' });
      const job = mockJobs.get(jobId);
      if (job) job.state = 'completed';

      const caller = analysisRouter.createCaller({ user: mockUser });
      const result = await caller.getJobStatus({ jobId });

      expect(result?.state).toBe('completed');
    });

    it('should handle failed job state', async () => {
      const jobId = await boss.send('critique-paper', { test: 'data' });
      const job = mockJobs.get(jobId);
      if (job) job.state = 'failed';

      const caller = analysisRouter.createCaller({ user: mockUser });
      const result = await caller.getJobStatus({ jobId });

      expect(result?.state).toBe('failed');
    });

    it('should require authentication', async () => {
      const caller = analysisRouter.createCaller({ user: null as any });

      await expect(
        caller.getJobStatus({ jobId: 'test-job' })
      ).rejects.toThrow();
    });
  });

  describe('regenerateAnalysis', () => {
    it('should delete existing analysis and enqueue new job', async () => {
      mockPrismaPapers.set('paper-123', mockPaper);
      mockPrismaAnalyses.set('paper-123-A', mockAnalysis);

      const caller = analysisRouter.createCaller({ user: mockUser });
      const result = await caller.regenerateAnalysis({
        paperId: 'paper-123',
        depth: 'A',
      });

      expect(result.jobId).toBeDefined();
      expect(mockPrismaAnalyses.has('paper-123-A')).toBe(false);
      expect(boss.send).toHaveBeenCalledWith('critique-paper', {
        paperId: 'paper-123',
        userId: 'user-123',
        depth: 'A',
      });
    });

    it('should work even if no existing analysis', async () => {
      mockPrismaPapers.set('paper-123', mockPaper);

      const caller = analysisRouter.createCaller({ user: mockUser });
      const result = await caller.regenerateAnalysis({
        paperId: 'paper-123',
        depth: 'B',
      });

      expect(result.jobId).toBeDefined();
      expect(boss.send).toHaveBeenCalled();
    });

    it('should require authentication', async () => {
      const caller = analysisRouter.createCaller({ user: null as any });

      await expect(
        caller.regenerateAnalysis({
          paperId: 'paper-123',
          depth: 'A',
        })
      ).rejects.toThrow();
    });

    it('should validate input parameters', async () => {
      const caller = analysisRouter.createCaller({ user: mockUser });

      await expect(
        caller.regenerateAnalysis({
          paperId: '',
          depth: 'A',
        })
      ).rejects.toThrow();
    });
  });
});
