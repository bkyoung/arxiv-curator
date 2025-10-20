/**
 * Ollama LLM Integration Tests
 *
 * Tests for local LLM integration using Ollama (gemma3:27b)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock ollama library
vi.mock('ollama', () => {
  return {
    Ollama: vi.fn().mockImplementation(() => ({
      chat: vi.fn(),
    })),
  };
});

import { generateSummaryOllama } from '@/server/lib/llm/ollama';
import { Ollama } from 'ollama';

describe('Ollama LLM Integration', () => {
  let mockChat: ReturnType<typeof vi.fn>;

  const mockInput = {
    title: 'Attention Is All You Need',
    abstract:
      'The dominant sequence transduction models are based on complex recurrent or convolutional neural networks...',
    authors: ['Ashish Vaswani', 'Noam Shazeer'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockChat = vi.fn();
    vi.mocked(Ollama).mockImplementation(
      () =>
        ({
          chat: mockChat,
        } as any)
    );
  });

  describe('generateSummaryOllama', () => {
    it('should call ollama chat with correct parameters', async () => {
      mockChat.mockResolvedValue({
        message: {
          content: JSON.stringify({
            whats_new: 'Introduces Transformer architecture.',
            key_points: ['Self-attention mechanism', 'No recurrence'],
          }),
        },
      });

      await generateSummaryOllama(mockInput);

      expect(mockChat).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gemma3:27b',
          format: 'json',
          options: expect.objectContaining({
            temperature: 0.3,
          }),
        })
      );
    });

    it('should include title and abstract in prompt', async () => {
      mockChat.mockResolvedValue({
        message: {
          content: JSON.stringify({
            whats_new: 'Test summary',
            key_points: ['Point 1'],
          }),
        },
      });

      await generateSummaryOllama(mockInput);

      const callArgs = mockChat.mock.calls[0][0];
      const userMessage = callArgs.messages.find((m: any) => m.role === 'user');

      expect(userMessage.content).toContain(mockInput.title);
      expect(userMessage.content).toContain(mockInput.abstract);
    });

    it('should parse JSON response correctly', async () => {
      const mockResponse = {
        whats_new: 'This paper introduces the Transformer architecture.',
        key_points: [
          'Replaces recurrence with self-attention',
          'Achieves state-of-the-art results',
          'Enables parallel training',
        ],
      };

      mockChat.mockResolvedValue({
        message: {
          content: JSON.stringify(mockResponse),
        },
      });

      const result = await generateSummaryOllama(mockInput);

      expect(result.whatsNew).toBe(mockResponse.whats_new);
      expect(result.keyPoints).toEqual(mockResponse.key_points);
    });

    it('should handle connection errors', async () => {
      mockChat.mockRejectedValue({
        code: 'ECONNREFUSED',
        message: 'connect ECONNREFUSED 127.0.0.1:11434',
      });

      await expect(generateSummaryOllama(mockInput)).rejects.toThrow();
    });

    it('should handle invalid JSON response', async () => {
      mockChat.mockResolvedValue({
        message: {
          content: 'Invalid JSON response',
        },
      });

      await expect(generateSummaryOllama(mockInput)).rejects.toThrow();
    });

    it('should handle missing fields in response', async () => {
      mockChat.mockResolvedValue({
        message: {
          content: JSON.stringify({
            whats_new: 'Summary only',
            // Missing key_points
          }),
        },
      });

      await expect(generateSummaryOllama(mockInput)).rejects.toThrow();
    });

    it('should use low temperature for consistency', async () => {
      mockChat.mockResolvedValue({
        message: {
          content: JSON.stringify({
            whats_new: 'Test',
            key_points: ['Test'],
          }),
        },
      });

      await generateSummaryOllama(mockInput);

      const callArgs = mockChat.mock.calls[0][0];
      expect(callArgs.options.temperature).toBeLessThanOrEqual(0.3);
    });

    it('should request JSON format output', async () => {
      mockChat.mockResolvedValue({
        message: {
          content: JSON.stringify({
            whats_new: 'Test',
            key_points: ['Test'],
          }),
        },
      });

      await generateSummaryOllama(mockInput);

      const callArgs = mockChat.mock.calls[0][0];
      expect(callArgs.format).toBe('json');
    });
  });
});
