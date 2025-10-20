/**
 * Summaries Router Tests (Mocked)
 *
 * Tests for summaries tRPC endpoints with mocked Prisma and Summarizer
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock Summaries storage
const mockPrismaSummaries = new Map<string, any>();
const mockPrismaPapers = new Map<string, any>();
const mockPrismaUserProfiles = new Map<string, any>();

// Mock Summarizer Agent
vi.mock('@/server/agents/summarizer', () => ({
  generateSummaryForPaper: vi.fn(async (paperId: string, userId: string) => {
    return {
      whatsNew: 'This paper introduces a novel approach to ML.',
      keyPoints: [
        'Novel architecture design',
        'Improved performance by 20%',
        'Open source implementation',
      ],
      markdownContent: `## What's New\n\nThis paper introduces a novel approach to ML.\n\n## Key Points\n\n- Novel architecture design\n- Improved performance by 20%\n- Open source implementation`,
      contentHash: 'abc123hash',
      generatedAt: new Date(),
    };
  }),
}));

// Mock Prisma
vi.mock('@/server/db', () => ({
  prisma: {
    summary: {
      findFirst: vi.fn(async ({ where }) => {
        const key = `${where.paperId}-${where.summaryType}`;
        return mockPrismaSummaries.get(key);
      }),

      delete: vi.fn(async ({ where }) => {
        const key = `${where.paperId}-${where.summaryType}`;
        mockPrismaSummaries.delete(key);
        return { count: 1 };
      }),

      create: vi.fn(async ({ data }) => {
        const summary = {
          id: `summary-${Date.now()}`,
          ...data,
          generatedAt: new Date(),
        };
        const key = `${data.paperId}-${data.summaryType}`;
        mockPrismaSummaries.set(key, summary);
        return summary;
      }),
    },

    paper: {
      findUnique: vi.fn(async ({ where }) => {
        return mockPrismaPapers.get(where.id);
      }),
    },

    userProfile: {
      findUnique: vi.fn(async ({ where }) => {
        return mockPrismaUserProfiles.get(where.userId);
      }),
    },
  },
}));

// Import after mocks
import { summariesRouter } from '@/server/routers/summaries';
import { generateSummaryForPaper } from '@/server/agents/summarizer';

describe('Summaries Router', () => {
  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
  };

  const mockPaper = {
    id: 'paper-123',
    arxivId: '2401.00001',
    version: 1,
    title: 'Test Paper',
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
  };

  const mockUserProfile = {
    id: 'profile-123',
    userId: 'user-123',
    useLocalLLM: true,
    preferredLLM: 'gemini-2.0-flash',
    interestVector: [],
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
    sourcesEnabled: {},
    useLocalEmbeddings: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    // Clear storage
    mockPrismaSummaries.clear();
    mockPrismaPapers.clear();
    mockPrismaUserProfiles.clear();

    // Clear mocks
    vi.clearAllMocks();

    // Setup default mocks
    mockPrismaPapers.set('paper-123', mockPaper);
    mockPrismaUserProfiles.set('user-123', mockUserProfile);
  });

  describe('getSummary', () => {
    it('should return existing summary if found', async () => {
      const mockSummary = {
        id: 'summary-123',
        paperId: 'paper-123',
        summaryType: 'skim',
        whatsNew: 'Existing summary',
        keyPoints: ['Point 1', 'Point 2'],
        markdownContent: '## Existing',
        contentHash: 'hash123',
        generatedAt: new Date(),
      };
      mockPrismaSummaries.set('paper-123-skim', mockSummary);

      const caller = summariesRouter.createCaller({ user: mockUser });
      const result = await caller.getSummary({ paperId: 'paper-123' });

      expect(result).toMatchObject({
        whatsNew: 'Existing summary',
        keyPoints: ['Point 1', 'Point 2'],
      });
      expect(generateSummaryForPaper).not.toHaveBeenCalled();
    });

    it('should generate new summary if not found', async () => {
      const caller = summariesRouter.createCaller({ user: mockUser });
      const result = await caller.getSummary({ paperId: 'paper-123' });

      expect(generateSummaryForPaper).toHaveBeenCalledWith(
        'paper-123',
        'user-123'
      );
      expect(result).toMatchObject({
        whatsNew: 'This paper introduces a novel approach to ML.',
        keyPoints: expect.arrayContaining(['Novel architecture design']),
      });
    });

    it('should require authentication', async () => {
      const caller = summariesRouter.createCaller({ user: null });

      await expect(caller.getSummary({ paperId: 'paper-123' })).rejects.toThrow(
        'Must be logged in'
      );
    });

    it('should validate paperId input', async () => {
      const caller = summariesRouter.createCaller({ user: mockUser });

      await expect(caller.getSummary({ paperId: '' })).rejects.toThrow();
    });

    it('should handle errors from summarizer gracefully', async () => {
      vi.mocked(generateSummaryForPaper).mockRejectedValue(
        new Error('LLM service unavailable')
      );

      const caller = summariesRouter.createCaller({ user: mockUser });

      await expect(
        caller.getSummary({ paperId: 'paper-123' })
      ).rejects.toThrow('LLM service unavailable');
    });
  });

  describe('regenerateSummary', () => {
    beforeEach(() => {
      // Reset the mock to return the default value
      vi.mocked(generateSummaryForPaper).mockResolvedValue({
        whatsNew: 'This paper introduces a novel approach to ML.',
        keyPoints: [
          'Novel architecture design',
          'Improved performance by 20%',
          'Open source implementation',
        ],
        markdownContent: `## What's New\n\nThis paper introduces a novel approach to ML.\n\n## Key Points\n\n- Novel architecture design\n- Improved performance by 20%\n- Open source implementation`,
        contentHash: 'abc123hash',
        generatedAt: new Date(),
      });
    });

    it('should delete existing summary and generate new one', async () => {
      const oldSummary = {
        id: 'summary-old',
        paperId: 'paper-123',
        summaryType: 'skim',
        whatsNew: 'Old summary',
        keyPoints: ['Old point'],
        markdownContent: '## Old',
        contentHash: 'oldhash',
        generatedAt: new Date(Date.now() - 86400000), // 1 day ago
      };
      mockPrismaSummaries.set('paper-123-skim', oldSummary);

      const caller = summariesRouter.createCaller({ user: mockUser });
      const result = await caller.regenerateSummary({ paperId: 'paper-123' });

      expect(result).toMatchObject({
        whatsNew: 'This paper introduces a novel approach to ML.',
        keyPoints: expect.arrayContaining(['Novel architecture design']),
      });
      expect(generateSummaryForPaper).toHaveBeenCalledWith(
        'paper-123',
        'user-123'
      );
    });

    it('should generate summary even if none existed before', async () => {
      const caller = summariesRouter.createCaller({ user: mockUser });
      const result = await caller.regenerateSummary({ paperId: 'paper-123' });

      expect(generateSummaryForPaper).toHaveBeenCalledWith(
        'paper-123',
        'user-123'
      );
      expect(result).toMatchObject({
        whatsNew: expect.any(String),
        keyPoints: expect.any(Array),
      });
    });

    it('should require authentication', async () => {
      const caller = summariesRouter.createCaller({ user: null });

      await expect(
        caller.regenerateSummary({ paperId: 'paper-123' })
      ).rejects.toThrow('Must be logged in');
    });
  });
});
