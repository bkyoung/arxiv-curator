import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fetchArxivCategories, ingestRecentPapers } from '@/server/agents/scout';
import { prisma } from '@/server/db';

// Mock the fetch function
global.fetch = vi.fn();

describe('Scout Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(async () => {
    // Clean up test papers after each test
    await prisma.paper.deleteMany({
      where: {
        arxivId: {
          in: ['2401.12345', '2401.99999', '2401.88888'],
        },
      },
    });
  });

  describe('fetchArxivCategories', () => {
    it('should fetch and parse arXiv categories', async () => {
      const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/">
  <ListSets>
    <set>
      <setSpec>cs</setSpec>
      <setName>Computer Science</setName>
    </set>
    <set>
      <setSpec>cs.AI</setSpec>
      <setName>Artificial Intelligence</setName>
    </set>
    <set>
      <setSpec>cs.CL</setSpec>
      <setName>Computation and Language</setName>
    </set>
    <set>
      <setSpec>math.AG</setSpec>
      <setName>Algebraic Geometry</setName>
    </set>
  </ListSets>
</OAI-PMH>`;

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => mockXML,
      });

      const categories = await fetchArxivCategories();

      // Should only return cs.* categories
      expect(categories.length).toBe(3);
      expect(categories).toEqual([
        { id: 'cs', name: 'Computer Science', description: '' },
        { id: 'cs.AI', name: 'Artificial Intelligence', description: '' },
        { id: 'cs.CL', name: 'Computation and Language', description: '' },
      ]);
    });

    it('should store categories in database', async () => {
      const mockXML = `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/">
  <ListSets>
    <set>
      <setSpec>cs.AI</setSpec>
      <setName>Artificial Intelligence</setName>
    </set>
  </ListSets>
</OAI-PMH>`;

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => mockXML,
      });

      await fetchArxivCategories();

      // Verify category was stored
      const stored = await prisma.arxivCategory.findUnique({
        where: { id: 'cs.AI' },
      });

      expect(stored).toBeDefined();
      expect(stored?.name).toBe('Artificial Intelligence');
    });
  });

  describe('ingestRecentPapers', () => {
    it('should fetch and parse recent papers from Atom feed', async () => {
      const mockAtom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2401.12345v1</id>
    <title>A Novel Agentic System</title>
    <summary>We present a novel agentic system for planning and tool use.</summary>
    <author>
      <name>John Doe</name>
    </author>
    <category term="cs.AI" />
    <category term="cs.LG" />
    <link title="pdf" href="http://arxiv.org/pdf/2401.12345v1" />
    <published>2024-01-15T10:00:00Z</published>
    <updated>2024-01-15T10:00:00Z</updated>
  </entry>
</feed>`;

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => mockAtom,
      });

      const paperIds = await ingestRecentPapers(['cs.AI'], 1);

      expect(paperIds.length).toBe(1);

      // Verify paper was stored
      const paper = await prisma.paper.findUnique({
        where: { arxivId: '2401.12345' },
      });

      expect(paper).toBeDefined();
      expect(paper?.title).toBe('A Novel Agentic System');
      expect(paper?.version).toBe(1);
      expect(paper?.categories).toEqual(['cs.AI', 'cs.LG']);
      expect(paper?.status).toBe('new');
    });

    it('should handle paper version updates', async () => {
      // First, create v1
      await prisma.paper.create({
        data: {
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
        },
      });

      // Now ingest v2
      const mockAtom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2401.99999v2</id>
    <title>Updated Title</title>
    <summary>Updated abstract with improvements.</summary>
    <author>
      <name>John Doe</name>
    </author>
    <category term="cs.AI" />
    <link title="pdf" href="http://arxiv.org/pdf/2401.99999v2" />
    <published>2024-01-15T10:00:00Z</published>
    <updated>2024-01-16T10:00:00Z</updated>
  </entry>
</feed>`;

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => mockAtom,
      });

      await ingestRecentPapers(['cs.AI'], 1);

      // Verify paper was updated to v2
      const paper = await prisma.paper.findUnique({
        where: { arxivId: '2401.99999' },
      });

      expect(paper?.version).toBe(2);
      expect(paper?.title).toBe('Updated Title');
      expect(paper?.status).toBe('new'); // Status reset for re-enrichment
    });

    it('should skip older versions', async () => {
      // Create v2
      await prisma.paper.create({
        data: {
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
        },
      });

      // Try to ingest v1 (older)
      const mockAtom = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/2401.88888v1</id>
    <title>Version 1</title>
    <summary>Version 1 abstract</summary>
    <author>
      <name>John Doe</name>
    </author>
    <category term="cs.AI" />
    <link title="pdf" href="http://arxiv.org/pdf/2401.88888v1" />
    <published>2024-01-15T10:00:00Z</published>
    <updated>2024-01-15T10:00:00Z</updated>
  </entry>
</feed>`;

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        text: async () => mockAtom,
      });

      const paperIds = await ingestRecentPapers(['cs.AI'], 1);

      // Should return empty since v1 is older than v2
      expect(paperIds.length).toBe(0);

      // Verify v2 is unchanged
      const paper = await prisma.paper.findUnique({
        where: { arxivId: '2401.88888' },
      });

      expect(paper?.version).toBe(2);
      expect(paper?.title).toBe('Version 2');
    });
  });
});
