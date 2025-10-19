/**
 * Scout Agent Tests (Properly Mocked)
 *
 * All external services (fetch, Prisma) are mocked with realistic data
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fetchArxivCategories, ingestRecentPapers } from '@/server/agents/scout';
import {
  mockOAIPMHCategoriesResponse,
  mockAtomFeedResponse,
  mockAtomFeedMultipleEntries,
} from '../../mocks/arxiv-responses';

// Mock fetch
global.fetch = vi.fn();

// Mock Prisma
const mockPrismaCategories = new Map<string, any>();
const mockPrismaPapers = new Map<string, any>();

vi.mock('@/server/db', () => ({
  prisma: {
    arxivCategory: {
      upsert: vi.fn(async ({ where, create, update }) => {
        const existing = mockPrismaCategories.get(where.id);
        if (existing) {
          const updated = { ...existing, ...update };
          mockPrismaCategories.set(where.id, updated);
          return updated;
        } else {
          mockPrismaCategories.set(create.id, create);
          return create;
        }
      }),
    },
    paper: {
      findUnique: vi.fn(async ({ where }) => {
        if (where.arxivId) {
          return Array.from(mockPrismaPapers.values()).find(
            (p) => p.arxivId === where.arxivId
          ) || null;
        }
        return null;
      }),
      upsert: vi.fn(async ({ where, create, update }) => {
        const existing = Array.from(mockPrismaPapers.values()).find(
          (p) => p.arxivId === where.arxivId
        );

        if (existing) {
          const updated = {
            ...existing,
            ...update,
            updatedAt: new Date(),
          };
          mockPrismaPapers.set(existing.id, updated);
          return updated;
        } else {
          const paper = {
            id: `mock-paper-${mockPrismaPapers.size + 1}`,
            createdAt: new Date(),
            updatedAt: new Date(),
            ...create,
          };
          mockPrismaPapers.set(paper.id, paper);
          return paper;
        }
      }),
    },
  },
}));

describe('Scout Agent (Mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrismaCategories.clear();
    mockPrismaPapers.clear();
  });

  describe('fetchArxivCategories', () => {
    it('should fetch and parse arXiv categories', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => mockOAIPMHCategoriesResponse,
      });

      const categories = await fetchArxivCategories();

      // Should only return cs.* categories (4 out of 5 in mock data)
      expect(categories.length).toBe(4);
      expect(categories[0]).toEqual({
        id: 'cs',
        name: 'Computer Science',
        description: '',
      });
      expect(categories[1].id).toBe('cs.AI');
      expect(categories[2].id).toBe('cs.CL');
      expect(categories[3].id).toBe('cs.LG');

      // Verify categories were stored in "database"
      expect(mockPrismaCategories.size).toBe(4);
      expect(mockPrismaCategories.get('cs.AI')).toEqual({
        id: 'cs.AI',
        name: 'Artificial Intelligence',
        description: '',
      });
    });
  });

  describe('ingestRecentPapers', () => {
    it('should fetch and parse recent papers from Atom feed', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => mockAtomFeedResponse,
      });

      const paperIds = await ingestRecentPapers(['cs.AI'], 1);

      expect(paperIds.length).toBe(1);

      // Verify paper was stored
      const papers = Array.from(mockPrismaPapers.values());
      expect(papers.length).toBe(1);

      const paper = papers[0];
      expect(paper.arxivId).toBe('2401.12345');
      expect(paper.version).toBe(1);
      expect(paper.title).toBe('Language Agents for Planning and Tool Use');
      expect(paper.authors).toEqual(['Alice Smith', 'Bob Johnson']);
      expect(paper.categories).toEqual(['cs.AI', 'cs.LG']);
      expect(paper.status).toBe('new');
    });

    it('should handle paper version updates', async () => {
      // First, create v1 in mock database
      const v1Paper = {
        id: 'paper-v1',
        arxivId: '2401.99999',
        version: 1,
        title: 'Original Title',
        authors: ['John Doe'],
        abstract: 'Original abstract',
        categories: ['cs.AI'],
        primaryCategory: 'cs.AI',
        status: 'enriched',
        pubDate: new Date('2024-01-15'),
        updatedDate: new Date('2024-01-15'),
        rawMetadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrismaPapers.set(v1Paper.id, v1Paper);

      // Now ingest v2
      const mockAtomV2 = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2401.99999v2</id>
    <updated>2024-01-16T10:00:00Z</updated>
    <published>2024-01-15T10:00:00Z</published>
    <title>Updated Title</title>
    <summary>Updated abstract with improvements.</summary>
    <author><name>John Doe</name></author>
    <category term="cs.AI" scheme="http://arxiv.org/schemas/atom"/>
    <link title="pdf" href="http://arxiv.org/pdf/2401.99999v2" rel="related" type="application/pdf"/>
  </entry>
</feed>`;

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => mockAtomV2,
      });

      await ingestRecentPapers(['cs.AI'], 1);

      // Verify paper was updated to v2
      const papers = Array.from(mockPrismaPapers.values());
      const paper = papers.find((p) => p.arxivId === '2401.99999');

      expect(paper.version).toBe(2);
      expect(paper.title).toBe('Updated Title');
      expect(paper.status).toBe('new'); // Status reset for re-enrichment
    });

    it('should skip older versions', async () => {
      // Create v2 in mock database
      const v2Paper = {
        id: 'paper-v2',
        arxivId: '2401.88888',
        version: 2,
        title: 'Version 2',
        authors: ['John Doe'],
        abstract: 'Version 2 abstract',
        categories: ['cs.AI'],
        primaryCategory: 'cs.AI',
        status: 'enriched',
        pubDate: new Date('2024-01-15'),
        updatedDate: new Date('2024-01-16'),
        rawMetadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrismaPapers.set(v2Paper.id, v2Paper);

      // Try to ingest v1 (older)
      const mockAtomV1 = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2401.88888v1</id>
    <updated>2024-01-15T10:00:00Z</updated>
    <published>2024-01-15T10:00:00Z</published>
    <title>Version 1</title>
    <summary>Version 1 abstract</summary>
    <author><name>John Doe</name></author>
    <category term="cs.AI" scheme="http://arxiv.org/schemas/atom"/>
    <link title="pdf" href="http://arxiv.org/pdf/2401.88888v1" rel="related" type="application/pdf"/>
  </entry>
</feed>`;

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => mockAtomV1,
      });

      const paperIds = await ingestRecentPapers(['cs.AI'], 1);

      // Should return empty since v1 is older than v2
      expect(paperIds.length).toBe(0);

      // Verify v2 is unchanged
      const papers = Array.from(mockPrismaPapers.values());
      const paper = papers.find((p) => p.arxivId === '2401.88888');
      expect(paper.version).toBe(2);
      expect(paper.title).toBe('Version 2');
    });

    it('should parse multiple papers from feed', async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => mockAtomFeedMultipleEntries,
      });

      const paperIds = await ingestRecentPapers(['cs.AI'], 2);

      expect(paperIds.length).toBe(2);

      const papers = Array.from(mockPrismaPapers.values());
      expect(papers.length).toBe(2);

      // First paper
      expect(papers[0].arxivId).toBe('2401.12345');
      expect(papers[0].title).toContain('Language Agents');

      // Second paper
      expect(papers[1].arxivId).toBe('2401.67890');
      expect(papers[1].title).toContain('Convergence Analysis');
      expect(papers[1].version).toBe(2);
    });
  });
});
