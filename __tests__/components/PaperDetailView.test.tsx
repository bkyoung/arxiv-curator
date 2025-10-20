/**
 * PaperDetailView Component Tests
 *
 * Tests for the full paper detail pane
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PaperDetailView } from '@/components/PaperDetailView';

// Mock FeedbackActions component
vi.mock('@/components/FeedbackActions', () => ({
  FeedbackActions: ({ onSave }: any) => (
    <div data-testid="feedback-actions">
      <button onClick={onSave}>Save</button>
    </div>
  ),
}));

// Mock ScoreBreakdown component
vi.mock('@/components/ScoreBreakdown', () => ({
  ScoreBreakdown: ({ score }: any) => (
    <div data-testid="score-breakdown">Score: {score.finalScore}</div>
  ),
}));

// Mock WhyShown component
vi.mock('@/components/WhyShown', () => ({
  WhyShown: ({ whyShown }: any) => (
    <div data-testid="why-shown">Why: {JSON.stringify(whyShown)}</div>
  ),
}));

const mockPaper = {
  id: 'paper-1',
  arxivId: '2401.12345',
  version: 1,
  title: 'Advances in Large Language Model Reasoning with Chain of Thought',
  authors: ['Alice Smith', 'Bob Jones', 'Carol White'],
  abstract:
    'We present a novel approach to improving reasoning capabilities in large language models through the use of chain-of-thought prompting. Our method demonstrates significant improvements over baseline approaches.',
  primaryCategory: 'cs.AI',
  categories: ['cs.AI', 'cs.CL'],
  pubDate: new Date('2024-01-15'),
  pdfUrl: 'https://arxiv.org/pdf/2401.12345',
  enriched: {
    topics: ['reasoning', 'language-models', 'prompting'],
    facets: ['planning', 'evaluation'],
    mathDepth: 0.3,
    hasCode: true,
    hasBaselines: true,
    hasAblations: false,
    hasData: false,
  },
  scores: [
    {
      id: 'score-1',
      finalScore: 0.85,
      novelty: 0.7,
      evidence: 0.9,
      velocity: 0.5,
      personalFit: 0.8,
      labPrior: 0.0,
      mathPenalty: 0.1,
      whyShown: {
        'Personal Fit': 0.8,
        Evidence: 0.9,
        Novelty: 0.7,
      },
    },
  ],
};

describe('PaperDetailView', () => {
  it('should render full title', () => {
    render(<PaperDetailView paper={mockPaper} onFeedback={() => {}} />);

    expect(
      screen.getByText('Advances in Large Language Model Reasoning with Chain of Thought')
    ).toBeInTheDocument();
  });

  it('should display all authors', () => {
    render(<PaperDetailView paper={mockPaper} onFeedback={() => {}} />);

    expect(screen.getByText(/Alice Smith/)).toBeInTheDocument();
    expect(screen.getByText(/Bob Jones/)).toBeInTheDocument();
    expect(screen.getByText(/Carol White/)).toBeInTheDocument();
  });

  it('should display publication date and category', () => {
    render(<PaperDetailView paper={mockPaper} onFeedback={() => {}} />);

    // Date may vary by timezone, so just check for year
    expect(screen.getByText(/2024/)).toBeInTheDocument();
    expect(screen.getByText(/cs.AI/)).toBeInTheDocument();
  });

  it('should render FeedbackActions component', () => {
    render(<PaperDetailView paper={mockPaper} onFeedback={() => {}} />);

    expect(screen.getByTestId('feedback-actions')).toBeInTheDocument();
  });

  it('should display link to PDF', () => {
    render(<PaperDetailView paper={mockPaper} onFeedback={() => {}} />);

    const pdfLink = screen.getByText(/View PDF/i).closest('a');
    expect(pdfLink).toHaveAttribute('href', 'https://arxiv.org/pdf/2401.12345');
    expect(pdfLink).toHaveAttribute('target', '_blank');
  });

  it('should render ScoreBreakdown component', () => {
    render(<PaperDetailView paper={mockPaper} onFeedback={() => {}} />);

    expect(screen.getByTestId('score-breakdown')).toBeInTheDocument();
  });

  it('should render WhyShown component', () => {
    render(<PaperDetailView paper={mockPaper} onFeedback={() => {}} />);

    expect(screen.getByTestId('why-shown')).toBeInTheDocument();
  });

  it('should display full abstract', () => {
    render(<PaperDetailView paper={mockPaper} onFeedback={() => {}} />);

    expect(
      screen.getByText(
        /We present a novel approach to improving reasoning capabilities/
      )
    ).toBeInTheDocument();
  });

  it('should display all topic badges', () => {
    render(<PaperDetailView paper={mockPaper} onFeedback={() => {}} />);

    expect(screen.getByText('reasoning')).toBeInTheDocument();
    expect(screen.getByText('language-models')).toBeInTheDocument();
    expect(screen.getByText('prompting')).toBeInTheDocument();
  });

  it('should display evidence badges', () => {
    render(<PaperDetailView paper={mockPaper} onFeedback={() => {}} />);

    expect(screen.getByText('Code')).toBeInTheDocument();
    expect(screen.getByText('Baselines')).toBeInTheDocument();
  });

  it('should display math depth indicator', () => {
    render(<PaperDetailView paper={mockPaper} onFeedback={() => {}} />);

    expect(screen.getByText(/Math Depth/i)).toBeInTheDocument();
    expect(screen.getByText(/30%/)).toBeInTheDocument(); // 0.3 * 100
  });

  it('should handle missing enrichment data gracefully', () => {
    const paperWithoutEnrichment = {
      ...mockPaper,
      enriched: null,
    };

    render(<PaperDetailView paper={paperWithoutEnrichment} onFeedback={() => {}} />);

    // Should still render title and other core info
    expect(screen.getByText(mockPaper.title)).toBeInTheDocument();
  });
});
