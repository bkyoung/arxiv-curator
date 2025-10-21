/**
 * PDF Parser Tests
 *
 * Tests for PDF download, caching, text extraction, and section detection
 * Phase 5: Critical Analysis
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  downloadPDF,
  extractTextFromPDF,
  extractIntro,
  extractConclusion,
  extractMethodology,
  downloadAndParsePDF
} from '@/server/lib/pdf-parser';

// Mock AWS S3
vi.mock('@aws-sdk/client-s3', () => {
  return {
    S3: vi.fn(),
    GetObjectCommand: vi.fn(),
    PutObjectCommand: vi.fn(),
  };
});

// Mock pdf-parse
vi.mock('pdf-parse', () => ({
  default: vi.fn(),
}));

// Mock fetch
global.fetch = vi.fn();

describe('PDF Parser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('downloadPDF', () => {
    it('should download PDF from arXiv URL', async () => {
      const mockPdfBuffer = Buffer.from('mock pdf content');

      // Mock S3 getObject to throw (not in cache)
      const { S3 } = await import('@aws-sdk/client-s3');
      const mockS3Instance = {
        getObject: vi.fn().mockRejectedValue(new Error('Not found')),
        putObject: vi.fn().mockResolvedValue({}),
      };
      vi.mocked(S3).mockImplementation(() => mockS3Instance as any);

      // Mock fetch to return PDF
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        arrayBuffer: async () => mockPdfBuffer.buffer,
      } as any);

      const result = await downloadPDF('https://arxiv.org/pdf/1234.5678.pdf', 'paper123');

      expect(global.fetch).toHaveBeenCalledWith('https://arxiv.org/pdf/1234.5678.pdf');
      expect(result).toBeInstanceOf(Buffer);
      expect(mockS3Instance.putObject).toHaveBeenCalled();
    });

    it('should return cached PDF if available in MinIO', async () => {
      const mockPdfBuffer = Buffer.from('cached pdf content');

      // Mock S3 getObject to return cached PDF
      const { S3 } = await import('@aws-sdk/client-s3');
      const mockS3Instance = {
        getObject: vi.fn().mockResolvedValue({
          Body: {
            transformToByteArray: async () => new Uint8Array(mockPdfBuffer),
          },
        }),
        putObject: vi.fn(),
      };
      vi.mocked(S3).mockImplementation(() => mockS3Instance as any);

      const result = await downloadPDF('https://arxiv.org/pdf/1234.5678.pdf', 'paper123');

      expect(mockS3Instance.getObject).toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
      expect(result).toBeInstanceOf(Buffer);
    });

    it('should throw error if PDF download fails', async () => {
      // Mock S3 getObject to throw (not in cache)
      const { S3 } = await import('@aws-sdk/client-s3');
      const mockS3Instance = {
        getObject: vi.fn().mockRejectedValue(new Error('Not found')),
        putObject: vi.fn(),
      };
      vi.mocked(S3).mockImplementation(() => mockS3Instance as any);

      // Mock fetch to fail
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        statusText: 'Not Found',
      } as any);

      await expect(
        downloadPDF('https://arxiv.org/pdf/invalid.pdf', 'paper123')
      ).rejects.toThrow('Failed to download PDF');
    });

    it('should cache PDF in MinIO after download', async () => {
      const mockPdfBuffer = Buffer.from('new pdf content');

      // Mock S3 getObject to throw (not in cache)
      const { S3 } = await import('@aws-sdk/client-s3');
      const mockS3Instance = {
        getObject: vi.fn().mockRejectedValue(new Error('Not found')),
        putObject: vi.fn().mockResolvedValue({}),
      };
      vi.mocked(S3).mockImplementation(() => mockS3Instance as any);

      // Mock fetch to return PDF
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        arrayBuffer: async () => mockPdfBuffer.buffer,
      } as any);

      await downloadPDF('https://arxiv.org/pdf/1234.5678.pdf', 'paper123');

      expect(mockS3Instance.putObject).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'arxiv-pdfs',
          Key: 'paper123.pdf',
          ContentType: 'application/pdf',
        })
      );
    });

    it('should use paperId as cache key', async () => {
      const mockPdfBuffer = Buffer.from('pdf content');

      const { S3 } = await import('@aws-sdk/client-s3');
      const mockS3Instance = {
        getObject: vi.fn().mockResolvedValue({
          Body: {
            transformToByteArray: async () => new Uint8Array(mockPdfBuffer),
          },
        }),
        putObject: vi.fn(),
      };
      vi.mocked(S3).mockImplementation(() => mockS3Instance as any);

      await downloadPDF('https://arxiv.org/pdf/1234.5678.pdf', 'paper-abc-123');

      expect(mockS3Instance.getObject).toHaveBeenCalledWith(
        expect.objectContaining({
          Bucket: 'arxiv-pdfs',
          Key: 'paper-abc-123.pdf',
        })
      );
    });
  });

  describe('extractTextFromPDF', () => {
    it('should extract text from PDF buffer', async () => {
      const mockPdfBuffer = Buffer.from('mock pdf');
      const mockText = 'This is extracted text from the PDF.';

      const pdfParse = (await import('pdf-parse')).default;
      vi.mocked(pdfParse).mockResolvedValue({
        text: mockText,
        numpages: 10,
        info: {},
        metadata: null,
        version: '1.10.100',
      } as any);

      const result = await extractTextFromPDF(mockPdfBuffer);

      expect(pdfParse).toHaveBeenCalledWith(mockPdfBuffer);
      expect(result).toBe(mockText);
    });

    it('should handle PDF parsing errors', async () => {
      const mockPdfBuffer = Buffer.from('invalid pdf');

      const pdfParse = (await import('pdf-parse')).default;
      vi.mocked(pdfParse).mockRejectedValue(new Error('Invalid PDF format'));

      await expect(extractTextFromPDF(mockPdfBuffer)).rejects.toThrow('Invalid PDF format');
    });

    it('should handle empty PDFs', async () => {
      const mockPdfBuffer = Buffer.from('empty pdf');

      const pdfParse = (await import('pdf-parse')).default;
      vi.mocked(pdfParse).mockResolvedValue({
        text: '',
        numpages: 0,
        info: {},
        metadata: null,
        version: '1.10.100',
      } as any);

      const result = await extractTextFromPDF(mockPdfBuffer);

      expect(result).toBe('');
    });
  });

  describe('extractIntro', () => {
    it('should extract introduction section from PDF text', () => {
      const pdfText = `
Abstract
This is the abstract.

1 Introduction
This is the introduction section.
It contains important background information.
This explains the problem we are solving.

2 Related Work
This is the related work section.
      `;

      const result = extractIntro(pdfText);

      expect(result).toBeTruthy();
      expect(result).toContain('introduction section');
      expect(result).not.toContain('Related Work');
    });

    it('should handle introduction without section number', () => {
      const pdfText = `
Abstract
This is the abstract.

Introduction
This is the introduction.

Methods
This is the methods section.
      `;

      const result = extractIntro(pdfText);

      expect(result).toBeTruthy();
      expect(result).toContain('introduction');
    });

    it('should return null if no introduction found', () => {
      const pdfText = `
Abstract
This is the abstract.

Background
This is background.

Methods
This is methods.
      `;

      const result = extractIntro(pdfText);

      expect(result).toBeNull();
    });

    it('should limit extracted text to reasonable length', () => {
      const longIntro = 'A'.repeat(5000);
      const pdfText = `
1 Introduction
${longIntro}

2 Methods
      `;

      const result = extractIntro(pdfText);

      expect(result).toBeTruthy();
      expect(result!.length).toBeLessThanOrEqual(3100); // Match regex limit + some buffer
    });
  });

  describe('extractConclusion', () => {
    it('should extract conclusion section from PDF text', () => {
      const pdfText = `
4 Results
These are the results.

5 Conclusion
This is the conclusion section.
We have shown that our method works.
Future work includes extending this to other domains.

References
[1] Smith et al.
      `;

      const result = extractConclusion(pdfText);

      expect(result).toBeTruthy();
      expect(result).toContain('conclusion section');
      expect(result).not.toContain('References');
    });

    it('should handle "Conclusions" plural', () => {
      const pdfText = `
Results
These are results.

Conclusions
These are the conclusions.

Acknowledgments
Thanks to everyone.
      `;

      const result = extractConclusion(pdfText);

      expect(result).toBeTruthy();
      expect(result).toContain('conclusions');
    });

    it('should return null if no conclusion found', () => {
      const pdfText = `
Methods
This is methods.

Results
This is results.

References
[1] Author
      `;

      const result = extractConclusion(pdfText);

      expect(result).toBeNull();
    });

    it('should limit extracted text to reasonable length', () => {
      const longConclusion = 'B'.repeat(3000);
      const pdfText = `
Conclusion
${longConclusion}

References
      `;

      const result = extractConclusion(pdfText);

      expect(result).toBeTruthy();
      expect(result!.length).toBeLessThanOrEqual(2100); // Match regex limit + buffer
    });
  });

  describe('extractMethodology', () => {
    it('should extract methodology section', () => {
      const pdfText = `
2 Introduction
This is intro.

3 Methodology
This describes our approach.
We use a novel technique.

4 Experiments
These are experiments.
      `;

      const result = extractMethodology(pdfText);

      expect(result).toBeTruthy();
      expect(result).toContain('approach');
      expect(result).not.toContain('Experiments');
    });

    it('should handle "Method" singular', () => {
      const pdfText = `
Introduction
Intro text.

Method
This is the method.

Results
Results text.
      `;

      const result = extractMethodology(pdfText);

      expect(result).toBeTruthy();
      expect(result).toContain('method');
    });

    it('should handle "Approach" as method section', () => {
      const pdfText = `
Background
Background text.

Approach
This is our approach.

Evaluation
Evaluation text.
      `;

      const result = extractMethodology(pdfText);

      expect(result).toBeTruthy();
      expect(result).toContain('approach');
    });

    it('should return null if no methodology found', () => {
      const pdfText = `
Introduction
Intro.

Results
Results.

Conclusion
Conclusion.
      `;

      const result = extractMethodology(pdfText);

      expect(result).toBeNull();
    });
  });

  describe('downloadAndParsePDF', () => {
    it('should download and extract text in one call', async () => {
      const mockPdfBuffer = Buffer.from('mock pdf');
      const mockText = 'Extracted text';

      // Mock S3
      const { S3 } = await import('@aws-sdk/client-s3');
      const mockS3Instance = {
        getObject: vi.fn().mockRejectedValue(new Error('Not found')),
        putObject: vi.fn().mockResolvedValue({}),
      };
      vi.mocked(S3).mockImplementation(() => mockS3Instance as any);

      // Mock fetch
      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        arrayBuffer: async () => mockPdfBuffer.buffer,
      } as any);

      // Mock pdf-parse
      const pdfParse = (await import('pdf-parse')).default;
      vi.mocked(pdfParse).mockResolvedValue({
        text: mockText,
        numpages: 5,
        info: {},
        metadata: null,
        version: '1.10.100',
      } as any);

      const result = await downloadAndParsePDF('https://arxiv.org/pdf/1234.pdf', 'paper123');

      expect(result).toBe(mockText);
      expect(global.fetch).toHaveBeenCalled();
      expect(pdfParse).toHaveBeenCalled();
    });

    it('should use cached PDF if available', async () => {
      const mockPdfBuffer = Buffer.from('cached pdf');
      const mockText = 'Cached text';

      // Mock S3 to return cached PDF
      const { S3 } = await import('@aws-sdk/client-s3');
      const mockS3Instance = {
        getObject: vi.fn().mockResolvedValue({
          Body: {
            transformToByteArray: async () => new Uint8Array(mockPdfBuffer),
          },
        }),
        putObject: vi.fn(),
      };
      vi.mocked(S3).mockImplementation(() => mockS3Instance as any);

      // Mock pdf-parse
      const pdfParse = (await import('pdf-parse')).default;
      vi.mocked(pdfParse).mockResolvedValue({
        text: mockText,
        numpages: 3,
        info: {},
        metadata: null,
        version: '1.10.100',
      } as any);

      const result = await downloadAndParsePDF('https://arxiv.org/pdf/1234.pdf', 'paper123');

      expect(result).toBe(mockText);
      expect(global.fetch).not.toHaveBeenCalled(); // Should not download
      expect(pdfParse).toHaveBeenCalled();
    });
  });
});
