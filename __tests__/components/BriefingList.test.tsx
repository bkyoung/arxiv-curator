/**
 * BriefingList Component Tests
 *
 * Tests for the scrollable list of paper cards
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BriefingList } from '@/components/BriefingList';

// Mock scrollIntoView (not available in jsdom)
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

const mockPapers = [
  {
    id: 'paper-1',
    arxivId: '2401.00001',
    title: 'First Paper Title',
    authors: ['Author A'],
    enriched: { topics: ['topic1'] },
    scores: [{ finalScore: 0.8, whyShown: { 'Personal Fit': 0.8 } }],
  },
  {
    id: 'paper-2',
    arxivId: '2401.00002',
    title: 'Second Paper Title',
    authors: ['Author B'],
    enriched: { topics: ['topic2'] },
    scores: [{ finalScore: 0.7, whyShown: { Evidence: 0.7 } }],
  },
  {
    id: 'paper-3',
    arxivId: '2401.00003',
    title: 'Third Paper Title',
    authors: ['Author C'],
    enriched: { topics: ['topic3'] },
    scores: [{ finalScore: 0.6, whyShown: { Novelty: 0.6 } }],
  },
];

describe('BriefingList', () => {
  it('should render all paper cards', () => {
    render(
      <BriefingList papers={mockPapers} selectedIndex={0} onSelectPaper={() => {}} />
    );

    expect(screen.getByText('First Paper Title')).toBeInTheDocument();
    expect(screen.getByText('Second Paper Title')).toBeInTheDocument();
    expect(screen.getByText('Third Paper Title')).toBeInTheDocument();
  });

  it('should highlight selected paper', () => {
    const { container } = render(
      <BriefingList papers={mockPapers} selectedIndex={1} onSelectPaper={() => {}} />
    );

    // Second paper should be highlighted
    const cards = container.querySelectorAll('.border-primary');
    expect(cards).toHaveLength(1);
  });

  it('should call onSelectPaper when card is clicked', async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();

    render(
      <BriefingList papers={mockPapers} selectedIndex={0} onSelectPaper={handleSelect} />
    );

    const secondCard = screen.getByText('Second Paper Title').closest('div');
    await user.click(secondCard!);

    expect(handleSelect).toHaveBeenCalledWith(1);
  });

  it('should render empty state when no papers', () => {
    render(<BriefingList papers={[]} selectedIndex={0} onSelectPaper={() => {}} />);

    expect(screen.getByText(/no papers/i)).toBeInTheDocument();
  });

  it('should handle selectedIndex out of bounds gracefully', () => {
    render(
      <BriefingList papers={mockPapers} selectedIndex={999} onSelectPaper={() => {}} />
    );

    // Should render without errors
    expect(screen.getByText('First Paper Title')).toBeInTheDocument();
  });
});
