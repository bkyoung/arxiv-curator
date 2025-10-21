/**
 * AnalysisPanel Component
 *
 * Displays AI-generated critical analysis at different depths
 * Phase 5: Critical Analysis
 */

'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface AnalysisPanelProps {
  paperId: string;
  depth: 'A' | 'B' | 'C';
  showRegenerate?: boolean;
}

const DEPTH_LABELS = {
  A: 'Quick Critique',
  B: 'Comparative Critique',
  C: 'Deep Analysis',
} as const;

const VERDICT_COLORS = {
  Promising: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  Solid: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  Questionable: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  'Over-claimed': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
} as const;

export function AnalysisPanel({ paperId, depth, showRegenerate = false }: AnalysisPanelProps) {
  const { data: analysis, isLoading, isError, error, refetch } = trpc.analysis.getAnalysis.useQuery(
    { paperId, depth },
    {
      staleTime: 1000 * 60 * 60, // 1 hour - analyses don't change often unless regenerated
    }
  );

  const regenerateMutation = trpc.analysis.regenerateAnalysis.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handleRegenerate = () => {
    regenerateMutation.mutate({ paperId, depth });
  };

  // Loading state
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Critical Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4" data-testid="analysis-skeleton">
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
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
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Error state - no analysis or query error
  if (isError || !analysis) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Critical Analysis</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {isError && error
              ? `Failed to load analysis. ${error.message || 'Please try again later.'}`
              : 'No analysis available for this paper at this depth.'}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Success state
  const verdictColor = VERDICT_COLORS[analysis.verdict as keyof typeof VERDICT_COLORS] || 'bg-gray-100 text-gray-800';
  const confidencePercent = Math.round(analysis.confidence * 100);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">Critical Analysis</CardTitle>
          <Badge variant="outline" className="text-xs">
            {DEPTH_LABELS[depth]}
          </Badge>
        </div>
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
        {/* Verdict and Confidence */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">Verdict:</span>
            <Badge className={verdictColor}>
              {analysis.verdict}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground">
              {confidencePercent}% confidence
            </span>
          </div>
        </div>

        {/* Markdown Content */}
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {analysis.markdownContent}
          </ReactMarkdown>
        </div>

        {/* Limitations */}
        {analysis.limitations && analysis.limitations.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <h3 className="text-sm font-semibold mb-2">Key Limitations</h3>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {analysis.limitations.map((limitation, index) => (
                <li key={index} className="flex items-start">
                  <span className="mr-2">•</span>
                  <span>{limitation}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Generation Timestamp */}
        <div className="text-xs text-muted-foreground pt-2 border-t">
          Generated {new Date(analysis.generatedAt).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}
