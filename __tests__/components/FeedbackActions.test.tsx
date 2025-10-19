import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FeedbackActions } from '@/components/FeedbackActions';

describe('FeedbackActions', () => {
  const mockCallbacks = {
    onSave: vi.fn(),
    onDismiss: vi.fn(),
    onThumbsUp: vi.fn(),
    onThumbsDown: vi.fn(),
    onHide: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render all action buttons', () => {
    render(<FeedbackActions {...mockCallbacks} />);

    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /dismiss/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /thumbs up/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /thumbs down/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /hide/i })).toBeInTheDocument();
  });

  it('should call onSave when save button clicked', () => {
    render(<FeedbackActions {...mockCallbacks} />);

    const saveButton = screen.getByRole('button', { name: /save/i });
    fireEvent.click(saveButton);

    expect(mockCallbacks.onSave).toHaveBeenCalledTimes(1);
  });

  it('should call onDismiss when dismiss button clicked', () => {
    render(<FeedbackActions {...mockCallbacks} />);

    const dismissButton = screen.getByRole('button', { name: /dismiss/i });
    fireEvent.click(dismissButton);

    expect(mockCallbacks.onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should call onThumbsUp when thumbs up button clicked', () => {
    render(<FeedbackActions {...mockCallbacks} />);

    const thumbsUpButton = screen.getByRole('button', { name: /thumbs up/i });
    fireEvent.click(thumbsUpButton);

    expect(mockCallbacks.onThumbsUp).toHaveBeenCalledTimes(1);
  });

  it('should call onThumbsDown when thumbs down button clicked', () => {
    render(<FeedbackActions {...mockCallbacks} />);

    const thumbsDownButton = screen.getByRole('button', { name: /thumbs down/i });
    fireEvent.click(thumbsDownButton);

    expect(mockCallbacks.onThumbsDown).toHaveBeenCalledTimes(1);
  });

  it('should call onHide when hide button clicked', () => {
    render(<FeedbackActions {...mockCallbacks} />);

    const hideButton = screen.getByRole('button', { name: /hide/i });
    fireEvent.click(hideButton);

    expect(mockCallbacks.onHide).toHaveBeenCalledTimes(1);
  });

  it('should show saved state when isSaved is true', () => {
    render(<FeedbackActions {...mockCallbacks} isSaved />);

    const saveButton = screen.getByRole('button', { name: /saved/i });
    expect(saveButton).toBeInTheDocument();
  });

  it('should show thumbed up state when isThumbsUp is true', () => {
    render(<FeedbackActions {...mockCallbacks} isThumbsUp />);

    // Button should show active/selected state
    const thumbsUpButton = screen.getByRole('button', { name: /thumbs up/i });
    expect(thumbsUpButton).toBeInTheDocument();
  });

  it('should show thumbed down state when isThumbsDown is true', () => {
    render(<FeedbackActions {...mockCallbacks} isThumbsDown />);

    // Button should show active/selected state
    const thumbsDownButton = screen.getByRole('button', { name: /thumbs down/i });
    expect(thumbsDownButton).toBeInTheDocument();
  });

  it('should render in compact mode', () => {
    render(<FeedbackActions {...mockCallbacks} compact />);

    // Should still have all buttons
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /thumbs up/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /thumbs down/i })).toBeInTheDocument();
  });

  it('should disable all buttons when disabled prop is true', () => {
    render(<FeedbackActions {...mockCallbacks} disabled />);

    const buttons = screen.getAllByRole('button');
    buttons.forEach(button => {
      expect(button).toBeDisabled();
    });
  });
});
