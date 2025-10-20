/**
 * Google Gemini LLM Integration Tests
 *
 * Tests for cloud LLM integration using Google Gemini (2.5-flash)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock Google Generative AI SDK
vi.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
      getGenerativeModel: vi.fn(),
    })),
  };
});

import { generateSummaryGemini } from '@/server/lib/llm/gemini';
import { GoogleGenerativeAI } from '@google/generative-ai';

describe('Gemini LLM Integration', () => {
  let mockGenerateContent: ReturnType<typeof vi.fn>;
  let mockGetGenerativeModel: ReturnType<typeof vi.fn>;

  const mockInput = {
    title: 'BERT: Pre-training of Deep Bidirectional Transformers',
    abstract:
      'We introduce a new language representation model called BERT, which stands for Bidirectional Encoder Representations from Transformers...',
    authors: ['Jacob Devlin', 'Ming-Wei Chang'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGenerateContent = vi.fn();
    mockGetGenerativeModel = vi.fn().mockReturnValue({
      generateContent: mockGenerateContent,
    });

    vi.mocked(GoogleGenerativeAI).mockImplementation(
      () =>
        ({
          getGenerativeModel: mockGetGenerativeModel,
        } as any)
    );
  });

  describe('generateSummaryGemini', () => {
    it('should initialize Google AI with API key', async () => {
      const originalEnv = process.env.GOOGLE_AI_API_KEY;
      process.env.GOOGLE_AI_API_KEY = 'test-api-key';

      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              whats_new: 'Test',
              key_points: ['Test'],
            }),
        },
      });

      await generateSummaryGemini(mockInput);

      expect(GoogleGenerativeAI).toHaveBeenCalledWith('test-api-key');

      process.env.GOOGLE_AI_API_KEY = originalEnv;
    });

    it('should use gemini-2.5-flash model', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              whats_new: 'Test',
              key_points: ['Test'],
            }),
        },
      });

      await generateSummaryGemini(mockInput);

      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemini-2.5-flash',
        })
      );
    });

    it('should request JSON response format', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              whats_new: 'Test',
              key_points: ['Test'],
            }),
        },
      });

      await generateSummaryGemini(mockInput);

      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({
          generationConfig: expect.objectContaining({
            responseMimeType: 'application/json',
          }),
        })
      );
    });

    it('should parse JSON response correctly', async () => {
      const mockResponse = {
        whats_new: 'BERT introduces bidirectional pre-training for NLP tasks.',
        key_points: [
          'Pre-trains deep bidirectional representations',
          'Fine-tunes on downstream tasks',
          'Achieves SOTA on 11 NLP benchmarks',
        ],
      };

      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => JSON.stringify(mockResponse),
        },
      });

      const result = await generateSummaryGemini(mockInput);

      expect(result.whatsNew).toBe(mockResponse.whats_new);
      expect(result.keyPoints).toEqual(mockResponse.key_points);
    });

    it('should handle rate limiting errors', async () => {
      mockGenerateContent.mockRejectedValue({
        status: 429,
        message: 'Resource has been exhausted (e.g. check quota).',
      });

      await expect(generateSummaryGemini(mockInput)).rejects.toThrow();
    });

    it('should handle API key errors', async () => {
      const originalEnv = process.env.GOOGLE_AI_API_KEY;
      delete process.env.GOOGLE_AI_API_KEY;

      await expect(generateSummaryGemini(mockInput)).rejects.toThrow();

      process.env.GOOGLE_AI_API_KEY = originalEnv;
    });

    it('should handle invalid JSON response', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () => 'Not a JSON response',
        },
      });

      await expect(generateSummaryGemini(mockInput)).rejects.toThrow();
    });

    it('should use low temperature for consistency', async () => {
      mockGenerateContent.mockResolvedValue({
        response: {
          text: () =>
            JSON.stringify({
              whats_new: 'Test',
              key_points: ['Test'],
            }),
        },
      });

      await generateSummaryGemini(mockInput);

      expect(mockGetGenerativeModel).toHaveBeenCalledWith(
        expect.objectContaining({
          generationConfig: expect.objectContaining({
            temperature: 0.3,
          }),
        })
      );
    });
  });
});
