import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  enrichPaper,
  estimateMathDepth,
  detectEvidenceSignals,
} from '@/server/agents/enricher';
import { prisma } from '@/server/db';

describe('Enricher Agent', () => {
  describe('estimateMathDepth', () => {
    it('should estimate high math depth for theorem papers', () => {
      const title = 'A Novel Convergence Theorem';
      const abstract =
        'We prove a convergence theorem using gradient descent with \\alpha regularization. ' +
        'The proof shows that the optimization converges to a global minimum.';

      const depth = estimateMathDepth(title, abstract);
      expect(depth).toBeGreaterThan(0.5);
    });

    it('should estimate low math depth for practical papers', () => {
      const title = 'Agentic System Design for Planning';
      const abstract =
        'We present a practical agentic system for tool use and planning. ' +
        'The system uses language models to coordinate multiple tools.';

      const depth = estimateMathDepth(title, abstract);
      expect(depth).toBeLessThan(0.3);
    });

    it('should handle papers with mixed content', () => {
      const title = 'Efficient Training with Gradient Descent';
      const abstract =
        'We propose an efficient training method using gradient descent. ' +
        'Our approach achieves state-of-the-art results on multiple benchmarks.';

      const depth = estimateMathDepth(title, abstract);
      expect(depth).toBeGreaterThan(0.0);
      expect(depth).toBeLessThan(0.3);
    });
  });

  describe('detectEvidenceSignals', () => {
    it('should detect all evidence signals', () => {
      const abstract =
        'We compare against strong baselines on 3 benchmarks and 2 datasets. ' +
        'Ablation studies show the importance of our novel component. ' +
        'Code is available on GitHub and the dataset is publicly available.';

      const signals = detectEvidenceSignals(abstract);

      expect(signals.hasBaselines).toBe(true);
      expect(signals.hasAblations).toBe(true);
      expect(signals.hasCode).toBe(true);
      expect(signals.hasData).toBe(true);
      expect(signals.hasMultipleEvals).toBe(true);
    });

    it('should detect partial evidence signals', () => {
      const abstract =
        'We evaluate on the MMLU benchmark and compare to GPT-4 baseline. ' +
        'Our method shows improved performance.';

      const signals = detectEvidenceSignals(abstract);

      expect(signals.hasBaselines).toBe(true);
      expect(signals.hasAblations).toBe(false);
      expect(signals.hasCode).toBe(false);
      expect(signals.hasData).toBe(false);
      expect(signals.hasMultipleEvals).toBe(false);
    });

    it('should detect no signals for theory papers', () => {
      const abstract =
        'We prove a theoretical result about convergence properties. ' +
        'The theorem establishes conditions for optimal solutions.';

      const signals = detectEvidenceSignals(abstract);

      expect(signals.hasBaselines).toBe(false);
      expect(signals.hasAblations).toBe(false);
      expect(signals.hasCode).toBe(false);
      expect(signals.hasData).toBe(false);
      expect(signals.hasMultipleEvals).toBe(false);
    });
  });

  describe('enrichPaper', () => {
    let testPaper: any;

    beforeEach(async () => {
      // Clean up any existing test paper first (in case previous test failed)
      await prisma.paper.deleteMany({
        where: { arxivId: '2401.TEST01' },
      });

      // Create a test paper
      testPaper = await prisma.paper.create({
        data: {
          arxivId: '2401.TEST01',
          version: 1,
          title: 'Agentic Planning with Tool Use',
          authors: ['Alice Smith', 'Bob Jones'],
          abstract:
            'We present an agentic system for planning and tool use. ' +
            'The system uses language models to coordinate tasks. ' +
            'We evaluate on multiple benchmarks with strong baselines. ' +
            'Code available on GitHub.',
          categories: ['cs.AI', 'cs.LG'],
          primaryCategory: 'cs.AI',
          status: 'new',
          pubDate: new Date('2024-01-20'),
          updatedDate: new Date('2024-01-20'),
          rawMetadata: {},
        },
      });
    });

    afterEach(async () => {
      // Clean up
      await prisma.paperEnriched.deleteMany({
        where: { paperId: testPaper.id },
      });
      await prisma.paper.delete({
        where: { id: testPaper.id },
      });
    });

    it('should enrich paper with all metadata', async () => {
      // Mock embedding generation (we'll implement this later)
      const enriched = await enrichPaper(testPaper, true, true);

      expect(enriched).toBeDefined();
      expect(enriched.paperId).toBe(testPaper.id);
      expect(enriched.mathDepth).toBeLessThan(0.3); // Low math content
      expect(enriched.hasCode).toBe(true);
      expect(enriched.hasBaselines).toBe(true);
      expect(enriched.topics.length).toBeGreaterThan(0);
      expect(enriched.facets.length).toBeGreaterThan(0);
    });

    it('should update paper status to enriched', async () => {
      await enrichPaper(testPaper, true, true);

      const updated = await prisma.paper.findUnique({
        where: { id: testPaper.id },
      });

      expect(updated?.status).toBe('enriched');
    });
  });
});
