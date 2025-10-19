/**
 * Enricher Agent Tests (Properly Mocked)
 *
 * All external services (ollama, Prisma) are mocked with realistic data
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  enrichPaper,
  estimateMathDepth,
  detectEvidenceSignals,
} from '@/server/agents/enricher';
import type { Paper } from '@prisma/client';
import {
  mockOllamaEmbeddingResponse,
  mockOllamaClassificationResponse,
  mockPaperData,
} from '../../mocks/arxiv-responses';

// Mock fetch for ollama API calls
global.fetch = vi.fn();

// Mock Prisma
const mockPrismaPapers = new Map<string, any>();
const mockPrismaEnriched = new Map<string, any>();

vi.mock('@/server/db', () => ({
  prisma: {
    paper: {
      findUnique: vi.fn(async ({ where }) => {
        if (where.id) {
          return mockPrismaPapers.get(where.id) || null;
        }
        return null;
      }),
      update: vi.fn(async ({ where, data }) => {
        const existing = mockPrismaPapers.get(where.id);
        if (!existing) throw new Error('Paper not found');
        const updated = { ...existing, ...data, updatedAt: new Date() };
        mockPrismaPapers.set(where.id, updated);
        return updated;
      }),
    },
    paperEnriched: {
      upsert: vi.fn(async ({ where, create, update }) => {
        const existing = mockPrismaEnriched.get(where.paperId);
        if (existing) {
          const updated = { ...existing, ...update };
          mockPrismaEnriched.set(where.paperId, updated);
          return updated;
        } else {
          const created = {
            id: `mock-enriched-${mockPrismaEnriched.size + 1}`,
            ...create,
          };
          mockPrismaEnriched.set(create.paperId, created);
          return created;
        }
      }),
    },
  },
}));

describe('Enricher Agent (Mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrismaPapers.clear();
    mockPrismaEnriched.clear();
  });

  describe('estimateMathDepth', () => {
    it('should return low math depth for practical paper', () => {
      const title = 'Building Web Applications with React';
      const abstract = 'We present a practical guide to building modern web applications.';

      const depth = estimateMathDepth(title, abstract);
      expect(depth).toBeGreaterThanOrEqual(0.0);
      expect(depth).toBeLessThan(0.1);
    });

    it('should return medium math depth for ML paper', () => {
      const title = 'Deep Learning for Image Classification';
      const abstract = 'We use gradient descent to optimize the loss function and achieve convergence.';

      const depth = estimateMathDepth(title, abstract);
      expect(depth).toBeGreaterThan(0.0);
      expect(depth).toBeLessThan(0.3);
    });

    it('should return high math depth for theory paper', () => {
      const title = 'Convergence Proof for Stochastic Gradient Descent';
      const abstract =
        'We present a theorem proving convergence of SGD. ' +
        'The proof relies on several key lemmas about the gradient \\nabla f(x) and corollary about the loss function.';

      const depth = estimateMathDepth(title, abstract);
      expect(depth).toBeGreaterThan(0.1);
    });
  });

  describe('detectEvidenceSignals', () => {
    it('should detect code availability', () => {
      const abstract = 'We release our implementation on GitHub at github.com/example/repo';
      const signals = detectEvidenceSignals(abstract);
      expect(signals.hasCode).toBe(true);
    });

    it('should detect dataset availability', () => {
      const abstract = 'We provide a new dataset with 10,000 examples. The data is available at our website.';
      const signals = detectEvidenceSignals(abstract);
      expect(signals.hasData).toBe(true);
    });

    it('should detect baseline comparisons', () => {
      const abstract = 'We compare against several baselines including GPT-4 and Claude.';
      const signals = detectEvidenceSignals(abstract);
      expect(signals.hasBaselines).toBe(true);
    });

    it('should detect ablation studies', () => {
      const abstract = 'Our ablation study shows that each component is necessary for performance.';
      const signals = detectEvidenceSignals(abstract);
      expect(signals.hasAblations).toBe(true);
    });

    it('should detect multiple evaluations', () => {
      const abstract =
        'We evaluate on three benchmark datasets: MMLU, HumanEval, and GSM8K. ' +
        'Results show strong performance across all benchmarks.';
      const signals = detectEvidenceSignals(abstract);
      expect(signals.hasMultipleEvals).toBe(true);
    });

    it('should handle paper with no evidence signals', () => {
      const abstract = 'We present a new approach to the problem.';
      const signals = detectEvidenceSignals(abstract);
      expect(signals.hasCode).toBe(false);
      expect(signals.hasData).toBe(false);
      expect(signals.hasBaselines).toBe(false);
      expect(signals.hasAblations).toBe(false);
      expect(signals.hasMultipleEvals).toBe(false);
    });
  });

  describe('enrichPaper', () => {
    it('should enrich paper with embeddings and classification', async () => {
      // Setup mock paper
      const paper: Paper = {
        ...mockPaperData,
        id: 'test-paper-123',
      };
      mockPrismaPapers.set(paper.id, paper);

      // Mock ollama embedding response
      (global.fetch as any).mockImplementation((url: string) => {
        if (url.includes('/api/embeddings')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockOllamaEmbeddingResponse,
          });
        }
        if (url.includes('/api/generate')) {
          return Promise.resolve({
            ok: true,
            json: async () => mockOllamaClassificationResponse,
          });
        }
        return Promise.reject(new Error('Unexpected fetch URL'));
      });

      const enriched = await enrichPaper(paper, true, true);

      // Verify enriched data structure
      expect(enriched.paperId).toBe(paper.id);
      expect(enriched.embedding).toHaveLength(384);
      expect(enriched.topics).toContain('agents');
      expect(enriched.topics).toContain('applications');
      expect(enriched.facets).toContain('planning');
      expect(enriched.facets).toContain('tool_use');
      expect(enriched.mathDepth).toBeGreaterThanOrEqual(0.0);
      expect(enriched.mathDepth).toBeLessThanOrEqual(1.0);
      expect(enriched.hasCode).toBe(true); // "Code is available on GitHub"
      expect(enriched.hasBaselines).toBe(false); // Abstract says "benchmarks" not "baseline"
      expect(enriched.hasMultipleEvals).toBe(false); // Only one mention of "benchmarks"

      // Verify paper status was updated
      const updatedPaper = mockPrismaPapers.get(paper.id);
      expect(updatedPaper.status).toBe('enriched');
    });

    it('should handle ollama service unavailable gracefully', async () => {
      const paper: Paper = {
        ...mockPaperData,
        id: 'test-paper-456',
      };
      mockPrismaPapers.set(paper.id, paper);

      // Mock ollama failure
      (global.fetch as any).mockImplementation(() => {
        return Promise.resolve({
          ok: false,
          statusText: 'Service Unavailable',
        });
      });

      const enriched = await enrichPaper(paper, true, true);

      // Should still complete with fallback values
      expect(enriched.paperId).toBe(paper.id);
      expect(enriched.embedding).toHaveLength(384); // Zero vector fallback
      expect(enriched.topics.length).toBeGreaterThan(0); // Keyword-based fallback
    });
  });
});
