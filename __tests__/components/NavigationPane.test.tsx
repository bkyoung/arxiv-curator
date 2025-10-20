/**
 * NavigationPane Component Tests
 *
 * Tests for the briefing navigation sidebar
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { NavigationPane } from '@/components/NavigationPane';

// Mock Next.js navigation
const mockPathname = '/briefings/latest';
vi.mock('next/navigation', () => ({
  usePathname: () => mockPathname,
}));

describe('NavigationPane', () => {
  it('should render all navigation items', () => {
    render(<NavigationPane savedCount={5} />);

    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Saved')).toBeInTheDocument();
    expect(screen.getByText('Archives')).toBeInTheDocument();
  });

  it('should display saved count badge', () => {
    render(<NavigationPane savedCount={12} />);

    expect(screen.getByText('12')).toBeInTheDocument();
  });

  it('should not display badge when saved count is 0', () => {
    render(<NavigationPane savedCount={0} />);

    // Badge should not be present
    const badges = screen.queryAllByRole('status');
    expect(badges).toHaveLength(0);
  });

  it('should highlight active route', () => {
    render(<NavigationPane savedCount={5} />);

    const todayLink = screen.getByText('Today').closest('a');
    expect(todayLink).toHaveClass('bg-accent'); // Active state styling
  });

  it('should have correct links', () => {
    render(<NavigationPane savedCount={5} />);

    const todayLink = screen.getByText('Today').closest('a');
    const savedLink = screen.getByText('Saved').closest('a');
    const archivesLink = screen.getByText('Archives').closest('a');

    expect(todayLink).toHaveAttribute('href', '/briefings/latest');
    expect(savedLink).toHaveAttribute('href', '/saved');
    expect(archivesLink).toHaveAttribute('href', '/briefings');
  });
});
