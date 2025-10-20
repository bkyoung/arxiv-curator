/**
 * LLM Interface Tests
 *
 * Tests for unified LLM interface that abstracts Ollama and Gemini
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock both LLM providers
vi.mock('@/server/lib/llm/ollama', () => ({
  generateSummaryOllama: vi.fn(),
}));

vi.mock('@/server/lib/llm/gemini', () => ({
  generateSummaryGemini: vi.fn(),
}));

import { generateSummary } from '@/server/lib/llm';
import { generateSummaryOllama } from '@/server/lib/llm/ollama';
import { generateSummaryGemini } from '@/server/lib/llm/gemini';

describe('LLM Interface', () => {
  const mockInput = {
    title: 'Test Paper Title',
    abstract: 'This is a test abstract describing a novel approach to ML.',
    authors: ['Alice Smith', 'Bob Jones'],
  };

  const mockOutput = {
    whatsNew: 'This paper introduces a new method for improving ML efficiency.',
    keyPoints: [
      'Novel architecture design',
      'Improved performance by 20%',
      'Open source implementation',
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateSummary', () => {
    it('should call ollama for local provider', async () => {
      vi.mocked(generateSummaryOllama).mockResolvedValue(mockOutput);

      const result = await generateSummary(mockInput, 'local');

      expect(generateSummaryOllama).toHaveBeenCalledWith(mockInput);
      expect(generateSummaryGemini).not.toHaveBeenCalled();
      expect(result).toEqual(mockOutput);
    });

    it('should call gemini for cloud provider', async () => {
      vi.mocked(generateSummaryGemini).mockResolvedValue(mockOutput);

      const result = await generateSummary(mockInput, 'cloud');

      expect(generateSummaryGemini).toHaveBeenCalledWith(mockInput);
      expect(generateSummaryOllama).not.toHaveBeenCalled();
      expect(result).toEqual(mockOutput);
    });

    it('should return structured output with whatsNew and keyPoints', async () => {
      vi.mocked(generateSummaryOllama).mockResolvedValue(mockOutput);

      const result = await generateSummary(mockInput, 'local');

      expect(result).toHaveProperty('whatsNew');
      expect(result).toHaveProperty('keyPoints');
      expect(typeof result.whatsNew).toBe('string');
      expect(Array.isArray(result.keyPoints)).toBe(true);
    });

    it('should propagate errors from LLM providers', async () => {
      const error = new Error('LLM service unavailable');
      vi.mocked(generateSummaryOllama).mockRejectedValue(error);

      await expect(generateSummary(mockInput, 'local')).rejects.toThrow(
        'LLM service unavailable'
      );
    });

    it('should handle empty abstract', async () => {
      const emptyInput = { ...mockInput, abstract: '' };
      vi.mocked(generateSummaryOllama).mockResolvedValue({
        whatsNew: 'No summary available',
        keyPoints: [],
      });

      const result = await generateSummary(emptyInput, 'local');

      expect(result.whatsNew).toBeTruthy();
      expect(result.keyPoints).toEqual([]);
    });
  });
});
