'use client';

/**
 * Papers Page
 *
 * Display and browse enriched papers from arXiv
 */

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScoreBreakdown } from '@/components/ScoreBreakdown';
import { FeedbackActions } from '@/components/FeedbackActions';
import { WhyShown } from '@/components/WhyShown';
import {
  FileText,
  Calendar,
  Users,
  Tag,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Loader2,
  BarChart3,
} from 'lucide-react';

const ITEMS_PER_PAGE = 20;

export default function PapersPage() {
  const [page, setPage] = useState(0);

  // Fetch papers
  const { data: papersData, isLoading, refetch } = trpc.papers.list.useQuery({
    limit: ITEMS_PER_PAGE,
    offset: page * ITEMS_PER_PAGE,
    // Don't filter by status - show both enriched and ranked papers
  });

  // Fetch stats
  const { data: stats } = trpc.papers.stats.useQuery();

  // Feedback mutations
  const saveMutation = trpc.feedback.save.useMutation({
    onSuccess: () => refetch(),
  });
  const dismissMutation = trpc.feedback.dismiss.useMutation({
    onSuccess: () => refetch(),
  });
  const thumbsUpMutation = trpc.feedback.thumbsUp.useMutation({
    onSuccess: () => refetch(),
  });
  const thumbsDownMutation = trpc.feedback.thumbsDown.useMutation({
    onSuccess: () => refetch(),
  });
  const hideMutation = trpc.feedback.hide.useMutation({
    onSuccess: () => refetch(),
  });

  const papers = papersData?.papers || [];
  const total = papersData?.total || 0;
  const hasMore = papersData?.hasMore || false;
  const totalPages = Math.ceil(total / ITEMS_PER_PAGE);

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="container mx-auto py-8 px-4 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <FileText className="h-8 w-8" />
              <h1 className="text-3xl font-bold">Papers</h1>
            </div>
            <p className="text-muted-foreground">Browse enriched arXiv papers</p>
          </div>

          {/* Stats */}
          {stats && (
            <Card className="min-w-[200px]">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total:</span>
                  <span className="font-medium">{stats.total}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pending:</span>
                  <span className="font-medium">{stats.pending}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Enriched:</span>
                  <span className="font-medium">{stats.enriched}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ranked:</span>
                  <span className="font-medium">{stats.ranked}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && papers.length === 0 && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No papers found</h3>
              <p className="text-sm text-muted-foreground mb-4">
                No enriched papers available yet. Configure your settings and run the worker to
                ingest papers.
              </p>
              <Button asChild>
                <a href="/settings">Go to Settings</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Papers list */}
      {!isLoading && papers.length > 0 && (
        <div className="space-y-4">
          {papers.map((paper) => {
            const score = paper.scores?.[0];
            const isSaved = paper.feedback?.some((f) => f.action === 'save');
            const isThumbsUp = paper.feedback?.some((f) => f.action === 'thumbs_up');
            const isThumbsDown = paper.feedback?.some((f) => f.action === 'thumbs_down');

            return (
              <Card key={paper.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-2 leading-tight">{paper.title}</CardTitle>
                      <CardDescription>
                        <div className="flex items-center gap-4 flex-wrap text-sm">
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            <span>{paper.authors.slice(0, 3).join(', ')}</span>
                            {paper.authors.length > 3 && <span>et al.</span>}
                          </div>
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            <span>{formatDate(paper.pubDate)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Tag className="h-3 w-3" />
                            <span>{paper.primaryCategory}</span>
                          </div>
                        </div>
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={paper.pdfUrl || `https://arxiv.org/abs/${paper.arxivId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        arXiv
                      </a>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-3">
                    {paper.abstract}
                  </p>

                  {paper.enriched && (
                    <>
                      <Separator className="my-3" />
                      <div className="flex flex-wrap gap-2 mb-4">
                        {/* Topics */}
                        {paper.enriched.topics.map((topic) => (
                          <Badge key={topic} variant="secondary">
                            {topic}
                          </Badge>
                        ))}

                        {/* Evidence signals */}
                        {paper.enriched.hasCode && <Badge variant="outline">Code Available</Badge>}
                        {paper.enriched.hasData && <Badge variant="outline">Dataset</Badge>}
                        {paper.enriched.hasBaselines && <Badge variant="outline">Baselines</Badge>}
                        {paper.enriched.hasAblations && <Badge variant="outline">Ablations</Badge>}
                        {paper.enriched.hasMultipleEvals && (
                          <Badge variant="outline">Multiple Evals</Badge>
                        )}
                      </div>
                    </>
                  )}

                  {/* Score Breakdown */}
                  {score && (
                    <div className="mb-4">
                      <ScoreBreakdown
                        score={{
                          novelty: score.novelty,
                          evidence: score.evidence,
                          velocity: score.velocity,
                          personalFit: score.personalFit,
                          labPrior: score.labPrior,
                          mathPenalty: score.mathPenalty,
                          finalScore: score.finalScore,
                        }}
                      />
                    </div>
                  )}

                  {/* Why Shown */}
                  {score?.whyShown && typeof score.whyShown === 'object' && !Array.isArray(score.whyShown) && (
                    <div className="mb-4">
                      <WhyShown
                        whyShown={score.whyShown as Record<string, number>}
                        matchedTopics={paper.enriched?.topics}
                        collapsible
                      />
                    </div>
                  )}

                  {/* Feedback Actions */}
                  <Separator className="my-3" />
                  <FeedbackActions
                    onSave={() => saveMutation.mutate({ paperId: paper.id })}
                    onDismiss={() => dismissMutation.mutate({ paperId: paper.id })}
                    onThumbsUp={() => thumbsUpMutation.mutate({ paperId: paper.id })}
                    onThumbsDown={() => thumbsDownMutation.mutate({ paperId: paper.id })}
                    onHide={() => hideMutation.mutate({ paperId: paper.id })}
                    isSaved={isSaved}
                    isThumbsUp={isThumbsUp}
                    isThumbsDown={isThumbsDown}
                  />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && papers.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-between mt-8">
          <div className="text-sm text-muted-foreground">
            Page {page + 1} of {totalPages} ({total} papers total)
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={!hasMore}
            >
              Next
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
