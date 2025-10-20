/**
 * SummaryPanel Component
 *
 * Displays AI-generated paper summaries
 * Phase 4: Summaries
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw } from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface SummaryPanelProps {
  paperId: string;
  showRegenerate?: boolean;
}

export function SummaryPanel({ paperId, showRegenerate = false }: SummaryPanelProps) {
  const { data: summary, isLoading, isError, error, refetch } = trpc.summaries.getSummary.useQuery(
    { paperId },
    {
      staleTime: 1000 * 60 * 60, // 1 hour - summaries don't change often
    }
  );

  const regenerateMutation = trpc.summaries.regenerateSummary.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handleRegenerate = () => {
    regenerateMutation.mutate({ paperId });
  };

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4" data-testid="summary-skeleton">
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state
  if (isError || !summary) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Failed to load summary. {error?.message || 'Please try again later.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Success state
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base">Summary</CardTitle>
        {showRegenerate && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRegenerate}
            disabled={regenerateMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${regenerateMutation.isPending ? 'animate-spin' : ''}`} />
            Regenerate
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* What's New Section */}
        <div>
          <h3 className="text-sm font-semibold mb-2">What&apos;s New</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {summary.whatsNew}
          </p>
        </div>

        {/* Key Points Section */}
        <div>
          <h3 className="text-sm font-semibold mb-2">Key Points</h3>
          {summary.keyPoints.length > 0 ? (
            <ul className="space-y-1 text-sm text-muted-foreground">
              {summary.keyPoints.map((point, index) => (
                <li key={index} className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{point}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground italic">No key points available</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
