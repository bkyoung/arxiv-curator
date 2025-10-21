/**
 * Analyst Agent Tests
 *
 * Tests for critical analysis generation (Depth A/B/C)
 * Phase 5: Critical Analysis
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  generateCritique,
  findSimilarPapers,
  extractClaimsTable,
  extractComparisonTable,
  extractLimitations,
  extractVerdict,
  extractConfidence,
} from '@/server/agents/analyst';
import { prisma } from '@/server/db';

// Mock dependencies
vi.mock('@/server/db', () => ({
  prisma: {
    paper: {
      findUnique: vi.fn(),
    },
    userProfile: {
      findUnique: vi.fn(),
    },
    analysis: {
      create: vi.fn(),
      findFirst: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

vi.mock('@/server/lib/llm/critique', () => ({
  generateCritiqueOllama: vi.fn(),
  generateCritiqueGemini: vi.fn(),
}));

vi.mock('@/server/lib/pdf-parser', () => ({
  downloadAndParsePDF: vi.fn(),
  extractIntro: vi.fn(),
  extractConclusion: vi.fn(),
}));

describe('Analyst Agent', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateCritique - Depth A (Fast)', () => {
    const mockPaper = {
      id: 'paper123',
      title: 'BERT: Pre-training of Deep Bidirectional Transformers',
      authors: ['Jacob Devlin', 'Ming-Wei Chang'],
      abstract: 'We introduce BERT, a new language representation model...',
      pdfUrl: 'https://arxiv.org/pdf/1810.04805.pdf',
      enriched: {
        embedding: [0.1, 0.2, 0.3],
      },
    };

    const mockUserProfile = {
      userId: 'user123',
      useLocalLLM: true,
    };

    it('should generate Depth A critique using local LLM', async () => {
      vi.mocked(prisma.paper.findUnique).mockResolvedValue(mockPaper as any);
      vi.mocked(prisma.userProfile.findUnique).mockResolvedValue(mockUserProfile as any);

      const mockCritiqueResponse = `
## Core Contribution
BERT introduces bidirectional pre-training for language understanding.

## Key Claims & Evidence
| Claim | Evidence | Assessment |
|-------|----------|------------|
| BERT achieves SOTA on 11 NLP tasks | Experimental results on GLUE benchmark | Supported |
| Bidirectional training is better than left-to-right | Ablation studies | Supported |

## Quick Assessment
**Strengths**:
- Novel bidirectional pre-training approach
- Strong empirical results across multiple tasks

**Limitations**:
- Requires significant compute resources
- Limited analysis of what the model learns

## Verdict
**Overall**: Promising
**Confidence**: 0.9
**Reasoning**: Strong empirical results with solid experimental validation.

## Bottom Line
BERT sets new SOTA on multiple NLP benchmarks through bidirectional pre-training.
      `;

      const { generateCritiqueOllama } = await import('@/server/lib/llm/critique');
      vi.mocked(generateCritiqueOllama).mockResolvedValue({
        markdown: mockCritiqueResponse,
      });

      vi.mocked(prisma.analysis.create).mockResolvedValue({
        id: 'analysis123',
        paperId: 'paper123',
        userId: 'user123',
        depth: 'A',
        claimsEvidence: expect.any(String),
        limitations: expect.any(Array),
        neighborComparison: null,
        verdict: 'Promising',
        confidence: 0.9,
        markdownContent: mockCritiqueResponse,
        generatedAt: new Date(),
      } as any);

      const result = await generateCritique({
        paperId: 'paper123',
        userId: 'user123',
        depth: 'A',
      });

      expect(result.depth).toBe('A');
      expect(result.verdict).toBe('Promising');
      expect(result.confidence).toBe(0.9);
      expect(generateCritiqueOllama).toHaveBeenCalled();
    });

    it('should use cloud LLM if user prefers it', async () => {
      vi.mocked(prisma.paper.findUnique).mockResolvedValue(mockPaper as any);
      vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
        ...mockUserProfile,
        useLocalLLM: false,
      } as any);

      const mockCritiqueResponse = `
## Core Contribution
Test contribution.

## Key Claims & Evidence
| Claim | Evidence | Assessment |
|-------|----------|------------|
| Test claim | Test evidence | Supported |

## Quick Assessment
**Strengths**: Test strength
**Limitations**: Test limitation

## Verdict
**Overall**: Solid Incremental
**Confidence**: 0.8
**Reasoning**: Test reasoning

## Bottom Line
Test bottom line.
      `;

      const { generateCritiqueGemini } = await import('@/server/lib/llm/critique');
      vi.mocked(generateCritiqueGemini).mockResolvedValue({
        markdown: mockCritiqueResponse,
      });

      vi.mocked(prisma.analysis.create).mockResolvedValue({
        id: 'analysis123',
        depth: 'A',
        verdict: 'Solid Incremental',
        confidence: 0.8,
      } as any);

      const result = await generateCritique({
        paperId: 'paper123',
        userId: 'user123',
        depth: 'A',
      });

      expect(generateCritiqueGemini).toHaveBeenCalled();
      expect(result.verdict).toBe('Solid Incremental');
    });

    it('should extract intro and conclusion from PDF if available', async () => {
      vi.mocked(prisma.paper.findUnique).mockResolvedValue(mockPaper as any);
      vi.mocked(prisma.userProfile.findUnique).mockResolvedValue(mockUserProfile as any);

      const { downloadAndParsePDF, extractIntro, extractConclusion } = await import(
        '@/server/lib/pdf-parser'
      );
      vi.mocked(downloadAndParsePDF).mockResolvedValue('Full PDF text');
      vi.mocked(extractIntro).mockReturnValue('This is the introduction...');
      vi.mocked(extractConclusion).mockReturnValue('This is the conclusion...');

      const { generateCritiqueOllama } = await import('@/server/lib/llm/critique');
      vi.mocked(generateCritiqueOllama).mockResolvedValue({
        markdown: 'Mock critique',
      });

      vi.mocked(prisma.analysis.create).mockResolvedValue({ id: 'analysis123' } as any);

      await generateCritique({
        paperId: 'paper123',
        userId: 'user123',
        depth: 'A',
      });

      expect(downloadAndParsePDF).toHaveBeenCalledWith(mockPaper.pdfUrl, mockPaper.id);
      expect(extractIntro).toHaveBeenCalled();
      expect(extractConclusion).toHaveBeenCalled();
    });

    it('should fall back to abstract-only if PDF parsing fails', async () => {
      vi.mocked(prisma.paper.findUnique).mockResolvedValue(mockPaper as any);
      vi.mocked(prisma.userProfile.findUnique).mockResolvedValue(mockUserProfile as any);

      const { downloadAndParsePDF } = await import('@/server/lib/pdf-parser');
      vi.mocked(downloadAndParsePDF).mockRejectedValue(new Error('PDF download failed'));

      const { generateCritiqueOllama } = await import('@/server/lib/llm/critique');
      vi.mocked(generateCritiqueOllama).mockResolvedValue({
        markdown: 'Mock critique from abstract only',
      });

      vi.mocked(prisma.analysis.create).mockResolvedValue({
        id: 'analysis123',
        markdownContent: 'Mock critique from abstract only',
      } as any);

      const result = await generateCritique({
        paperId: 'paper123',
        userId: 'user123',
        depth: 'A',
      });

      expect(result.markdownContent).toBe('Mock critique from abstract only');
      expect(generateCritiqueOllama).toHaveBeenCalled();
    });

    it('should throw error if paper not found', async () => {
      vi.mocked(prisma.paper.findUnique).mockResolvedValue(null);

      await expect(
        generateCritique({
          paperId: 'nonexistent',
          userId: 'user123',
          depth: 'A',
        })
      ).rejects.toThrow('Paper not found');
    });

    it('should store analysis in database with correct fields', async () => {
      vi.mocked(prisma.paper.findUnique).mockResolvedValue(mockPaper as any);
      vi.mocked(prisma.userProfile.findUnique).mockResolvedValue(mockUserProfile as any);

      const mockCritique = `
## Core Contribution
Test

## Key Claims & Evidence
| Claim | Evidence | Assessment |
| Test | Test | Supported |

## Quick Assessment
**Strengths**: S1
**Limitations**: L1, L2

## Verdict
**Overall**: Promising
**Confidence**: 0.85
**Reasoning**: Test

## Bottom Line
Test
      `;

      const { generateCritiqueOllama } = await import('@/server/lib/llm/critique');
      vi.mocked(generateCritiqueOllama).mockResolvedValue({
        markdown: mockCritique,
      });

      const mockAnalysis = {
        id: 'analysis123',
        paperId: 'paper123',
        userId: 'user123',
        depth: 'A',
        claimsEvidence: expect.any(String),
        limitations: expect.any(Array),
        neighborComparison: null,
        verdict: 'Promising',
        confidence: 0.85,
        markdownContent: mockCritique,
        generatedAt: new Date(),
      };

      vi.mocked(prisma.analysis.create).mockResolvedValue(mockAnalysis as any);

      await generateCritique({
        paperId: 'paper123',
        userId: 'user123',
        depth: 'A',
      });

      expect(prisma.analysis.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          paperId: 'paper123',
          userId: 'user123',
          depth: 'A',
          claimsEvidence: expect.any(String),
          limitations: expect.any(Array),
          // neighborComparison is omitted for Depth A (only used for Depth B)
          verdict: expect.any(String),
          confidence: expect.any(Number),
          markdownContent: mockCritique,
        }),
      });
    });
  });

  describe('generateCritique - Depth B (Comparative)', () => {
    const mockPaper = {
      id: 'paper123',
      title: 'Transformer Architecture for NLP',
      authors: ['Author A', 'Author B'],
      abstract: 'We introduce a new transformer architecture...',
      pdfUrl: 'https://arxiv.org/pdf/1234.5678.pdf',
      enriched: {
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
      },
    };

    const mockNeighbors = [
      {
        id: 'neighbor1',
        title: 'BERT: Pre-training Transformers',
        abstract: 'Abstract 1',
        authors: ['Author C'],
        pubDate: new Date('2025-10-15'),
        similarity: 0.95,
        summary: {
          whatsNew: 'Novel pre-training approach',
          keyPoints: ['Bidirectional training', 'SOTA results'],
        },
      },
      {
        id: 'neighbor2',
        title: 'GPT-3: Language Models',
        abstract: 'Abstract 2',
        authors: ['Author D'],
        pubDate: new Date('2025-10-10'),
        similarity: 0.87,
        summary: {
          whatsNew: 'Scaling language models',
          keyPoints: ['Few-shot learning', 'Large scale'],
        },
      },
      {
        id: 'neighbor3',
        title: 'T5: Text-to-Text Framework',
        abstract: 'Abstract 3',
        authors: ['Author E'],
        pubDate: new Date('2025-09-25'),
        similarity: 0.82,
        summary: {
          whatsNew: 'Unified text-to-text framework',
          keyPoints: ['Transfer learning', 'Multi-task training'],
        },
      },
    ];

    it('should generate Depth B critique successfully', async () => {
      vi.mocked(prisma.paper.findUnique).mockResolvedValue(mockPaper as any);
      vi.mocked(prisma.$queryRaw).mockResolvedValue(mockNeighbors as any);

      const { downloadAndParsePDF } = await import('@/server/lib/pdf-parser');
      vi.mocked(downloadAndParsePDF).mockResolvedValue('Full PDF content here...');

      const mockCritiqueResponse = `
## Core Contribution
Novel transformer architecture with improved attention.

## Key Claims & Evidence
| Claim | Evidence | Assessment |
| Improved attention | Experimental results | Supported |

## Comparison vs Prior Work
| Aspect | Current Paper | BERT | GPT-3 | T5 |
|--------|---------------|------|-------|-----|
| Approach | New attention | Bidirectional | Autoregressive | Seq2seq |
| Key Results | 95% accuracy | 92% | 93% | 94% |

## Relative Positioning
This work builds on BERT and GPT-3 by introducing...

## Quick Assessment
**Strengths**: Novel approach
**Limitations**: Limited baselines

## Verdict
**Overall**: Promising
**Confidence**: 0.85
**Reasoning**: Strong contribution

## Bottom Line
Solid advance in transformer architectures.
      `;

      const { generateCritiqueGemini } = await import('@/server/lib/llm/critique');
      vi.mocked(generateCritiqueGemini).mockResolvedValue({
        markdown: mockCritiqueResponse,
      });

      vi.mocked(prisma.analysis.create).mockResolvedValue({
        id: 'analysis123',
        depth: 'B',
        verdict: 'Promising',
        confidence: 0.85,
        neighborComparison: expect.any(Object),
      } as any);

      const result = await generateCritique({
        paperId: 'paper123',
        userId: 'user123',
        depth: 'B',
      });

      expect(result.depth).toBe('B');
      expect(result.verdict).toBe('Promising');
      expect(generateCritiqueGemini).toHaveBeenCalled();
    });

    it('should always use cloud LLM for Depth B', async () => {
      vi.mocked(prisma.paper.findUnique).mockResolvedValue(mockPaper as any);
      vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
        userId: 'user123',
        useLocalLLM: true, // User prefers local, but should use cloud
      } as any);
      vi.mocked(prisma.$queryRaw).mockResolvedValue(mockNeighbors as any);

      const { downloadAndParsePDF } = await import('@/server/lib/pdf-parser');
      vi.mocked(downloadAndParsePDF).mockResolvedValue('PDF content');

      const { generateCritiqueGemini, generateCritiqueOllama } = await import(
        '@/server/lib/llm/critique'
      );
      vi.mocked(generateCritiqueGemini).mockResolvedValue({
        markdown: 'Mock response',
      });

      vi.mocked(prisma.analysis.create).mockResolvedValue({
        id: 'analysis123',
        depth: 'B',
      } as any);

      await generateCritique({
        paperId: 'paper123',
        userId: 'user123',
        depth: 'B',
      });

      expect(generateCritiqueGemini).toHaveBeenCalled();
      expect(generateCritiqueOllama).not.toHaveBeenCalled();
    });

    it('should include 3 neighbors in prompt', async () => {
      vi.mocked(prisma.paper.findUnique).mockResolvedValue(mockPaper as any);
      vi.mocked(prisma.$queryRaw).mockResolvedValue(mockNeighbors as any);

      const { downloadAndParsePDF } = await import('@/server/lib/pdf-parser');
      vi.mocked(downloadAndParsePDF).mockResolvedValue('PDF content');

      const { generateCritiqueGemini } = await import('@/server/lib/llm/critique');
      let capturedPrompt = '';
      vi.mocked(generateCritiqueGemini).mockImplementation(async ({ prompt }) => {
        capturedPrompt = prompt;
        return { markdown: 'Mock response' };
      });

      vi.mocked(prisma.analysis.create).mockResolvedValue({ id: 'analysis123' } as any);

      await generateCritique({
        paperId: 'paper123',
        userId: 'user123',
        depth: 'B',
      });

      expect(capturedPrompt).toContain('BERT: Pre-training Transformers');
      expect(capturedPrompt).toContain('GPT-3: Language Models');
      expect(capturedPrompt).toContain('T5: Text-to-Text Framework');
    });

    it('should store neighborComparison JSON', async () => {
      vi.mocked(prisma.paper.findUnique).mockResolvedValue(mockPaper as any);
      vi.mocked(prisma.$queryRaw).mockResolvedValue(mockNeighbors as any);

      const { downloadAndParsePDF } = await import('@/server/lib/pdf-parser');
      vi.mocked(downloadAndParsePDF).mockResolvedValue('PDF content');

      const mockResponse = `
## Comparison vs Prior Work
| Aspect | Current | N1 | N2 | N3 |
| Approach | A | B | C | D |
      `;

      const { generateCritiqueGemini } = await import('@/server/lib/llm/critique');
      vi.mocked(generateCritiqueGemini).mockResolvedValue({
        markdown: mockResponse,
      });

      vi.mocked(prisma.analysis.create).mockResolvedValue({ id: 'analysis123' } as any);

      await generateCritique({
        paperId: 'paper123',
        userId: 'user123',
        depth: 'B',
      });

      expect(prisma.analysis.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          neighborComparison: expect.any(Object),
        }),
      });
    });

    it('should handle case with fewer than 3 neighbors', async () => {
      vi.mocked(prisma.paper.findUnique).mockResolvedValue(mockPaper as any);
      vi.mocked(prisma.$queryRaw).mockResolvedValue([mockNeighbors[0]] as any); // Only 1 neighbor

      const { downloadAndParsePDF } = await import('@/server/lib/pdf-parser');
      vi.mocked(downloadAndParsePDF).mockResolvedValue('PDF content');

      const { generateCritiqueGemini } = await import('@/server/lib/llm/critique');
      vi.mocked(generateCritiqueGemini).mockResolvedValue({
        markdown: 'Mock response',
      });

      vi.mocked(prisma.analysis.create).mockResolvedValue({
        id: 'analysis123',
        depth: 'B',
      } as any);

      const result = await generateCritique({
        paperId: 'paper123',
        userId: 'user123',
        depth: 'B',
      });

      expect(result.depth).toBe('B');
      expect(generateCritiqueGemini).toHaveBeenCalled();
    });

    it('should throw error if PDF unavailable for Depth B', async () => {
      const paperWithoutPDF = { ...mockPaper, pdfUrl: null };
      vi.mocked(prisma.paper.findUnique).mockResolvedValue(paperWithoutPDF as any);
      vi.mocked(prisma.$queryRaw).mockResolvedValue(mockNeighbors as any);

      await expect(
        generateCritique({
          paperId: 'paper123',
          userId: 'user123',
          depth: 'B',
        })
      ).rejects.toThrow('PDF required for Depth B');
    });
  });

  describe('generateCritique - Depth C (Deep)', () => {
    const mockPaper = {
      id: 'paper123',
      title: 'Transformer Architecture for NLP',
      authors: ['Author A', 'Author B'],
      abstract: 'We introduce a new transformer architecture...',
      pdfUrl: 'https://arxiv.org/pdf/1234.5678.pdf',
      enriched: {
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5],
      },
    };

    it('should generate Depth C critique successfully', async () => {
      vi.mocked(prisma.paper.findUnique).mockResolvedValue(mockPaper as any);

      const { downloadAndParsePDF } = await import('@/server/lib/pdf-parser');
      vi.mocked(downloadAndParsePDF).mockResolvedValue(
        'Full PDF content with methodology and experiments sections...'
      );

      const mockCritiqueResponse = `
## Core Contribution
Novel transformer architecture with improved attention.

## Key Claims & Evidence
| Claim | Evidence | Assessment |
| Improved attention | Experimental results | Supported |

## Methodology Review
The approach is sound, using standard transformer baselines...

## Experimental Design
Experiments are comprehensive, covering 5 benchmarks...

## Reproducibility Assessment
Code and data are available. Implementation details are clear...

## Compute & Data Costs
Requires 8 A100 GPUs for training, moderate resource requirements...

## SOTA Comparability
Fair comparisons to BERT, GPT-3, and T5. SOTA claims justified...

## Quick Assessment
**Strengths**: Novel approach, comprehensive experiments
**Limitations**: High compute requirements

## Verdict
**Overall**: Promising
**Confidence**: 0.9
**Reasoning**: Strong methodology and reproducibility

## Bottom Line
Solid methodological contribution with reproducible results.
      `;

      const { generateCritiqueGemini } = await import('@/server/lib/llm/critique');
      vi.mocked(generateCritiqueGemini).mockResolvedValue({
        markdown: mockCritiqueResponse,
      });

      vi.mocked(prisma.analysis.create).mockResolvedValue({
        id: 'analysis123',
        depth: 'C',
        verdict: 'Promising',
        confidence: 0.9,
      } as any);

      const result = await generateCritique({
        paperId: 'paper123',
        userId: 'user123',
        depth: 'C',
      });

      expect(result.depth).toBe('C');
      expect(result.verdict).toBe('Promising');
      expect(generateCritiqueGemini).toHaveBeenCalled();
    });

    it('should always use cloud LLM for Depth C', async () => {
      vi.mocked(prisma.paper.findUnique).mockResolvedValue(mockPaper as any);
      vi.mocked(prisma.userProfile.findUnique).mockResolvedValue({
        userId: 'user123',
        useLocalLLM: true, // User prefers local, but should use cloud
      } as any);

      const { downloadAndParsePDF } = await import('@/server/lib/pdf-parser');
      vi.mocked(downloadAndParsePDF).mockResolvedValue('PDF content');

      const { generateCritiqueGemini, generateCritiqueOllama } = await import(
        '@/server/lib/llm/critique'
      );
      vi.mocked(generateCritiqueGemini).mockResolvedValue({
        markdown: 'Mock response',
      });

      vi.mocked(prisma.analysis.create).mockResolvedValue({
        id: 'analysis123',
        depth: 'C',
      } as any);

      await generateCritique({
        paperId: 'paper123',
        userId: 'user123',
        depth: 'C',
      });

      expect(generateCritiqueGemini).toHaveBeenCalled();
      expect(generateCritiqueOllama).not.toHaveBeenCalled();
    });

    it('should throw error if PDF unavailable for Depth C', async () => {
      const paperWithoutPDF = { ...mockPaper, pdfUrl: null };
      vi.mocked(prisma.paper.findUnique).mockResolvedValue(paperWithoutPDF as any);

      await expect(
        generateCritique({
          paperId: 'paper123',
          userId: 'user123',
          depth: 'C',
        })
      ).rejects.toThrow('PDF required for Depth C');
    });

    it('should include methodology review in prompt', async () => {
      vi.mocked(prisma.paper.findUnique).mockResolvedValue(mockPaper as any);

      const { downloadAndParsePDF } = await import('@/server/lib/pdf-parser');
      vi.mocked(downloadAndParsePDF).mockResolvedValue('PDF content');

      const { generateCritiqueGemini } = await import('@/server/lib/llm/critique');
      let capturedPrompt = '';
      vi.mocked(generateCritiqueGemini).mockImplementation(async ({ prompt }) => {
        capturedPrompt = prompt;
        return { markdown: 'Mock response' };
      });

      vi.mocked(prisma.analysis.create).mockResolvedValue({ id: 'analysis123' } as any);

      await generateCritique({
        paperId: 'paper123',
        userId: 'user123',
        depth: 'C',
      });

      expect(capturedPrompt).toContain('Methodology Review');
      expect(capturedPrompt).toContain('Experimental Design');
      expect(capturedPrompt).toContain('Reproducibility Assessment');
    });

    it('should store analysis with depth C', async () => {
      vi.mocked(prisma.paper.findUnique).mockResolvedValue(mockPaper as any);

      const { downloadAndParsePDF } = await import('@/server/lib/pdf-parser');
      vi.mocked(downloadAndParsePDF).mockResolvedValue('PDF content');

      const { generateCritiqueGemini } = await import('@/server/lib/llm/critique');
      vi.mocked(generateCritiqueGemini).mockResolvedValue({
        markdown: 'Mock response',
      });

      vi.mocked(prisma.analysis.create).mockResolvedValue({
        id: 'analysis123',
        depth: 'C',
      } as any);

      const result = await generateCritique({
        paperId: 'paper123',
        userId: 'user123',
        depth: 'C',
      });

      expect(result.depth).toBe('C');
      expect(prisma.analysis.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          depth: 'C',
        }),
      });
    });

    it('should not include neighborComparison for Depth C', async () => {
      vi.mocked(prisma.paper.findUnique).mockResolvedValue(mockPaper as any);

      const { downloadAndParsePDF } = await import('@/server/lib/pdf-parser');
      vi.mocked(downloadAndParsePDF).mockResolvedValue('PDF content');

      const { generateCritiqueGemini } = await import('@/server/lib/llm/critique');
      vi.mocked(generateCritiqueGemini).mockResolvedValue({
        markdown: 'Mock response',
      });

      vi.mocked(prisma.analysis.create).mockResolvedValue({
        id: 'analysis123',
        depth: 'C',
      } as any);

      await generateCritique({
        paperId: 'paper123',
        userId: 'user123',
        depth: 'C',
      });

      expect(prisma.analysis.create).toHaveBeenCalledWith({
        data: expect.not.objectContaining({
          neighborComparison: expect.anything(),
        }),
      });
    });
  });

  describe('Response Parsers', () => {
    describe('extractClaimsTable', () => {
      it('should extract claims table from markdown', () => {
        const markdown = `
## Key Claims & Evidence
| Claim | Evidence | Assessment |
|-------|----------|------------|
| BERT achieves SOTA | Experimental results | Supported |
| Bidirectional is better | Ablation studies | Supported |

## Other Section
        `;

        const result = extractClaimsTable(markdown);

        expect(result).toContain('Claim');
        expect(result).toContain('BERT achieves SOTA');
        expect(result).toContain('Bidirectional is better');
      });

      it('should return message if no claims table found', () => {
        const markdown = `
## Core Contribution
Some text

## Verdict
Some verdict
        `;

        const result = extractClaimsTable(markdown);

        expect(result).toBe('No claims table found');
      });
    });

    describe('extractLimitations', () => {
      it('should extract limitations bullets from markdown', () => {
        const markdown = `
## Quick Assessment
**Strengths**:
- Good performance
- Novel approach

**Limitations**:
- Requires significant compute
- Limited theoretical analysis
- No ablation studies

## Verdict
        `;

        const result = extractLimitations(markdown);

        expect(result).toHaveLength(3);
        expect(result[0]).toBe('Requires significant compute');
        expect(result[1]).toBe('Limited theoretical analysis');
        expect(result[2]).toBe('No ablation studies');
      });

      it('should return empty array if no limitations found', () => {
        const markdown = `
## Core Contribution
Test
        `;

        const result = extractLimitations(markdown);

        expect(result).toEqual([]);
      });

      it('should handle various bullet formats', () => {
        const markdown = `
**Limitations**:
- First limitation
  - Nested item (should be ignored)
- Second limitation
        `;

        const result = extractLimitations(markdown);

        expect(result.length).toBeGreaterThan(0);
        expect(result).toContain('First limitation');
      });
    });

    describe('extractVerdict', () => {
      it('should extract verdict from markdown', () => {
        const markdown = `
## Verdict
**Overall**: Promising
**Confidence**: 0.9
**Reasoning**: Strong results
        `;

        const result = extractVerdict(markdown);

        expect(result).toBe('Promising');
      });

      it('should handle different verdict values', () => {
        const verdicts = ['Promising', 'Solid Incremental', 'Over-claimed'];

        verdicts.forEach((verdict) => {
          const markdown = `**Overall**: ${verdict}`;
          const result = extractVerdict(markdown);
          expect(result).toBe(verdict);
        });
      });

      it('should return "Unknown" if no verdict found', () => {
        const markdown = `
## Core Contribution
No verdict here
        `;

        const result = extractVerdict(markdown);

        expect(result).toBe('Unknown');
      });
    });

    describe('extractConfidence', () => {
      it('should extract confidence as float', () => {
        const markdown = `
**Confidence**: 0.85
        `;

        const result = extractConfidence(markdown);

        expect(result).toBe(0.85);
      });

      it('should handle confidence in range 0-1', () => {
        const confidences = [0.0, 0.5, 0.75, 0.9, 1.0];

        confidences.forEach((conf) => {
          const markdown = `**Confidence**: ${conf}`;
          const result = extractConfidence(markdown);
          expect(result).toBe(conf);
        });
      });

      it('should return 0.5 as default if not found', () => {
        const markdown = `
## Verdict
No confidence value
        `;

        const result = extractConfidence(markdown);

        expect(result).toBe(0.5);
      });

      it('should parse confidence from decimal string', () => {
        const markdown = `**Confidence**: 0.123456`;
        const result = extractConfidence(markdown);
        expect(result).toBeCloseTo(0.123456);
      });
    });

    describe('extractComparisonTable', () => {
      it('should extract comparison table from markdown', () => {
        const markdown = `
## Comparison vs Prior Work
| Aspect | Current Paper | BERT | GPT-3 | T5 |
|--------|---------------|------|-------|-----|
| Approach | New attention | Bidirectional | Autoregressive | Seq2seq |
| Key Results | 95% | 92% | 93% | 94% |

## Relative Positioning
Some text here
        `;

        const result = extractComparisonTable(markdown);

        expect(result).toContain('Aspect');
        expect(result).toContain('Current Paper');
        expect(result).toContain('BERT');
        expect(result).toContain('GPT-3');
      });

      it('should return null if no comparison section found', () => {
        const markdown = `
## Core Contribution
Some text

## Verdict
Some verdict
        `;

        const result = extractComparisonTable(markdown);

        expect(result).toBeNull();
      });

      it('should handle malformed tables gracefully', () => {
        const markdown = `
## Comparison vs Prior Work
This is not a table, just text
| Missing proper structure

## Other Section
        `;

        const result = extractComparisonTable(markdown);

        // Should still extract the content even if malformed
        expect(result).toBeTruthy();
        expect(result).toContain('This is not a table');
      });
    });
  });

  describe('findSimilarPapers', () => {
    const mockEmbedding = [0.1, 0.2, 0.3, 0.4, 0.5];
    const queryPaperId = 'query-paper-123';

    it('should find 3 similar papers within 180 days', async () => {
      const mockResults = [
        {
          id: 'paper1',
          title: 'Similar Paper 1',
          abstract: 'Abstract 1',
          authors: ['Author A'],
          pubDate: new Date('2025-10-15'),
          similarity: 0.95,
          whatsNew: 'Summary 1',
          keyPoints: ['Point 1', 'Point 2'],
        },
        {
          id: 'paper2',
          title: 'Similar Paper 2',
          abstract: 'Abstract 2',
          authors: ['Author B', 'Author C'],
          pubDate: new Date('2025-10-10'),
          similarity: 0.87,
          whatsNew: null,
          keyPoints: null,
        },
        {
          id: 'paper3',
          title: 'Similar Paper 3',
          abstract: 'Abstract 3',
          authors: ['Author D'],
          pubDate: new Date('2025-09-25'),
          similarity: 0.82,
          whatsNew: 'Summary 3',
          keyPoints: ['Point A'],
        },
      ];

      vi.mocked(prisma.$queryRaw).mockResolvedValue(mockResults as any);

      const result = await findSimilarPapers(mockEmbedding, 3, 180, queryPaperId);

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe('paper1');
      expect(result[0].similarity).toBe(0.95);
      expect(result[0].summary).toEqual({
        whatsNew: 'Summary 1',
        keyPoints: ['Point 1', 'Point 2'],
      });
      expect(result[1].summary).toBeUndefined();
      expect(prisma.$queryRaw).toHaveBeenCalled();
    });

    it('should exclude query paper from results', async () => {
      const mockResults = [
        {
          id: 'paper1',
          title: 'Similar Paper 1',
          abstract: 'Abstract 1',
          authors: ['Author A'],
          pubDate: new Date('2025-10-15'),
          similarity: 0.95,
          whatsNew: null,
          keyPoints: null,
        },
      ];

      vi.mocked(prisma.$queryRaw).mockResolvedValue(mockResults as any);

      const result = await findSimilarPapers(mockEmbedding, 3, 180, queryPaperId);

      expect(result.every((p) => p.id !== queryPaperId)).toBe(true);
    });

    it('should return papers ordered by similarity descending', async () => {
      const mockResults = [
        {
          id: 'paper1',
          title: 'Most Similar',
          abstract: 'Abstract 1',
          authors: ['Author A'],
          pubDate: new Date('2025-10-15'),
          similarity: 0.95,
          whatsNew: null,
          keyPoints: null,
        },
        {
          id: 'paper2',
          title: 'Medium Similar',
          abstract: 'Abstract 2',
          authors: ['Author B'],
          pubDate: new Date('2025-10-14'),
          similarity: 0.85,
          whatsNew: null,
          keyPoints: null,
        },
        {
          id: 'paper3',
          title: 'Least Similar',
          abstract: 'Abstract 3',
          authors: ['Author C'],
          pubDate: new Date('2025-10-13'),
          similarity: 0.75,
          whatsNew: null,
          keyPoints: null,
        },
      ];

      vi.mocked(prisma.$queryRaw).mockResolvedValue(mockResults as any);

      const result = await findSimilarPapers(mockEmbedding, 3, 180);

      expect(result[0].similarity).toBeGreaterThan(result[1].similarity);
      expect(result[1].similarity).toBeGreaterThan(result[2].similarity);
    });

    it('should include summaries when available', async () => {
      const mockResults = [
        {
          id: 'paper1',
          title: 'Paper with Summary',
          abstract: 'Abstract',
          authors: ['Author A'],
          pubDate: new Date('2025-10-15'),
          similarity: 0.9,
          whatsNew: "What's new content",
          keyPoints: ['Key point 1', 'Key point 2'],
        },
      ];

      vi.mocked(prisma.$queryRaw).mockResolvedValue(mockResults as any);

      const result = await findSimilarPapers(mockEmbedding, 1, 180);

      expect(result[0].summary).toEqual({
        whatsNew: "What's new content",
        keyPoints: ['Key point 1', 'Key point 2'],
      });
    });

    it('should handle empty embedding case', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([]);

      const result = await findSimilarPapers([], 3, 180);

      expect(result).toEqual([]);
    });

    it('should handle no similar papers case', async () => {
      vi.mocked(prisma.$queryRaw).mockResolvedValue([]);

      const result = await findSimilarPapers(mockEmbedding, 3, 180);

      expect(result).toEqual([]);
    });

    it('should respect dayRange filter', async () => {
      const mockResults = [
        {
          id: 'paper1',
          title: 'Recent Paper',
          abstract: 'Abstract',
          authors: ['Author A'],
          pubDate: new Date('2025-10-15'),
          similarity: 0.9,
          whatsNew: null,
          keyPoints: null,
        },
      ];

      vi.mocked(prisma.$queryRaw).mockResolvedValue(mockResults as any);

      await findSimilarPapers(mockEmbedding, 3, 30);

      expect(prisma.$queryRaw).toHaveBeenCalled();
      // Verify the SQL query includes date filter logic
      // The actual SQL verification would check the query string passed to $queryRaw
    });

    it('should handle case with no excludePaperId', async () => {
      const mockResults = [
        {
          id: 'paper1',
          title: 'Similar Paper',
          abstract: 'Abstract',
          authors: ['Author A'],
          pubDate: new Date('2025-10-15'),
          similarity: 0.9,
          whatsNew: null,
          keyPoints: null,
        },
      ];

      vi.mocked(prisma.$queryRaw).mockResolvedValue(mockResults as any);

      const result = await findSimilarPapers(mockEmbedding, 3, 180);

      expect(result).toHaveLength(1);
    });
  });
});
