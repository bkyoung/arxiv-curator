/**
 * HelpModal Component Tests
 *
 * Tests for keyboard shortcuts help dialog
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HelpModal } from '@/components/HelpModal';

describe('HelpModal', () => {
  it('should not render when closed', () => {
    render(<HelpModal open={false} onClose={() => {}} />);

    expect(screen.queryByText('Keyboard Shortcuts')).not.toBeInTheDocument();
  });

  it('should render when open', () => {
    render(<HelpModal open={true} onClose={() => {}} />);

    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
  });

  it('should display navigation shortcuts', () => {
    render(<HelpModal open={true} onClose={() => {}} />);

    expect(screen.getByText('Navigation')).toBeInTheDocument();
    expect(screen.getByText('j')).toBeInTheDocument();
    expect(screen.getByText('k')).toBeInTheDocument();
  });

  it('should display action shortcuts', () => {
    render(<HelpModal open={true} onClose={() => {}} />);

    expect(screen.getByText('Actions')).toBeInTheDocument();
    expect(screen.getByText('s')).toBeInTheDocument();
    expect(screen.getByText('h')).toBeInTheDocument();
  });

  it('should call onClose when Escape key is pressed', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    render(<HelpModal open={true} onClose={handleClose} />);

    await user.keyboard('{Escape}');

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    render(<HelpModal open={true} onClose={handleClose} />);

    // Find and click close button (X button in dialog)
    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
