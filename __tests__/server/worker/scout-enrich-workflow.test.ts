/**
 * Scout-Enrich Workflow Tests (Mocked)
 *
 * Tests the LangGraph.js workflow that orchestrates Scout and Enricher agents
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { scoutEnrichWorkflow } from '@/worker/workflows/scout-enrich';

// Mock the agents
vi.mock('@/server/agents/scout', () => ({
  ingestRecentPapers: vi.fn(),
}));

vi.mock('@/server/agents/enricher', () => ({
  enrichPaper: vi.fn(),
}));

vi.mock('@/server/agents/ranker', () => ({
  scoreUnrankedPapers: vi.fn(),
}));

// Mock Prisma
const mockPrismaPapers = new Map<string, any>();

vi.mock('@/server/db', () => ({
  prisma: {
    paper: {
      findUnique: vi.fn(async ({ where }) => {
        if (where.id) {
          return mockPrismaPapers.get(where.id) || null;
        }
        return null;
      }),
    },
    userProfile: {
      findFirst: vi.fn(async () => ({
        id: 'profile-1',
        userId: 'user-1',
        includeTopics: [],
        excludeTopics: [],
        includeKeywords: [],
        excludeKeywords: [],
        mathDepthMax: 0.5,
        explorationRate: 0.15,
        interestVector: Array(384).fill(0),
      })),
    },
  },
}));

import { ingestRecentPapers } from '@/server/agents/scout';
import { enrichPaper } from '@/server/agents/enricher';
import { scoreUnrankedPapers } from '@/server/agents/ranker';

describe('Scout-Enrich Workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrismaPapers.clear();
  });

  it('should execute scout node and return paper IDs', async () => {
    const mockPaperIds = ['paper-1', 'paper-2', 'paper-3'];
    (ingestRecentPapers as any).mockResolvedValue(mockPaperIds);
    (scoreUnrankedPapers as any).mockResolvedValue([]);

    const result = await scoutEnrichWorkflow(['cs.AI'], 10);

    expect(ingestRecentPapers).toHaveBeenCalledWith(['cs.AI'], 10);
    expect(result).toEqual({
      categories: ['cs.AI'],
      maxResults: 10,
      paperIds: mockPaperIds,
      enrichedCount: 0,
      rankedCount: 0,
    });
  });

  it('should execute full workflow: scout then enrich then rank', async () => {
    const mockPaperIds = ['paper-1', 'paper-2'];
    (ingestRecentPapers as any).mockResolvedValue(mockPaperIds);

    // Setup mock papers in database
    mockPrismaPapers.set('paper-1', {
      id: 'paper-1',
      arxivId: '2401.00001',
      status: 'new',
      title: 'Test Paper 1',
      abstract: 'Test abstract 1',
    });
    mockPrismaPapers.set('paper-2', {
      id: 'paper-2',
      arxivId: '2401.00002',
      status: 'new',
      title: 'Test Paper 2',
      abstract: 'Test abstract 2',
    });

    (enrichPaper as any).mockResolvedValue({
      paperId: 'paper-1',
      topics: ['agents'],
      facets: ['planning'],
    });

    (scoreUnrankedPapers as any).mockResolvedValue([
      { id: 'score-1', paperId: 'paper-1', finalScore: 0.8 },
      { id: 'score-2', paperId: 'paper-2', finalScore: 0.7 },
    ]);

    const result = await scoutEnrichWorkflow(['cs.AI', 'cs.LG'], 20);

    // Verify scout was called
    expect(ingestRecentPapers).toHaveBeenCalledWith(['cs.AI', 'cs.LG'], 20);

    // Verify enrich was called for each paper
    expect(enrichPaper).toHaveBeenCalledTimes(2);

    // Verify ranker was called
    expect(scoreUnrankedPapers).toHaveBeenCalledWith(
      expect.objectContaining({
        userProfile: expect.objectContaining({
          id: 'profile-1',
        }),
      })
    );

    // Verify result
    expect(result.paperIds).toEqual(mockPaperIds);
    expect(result.enrichedCount).toBe(2);
    expect(result.rankedCount).toBe(2);
  });

  it('should skip papers that are not in "new" status', async () => {
    const mockPaperIds = ['paper-1', 'paper-2', 'paper-3'];
    (ingestRecentPapers as any).mockResolvedValue(mockPaperIds);

    // Setup mock papers: one new, one enriched, one new
    mockPrismaPapers.set('paper-1', {
      id: 'paper-1',
      arxivId: '2401.00001',
      status: 'new',
      title: 'Test Paper 1',
      abstract: 'Test abstract 1',
    });
    mockPrismaPapers.set('paper-2', {
      id: 'paper-2',
      arxivId: '2401.00002',
      status: 'enriched', // Already enriched
      title: 'Test Paper 2',
      abstract: 'Test abstract 2',
    });
    mockPrismaPapers.set('paper-3', {
      id: 'paper-3',
      arxivId: '2401.00003',
      status: 'new',
      title: 'Test Paper 3',
      abstract: 'Test abstract 3',
    });

    (enrichPaper as any).mockResolvedValue({});
    (scoreUnrankedPapers as any).mockResolvedValue([
      { id: 'score-1', paperId: 'paper-1', finalScore: 0.8 },
      { id: 'score-3', paperId: 'paper-3', finalScore: 0.7 },
    ]);

    const result = await scoutEnrichWorkflow(['cs.AI'], 10);

    // Verify enrich was only called for papers with status="new"
    expect(enrichPaper).toHaveBeenCalledTimes(2);
    expect(result.enrichedCount).toBe(2);
    expect(result.rankedCount).toBe(2);
  });

  it('should handle empty paper list from scout', async () => {
    (ingestRecentPapers as any).mockResolvedValue([]);
    (scoreUnrankedPapers as any).mockResolvedValue([]);

    const result = await scoutEnrichWorkflow(['cs.AI'], 10);

    expect(ingestRecentPapers).toHaveBeenCalledWith(['cs.AI'], 10);
    expect(enrichPaper).not.toHaveBeenCalled();
    expect(result.paperIds).toEqual([]);
    expect(result.enrichedCount).toBe(0);
    expect(result.rankedCount).toBe(0);
  });

  it('should handle papers not found in database', async () => {
    const mockPaperIds = ['paper-1', 'paper-2', 'paper-3'];
    (ingestRecentPapers as any).mockResolvedValue(mockPaperIds);

    // Only add paper-1 to mock database
    mockPrismaPapers.set('paper-1', {
      id: 'paper-1',
      arxivId: '2401.00001',
      status: 'new',
      title: 'Test Paper 1',
      abstract: 'Test abstract 1',
    });

    (enrichPaper as any).mockResolvedValue({});
    (scoreUnrankedPapers as any).mockResolvedValue([
      { id: 'score-1', paperId: 'paper-1', finalScore: 0.8 },
    ]);

    const result = await scoutEnrichWorkflow(['cs.AI'], 10);

    // Should only enrich the one paper that was found
    expect(enrichPaper).toHaveBeenCalledTimes(1);
    expect(result.enrichedCount).toBe(1);
    expect(result.rankedCount).toBe(1);
  });

  it('should handle enrichment errors gracefully', async () => {
    const mockPaperIds = ['paper-1', 'paper-2'];
    (ingestRecentPapers as any).mockResolvedValue(mockPaperIds);

    mockPrismaPapers.set('paper-1', {
      id: 'paper-1',
      arxivId: '2401.00001',
      status: 'new',
      title: 'Test Paper 1',
      abstract: 'Test abstract 1',
    });
    mockPrismaPapers.set('paper-2', {
      id: 'paper-2',
      arxivId: '2401.00002',
      status: 'new',
      title: 'Test Paper 2',
      abstract: 'Test abstract 2',
    });

    // First enrichment fails, second succeeds
    (enrichPaper as any)
      .mockRejectedValueOnce(new Error('Enrichment failed'))
      .mockResolvedValueOnce({});

    (scoreUnrankedPapers as any).mockResolvedValue([
      { id: 'score-2', paperId: 'paper-2', finalScore: 0.7 },
    ]);

    const result = await scoutEnrichWorkflow(['cs.AI'], 10);

    // Should continue processing despite error
    expect(enrichPaper).toHaveBeenCalledTimes(2);
    expect(result.paperIds).toEqual(mockPaperIds);
    // Only one successful enrichment
    expect(result.enrichedCount).toBe(1);
    // Only one paper ranked (the one that was successfully enriched)
    expect(result.rankedCount).toBe(1);
  });
});
