/**
 * Bulk Summarization Tests
 *
 * Tests for parallel summary generation with concurrency control
 * Phase 4: Summaries
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/server/agents/summarizer', () => ({
  generateSummaryForPaper: vi.fn(),
}));

vi.mock('@/server/db', () => ({
  prisma: {
    briefing: {
      findUnique: vi.fn(),
    },
    paper: {
      findMany: vi.fn(),
    },
  },
}));

import { summarizeTopPapers } from '@/server/lib/bulk-summarize';
import { generateSummaryForPaper } from '@/server/agents/summarizer';
import { prisma } from '@/server/db';

describe('Bulk Summarization', () => {
  const mockBriefing = {
    id: 'briefing-123',
    userId: 'user-123',
    date: new Date(),
    paperIds: [
      'paper-1',
      'paper-2',
      'paper-3',
      'paper-4',
      'paper-5',
      'paper-6',
      'paper-7',
      'paper-8',
      'paper-9',
      'paper-10',
    ],
    paperCount: 10,
    avgScore: 0.75,
    status: 'ready',
    generatedAt: new Date(),
    viewedAt: null,
  };

  const mockPapers = mockBriefing.paperIds.map((id, index) => ({
    id,
    arxivId: `2401.${(index + 1).toString().padStart(5, '0')}`,
    version: 1,
    title: `Paper ${index + 1}`,
    authors: ['Author A'],
    abstract: `Abstract for paper ${index + 1}`,
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
  }));

  const mockSummaryResult = {
    whatsNew: 'Test summary',
    keyPoints: ['Point 1', 'Point 2'],
    markdownContent: '## Test',
    contentHash: 'hash123',
    generatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('summarizeTopPapers', () => {
    it('should summarize all papers in a briefing', async () => {
      vi.mocked(prisma.briefing.findUnique).mockResolvedValue(
        mockBriefing as any
      );
      vi.mocked(prisma.paper.findMany).mockResolvedValue(mockPapers as any);
      vi.mocked(generateSummaryForPaper).mockResolvedValue(mockSummaryResult);

      const result = await summarizeTopPapers('briefing-123');

      expect(prisma.briefing.findUnique).toHaveBeenCalledWith({
        where: { id: 'briefing-123' },
      });
      expect(prisma.paper.findMany).toHaveBeenCalledWith({
        where: { id: { in: mockBriefing.paperIds } },
      });
      expect(generateSummaryForPaper).toHaveBeenCalledTimes(10);
      expect(result).toMatchObject({
        total: 10,
        succeeded: 10,
        failed: 0,
        errors: [],
      });
    });

    it('should limit concurrency to 3 parallel requests', async () => {
      vi.mocked(prisma.briefing.findUnique).mockResolvedValue(
        mockBriefing as any
      );
      vi.mocked(prisma.paper.findMany).mockResolvedValue(mockPapers as any);

      let activeRequests = 0;
      let maxConcurrent = 0;

      vi.mocked(generateSummaryForPaper).mockImplementation(async () => {
        activeRequests++;
        maxConcurrent = Math.max(maxConcurrent, activeRequests);
        await new Promise((resolve) => setTimeout(resolve, 10));
        activeRequests--;
        return mockSummaryResult;
      });

      await summarizeTopPapers('briefing-123');

      expect(maxConcurrent).toBeLessThanOrEqual(3);
    });

    it('should handle individual paper failures gracefully', async () => {
      vi.mocked(prisma.briefing.findUnique).mockResolvedValue(
        mockBriefing as any
      );
      vi.mocked(prisma.paper.findMany).mockResolvedValue(mockPapers as any);

      vi.mocked(generateSummaryForPaper).mockImplementation(
        async (paperId) => {
          if (paperId === 'paper-3' || paperId === 'paper-7') {
            throw new Error(`Failed to summarize ${paperId}`);
          }
          return mockSummaryResult;
        }
      );

      const result = await summarizeTopPapers('briefing-123');

      expect(result).toMatchObject({
        total: 10,
        succeeded: 8,
        failed: 2,
      });
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toMatchObject({
        paperId: expect.stringMatching(/paper-(3|7)/),
        error: expect.stringContaining('Failed to summarize'),
      });
    });

    it('should throw error if briefing not found', async () => {
      vi.mocked(prisma.briefing.findUnique).mockResolvedValue(null);

      await expect(summarizeTopPapers('briefing-999')).rejects.toThrow(
        'Briefing not found'
      );
    });

    it('should handle empty briefing (no papers)', async () => {
      const emptyBriefing = { ...mockBriefing, paperIds: [], paperCount: 0 };
      vi.mocked(prisma.briefing.findUnique).mockResolvedValue(
        emptyBriefing as any
      );
      vi.mocked(prisma.paper.findMany).mockResolvedValue([]);

      const result = await summarizeTopPapers('briefing-123');

      expect(result).toMatchObject({
        total: 0,
        succeeded: 0,
        failed: 0,
        errors: [],
      });
      expect(generateSummaryForPaper).not.toHaveBeenCalled();
    });

    it('should track progress for large briefings', async () => {
      vi.mocked(prisma.briefing.findUnique).mockResolvedValue(
        mockBriefing as any
      );
      vi.mocked(prisma.paper.findMany).mockResolvedValue(mockPapers as any);
      vi.mocked(generateSummaryForPaper).mockResolvedValue(mockSummaryResult);

      const result = await summarizeTopPapers('briefing-123');

      expect(result.total).toBe(10);
      expect(result.succeeded + result.failed).toBe(result.total);
    });

    it('should handle all papers failing', async () => {
      vi.mocked(prisma.briefing.findUnique).mockResolvedValue(
        mockBriefing as any
      );
      vi.mocked(prisma.paper.findMany).mockResolvedValue(mockPapers as any);
      vi.mocked(generateSummaryForPaper).mockRejectedValue(
        new Error('LLM service down')
      );

      const result = await summarizeTopPapers('briefing-123');

      expect(result).toMatchObject({
        total: 10,
        succeeded: 0,
        failed: 10,
      });
      expect(result.errors).toHaveLength(10);
    });

    it('should return detailed error information', async () => {
      vi.mocked(prisma.briefing.findUnique).mockResolvedValue(
        mockBriefing as any
      );
      vi.mocked(prisma.paper.findMany).mockResolvedValue(mockPapers as any);

      vi.mocked(generateSummaryForPaper).mockImplementation(
        async (paperId) => {
          if (paperId === 'paper-5') {
            throw new Error('Rate limit exceeded');
          }
          return mockSummaryResult;
        }
      );

      const result = await summarizeTopPapers('briefing-123');

      const error = result.errors.find((e) => e.paperId === 'paper-5');
      expect(error).toBeDefined();
      expect(error?.error).toBe('Rate limit exceeded');
    });
  });
});
