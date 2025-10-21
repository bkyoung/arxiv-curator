/**
 * AnalysisPanel Component Tests
 *
 * Tests for critical analysis display component
 * Phase 5: Critical Analysis
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock tRPC
const mockGetAnalysisQuery = vi.fn();
const mockRegenerateMutate = vi.fn();

vi.mock('@/lib/trpc', () => ({
  trpc: {
    analysis: {
      getAnalysis: {
        useQuery: vi.fn(),
      },
      regenerateAnalysis: {
        useMutation: vi.fn(),
      },
    },
  },
}));

import { AnalysisPanel } from '@/components/AnalysisPanel';
import { trpc } from '@/lib/trpc';

describe('AnalysisPanel', () => {
  const mockAnalysisA = {
    id: 'analysis-123',
    paperId: 'paper-123',
    userId: 'user-123',
    depth: 'A' as const,
    claimsEvidence: '| Claim | Evidence | Assessment |\n| Test Claim | Test Evidence | Supported |',
    limitations: ['Limited dataset size', 'No real-world validation'],
    neighborComparison: null,
    verdict: 'Promising',
    confidence: 0.85,
    markdownContent: '## Core Contribution\nTest contribution\n\n## Claims & Evidence\nTest claims',
    generatedAt: new Date(),
  };

  const mockAnalysisB = {
    ...mockAnalysisA,
    depth: 'B' as const,
    neighborComparison: {
      neighbors: ['paper-124', 'paper-125'],
      comparisonTable: '| Aspect | Current | Neighbor 1 | Neighbor 2 |',
    },
    markdownContent: '## Comparison vs Prior Work\nTest comparison',
  };

  const mockAnalysisC = {
    ...mockAnalysisA,
    depth: 'C' as const,
    markdownContent: '## Methodology Review\nTest methodology\n\n## Reproducibility\nTest reproducibility',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(trpc.analysis.regenerateAnalysis.useMutation).mockReturnValue({
      mutate: mockRegenerateMutate,
      isPending: false,
    } as any);
  });

  describe('Loading State', () => {
    it('should display skeleton while loading', () => {
      vi.mocked(trpc.analysis.getAnalysis.useQuery).mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
      } as any);

      render(<AnalysisPanel paperId="paper-123" depth="A" />);

      expect(screen.getByTestId('analysis-skeleton')).toBeInTheDocument();
    });

    it('should not show analysis content while loading', () => {
      vi.mocked(trpc.analysis.getAnalysis.useQuery).mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
      } as any);

      render(<AnalysisPanel paperId="paper-123" depth="A" />);

      expect(screen.queryByText(/Core Contribution/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Claims & Evidence/)).not.toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('should display error message when query fails', () => {
      vi.mocked(trpc.analysis.getAnalysis.useQuery).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        error: new Error('Failed to load analysis'),
      } as any);

      render(<AnalysisPanel paperId="paper-123" depth="A" />);

      expect(screen.getByText(/Failed to load analysis/)).toBeInTheDocument();
    });

    it('should display generic error when no analysis exists', () => {
      vi.mocked(trpc.analysis.getAnalysis.useQuery).mockReturnValue({
        data: null,
        isLoading: false,
        isError: false,
      } as any);

      render(<AnalysisPanel paperId="paper-123" depth="A" />);

      expect(screen.getByText(/No analysis available/)).toBeInTheDocument();
    });
  });

  describe('Success State - Depth A', () => {
    it('should render Depth A analysis with markdown content', () => {
      vi.mocked(trpc.analysis.getAnalysis.useQuery).mockReturnValue({
        data: mockAnalysisA,
        isLoading: false,
        isError: false,
      } as any);

      render(<AnalysisPanel paperId="paper-123" depth="A" />);

      expect(screen.getByText('Critical Analysis')).toBeInTheDocument();
      expect(screen.getByText(/Core Contribution/)).toBeInTheDocument();
      expect(screen.getByText(/Claims & Evidence/)).toBeInTheDocument();
    });

    it('should display depth badge for Depth A', () => {
      vi.mocked(trpc.analysis.getAnalysis.useQuery).mockReturnValue({
        data: mockAnalysisA,
        isLoading: false,
        isError: false,
      } as any);

      render(<AnalysisPanel paperId="paper-123" depth="A" />);

      expect(screen.getByText('Quick Critique')).toBeInTheDocument();
    });

    it('should display verdict badge', () => {
      vi.mocked(trpc.analysis.getAnalysis.useQuery).mockReturnValue({
        data: mockAnalysisA,
        isLoading: false,
        isError: false,
      } as any);

      render(<AnalysisPanel paperId="paper-123" depth="A" />);

      expect(screen.getByText('Promising')).toBeInTheDocument();
    });

    it('should display confidence level', () => {
      vi.mocked(trpc.analysis.getAnalysis.useQuery).mockReturnValue({
        data: mockAnalysisA,
        isLoading: false,
        isError: false,
      } as any);

      render(<AnalysisPanel paperId="paper-123" depth="A" />);

      expect(screen.getByText(/85% confidence/)).toBeInTheDocument();
    });
  });

  describe('Success State - Depth B', () => {
    it('should render Depth B analysis with comparison content', () => {
      vi.mocked(trpc.analysis.getAnalysis.useQuery).mockReturnValue({
        data: mockAnalysisB,
        isLoading: false,
        isError: false,
      } as any);

      render(<AnalysisPanel paperId="paper-123" depth="B" />);

      expect(screen.getByText('Comparative Critique')).toBeInTheDocument();
      expect(screen.getByText(/Comparison vs Prior Work/)).toBeInTheDocument();
    });
  });

  describe('Success State - Depth C', () => {
    it('should render Depth C analysis with deep content', () => {
      vi.mocked(trpc.analysis.getAnalysis.useQuery).mockReturnValue({
        data: mockAnalysisC,
        isLoading: false,
        isError: false,
      } as any);

      render(<AnalysisPanel paperId="paper-123" depth="C" />);

      expect(screen.getByText('Deep Analysis')).toBeInTheDocument();
      expect(screen.getByText(/Methodology Review/)).toBeInTheDocument();
      expect(screen.getByText(/Reproducibility/)).toBeInTheDocument();
    });
  });

  describe('Regenerate Functionality', () => {
    it('should show regenerate button when showRegenerate is true', () => {
      vi.mocked(trpc.analysis.getAnalysis.useQuery).mockReturnValue({
        data: mockAnalysisA,
        isLoading: false,
        isError: false,
      } as any);

      render(<AnalysisPanel paperId="paper-123" depth="A" showRegenerate />);

      expect(screen.getByRole('button', { name: /Regenerate/i })).toBeInTheDocument();
    });

    it('should not show regenerate button by default', () => {
      vi.mocked(trpc.analysis.getAnalysis.useQuery).mockReturnValue({
        data: mockAnalysisA,
        isLoading: false,
        isError: false,
      } as any);

      render(<AnalysisPanel paperId="paper-123" depth="A" />);

      expect(screen.queryByRole('button', { name: /Regenerate/i })).not.toBeInTheDocument();
    });

    it('should call regenerate mutation when button clicked', async () => {
      const user = userEvent.setup();
      vi.mocked(trpc.analysis.getAnalysis.useQuery).mockReturnValue({
        data: mockAnalysisA,
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      } as any);

      render(<AnalysisPanel paperId="paper-123" depth="A" showRegenerate />);

      const regenerateButton = screen.getByRole('button', { name: /Regenerate/i });
      await user.click(regenerateButton);

      expect(mockRegenerateMutate).toHaveBeenCalledWith({
        paperId: 'paper-123',
        depth: 'A',
      });
    });
  });
});
