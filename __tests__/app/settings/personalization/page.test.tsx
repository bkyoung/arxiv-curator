/**
 * Personalization Settings Page Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PersonalizationPage from '@/app/settings/personalization/page';

// Mock tRPC
const mockGetProfile = vi.fn();
const mockUpdatePersonalization = vi.fn();
const mockUpdateMathSensitivity = vi.fn();
const mockUpdateExplorationRate = vi.fn();

vi.mock('@/lib/trpc', () => ({
  trpc: {
    settings: {
      getProfile: {
        useQuery: () => mockGetProfile(),
      },
      updatePersonalization: {
        useMutation: () => ({ mutate: mockUpdatePersonalization, isLoading: false }),
      },
      updateMathSensitivity: {
        useMutation: () => ({ mutate: mockUpdateMathSensitivity, isLoading: false }),
      },
      updateExplorationRate: {
        useMutation: () => ({ mutate: mockUpdateExplorationRate, isLoading: false }),
      },
    },
  },
}));

describe('Personalization Settings Page', () => {
  const mockProfile = {
    id: 'profile-1',
    userId: 'user-1',
    includeTopics: ['agents', 'rag'],
    excludeTopics: ['theory'],
    includeKeywords: ['llm', 'gpt'],
    excludeKeywords: ['proof', 'theorem'],
    mathDepthMax: 0.5,
    explorationRate: 0.15,
    labBoosts: { 'OpenAI': 0.05, 'DeepMind': 0.05 },
    arxivCategories: ['cs.AI'],
    sourcesEnabled: { arxiv: true },
    useLocalEmbeddings: true,
    useLocalLLM: true,
    preferredLLM: 'gemini-2.0-flash',
    noiseCap: 50,
    targetToday: 15,
    target7d: 100,
    interestVector: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render page title', () => {
    mockGetProfile.mockReturnValue({ data: mockProfile, isLoading: false });

    render(<PersonalizationPage />);

    expect(screen.getByText('Personalization')).toBeInTheDocument();
  });

  it('should show loading state', () => {
    mockGetProfile.mockReturnValue({ data: undefined, isLoading: true });

    render(<PersonalizationPage />);

    const loader = document.querySelector('.animate-spin');
    expect(loader).toBeInTheDocument();
  });

  it('should display current topic preferences', () => {
    mockGetProfile.mockReturnValue({ data: mockProfile, isLoading: false });

    render(<PersonalizationPage />);

    expect(screen.getByText(/agents/i)).toBeInTheDocument();
    expect(screen.getByText(/rag/i)).toBeInTheDocument();
  });

  it('should display math sensitivity section', () => {
    mockGetProfile.mockReturnValue({ data: mockProfile, isLoading: false });

    render(<PersonalizationPage />);

    expect(screen.getByText('Math Sensitivity')).toBeInTheDocument();
    expect(screen.getByText(/Current: 0.50/i)).toBeInTheDocument();
  });

  it('should display exploration rate section', () => {
    mockGetProfile.mockReturnValue({ data: mockProfile, isLoading: false });

    render(<PersonalizationPage />);

    expect(screen.getByText('Exploration Rate')).toBeInTheDocument();
    expect(screen.getByText(/Current: 15%/i)).toBeInTheDocument();
  });

  it('should have slider for math sensitivity', () => {
    mockGetProfile.mockReturnValue({ data: mockProfile, isLoading: false });

    render(<PersonalizationPage />);

    const slider = document.querySelector('#math-sensitivity');
    expect(slider).toBeInTheDocument();
  });

  it('should show topic input fields', () => {
    mockGetProfile.mockReturnValue({ data: mockProfile, isLoading: false });

    render(<PersonalizationPage />);

    expect(screen.getByLabelText(/include topics/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/exclude topics/i)).toBeInTheDocument();
  });

  it('should show keyword input fields', () => {
    mockGetProfile.mockReturnValue({ data: mockProfile, isLoading: false });

    render(<PersonalizationPage />);

    expect(screen.getByLabelText(/include keywords/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/exclude keywords/i)).toBeInTheDocument();
  });
});
