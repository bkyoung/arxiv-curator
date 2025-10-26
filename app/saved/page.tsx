'use client';

/**
 * Saved Papers Page
 *
 * Display papers saved by the user
 */

import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScoreBreakdown } from '@/components/ScoreBreakdown';
import { FeedbackActions } from '@/components/FeedbackActions';
import { WhyShown } from '@/components/WhyShown';
import {
  Bookmark,
  Calendar,
  Users,
  Tag,
  ExternalLink,
  Loader2,
} from 'lucide-react';

export default function SavedPage() {
  // Fetch saved papers
  const { data: savedFeedback, isLoading, refetch } = trpc.feedback.getHistory.useQuery({
    action: 'save',
  });

  // Feedback mutations
  const saveMutation = trpc.feedback.save.useMutation({
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
        <div className="flex items-center gap-3 mb-2">
          <Bookmark className="h-8 w-8" />
          <h1 className="text-3xl font-bold">Saved Papers</h1>
        </div>
        <p className="text-muted-foreground">
          Papers you&apos;ve saved for later reading
        </p>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!savedFeedback || savedFeedback.length === 0) && (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Bookmark className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="text-lg font-medium mb-2">No saved papers yet</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Save papers from the papers page to read them later.
              </p>
              <Button asChild>
                <a href="/papers">Browse Papers</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Papers list */}
      {!isLoading && savedFeedback && savedFeedback.length > 0 && (
        <div className="space-y-4">
          {savedFeedback.map((feedback) => {
            const paper = feedback.paper;
            if (!paper) return null;

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
    </div>
  );
}
