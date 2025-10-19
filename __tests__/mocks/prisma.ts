/**
 * Mock Prisma client for testing
 *
 * Provides in-memory mock implementations of Prisma operations
 */

import { vi } from 'vitest';

export const createMockPrisma = () => {
  // In-memory stores
  const papers = new Map<string, any>();
  const enrichedPapers = new Map<string, any>();
  const categories = new Map<string, any>();

  return {
    paper: {
      findUnique: vi.fn(async ({ where }) => {
        if (where.id) {
          return papers.get(where.id) || null;
        }
        if (where.arxivId) {
          return Array.from(papers.values()).find((p) => p.arxivId === where.arxivId) || null;
        }
        return null;
      }),

      findMany: vi.fn(async ({ where, include }) => {
        let results = Array.from(papers.values());

        if (where?.arxivId?.in) {
          results = results.filter((p) => where.arxivId.in.includes(p.arxivId));
        }
        if (where?.status) {
          results = results.filter((p) => p.status === where.status);
        }

        if (include?.enriched) {
          results = results.map((p) => ({
            ...p,
            enriched: enrichedPapers.get(p.id) || null,
          }));
        }

        return results;
      }),

      create: vi.fn(async ({ data }) => {
        const paper = {
          id: `mock-paper-${papers.size + 1}`,
          createdAt: new Date(),
          updatedAt: new Date(),
          ...data,
        };
        papers.set(paper.id, paper);
        return paper;
      }),

      update: vi.fn(async ({ where, data }) => {
        const paper = await createMockPrisma().paper.findUnique({ where });
        if (!paper) throw new Error('Paper not found');

        const updated = {
          ...paper,
          ...data,
          updatedAt: new Date(),
        };
        papers.set(paper.id, updated);
        return updated;
      }),

      upsert: vi.fn(async ({ where, create, update }) => {
        const existing = await createMockPrisma().paper.findUnique({ where });

        if (existing) {
          return createMockPrisma().paper.update({ where, data: update });
        } else {
          return createMockPrisma().paper.create({ data: create });
        }
      }),

      deleteMany: vi.fn(async ({ where }) => {
        if (where?.arxivId?.in) {
          const toDelete = Array.from(papers.values()).filter((p) =>
            where.arxivId.in.includes(p.arxivId)
          );
          toDelete.forEach((p) => papers.delete(p.id));
          return { count: toDelete.length };
        }
        return { count: 0 };
      }),

      delete: vi.fn(async ({ where }) => {
        const paper = await createMockPrisma().paper.findUnique({ where });
        if (!paper) throw new Error('Paper not found');
        papers.delete(paper.id);
        return paper;
      }),
    },

    paperEnriched: {
      findUnique: vi.fn(async ({ where }) => {
        return enrichedPapers.get(where.paperId) || null;
      }),

      upsert: vi.fn(async ({ where, create, update }) => {
        const existing = enrichedPapers.get(where.paperId);

        if (existing) {
          const updated = { ...existing, ...update };
          enrichedPapers.set(where.paperId, updated);
          return updated;
        } else {
          const created = {
            id: `mock-enriched-${enrichedPapers.size + 1}`,
            ...create,
          };
          enrichedPapers.set(create.paperId, created);
          return created;
        }
      }),

      deleteMany: vi.fn(async ({ where }) => {
        enrichedPapers.delete(where.paperId);
        return { count: 1 };
      }),
    },

    arxivCategory: {
      findUnique: vi.fn(async ({ where }) => {
        return categories.get(where.id) || null;
      }),

      upsert: vi.fn(async ({ where, create, update }) => {
        const existing = categories.get(where.id);

        if (existing) {
          const updated = { ...existing, ...update };
          categories.set(where.id, updated);
          return updated;
        } else {
          categories.set(create.id, create);
          return create;
        }
      }),
    },

    $queryRaw: vi.fn(async () => [{ result: 1 }]),
  };
};

// Export a singleton mock instance
export const mockPrisma = createMockPrisma();
