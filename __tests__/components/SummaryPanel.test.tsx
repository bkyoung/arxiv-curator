/**
 * SummaryPanel Component Tests
 *
 * Tests for AI-generated summary display component
 * Phase 4: Summaries
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock tRPC
const mockGetSummaryQuery = vi.fn();
const mockRegenerateMutate = vi.fn();

vi.mock('@/lib/trpc', () => ({
  trpc: {
    summaries: {
      getSummary: {
        useQuery: vi.fn(),
      },
      regenerateSummary: {
        useMutation: vi.fn(),
      },
    },
  },
}));

import { SummaryPanel } from '@/components/SummaryPanel';
import { trpc } from '@/lib/trpc';

describe('SummaryPanel', () => {
  const mockSummary = {
    whatsNew:
      'This paper introduces the Transformer architecture, a novel attention-based model for sequence transduction that replaces recurrence.',
    keyPoints: [
      'Replaces recurrence with self-attention mechanisms',
      'Achieves state-of-the-art results on machine translation',
      'Enables parallel training unlike RNNs',
    ],
    markdownContent: '## Test',
    contentHash: 'hash123',
    generatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(trpc.summaries.regenerateSummary.useMutation).mockReturnValue({
      mutate: mockRegenerateMutate,
      isLoading: false,
    } as any);
  });

  describe('Loading State', () => {
    it('should display loading indicator while generating summary', () => {
      vi.mocked(trpc.summaries.getSummary.useQuery).mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
      } as any);

      render(<SummaryPanel paperId="paper-123" />);

      // Should show loading indicator with text
      expect(screen.getByTestId('summary-skeleton')).toBeInTheDocument();
      expect(screen.getByText('Generating summary...')).toBeInTheDocument();
      expect(screen.getByText(/This may take a moment as we analyze the paper with AI/)).toBeInTheDocument();
    });

    it('should not show summary content while loading', () => {
      vi.mocked(trpc.summaries.getSummary.useQuery).mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
      } as any);

      render(<SummaryPanel paperId="paper-123" />);

      expect(screen.queryByText(/What's New/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Key Points/)).not.toBeInTheDocument();
    });
  });

  describe('Summary Display', () => {
    it('should display "What\'s New" section', async () => {
      vi.mocked(trpc.summaries.getSummary.useQuery).mockReturnValue({
        data: mockSummary,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as any);

      render(<SummaryPanel paperId="paper-123" />);

      expect(screen.getByText("What's New")).toBeInTheDocument();
      expect(
        screen.getByText(/This paper introduces the Transformer architecture/)
      ).toBeInTheDocument();
    });

    it('should display "Key Points" section', () => {
      vi.mocked(trpc.summaries.getSummary.useQuery).mockReturnValue({
        data: mockSummary,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as any);

      render(<SummaryPanel paperId="paper-123" />);

      expect(screen.getByText('Key Points')).toBeInTheDocument();
    });

    it('should display all key points as bullets', () => {
      vi.mocked(trpc.summaries.getSummary.useQuery).mockReturnValue({
        data: mockSummary,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as any);

      render(<SummaryPanel paperId="paper-123" />);

      expect(
        screen.getByText(/Replaces recurrence with self-attention mechanisms/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Achieves state-of-the-art results on machine translation/)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Enables parallel training unlike RNNs/)
      ).toBeInTheDocument();
    });

    it('should handle empty key points gracefully', () => {
      const summaryWithoutPoints = {
        ...mockSummary,
        keyPoints: [],
      };

      vi.mocked(trpc.summaries.getSummary.useQuery).mockReturnValue({
        data: summaryWithoutPoints,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as any);

      render(<SummaryPanel paperId="paper-123" />);

      expect(screen.getByText("What's New")).toBeInTheDocument();
      expect(screen.getByText('Key Points')).toBeInTheDocument();
      // Should not crash, just show empty list
    });
  });

  describe('Error Handling', () => {
    it('should display error message when summary fails to load', () => {
      vi.mocked(trpc.summaries.getSummary.useQuery).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: { message: 'Failed to generate summary' },
        refetch: vi.fn(),
      } as any);

      render(<SummaryPanel paperId="paper-123" />);

      expect(
        screen.getByText(/Failed to load summary/)
      ).toBeInTheDocument();
    });

    it('should not show summary content when error occurs', () => {
      vi.mocked(trpc.summaries.getSummary.useQuery).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: { message: 'Network error' },
        refetch: vi.fn(),
      } as any);

      render(<SummaryPanel paperId="paper-123" />);

      expect(screen.queryByText("What's New")).not.toBeInTheDocument();
      expect(screen.queryByText('Key Points')).not.toBeInTheDocument();
    });
  });

  describe('Regenerate Functionality', () => {
    it('should show regenerate button when showRegenerate is true', () => {
      vi.mocked(trpc.summaries.getSummary.useQuery).mockReturnValue({
        data: mockSummary,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as any);

      render(<SummaryPanel paperId="paper-123" showRegenerate={true} />);

      expect(screen.getByRole('button', { name: /regenerate/i })).toBeInTheDocument();
    });

    it('should not show regenerate button by default', () => {
      vi.mocked(trpc.summaries.getSummary.useQuery).mockReturnValue({
        data: mockSummary,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as any);

      render(<SummaryPanel paperId="paper-123" />);

      expect(screen.queryByRole('button', { name: /regenerate/i })).not.toBeInTheDocument();
    });

    it('should call regenerate mutation when button clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(trpc.summaries.getSummary.useQuery).mockReturnValue({
        data: mockSummary,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as any);

      render(<SummaryPanel paperId="paper-123" showRegenerate={true} />);

      const regenerateButton = screen.getByRole('button', { name: /regenerate/i });
      await user.click(regenerateButton);

      expect(mockRegenerateMutate).toHaveBeenCalledWith({
        paperId: 'paper-123',
      });
    });

    it('should show loading state while regenerating', () => {
      vi.mocked(trpc.summaries.getSummary.useQuery).mockReturnValue({
        data: mockSummary,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as any);

      vi.mocked(trpc.summaries.regenerateSummary.useMutation).mockReturnValue({
        mutate: mockRegenerateMutate,
        isPending: true,
      } as any);

      render(<SummaryPanel paperId="paper-123" showRegenerate={true} />);

      expect(screen.getByText('Regenerating summary...')).toBeInTheDocument();
      expect(screen.queryByText("What's New")).not.toBeInTheDocument();
      expect(screen.queryByText('Key Points')).not.toBeInTheDocument();
    });
  });
});
