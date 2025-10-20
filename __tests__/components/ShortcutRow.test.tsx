/**
 * ShortcutRow Component Tests
 *
 * Tests for keyboard shortcut display row
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ShortcutRow } from '@/components/ShortcutRow';

describe('ShortcutRow', () => {
  it('should render key badge', () => {
    render(<ShortcutRow keyName="j" description="Next paper" />);

    expect(screen.getByText('j')).toBeInTheDocument();
  });

  it('should render description', () => {
    render(<ShortcutRow keyName="k" description="Previous paper" />);

    expect(screen.getByText('Previous paper')).toBeInTheDocument();
  });

  it('should render special keys correctly', () => {
    render(<ShortcutRow keyName="Enter" description="Open PDF" />);

    expect(screen.getByText('Enter')).toBeInTheDocument();
    expect(screen.getByText('Open PDF')).toBeInTheDocument();
  });

  it('should render symbol keys correctly', () => {
    render(<ShortcutRow keyName="?" description="Show help" />);

    expect(screen.getByText('?')).toBeInTheDocument();
    expect(screen.getByText('Show help')).toBeInTheDocument();
  });
});
