/**
 * PaperCard Component Tests
 *
 * Tests for the paper card in briefing list
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PaperCard } from '@/components/PaperCard';

const mockPaper = {
  id: 'paper-1',
  arxivId: '2401.12345',
  title: 'Advances in Large Language Model Reasoning with Chain of Thought',
  authors: ['Alice Smith', 'Bob Jones', 'Carol White', 'David Brown'],
  abstract: 'We present a novel approach to improving reasoning...',
  enriched: {
    topics: ['reasoning', 'language-models', 'prompting'],
    facets: ['planning', 'evaluation'],
    hasCode: true,
    hasBaselines: true,
    hasAblations: false,
  },
  scores: [
    {
      finalScore: 0.85,
      novelty: 0.7,
      evidence: 0.9,
      personalFit: 0.8,
      whyShown: {
        'Personal Fit': 0.8,
        Evidence: 0.9,
        Novelty: 0.7,
      },
    },
  ],
};

describe('PaperCard', () => {
  it('should render paper title', () => {
    render(<PaperCard paper={mockPaper} isActive={false} onClick={() => {}} />);

    expect(
      screen.getByText('Advances in Large Language Model Reasoning with Chain of Thought')
    ).toBeInTheDocument();
  });

  it('should display score badge as percentage', () => {
    render(<PaperCard paper={mockPaper} isActive={false} onClick={() => {}} />);

    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('should display first 3 authors with +N more', () => {
    render(<PaperCard paper={mockPaper} isActive={false} onClick={() => {}} />);

    expect(screen.getByText(/Alice Smith/)).toBeInTheDocument();
    expect(screen.getByText(/Bob Jones/)).toBeInTheDocument();
    expect(screen.getByText(/Carol White/)).toBeInTheDocument();
    expect(screen.getByText(/\+1 more/)).toBeInTheDocument();
  });

  it('should display all authors when count is 3 or less', () => {
    const paperWith3Authors = {
      ...mockPaper,
      authors: ['Alice Smith', 'Bob Jones', 'Carol White'],
    };

    render(<PaperCard paper={paperWith3Authors} isActive={false} onClick={() => {}} />);

    expect(screen.getByText(/Alice Smith/)).toBeInTheDocument();
    expect(screen.getByText(/Bob Jones/)).toBeInTheDocument();
    expect(screen.getByText(/Carol White/)).toBeInTheDocument();
    expect(screen.queryByText(/\+/)).not.toBeInTheDocument();
  });

  it('should display up to 3 topic badges', () => {
    render(<PaperCard paper={mockPaper} isActive={false} onClick={() => {}} />);

    expect(screen.getByText('reasoning')).toBeInTheDocument();
    expect(screen.getByText('language-models')).toBeInTheDocument();
    expect(screen.getByText('prompting')).toBeInTheDocument();
  });

  it('should display evidence badges when present', () => {
    render(<PaperCard paper={mockPaper} isActive={false} onClick={() => {}} />);

    expect(screen.getByText('Code')).toBeInTheDocument();
    expect(screen.getByText('Baselines')).toBeInTheDocument();
    expect(screen.queryByText('Ablations')).not.toBeInTheDocument();
  });

  it('should display top 2 "why shown" signals', () => {
    render(<PaperCard paper={mockPaper} isActive={false} onClick={() => {}} />);

    // Should show Evidence (0.9) and Personal Fit (0.8), not Novelty (0.7)
    expect(screen.getByText(/Evidence/)).toBeInTheDocument();
    expect(screen.getByText(/Personal Fit/)).toBeInTheDocument();
  });

  it('should highlight when active', () => {
    const { container } = render(
      <PaperCard paper={mockPaper} isActive={true} onClick={() => {}} />
    );

    const card = container.firstChild;
    expect(card).toHaveClass('border-primary');
  });

  it('should not highlight when inactive', () => {
    const { container } = render(
      <PaperCard paper={mockPaper} isActive={false} onClick={() => {}} />
    );

    const card = container.firstChild;
    expect(card).not.toHaveClass('border-primary');
  });

  it('should call onClick when clicked', async () => {
    const user = userEvent.setup();
    const handleClick = vi.fn();

    const { container } = render(
      <PaperCard paper={mockPaper} isActive={false} onClick={handleClick} />
    );

    const card = container.firstChild as HTMLElement;
    await user.click(card);

    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
