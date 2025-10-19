/**
 * Papers Page Tests
 *
 * Tests for Papers page component with mocked tRPC
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PapersPage from '@/app/papers/page';

// Mock tRPC
const mockListPapers = vi.fn();
const mockGetStats = vi.fn();

vi.mock('@/lib/trpc', () => ({
  trpc: {
    papers: {
      list: {
        useQuery: (params: any) => mockListPapers(params),
      },
      stats: {
        useQuery: () => mockGetStats(),
      },
    },
  },
}));

describe('Papers Page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    mockListPapers.mockReturnValue({ data: undefined, isLoading: true });
    mockGetStats.mockReturnValue({ data: undefined });

    render(<PapersPage />);

    expect(screen.getByText('Papers')).toBeInTheDocument();
    // Loader icon should be present
    const loader = document.querySelector('.animate-spin');
    expect(loader).toBeInTheDocument();
  });

  it('should render papers list with stats', () => {
    const papersData = {
      papers: [
        {
          id: 'paper-1',
          arxivId: '2401.00001',
          version: 1,
          title: 'Test Paper 1',
          authors: ['Alice Smith', 'Bob Johnson'],
          abstract: 'This is a test abstract about AI agents.',
          categories: ['cs.AI', 'cs.LG'],
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
            topics: ['agents', 'applications'],
            facets: ['planning', 'tool_use'],
            embedding: new Array(384).fill(0.1),
            mathDepth: 0.2,
            hasCode: true,
            hasData: false,
            hasBaselines: true,
            hasAblations: false,
            hasMultipleEvals: true,
            enrichedAt: new Date(),
          },
        },
      ],
      total: 1,
      hasMore: false,
    };

    const stats = {
      total: 10,
      enriched: 8,
      pending: 2,
      topCategories: [{ category: 'cs.AI', count: 5 }],
    };

    mockListPapers.mockReturnValue({ data: papersData, isLoading: false });
    mockGetStats.mockReturnValue({ data: stats });

    render(<PapersPage />);

    // Check paper title
    expect(screen.getByText('Test Paper 1')).toBeInTheDocument();

    // Check authors
    expect(screen.getByText(/Alice Smith, Bob Johnson/)).toBeInTheDocument();

    // Check abstract
    expect(screen.getByText(/This is a test abstract about AI agents/)).toBeInTheDocument();

    // Check topics/badges
    expect(screen.getByText('agents')).toBeInTheDocument();
    expect(screen.getByText('applications')).toBeInTheDocument();

    // Check evidence badges
    expect(screen.getByText('Code Available')).toBeInTheDocument();
    expect(screen.getByText('Baselines')).toBeInTheDocument();
    expect(screen.getByText('Multiple Evals')).toBeInTheDocument();

    // Check stats
    expect(screen.getByText('10')).toBeInTheDocument(); // Total
    expect(screen.getByText('8')).toBeInTheDocument(); // Enriched
    expect(screen.getByText('2')).toBeInTheDocument(); // Pending
  });

  it('should render empty state when no papers exist', () => {
    const papersData = {
      papers: [],
      total: 0,
      hasMore: false,
    };

    mockListPapers.mockReturnValue({ data: papersData, isLoading: false });
    mockGetStats.mockReturnValue({ data: undefined });

    render(<PapersPage />);

    expect(screen.getByText('No papers found')).toBeInTheDocument();
    expect(screen.getByText(/No enriched papers available yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Go to Settings/i })).toBeInTheDocument();
  });

  it('should display arXiv link for each paper', () => {
    const papersData = {
      papers: [
        {
          id: 'paper-1',
          arxivId: '2401.00001',
          version: 1,
          title: 'Test Paper 1',
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
        },
      ],
      total: 1,
      hasMore: false,
    };

    mockListPapers.mockReturnValue({ data: papersData, isLoading: false });
    mockGetStats.mockReturnValue({ data: undefined });

    render(<PapersPage />);

    const arxivLink = screen.getByRole('link', { name: /arXiv/i });
    expect(arxivLink).toHaveAttribute('href', 'https://arxiv.org/pdf/2401.00001');
    expect(arxivLink).toHaveAttribute('target', '_blank');
  });

  it('should handle pagination', async () => {
    const user = userEvent.setup();
    const page1Data = {
      papers: [
        {
          id: 'paper-1',
          arxivId: '2401.00001',
          version: 1,
          title: 'Paper 1',
          authors: ['Alice'],
          abstract: 'Abstract 1',
          categories: ['cs.AI'],
          primaryCategory: 'cs.AI',
          status: 'enriched',
          pubDate: new Date(),
          updatedDate: new Date(),
          pdfUrl: 'https://arxiv.org/pdf/2401.00001',
          rawMetadata: {},
          codeUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          enriched: null,
        },
      ],
      total: 25,
      hasMore: true,
    };

    mockListPapers.mockReturnValue({ data: page1Data, isLoading: false });
    mockGetStats.mockReturnValue({ data: undefined });

    render(<PapersPage />);

    // Check pagination info
    expect(screen.getByText(/Page 1 of 2/)).toBeInTheDocument();
    expect(screen.getByText(/25 papers total/)).toBeInTheDocument();

    // Previous button should be disabled
    const prevButton = screen.getByRole('button', { name: /Previous/i });
    expect(prevButton).toBeDisabled();

    // Next button should be enabled
    const nextButton = screen.getByRole('button', { name: /Next/i });
    expect(nextButton).not.toBeDisabled();
  });

  it('should truncate long author lists', () => {
    const papersData = {
      papers: [
        {
          id: 'paper-1',
          arxivId: '2401.00001',
          version: 1,
          title: 'Test Paper',
          authors: ['Author 1', 'Author 2', 'Author 3', 'Author 4'],
          abstract: 'Abstract',
          categories: ['cs.AI'],
          primaryCategory: 'cs.AI',
          status: 'enriched',
          pubDate: new Date(),
          updatedDate: new Date(),
          pdfUrl: 'https://arxiv.org/pdf/2401.00001',
          rawMetadata: {},
          codeUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          enriched: null,
        },
      ],
      total: 1,
      hasMore: false,
    };

    mockListPapers.mockReturnValue({ data: papersData, isLoading: false });
    mockGetStats.mockReturnValue({ data: undefined });

    render(<PapersPage />);

    // Should show first 3 authors + "et al."
    expect(screen.getByText(/Author 1, Author 2, Author 3/)).toBeInTheDocument();
    expect(screen.getByText(/et al\./)).toBeInTheDocument();
  });

  it('should format publication dates correctly', () => {
    const papersData = {
      papers: [
        {
          id: 'paper-1',
          arxivId: '2401.00001',
          version: 1,
          title: 'Test Paper',
          authors: ['Alice'],
          abstract: 'Abstract',
          categories: ['cs.AI'],
          primaryCategory: 'cs.AI',
          status: 'enriched',
          pubDate: new Date('2024-01-15T10:00:00Z'),
          updatedDate: new Date('2024-01-15T10:00:00Z'),
          pdfUrl: 'https://arxiv.org/pdf/2401.00001',
          rawMetadata: {},
          codeUrl: null,
          createdAt: new Date(),
          updatedAt: new Date(),
          enriched: null,
        },
      ],
      total: 1,
      hasMore: false,
    };

    mockListPapers.mockReturnValue({ data: papersData, isLoading: false });
    mockGetStats.mockReturnValue({ data: undefined });

    render(<PapersPage />);

    // Date should be formatted as "Jan 15, 2024" or similar
    expect(screen.getByText(/Jan 15, 2024/)).toBeInTheDocument();
  });
});
