import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { WhyShown } from '@/components/WhyShown';

describe('WhyShown', () => {
  const mockWhyShown = {
    novelty: 0.8,
    evidence: 0.9,
    velocity: 0.5,
    personalFit: 0.7,
    labPrior: 1.0,
    mathPenalty: 0.3,
  };

  it('should render explanation title', () => {
    render(<WhyShown whyShown={mockWhyShown} />);

    expect(screen.getByText(/why shown/i)).toBeInTheDocument();
  });

  it('should highlight top contributing signals', () => {
    render(<WhyShown whyShown={mockWhyShown} />);

    // Lab Prior (1.0) and Evidence (0.9) should be highlighted as top contributors
    const labPriorElements = screen.getAllByText(/lab prior/i);
    const evidenceElements = screen.getAllByText(/evidence/i);

    expect(labPriorElements.length).toBeGreaterThan(0);
    expect(evidenceElements.length).toBeGreaterThan(0);
  });

  it('should show signal descriptions', () => {
    render(<WhyShown whyShown={mockWhyShown} />);

    // Should have descriptions for top signals
    expect(screen.getByText(/from a research lab you follow/i)).toBeInTheDocument();
    expect(screen.getByText(/strong evidence quality/i)).toBeInTheDocument();
  });

  it('should order signals by contribution', () => {
    render(<WhyShown whyShown={mockWhyShown} />);

    // Lab Prior (1.0) should appear before Evidence (0.9)
    const allText = screen.getByRole('article').textContent || '';
    const labPriorIndex = allText.indexOf('Lab Prior');
    const evidenceIndex = allText.indexOf('Evidence');

    expect(labPriorIndex).toBeLessThan(evidenceIndex);
  });

  it('should handle all zero scores', () => {
    const zeroScores = {
      novelty: 0,
      evidence: 0,
      velocity: 0,
      personalFit: 0,
      labPrior: 0,
      mathPenalty: 0,
    };

    render(<WhyShown whyShown={zeroScores} />);

    expect(screen.getByText(/why shown/i)).toBeInTheDocument();
    // Should still render without errors
  });

  it('should show top 3 signals by default', () => {
    render(<WhyShown whyShown={mockWhyShown} />);

    // Should show Lab Prior (1.0), Evidence (0.9), Novelty (0.8)
    const labPriorElements = screen.getAllByText(/lab prior/i);
    const evidenceElements = screen.getAllByText(/evidence/i);
    const noveltyElements = screen.getAllByText(/novelty/i);

    expect(labPriorElements.length).toBeGreaterThan(0);
    expect(evidenceElements.length).toBeGreaterThan(0);
    expect(noveltyElements.length).toBeGreaterThan(0);
  });

  it('should handle matched topics', () => {
    const matchedTopics = ['agents', 'rag'];

    render(<WhyShown whyShown={mockWhyShown} matchedTopics={matchedTopics} />);

    // Should display matched topics
    expect(screen.getByText(/agents/i)).toBeInTheDocument();
    expect(screen.getByText(/rag/i)).toBeInTheDocument();
  });

  it('should handle matched keywords', () => {
    const matchedKeywords = ['planning', 'tool use'];

    render(<WhyShown whyShown={mockWhyShown} matchedKeywords={matchedKeywords} />);

    // Should display matched keywords
    expect(screen.getByText(/planning/i)).toBeInTheDocument();
    expect(screen.getByText(/tool use/i)).toBeInTheDocument();
  });

  it('should render in collapsible mode', () => {
    render(<WhyShown whyShown={mockWhyShown} collapsible />);

    // Should have a clickable trigger
    const trigger = screen.getByRole('button');
    expect(trigger).toBeInTheDocument();
  });
});
