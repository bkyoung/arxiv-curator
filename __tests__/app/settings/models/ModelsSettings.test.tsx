/**
 * ModelsSettings Component Tests
 *
 * Tests for AI models configuration UI
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ModelsSettings } from '@/app/settings/models/ModelsSettings';

describe('ModelsSettings', () => {
  const mockProfile = {
    embeddingModel: 'local' as const,
    languageModel: 'local' as const,
  };

  it('should render embedding model section', () => {
    const handleSave = vi.fn();
    render(<ModelsSettings profile={mockProfile} onSave={handleSave} />);

    expect(screen.getByText('Embedding Model')).toBeInTheDocument();
    expect(screen.getByText(/Local.*mxbai-embed-large/i)).toBeInTheDocument();
    expect(screen.getByText(/Cloud.*text-embedding-004/i)).toBeInTheDocument();
  });

  it('should render language model section', () => {
    const handleSave = vi.fn();
    render(<ModelsSettings profile={mockProfile} onSave={handleSave} />);

    expect(screen.getByText('Language Model')).toBeInTheDocument();
    expect(screen.getByText(/Local.*llama3.2/i)).toBeInTheDocument();
    expect(screen.getByText(/Cloud.*gemini-2.0-flash-exp/i)).toBeInTheDocument();
  });

  it('should select local embedding model by default', () => {
    const handleSave = vi.fn();
    render(<ModelsSettings profile={mockProfile} onSave={handleSave} />);

    const localRadio = screen.getByRole('radio', { name: /Local.*ollama.*mxbai/i });
    expect(localRadio).toBeChecked();
  });

  it('should select cloud embedding model when specified', () => {
    const handleSave = vi.fn();
    const profile = { ...mockProfile, embeddingModel: 'cloud' as const };
    render(<ModelsSettings profile={profile} onSave={handleSave} />);

    const cloudRadio = screen.getByRole('radio', { name: /Cloud.*Google.*text-embedding/i });
    expect(cloudRadio).toBeChecked();
  });

  it('should select local language model by default', () => {
    const handleSave = vi.fn();
    render(<ModelsSettings profile={mockProfile} onSave={handleSave} />);

    const localRadio = screen.getByRole('radio', { name: /Local.*ollama.*llama/i });
    expect(localRadio).toBeChecked();
  });

  it('should select cloud language model when specified', () => {
    const handleSave = vi.fn();
    const profile = { ...mockProfile, languageModel: 'cloud' as const };
    render(<ModelsSettings profile={profile} onSave={handleSave} />);

    const cloudRadio = screen.getByRole('radio', { name: /Cloud.*Google.*gemini/i });
    expect(cloudRadio).toBeChecked();
  });

  it('should call onSave when save button is clicked', async () => {
    const user = userEvent.setup();
    const handleSave = vi.fn();
    render(<ModelsSettings profile={mockProfile} onSave={handleSave} />);

    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    expect(handleSave).toHaveBeenCalledTimes(1);
  });

  it('should call onSave with updated models when changed', async () => {
    const user = userEvent.setup();
    const handleSave = vi.fn();
    render(<ModelsSettings profile={mockProfile} onSave={handleSave} />);

    // Change embedding model to cloud
    const cloudEmbeddingRadio = screen.getByRole('radio', { name: /Cloud.*Google.*text-embedding/i });
    await user.click(cloudEmbeddingRadio);

    // Change language model to cloud
    const cloudLanguageRadio = screen.getByRole('radio', { name: /Cloud.*Google.*gemini/i });
    await user.click(cloudLanguageRadio);

    const saveButton = screen.getByRole('button', { name: /save/i });
    await user.click(saveButton);

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledWith({
        embeddingModel: 'cloud',
        languageModel: 'cloud',
      });
    });
  });

  it('should display help text for each model type', () => {
    const handleSave = vi.fn();
    render(<ModelsSettings profile={mockProfile} onSave={handleSave} />);

    expect(screen.getByText(/Used for semantic search/i)).toBeInTheDocument();
    expect(screen.getByText(/Used for classification/i)).toBeInTheDocument();
  });

  describe('Error Handling', () => {
    it('should display error message when save fails', async () => {
      const user = userEvent.setup();
      const handleSave = vi.fn().mockRejectedValue(new Error('Network error'));
      render(<ModelsSettings profile={mockProfile} onSave={handleSave} />);

      const saveButton = screen.getByRole('button', { name: /save models/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('should display generic error message for non-Error exceptions', async () => {
      const user = userEvent.setup();
      const handleSave = vi.fn().mockRejectedValue('Some string error');
      render(<ModelsSettings profile={mockProfile} onSave={handleSave} />);

      const saveButton = screen.getByRole('button', { name: /save models/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText('Failed to save model settings')).toBeInTheDocument();
      });
    });

    it('should display success message when save succeeds', async () => {
      const user = userEvent.setup();
      const handleSave = vi.fn().mockResolvedValue(undefined);
      render(<ModelsSettings profile={mockProfile} onSave={handleSave} />);

      const saveButton = screen.getByRole('button', { name: /save models/i });
      await user.click(saveButton);

      await waitFor(() => {
        expect(screen.getByText(/saved successfully/i)).toBeInTheDocument();
      });
    });

    it('should auto-hide success message after 3 seconds', async () => {
      const user = userEvent.setup();
      const handleSave = vi.fn().mockResolvedValue(undefined);
      render(<ModelsSettings profile={mockProfile} onSave={handleSave} />);

      const saveButton = screen.getByRole('button', { name: /save models/i });
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
      render(<ModelsSettings profile={mockProfile} onSave={handleSave} />);

      const saveButton = screen.getByRole('button', { name: /save models/i });

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
        expect(screen.getByRole('button', { name: /save models/i })).toBeEnabled();
      });
    });

    it('should clear previous error when saving again', async () => {
      const user = userEvent.setup();
      const handleSave = vi.fn()
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce(undefined);

      render(<ModelsSettings profile={mockProfile} onSave={handleSave} />);

      const saveButton = screen.getByRole('button', { name: /save models/i });

      // First save fails
      await user.click(saveButton);
      await waitFor(() => {
        expect(screen.getByText('First error')).toBeInTheDocument();
      });

      // Second save succeeds
      await user.click(saveButton);
      await waitFor(() => {
        expect(screen.queryByText('First error')).not.toBeInTheDocument();
        expect(screen.getByText(/saved successfully/i)).toBeInTheDocument();
      });
    });
  });
});
