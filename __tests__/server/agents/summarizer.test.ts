/**
 * Summarizer Agent Tests
 *
 * Tests for summary generation with content-hash based caching
 * Phase 4: Summaries
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'crypto';

// Mock dependencies
vi.mock('@/server/lib/llm', () => ({
  generateSummary: vi.fn(),
}));

vi.mock('@/server/db', () => ({
  prisma: {
    paper: {
      findUnique: vi.fn(),
    },
    summary: {
      findFirst: vi.fn(),
      create: vi.fn(),
      upsert: vi.fn(),
    },
    userProfile: {
      findUnique: vi.fn(),
    },
  },
}));

import { generateSummaryForPaper } from '@/server/agents/summarizer';
import { generateSummary } from '@/server/lib/llm';
import { prisma } from '@/server/db';

describe('Summarizer Agent', () => {
  const mockPaper = {
    id: 'paper-123',
    arxivId: '2401.00001',
    title: 'Attention Is All You Need',
    authors: ['Ashish Vaswani', 'Noam Shazeer'],
    abstract:
      'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks...',
    categories: ['cs.LG'],
    primaryCategory: 'cs.LG',
    pdfUrl: 'https://arxiv.org/pdf/2401.00001',
    codeUrl: null,
    pubDate: new Date('2024-01-01'),
    updatedDate: new Date('2024-01-01'),
    rawMetadata: {},
    status: 'enriched',
    version: 1,
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

  const mockLLMOutput = {
    whatsNew:
      'This paper introduces the Transformer architecture, a novel attention-based model for sequence transduction.',
    keyPoints: [
      'Replaces recurrence with self-attention mechanisms',
      'Achieves state-of-the-art results on machine translation',
      'Enables parallel training unlike RNNs',
    ],
  };

  const mockSummary = {
    id: 'summary-123',
    paperId: 'paper-123',
    summaryType: 'skim',
    whatsNew: mockLLMOutput.whatsNew,
    keyPoints: mockLLMOutput.keyPoints,
    markdownContent: `## What's New\n\n${mockLLMOutput.whatsNew}\n\n## Key Points\n\n${mockLLMOutput.keyPoints.map((p) => `- ${p}`).join('\n')}`,
    contentHash: createHash('sha256')
      .update(mockPaper.abstract)
      .digest('hex'),
    generatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Core Summary Generation', () => {
    it('should generate summary for a paper (cache miss)', async () => {
      vi.mocked(prisma.paper.findUnique).mockResolvedValue(mockPaper as any);
      vi.mocked(prisma.userProfile.findUnique).mockResolvedValue(
        mockUserProfile as any
      );
      vi.mocked(prisma.summary.findFirst).mockResolvedValue(null); // Cache miss
      vi.mocked(prisma.summary.upsert).mockResolvedValue(mockSummary as any);
      vi.mocked(generateSummary).mockResolvedValue(mockLLMOutput);

      const result = await generateSummaryForPaper('paper-123', 'user-123');

      expect(prisma.paper.findUnique).toHaveBeenCalledWith({
        where: { id: 'paper-123' },
      });
      expect(prisma.summary.findFirst).toHaveBeenCalled();
      expect(generateSummary).toHaveBeenCalledWith(
        {
          title: mockPaper.title,
          abstract: mockPaper.abstract,
          authors: mockPaper.authors,
        },
        'local' // useLocalLLM = true
      );
      expect(prisma.summary.upsert).toHaveBeenCalled();
      expect(result).toMatchObject({
        whatsNew: mockLLMOutput.whatsNew,
        keyPoints: mockLLMOutput.keyPoints,
      });
    });

    it('should use cloud LLM when user prefers it', async () => {
      const cloudProfile = { ...mockUserProfile, useLocalLLM: false };
      vi.mocked(prisma.paper.findUnique).mockResolvedValue(mockPaper as any);
      vi.mocked(prisma.userProfile.findUnique).mockResolvedValue(
        cloudProfile as any
      );
      vi.mocked(prisma.summary.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.summary.upsert).mockResolvedValue(mockSummary as any);
      vi.mocked(generateSummary).mockResolvedValue(mockLLMOutput);

      await generateSummaryForPaper('paper-123', 'user-123');

      expect(generateSummary).toHaveBeenCalledWith(
        expect.any(Object),
        'cloud' // useLocalLLM = false
      );
    });

    it('should generate markdown content from LLM output', async () => {
      vi.mocked(prisma.paper.findUnique).mockResolvedValue(mockPaper as any);
      vi.mocked(prisma.userProfile.findUnique).mockResolvedValue(
        mockUserProfile as any
      );
      vi.mocked(prisma.summary.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.summary.upsert).mockResolvedValue(mockSummary as any);
      vi.mocked(generateSummary).mockResolvedValue(mockLLMOutput);

      await generateSummaryForPaper('paper-123', 'user-123');

      const upsertCall = vi.mocked(prisma.summary.upsert).mock.calls[0][0];
      expect(upsertCall.create.markdownContent).toContain("## What's New");
      expect(upsertCall.create.markdownContent).toContain('## Key Points');
      expect(upsertCall.create.markdownContent).toContain(
        mockLLMOutput.keyPoints[0]
      );
    });

    it('should persist summary to database', async () => {
      vi.mocked(prisma.paper.findUnique).mockResolvedValue(mockPaper as any);
      vi.mocked(prisma.userProfile.findUnique).mockResolvedValue(
        mockUserProfile as any
      );
      vi.mocked(prisma.summary.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.summary.upsert).mockResolvedValue(mockSummary as any);
      vi.mocked(generateSummary).mockResolvedValue(mockLLMOutput);

      await generateSummaryForPaper('paper-123', 'user-123');

      expect(prisma.summary.upsert).toHaveBeenCalledWith({
        where: expect.any(Object),
        create: expect.objectContaining({
          paperId: 'paper-123',
          summaryType: 'skim',
          whatsNew: mockLLMOutput.whatsNew,
          keyPoints: mockLLMOutput.keyPoints,
          markdownContent: expect.stringContaining("What's New"),
          contentHash: expect.any(String),
        }),
        update: expect.any(Object),
      });
    });

    it('should handle paper not found error', async () => {
      vi.mocked(prisma.paper.findUnique).mockResolvedValue(null);

      await expect(
        generateSummaryForPaper('paper-999', 'user-123')
      ).rejects.toThrow('Paper not found');
    });

    it('should handle user profile not found error', async () => {
      vi.mocked(prisma.paper.findUnique).mockResolvedValue(mockPaper as any);
      vi.mocked(prisma.userProfile.findUnique).mockResolvedValue(null);

      await expect(
        generateSummaryForPaper('paper-123', 'user-123')
      ).rejects.toThrow('User profile not found');
    });

    it('should handle LLM generation errors', async () => {
      vi.mocked(prisma.paper.findUnique).mockResolvedValue(mockPaper as any);
      vi.mocked(prisma.userProfile.findUnique).mockResolvedValue(
        mockUserProfile as any
      );
      vi.mocked(prisma.summary.findFirst).mockResolvedValue(null);
      vi.mocked(generateSummary).mockRejectedValue(
        new Error('LLM service unavailable')
      );

      await expect(
        generateSummaryForPaper('paper-123', 'user-123')
      ).rejects.toThrow('LLM service unavailable');
    });

    it('should default to local LLM when profile has no preference', async () => {
      const profileWithoutPreference = { ...mockUserProfile, useLocalLLM: true };
      vi.mocked(prisma.paper.findUnique).mockResolvedValue(mockPaper as any);
      vi.mocked(prisma.userProfile.findUnique).mockResolvedValue(
        profileWithoutPreference as any
      );
      vi.mocked(prisma.summary.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.summary.upsert).mockResolvedValue(mockSummary as any);
      vi.mocked(generateSummary).mockResolvedValue(mockLLMOutput);

      await generateSummaryForPaper('paper-123', 'user-123');

      expect(generateSummary).toHaveBeenCalledWith(expect.any(Object), 'local');
    });

    it('should include all required fields in summary', async () => {
      vi.mocked(prisma.paper.findUnique).mockResolvedValue(mockPaper as any);
      vi.mocked(prisma.userProfile.findUnique).mockResolvedValue(
        mockUserProfile as any
      );
      vi.mocked(prisma.summary.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.summary.upsert).mockResolvedValue(mockSummary as any);
      vi.mocked(generateSummary).mockResolvedValue(mockLLMOutput);

      const result = await generateSummaryForPaper('paper-123', 'user-123');

      expect(result).toHaveProperty('whatsNew');
      expect(result).toHaveProperty('keyPoints');
      expect(result).toHaveProperty('markdownContent');
      expect(result.keyPoints).toBeInstanceOf(Array);
      expect(result.keyPoints.length).toBeGreaterThan(0);
    });

    it('should generate content hash from abstract', async () => {
      vi.mocked(prisma.paper.findUnique).mockResolvedValue(mockPaper as any);
      vi.mocked(prisma.userProfile.findUnique).mockResolvedValue(
        mockUserProfile as any
      );
      vi.mocked(prisma.summary.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.summary.upsert).mockResolvedValue(mockSummary as any);
      vi.mocked(generateSummary).mockResolvedValue(mockLLMOutput);

      await generateSummaryForPaper('paper-123', 'user-123');

      const upsertCall = vi.mocked(prisma.summary.upsert).mock.calls[0][0];
      const expectedHash = createHash('sha256')
        .update(mockPaper.abstract)
        .digest('hex');
      expect(upsertCall.create.contentHash).toBe(expectedHash);
    });

    it('should handle summaries with empty key points gracefully', async () => {
      const emptyKeyPointsOutput = {
        whatsNew: 'Test summary',
        keyPoints: [],
      };

      const summaryWithEmptyKeyPoints = {
        ...mockSummary,
        whatsNew: 'Test summary',
        keyPoints: [],
        markdownContent: `## What's New\n\nTest summary\n\n## Key Points\n\n`,
      };

      vi.mocked(prisma.paper.findUnique).mockResolvedValue(mockPaper as any);
      vi.mocked(prisma.userProfile.findUnique).mockResolvedValue(
        mockUserProfile as any
      );
      vi.mocked(prisma.summary.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.summary.upsert).mockResolvedValue(
        summaryWithEmptyKeyPoints as any
      );
      vi.mocked(generateSummary).mockResolvedValue(emptyKeyPointsOutput);

      const result = await generateSummaryForPaper('paper-123', 'user-123');

      expect(result.keyPoints).toEqual([]);
      expect(result.whatsNew).toBe('Test summary');
    });

    it('should handle very long abstracts', async () => {
      const longAbstract = 'A'.repeat(10000); // 10k character abstract
      const paperWithLongAbstract = { ...mockPaper, abstract: longAbstract };

      vi.mocked(prisma.paper.findUnique).mockResolvedValue(
        paperWithLongAbstract as any
      );
      vi.mocked(prisma.userProfile.findUnique).mockResolvedValue(
        mockUserProfile as any
      );
      vi.mocked(prisma.summary.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.summary.upsert).mockResolvedValue(mockSummary as any);
      vi.mocked(generateSummary).mockResolvedValue(mockLLMOutput);

      await generateSummaryForPaper('paper-123', 'user-123');

      // Should still call LLM with full abstract
      expect(generateSummary).toHaveBeenCalledWith(
        expect.objectContaining({
          abstract: longAbstract,
        }),
        'local'
      );
    });
  });

  describe('Content Hash Caching', () => {
    it('should return cached summary on cache hit', async () => {
      vi.mocked(prisma.paper.findUnique).mockResolvedValue(mockPaper as any);
      vi.mocked(prisma.userProfile.findUnique).mockResolvedValue(
        mockUserProfile as any
      );
      vi.mocked(prisma.summary.findFirst).mockResolvedValue(mockSummary as any); // Cache hit

      const result = await generateSummaryForPaper('paper-123', 'user-123');

      expect(prisma.summary.findFirst).toHaveBeenCalled();
      expect(generateSummary).not.toHaveBeenCalled(); // Should NOT call LLM
      expect(prisma.summary.upsert).not.toHaveBeenCalled(); // Should NOT create new
      expect(result).toMatchObject({
        whatsNew: mockSummary.whatsNew,
        keyPoints: mockSummary.keyPoints,
      });
    });

    it('should check cache using content hash', async () => {
      vi.mocked(prisma.paper.findUnique).mockResolvedValue(mockPaper as any);
      vi.mocked(prisma.userProfile.findUnique).mockResolvedValue(
        mockUserProfile as any
      );
      vi.mocked(prisma.summary.findFirst).mockResolvedValue(mockSummary as any);

      await generateSummaryForPaper('paper-123', 'user-123');

      const expectedHash = createHash('sha256')
        .update(mockPaper.abstract)
        .digest('hex');

      expect(prisma.summary.findFirst).toHaveBeenCalledWith({
        where: {
          paperId: 'paper-123',
          summaryType: 'skim',
          contentHash: expectedHash,
        },
      });
    });

    it('should generate new summary when abstract changes (cache miss)', async () => {
      const updatedPaper = {
        ...mockPaper,
        abstract: 'Updated abstract with new content',
      };

      vi.mocked(prisma.paper.findUnique).mockResolvedValue(updatedPaper as any);
      vi.mocked(prisma.userProfile.findUnique).mockResolvedValue(
        mockUserProfile as any
      );
      vi.mocked(prisma.summary.findFirst).mockResolvedValue(null); // Cache miss (hash mismatch)
      vi.mocked(prisma.summary.upsert).mockResolvedValue(mockSummary as any);
      vi.mocked(generateSummary).mockResolvedValue(mockLLMOutput);

      await generateSummaryForPaper('paper-123', 'user-123');

      expect(generateSummary).toHaveBeenCalled(); // Should call LLM
      expect(prisma.summary.upsert).toHaveBeenCalled(); // Should create new
    });

    it('should reuse cache across different users', async () => {
      // User 1 generates summary
      vi.mocked(prisma.paper.findUnique).mockResolvedValue(mockPaper as any);
      vi.mocked(prisma.userProfile.findUnique).mockResolvedValue(
        mockUserProfile as any
      );
      vi.mocked(prisma.summary.findFirst).mockResolvedValue(mockSummary as any);

      const result1 = await generateSummaryForPaper('paper-123', 'user-123');

      vi.clearAllMocks();

      // User 2 should get cached version
      vi.mocked(prisma.paper.findUnique).mockResolvedValue(mockPaper as any);
      vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
        ...mockUserProfile,
        userId: 'user-456',
      } as any);
      vi.mocked(prisma.summary.findFirst).mockResolvedValue(mockSummary as any);

      const result2 = await generateSummaryForPaper('paper-123', 'user-456');

      expect(result1).toEqual(result2);
      expect(generateSummary).not.toHaveBeenCalled(); // Both should use cache
    });

    it('should compute different hashes for different abstracts', async () => {
      const paper1 = { ...mockPaper, id: 'paper-1', abstract: 'Abstract 1' };
      const paper2 = { ...mockPaper, id: 'paper-2', abstract: 'Abstract 2' };

      const hash1 = createHash('sha256').update(paper1.abstract).digest('hex');
      const hash2 = createHash('sha256').update(paper2.abstract).digest('hex');

      expect(hash1).not.toBe(hash2);
    });

    it('should maintain cache hit even when LLM provider changes', async () => {
      // Summary generated with local LLM
      vi.mocked(prisma.paper.findUnique).mockResolvedValue(mockPaper as any);
      vi.mocked(prisma.userProfile.findUnique).mockResolvedValue(
        mockUserProfile as any
      );
      vi.mocked(prisma.summary.findFirst).mockResolvedValue(mockSummary as any);

      const result1 = await generateSummaryForPaper('paper-123', 'user-123');

      vi.clearAllMocks();

      // User switches to cloud LLM - should still get cached summary
      vi.mocked(prisma.paper.findUnique).mockResolvedValue(mockPaper as any);
      vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
        ...mockUserProfile,
        useLocalLLM: false,
      } as any);
      vi.mocked(prisma.summary.findFirst).mockResolvedValue(mockSummary as any);

      const result2 = await generateSummaryForPaper('paper-123', 'user-123');

      expect(result1).toEqual(result2);
      expect(generateSummary).not.toHaveBeenCalled(); // Should use cache
    });
  });
});
