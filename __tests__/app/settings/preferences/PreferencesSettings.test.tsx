/**
 * PreferencesSettings Component Tests
 *
 * Tests for briefing preferences settings UI
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PreferencesSettings } from '@/app/settings/preferences/PreferencesSettings';

describe('PreferencesSettings', () => {
  const mockProfile = {
    digestEnabled: true,
    noiseCap: 15,
    scoreThreshold: 0.5,
    explorationRate: 0.15,
  };

  it('should render digest enabled toggle', () => {
    const handleSave = vi.fn();
    render(<PreferencesSettings profile={mockProfile} onSave={handleSave} />);

    expect(screen.getByText('Enable Daily Digests')).toBeInTheDocument();
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('should render noise cap slider', () => {
    const handleSave = vi.fn();
    render(<PreferencesSettings profile={mockProfile} onSave={handleSave} />);

    expect(screen.getByText(/Maximum Papers per Day/i)).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument(); // Current value display
  });

  it('should render score threshold slider', () => {
    const handleSave = vi.fn();
    render(<PreferencesSettings profile={mockProfile} onSave={handleSave} />);

    expect(screen.getByText(/Minimum Score Threshold/i)).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument(); // 0.5 * 100
  });

  it('should show toggle as checked when digestEnabled is true', () => {
    const handleSave = vi.fn();
    render(<PreferencesSettings profile={mockProfile} onSave={handleSave} />);

    const toggle = screen.getByRole('switch');
    expect(toggle).toBeChecked();
  });

  it('should show toggle as unchecked when digestEnabled is false', () => {
    const handleSave = vi.fn();
    const profile = { ...mockProfile, digestEnabled: false };
    render(<PreferencesSettings profile={profile} onSave={handleSave} />);

    const toggle = screen.getByRole('switch');
    expect(toggle).not.toBeChecked();
  });

  it('should call onSave when save button is clicked', async () => {
    const user = userEvent.setup();
    const handleSave = vi.fn();
    render(<PreferencesSettings profile={mockProfile} onSave={handleSave} />);

    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    expect(handleSave).toHaveBeenCalledTimes(1);
  });

  it('should call onSave with updated digestEnabled when toggle is changed', async () => {
    const user = userEvent.setup();
    const handleSave = vi.fn();
    render(<PreferencesSettings profile={mockProfile} onSave={handleSave} />);

    const toggle = screen.getByRole('switch');
    await user.click(toggle);

    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith({
        digestEnabled: false, // Toggled from true to false
        noiseCap: 15,
        scoreThreshold: 0.5,
      });
    });
  });

  it('should display help text for each setting', () => {
    const handleSave = vi.fn();
    render(<PreferencesSettings profile={mockProfile} onSave={handleSave} />);

    expect(screen.getByText(/Receive daily paper recommendations/i)).toBeInTheDocument();
    expect(screen.getByText(/Maximum number of papers/i)).toBeInTheDocument();
    expect(screen.getByText(/Papers below this score/i)).toBeInTheDocument();
  });

  describe('Error Handling', () => {
    it('should display error message when save fails', async () => {
      const user = userEvent.setup();
      const handleSave = vi.fn().mockRejectedValue(new Error('Database error'));
      render(<PreferencesSettings profile={mockProfile} onSave={handleSave} />);

      const saveButton = screen.getByRole('button', { name: /save preferences/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Database error')).toBeInTheDocument();
      });
    });

    it('should display generic error message for non-Error exceptions', async () => {
      const user = userEvent.setup();
      const handleSave = vi.fn().mockRejectedValue('Some error');
      render(<PreferencesSettings profile={mockProfile} onSave={handleSave} />);

      const saveButton = screen.getByRole('button', { name: /save preferences/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to save preferences')).toBeInTheDocument();
      });
    });

    it('should display success message when save succeeds', async () => {
      const user = userEvent.setup();
      const handleSave = vi.fn().mockResolvedValue(undefined);
      render(<PreferencesSettings profile={mockProfile} onSave={handleSave} />);

      const saveButton = screen.getByRole('button', { name: /save preferences/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/saved successfully/i)).toBeInTheDocument();
      });
    });

    it('should auto-hide success message after 3 seconds', async () => {
      const user = userEvent.setup();
      const handleSave = vi.fn().mockResolvedValue(undefined);
      render(<PreferencesSettings profile={mockProfile} onSave={handleSave} />);

      const saveButton = screen.getByRole('button', { name: /save preferences/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/saved successfully/i)).toBeInTheDocument();
      });

      // Wait for the message to auto-hide (3 seconds + buffer)
      await waitFor(
        () => {
          expect(screen.queryByText(/saved successfully/i)).not.toBeInTheDocument();
        },
        { timeout: 4000 }
      );
    });

    it('should disable save button while saving', async () => {
      const user = userEvent.setup();
      let resolvePromise: (value: void | PromiseLike<void>) => void;
      const savePromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });
      const handleSave = vi.fn(() => savePromise);
      render(<PreferencesSettings profile={mockProfile} onSave={handleSave} />);

      const saveButton = screen.getByRole('button', { name: /save preferences/i });

      // Click and check it's disabled during save
      const clickPromise = user.click(saveButton);

      // Button should be disabled and show "Saving..."
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /saving/i })).toBeDisabled();
      });

      // Resolve the promise
      resolvePromise!();

      // Wait for click to complete
      await clickPromise;

      // Button should be enabled again
      await waitFor(() => {
        expect(screen.getByRole('button', { name: /save preferences/i })).toBeEnabled();
      });
    });

    it('should clear previous error when saving again', async () => {
      const user = userEvent.setup();
      const handleSave = vi.fn()
        .mockRejectedValueOnce(new Error('Validation error'))
        .mockResolvedValueOnce(undefined);

      render(<PreferencesSettings profile={mockProfile} onSave={handleSave} />);

      const saveButton = screen.getByRole('button', { name: /save preferences/i });

      // First save fails
      await user.click(saveButton);
      await waitFor(() => {
        expect(screen.getByText('Validation error')).toBeInTheDocument();
      });

      // Second save succeeds
      await user.click(saveButton);
      await waitFor(() => {
        expect(screen.queryByText('Validation error')).not.toBeInTheDocument();
        expect(screen.getByText(/saved successfully/i)).toBeInTheDocument();
      });
    });
  });
});
