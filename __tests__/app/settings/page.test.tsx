/**
 * Settings Page Tests
 *
 * Tests for Settings page component with mocked tRPC
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SettingsPage from '@/app/settings/page';

// Mock tRPC
const mockGetCategories = vi.fn();
const mockGetProfile = vi.fn();
const mockUpdateCategories = vi.fn();
const mockUpdateProcessing = vi.fn();

vi.mock('@/lib/trpc', () => ({
  trpc: {
    settings: {
      getCategories: {
        useQuery: () => mockGetCategories(),
      },
      getProfile: {
        useQuery: () => mockGetProfile(),
      },
      updateCategories: {
        useMutation: () => ({
          mutateAsync: mockUpdateCategories,
        }),
      },
      updateProcessing: {
        useMutation: () => ({
          mutateAsync: mockUpdateProcessing,
        }),
      },
    },
  },
}));

describe('Settings Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    mockGetCategories.mockReturnValue({ data: undefined });
    mockGetProfile.mockReturnValue({ data: undefined });

    render(<SettingsPage />);

    expect(screen.getByText('Settings')).toBeInTheDocument();
    expect(screen.getByText('Loading categories...')).toBeInTheDocument();
  });

  it('should render categories and profile data', () => {
    const categories = [
      { id: 'cs.AI', name: 'Artificial Intelligence', description: '' },
      { id: 'cs.LG', name: 'Machine Learning', description: '' },
    ];

    const profile = {
      id: 'profile-1',
      userId: 'user-1',
      arxivCategories: ['cs.AI'],
      sourcesEnabled: ['arxiv'],
      useLocalEmbeddings: true,
      useLocalLLM: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockGetCategories.mockReturnValue({ data: categories });
    mockGetProfile.mockReturnValue({ data: profile });

    render(<SettingsPage />);

    expect(screen.getAllByText('cs.AI')).toHaveLength(2); // Label and selected section
    expect(screen.getByText('Artificial Intelligence')).toBeInTheDocument();
    expect(screen.getByText('cs.LG')).toBeInTheDocument();
    expect(screen.getByText('Machine Learning')).toBeInTheDocument();

    // Check that cs.AI is checked
    const aiCheckbox = screen.getByRole('checkbox', { name: /cs.AI/i });
    expect(aiCheckbox).toBeChecked();

    // Check that cs.LG is not checked
    const lgCheckbox = screen.getByRole('checkbox', { name: /cs.LG/i });
    expect(lgCheckbox).not.toBeChecked();

    // Check processing preferences
    const localEmbeddingsCheckbox = screen.getByRole('checkbox', { name: /Use local embeddings/i });
    expect(localEmbeddingsCheckbox).toBeChecked();

    const localLLMCheckbox = screen.getByRole('checkbox', { name: /Use local LLM/i });
    expect(localLLMCheckbox).toBeChecked();
  });

  it('should handle category selection', async () => {
    const user = userEvent.setup();
    const categories = [
      { id: 'cs.AI', name: 'Artificial Intelligence', description: '' },
      { id: 'cs.LG', name: 'Machine Learning', description: '' },
    ];

    const profile = {
      id: 'profile-1',
      userId: 'user-1',
      arxivCategories: ['cs.AI'],
      sourcesEnabled: ['arxiv'],
      useLocalEmbeddings: true,
      useLocalLLM: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockGetCategories.mockReturnValue({ data: categories });
    mockGetProfile.mockReturnValue({ data: profile });

    render(<SettingsPage />);

    // Click on cs.LG checkbox to add it
    const lgCheckbox = screen.getByRole('checkbox', { name: /cs.LG/i });
    await user.click(lgCheckbox);

    // Verify it's now checked
    expect(lgCheckbox).toBeChecked();
  });

  it('should save settings when Save button is clicked', async () => {
    const user = userEvent.setup();
    const categories = [
      { id: 'cs.AI', name: 'Artificial Intelligence', description: '' },
    ];

    const profile = {
      id: 'profile-1',
      userId: 'user-1',
      arxivCategories: ['cs.AI'],
      sourcesEnabled: ['arxiv'],
      useLocalEmbeddings: true,
      useLocalLLM: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockGetCategories.mockReturnValue({ data: categories });
    mockGetProfile.mockReturnValue({ data: profile });
    mockUpdateCategories.mockResolvedValue(profile);
    mockUpdateProcessing.mockResolvedValue(profile);

    render(<SettingsPage />);

    // Click Save Settings button
    const saveButton = screen.getByRole('button', { name: /Save Settings/i });
    await user.click(saveButton);

    // Verify mutations were called
    await waitFor(() => {
      expect(mockUpdateCategories).toHaveBeenCalledWith({
        categories: ['cs.AI'],
      });
      expect(mockUpdateProcessing).toHaveBeenCalledWith({
        useLocalEmbeddings: true,
        useLocalLLM: true,
      });
    });
  });

  it('should show success message after saving', async () => {
    const user = userEvent.setup();
    const categories = [
      { id: 'cs.AI', name: 'Artificial Intelligence', description: '' },
    ];

    const profile = {
      id: 'profile-1',
      userId: 'user-1',
      arxivCategories: ['cs.AI'],
      sourcesEnabled: ['arxiv'],
      useLocalEmbeddings: true,
      useLocalLLM: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockGetCategories.mockReturnValue({ data: categories });
    mockGetProfile.mockReturnValue({ data: profile });
    mockUpdateCategories.mockResolvedValue(profile);
    mockUpdateProcessing.mockResolvedValue(profile);

    render(<SettingsPage />);

    const saveButton = screen.getByRole('button', { name: /Save Settings/i });
    await user.click(saveButton);

    // Wait for success message
    await waitFor(() => {
      expect(screen.getByText('Settings saved successfully')).toBeInTheDocument();
    });
  });

  it('should disable save button when no categories selected', () => {
    const categories = [
      { id: 'cs.AI', name: 'Artificial Intelligence', description: '' },
    ];

    const profile = {
      id: 'profile-1',
      userId: 'user-1',
      arxivCategories: [],
      sourcesEnabled: ['arxiv'],
      useLocalEmbeddings: true,
      useLocalLLM: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockGetCategories.mockReturnValue({ data: categories });
    mockGetProfile.mockReturnValue({ data: profile });

    render(<SettingsPage />);

    const saveButton = screen.getByRole('button', { name: /Save Settings/i });
    expect(saveButton).toBeDisabled();
  });

  it('should show empty state when no categories available', () => {
    mockGetCategories.mockReturnValue({ data: [] });
    mockGetProfile.mockReturnValue({
      data: {
        id: 'default',
        userId: 'default',
        arxivCategories: [],
        sourcesEnabled: ['arxiv'],
        useLocalEmbeddings: true,
        useLocalLLM: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    render(<SettingsPage />);

    expect(screen.getByText('No categories available. Run the Scout agent to fetch categories.')).toBeInTheDocument();
  });
});
