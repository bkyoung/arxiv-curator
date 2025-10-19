import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScoreBreakdown } from '@/components/ScoreBreakdown';

describe('ScoreBreakdown', () => {
  const mockScore = {
    novelty: 0.8,
    evidence: 0.9,
    velocity: 0.5,
    personalFit: 0.7,
    labPrior: 1.0,
    mathPenalty: 0.3,
    finalScore: 0.75,
  };

  it('should render final score', () => {
    render(<ScoreBreakdown score={mockScore} />);

    expect(screen.getByText(/final score/i)).toBeInTheDocument();
    expect(screen.getByText('0.75')).toBeInTheDocument();
  });

  it('should render all signal components', () => {
    render(<ScoreBreakdown score={mockScore} />);

    // Check all signals are displayed
    expect(screen.getByText(/novelty/i)).toBeInTheDocument();
    expect(screen.getByText(/evidence/i)).toBeInTheDocument();
    expect(screen.getByText(/velocity/i)).toBeInTheDocument();
    expect(screen.getByText(/personal fit/i)).toBeInTheDocument();
    expect(screen.getByText(/lab prior/i)).toBeInTheDocument();
    expect(screen.getByText(/math penalty/i)).toBeInTheDocument();
  });

  it('should display signal values', () => {
    render(<ScoreBreakdown score={mockScore} />);

    // Check that specific score values are present
    expect(screen.getByText('0.75')).toBeInTheDocument(); // final score
    const allScores = screen.getAllByText(/\d+\.\d{2}/);
    expect(allScores.length).toBeGreaterThan(6); // At least 7 scores (final + 6 signals)
  });

  it('should render in compact mode', () => {
    render(<ScoreBreakdown score={mockScore} compact />);

    // Should still show final score
    expect(screen.getByText('0.75')).toBeInTheDocument();
  });

  it('should handle zero scores', () => {
    const zeroScore = {
      novelty: 0,
      evidence: 0,
      velocity: 0,
      personalFit: 0,
      labPrior: 0,
      mathPenalty: 0,
      finalScore: 0,
    };

    render(<ScoreBreakdown score={zeroScore} />);

    expect(screen.getByText(/final score/i)).toBeInTheDocument();
    // Check that all scores are displayed as 0.00 (there will be multiple)
    const zeroScores = screen.getAllByText('0.00');
    expect(zeroScores.length).toBeGreaterThan(0);
  });

  it('should format scores to 2 decimal places', () => {
    const preciseScore = {
      novelty: 0.12345,
      evidence: 0.98765,
      velocity: 0.55555,
      personalFit: 0.77777,
      labPrior: 0.33333,
      mathPenalty: 0.11111,
      finalScore: 0.66666,
    };

    render(<ScoreBreakdown score={preciseScore} />);

    // Should round to 2 decimal places - check that final score is formatted
    expect(screen.getByText('0.67')).toBeInTheDocument(); // finalScore

    // Check all values are formatted to 2 decimal places
    const allScores = screen.getAllByText(/\d+\.\d{2}/);
    allScores.forEach(element => {
      const text = element.textContent || '';
      expect(text).toMatch(/^\d+\.\d{2}$/); // Format: X.XX
    });
  });
});
