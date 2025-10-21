/**
 * GenerateCritiqueDropdown Component Tests
 *
 * Tests for analysis generation dropdown component
 * Phase 5: Critical Analysis
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock tRPC
const mockRequestAnalysisMutate = vi.fn();
const mockGetAnalysisQuery = vi.fn();

vi.mock('@/lib/trpc', () => ({
  trpc: {
    analysis: {
      requestAnalysis: {
        useMutation: vi.fn(),
      },
      getAnalysis: {
        useQuery: vi.fn(),
      },
    },
  },
}));

import { GenerateCritiqueDropdown } from '@/components/GenerateCritiqueDropdown';
import { trpc } from '@/lib/trpc';

describe('GenerateCritiqueDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(trpc.analysis.requestAnalysis.useMutation).mockReturnValue({
      mutate: mockRequestAnalysisMutate,
      isPending: false,
      data: undefined,
    } as any);

    // By default, no analyses exist
    vi.mocked(trpc.analysis.getAnalysis.useQuery).mockReturnValue({
      data: null,
      isLoading: false,
    } as any);
  });

  describe('Button Rendering', () => {
    it('should render dropdown trigger button', () => {
      render(<GenerateCritiqueDropdown paperId="paper-123" />);

      expect(screen.getByRole('button', { name: /Generate Critique/i })).toBeInTheDocument();
    });

    it('should show three depth options when opened', async () => {
      const user = userEvent.setup();
      render(<GenerateCritiqueDropdown paperId="paper-123" />);

      const trigger = screen.getByRole('button', { name: /Generate Critique/i });
      await user.click(trigger);

      expect(screen.getByText('Quick Critique (A)')).toBeInTheDocument();
      expect(screen.getByText('Compare to Similar (B)')).toBeInTheDocument();
      expect(screen.getByText('Deep Analysis (C)')).toBeInTheDocument();
    });

    it('should display estimated times for each depth', async () => {
      const user = userEvent.setup();
      render(<GenerateCritiqueDropdown paperId="paper-123" />);

      const trigger = screen.getByRole('button', { name: /Generate Critique/i });
      await user.click(trigger);

      // Check that all three time estimates are present (use getAllByText for multiple matches)
      const timeEstimates = screen.getAllByText(/~\d+ min/i);
      expect(timeEstimates.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('Generation Functionality', () => {
    it('should call requestAnalysis mutation when Depth A selected', async () => {
      const user = userEvent.setup();
      render(<GenerateCritiqueDropdown paperId="paper-123" />);

      const trigger = screen.getByRole('button', { name: /Generate Critique/i });
      await user.click(trigger);

      const depthA = screen.getByText('Quick Critique (A)');
      await user.click(depthA);

      expect(mockRequestAnalysisMutate).toHaveBeenCalledWith({
        paperId: 'paper-123',
        depth: 'A',
      });
    });

    it('should call requestAnalysis mutation when Depth B selected', async () => {
      const user = userEvent.setup();
      render(<GenerateCritiqueDropdown paperId="paper-123" />);

      const trigger = screen.getByRole('button', { name: /Generate Critique/i });
      await user.click(trigger);

      const depthB = screen.getByText('Compare to Similar (B)');
      await user.click(depthB);

      expect(mockRequestAnalysisMutate).toHaveBeenCalledWith({
        paperId: 'paper-123',
        depth: 'B',
      });
    });

    it('should call requestAnalysis mutation when Depth C selected', async () => {
      const user = userEvent.setup();
      render(<GenerateCritiqueDropdown paperId="paper-123" />);

      const trigger = screen.getByRole('button', { name: /Generate Critique/i });
      await user.click(trigger);

      const depthC = screen.getByText('Deep Analysis (C)');
      await user.click(depthC);

      expect(mockRequestAnalysisMutate).toHaveBeenCalledWith({
        paperId: 'paper-123',
        depth: 'C',
      });
    });
  });

  describe('Cost Warning', () => {
    it('should show cost warning for Depth B when showCostWarning is true', async () => {
      const user = userEvent.setup();
      render(<GenerateCritiqueDropdown paperId="paper-123" showCostWarning />);

      const trigger = screen.getByRole('button', { name: /Generate Critique/i });
      await user.click(trigger);

      // Should have at least one "Uses cloud LLM" warning (for Depths B and C)
      const warnings = screen.getAllByText(/Uses cloud LLM/i);
      expect(warnings.length).toBeGreaterThanOrEqual(1);
    });

    it('should show cost warning for Depth C when showCostWarning is true', async () => {
      const user = userEvent.setup();
      render(<GenerateCritiqueDropdown paperId="paper-123" showCostWarning />);

      const trigger = screen.getByRole('button', { name: /Generate Critique/i });
      await user.click(trigger);

      // Should have two warnings total (B and C)
      const warnings = screen.getAllByText(/Uses cloud LLM/i);
      expect(warnings.length).toBe(2);
    });

    it('should not show cost warning when showCostWarning is false', async () => {
      const user = userEvent.setup();
      render(<GenerateCritiqueDropdown paperId="paper-123" showCostWarning={false} />);

      const trigger = screen.getByRole('button', { name: /Generate Critique/i });
      await user.click(trigger);

      expect(screen.queryByText(/Uses cloud LLM/i)).not.toBeInTheDocument();
    });
  });

  describe('Callback Functionality', () => {
    it('should call onAnalysisRequested callback with depth and jobId', async () => {
      const mockCallback = vi.fn();
      const user = userEvent.setup();

      vi.mocked(trpc.analysis.requestAnalysis.useMutation).mockReturnValue({
        mutate: mockRequestAnalysisMutate,
        isPending: false,
        data: {
          cached: false,
          jobId: 'job-123',
        },
      } as any);

      render(<GenerateCritiqueDropdown paperId="paper-123" onAnalysisRequested={mockCallback} />);

      const trigger = screen.getByRole('button', { name: /Generate Critique/i });
      await user.click(trigger);

      const depthA = screen.getByText('Quick Critique (A)');
      await user.click(depthA);

      // Wait for callback to be called with mutation result
      await waitFor(() => {
        expect(mockCallback).toHaveBeenCalledWith('A', 'job-123');
      });
    });

    it('should call onAnalysisRequested with cached analysis', async () => {
      const mockCallback = vi.fn();
      const user = userEvent.setup();

      const mockAnalysis = {
        id: 'analysis-123',
        paperId: 'paper-123',
        depth: 'A',
        verdict: 'Promising',
        confidence: 0.85,
        markdownContent: 'Test content',
      };

      vi.mocked(trpc.analysis.requestAnalysis.useMutation).mockReturnValue({
        mutate: mockRequestAnalysisMutate,
        isPending: false,
        data: {
          cached: true,
          analysis: mockAnalysis,
        },
      } as any);

      render(<GenerateCritiqueDropdown paperId="paper-123" onAnalysisRequested={mockCallback} />);

      const trigger = screen.getByRole('button', { name: /Generate Critique/i });
      await user.click(trigger);

      const depthA = screen.getByText('Quick Critique (A)');
      await user.click(depthA);

      await waitFor(() => {
        expect(mockCallback).toHaveBeenCalledWith('A', null);
      });
    });
  });
});
