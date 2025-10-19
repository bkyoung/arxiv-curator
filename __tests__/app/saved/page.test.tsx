/**
 * Saved Papers Page Tests
 *
 * Tests for Saved Papers page component
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SavedPage from '@/app/saved/page';

// Mock tRPC
const mockGetSavedPapers = vi.fn();
const mockSaveMutation = vi.fn();
const mockDismissMutation = vi.fn();
const mockThumbsUpMutation = vi.fn();
const mockThumbsDownMutation = vi.fn();
const mockHideMutation = vi.fn();

vi.mock('@/lib/trpc', () => ({
  trpc: {
    feedback: {
      getHistory: {
        useQuery: (params: any) => mockGetSavedPapers(params),
      },
      save: {
        useMutation: () => ({ mutate: mockSaveMutation, isLoading: false }),
      },
      dismiss: {
        useMutation: () => ({ mutate: mockDismissMutation, isLoading: false }),
      },
      thumbsUp: {
        useMutation: () => ({ mutate: mockThumbsUpMutation, isLoading: false }),
      },
      thumbsDown: {
        useMutation: () => ({ mutate: mockThumbsDownMutation, isLoading: false }),
      },
      hide: {
        useMutation: () => ({ mutate: mockHideMutation, isLoading: false }),
      },
    },
  },
}));

describe('Saved Papers Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render page title', () => {
    mockGetSavedPapers.mockReturnValue({ data: [], isLoading: false });

    render(<SavedPage />);

    expect(screen.getByText('Saved Papers')).toBeInTheDocument();
  });

  it('should render loading state', () => {
    mockGetSavedPapers.mockReturnValue({ data: undefined, isLoading: true });

    render(<SavedPage />);

    const loader = document.querySelector('.animate-spin');
    expect(loader).toBeInTheDocument();
  });

  it('should render empty state when no saved papers', () => {
    mockGetSavedPapers.mockReturnValue({ data: [], isLoading: false });

    render(<SavedPage />);

    expect(screen.getByText(/No saved papers yet/i)).toBeInTheDocument();
  });

  it('should render saved papers with score breakdown', () => {
    const savedPapers = [
      {
        id: 'feedback-1',
        userId: 'user-1',
        paperId: 'paper-1',
        action: 'save',
        weight: 1.0,
        context: null,
        createdAt: new Date('2024-01-15'),
        paper: {
          id: 'paper-1',
          arxivId: '2401.00001',
          version: 1,
          title: 'Test Saved Paper',
          authors: ['Alice Smith'],
          abstract: 'This is a saved paper abstract.',
          categories: ['cs.AI'],
          primaryCategory: 'cs.AI',
          status: 'enriched',
          pubDate: new Date('2024-01-15'),
          updatedDate: new Date('2024-01-15'),
          pdfUrl: 'https://arxiv.org/pdf/2401.00001',
          rawMetadata: {},
          codeUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          enriched: {
            id: 'enriched-1',
            paperId: 'paper-1',
            topics: ['agents'],
            facets: [],
            embedding: [],
            mathDepth: 0.5,
            hasCode: true,
            hasData: false,
            hasBaselines: true,
            hasAblations: false,
            hasMultipleEvals: true,
            enrichedAt: new Date(),
          },
          scores: [
            {
              id: 'score-1',
              paperId: 'paper-1',
              novelty: 0.8,
              evidence: 0.9,
              velocity: 0.5,
              personalFit: 0.7,
              labPrior: 0.05,
              mathPenalty: 0.15,
              finalScore: 0.75,
              whyShown: {
                novelty: 0.8,
                evidence: 0.9,
                velocity: 0.5,
                personalFit: 0.7,
                labPrior: 0.05,
                mathPenalty: 0.15,
              },
              createdAt: new Date(),
            },
          ],
          feedback: [
            {
              id: 'feedback-1',
              userId: 'user-1',
              paperId: 'paper-1',
              action: 'save',
              weight: 1.0,
              context: null,
              createdAt: new Date(),
            },
          ],
        },
      },
    ];

    mockGetSavedPapers.mockReturnValue({ data: savedPapers, isLoading: false });

    render(<SavedPage />);

    // Should show paper title
    expect(screen.getByText('Test Saved Paper')).toBeInTheDocument();

    // Should show score breakdown
    expect(screen.getByText(/Score Breakdown/i)).toBeInTheDocument();
    expect(screen.getByText('0.75')).toBeInTheDocument();
  });

  it('should show feedback actions with saved state', () => {
    const savedPapers = [
      {
        id: 'feedback-1',
        userId: 'user-1',
        paperId: 'paper-1',
        action: 'save',
        weight: 1.0,
        context: null,
        createdAt: new Date('2024-01-15'),
        paper: {
          id: 'paper-1',
          arxivId: '2401.00001',
          version: 1,
          title: 'Test Paper',
          authors: ['Alice'],
          abstract: 'Abstract',
          categories: ['cs.AI'],
          primaryCategory: 'cs.AI',
          status: 'enriched',
          pubDate: new Date('2024-01-15'),
          updatedDate: new Date('2024-01-15'),
          pdfUrl: 'https://arxiv.org/pdf/2401.00001',
          rawMetadata: {},
          codeUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          enriched: null,
          scores: [],
          feedback: [
            {
              id: 'feedback-1',
              userId: 'user-1',
              paperId: 'paper-1',
              action: 'save',
              weight: 1.0,
              context: null,
              createdAt: new Date(),
            },
          ],
        },
      },
    ];

    mockGetSavedPapers.mockReturnValue({ data: savedPapers, isLoading: false });

    render(<SavedPage />);

    // Should show saved state
    expect(screen.getByRole('button', { name: /saved/i })).toBeInTheDocument();
  });

  it('should render WhyShown component when available', () => {
    const savedPapers = [
      {
        id: 'feedback-1',
        userId: 'user-1',
        paperId: 'paper-1',
        action: 'save',
        weight: 1.0,
        context: null,
        createdAt: new Date('2024-01-15'),
        paper: {
          id: 'paper-1',
          arxivId: '2401.00001',
          version: 1,
          title: 'Test Paper',
          authors: ['Alice'],
          abstract: 'Abstract',
          categories: ['cs.AI'],
          primaryCategory: 'cs.AI',
          status: 'enriched',
          pubDate: new Date('2024-01-15'),
          updatedDate: new Date('2024-01-15'),
          pdfUrl: 'https://arxiv.org/pdf/2401.00001',
          rawMetadata: {},
          codeUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          enriched: {
            id: 'enriched-1',
            paperId: 'paper-1',
            topics: ['agents'],
            facets: [],
            embedding: [],
            mathDepth: 0.5,
            hasCode: true,
            hasData: false,
            hasBaselines: true,
            hasAblations: false,
            hasMultipleEvals: true,
            enrichedAt: new Date(),
          },
          scores: [
            {
              id: 'score-1',
              paperId: 'paper-1',
              novelty: 0.8,
              evidence: 0.9,
              velocity: 0.5,
              personalFit: 0.7,
              labPrior: 0.05,
              mathPenalty: 0.15,
              finalScore: 0.75,
              whyShown: {
                novelty: 0.8,
                evidence: 0.9,
                velocity: 0.5,
                personalFit: 0.7,
                labPrior: 0.05,
                mathPenalty: 0.15,
              },
              createdAt: new Date(),
            },
          ],
          feedback: [],
        },
      },
    ];

    mockGetSavedPapers.mockReturnValue({ data: savedPapers, isLoading: false });

    render(<SavedPage />);

    // Should show WhyShown component
    const whyShownElements = screen.getAllByText(/Why Shown/i);
    expect(whyShownElements.length).toBeGreaterThan(0);
  });
});
