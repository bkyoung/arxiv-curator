/**
 * PaperDetailView Component
 *
 * Full paper details in the right pane
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ExternalLink, Loader2 } from 'lucide-react';
import { FeedbackActions } from '@/components/FeedbackActions';
import { ScoreBreakdown } from '@/components/ScoreBreakdown';
import { WhyShown } from '@/components/WhyShown';
import { SummaryPanel } from '@/components/SummaryPanel';
import { GenerateCritiqueDropdown } from '@/components/GenerateCritiqueDropdown';
import { AnalysisPanel } from '@/components/AnalysisPanel';
import { BriefingPaper } from '@/types/briefing';
import { getEvidenceBadges } from '@/lib/paper-helpers';
import { trpc } from '@/lib/trpc';

interface PaperDetailViewProps {
  paper: BriefingPaper;
  onSave: () => void;
  onDismiss: () => void;
  onThumbsUp: () => void;
  onThumbsDown: () => void;
  onHide: () => void;
}

export function PaperDetailView({ paper, onSave, onDismiss, onThumbsUp, onThumbsDown, onHide }: PaperDetailViewProps) {
  const [selectedDepth, setSelectedDepth] = useState<'A' | 'B' | 'C' | null>(null);
  const [generatingJobId, setGeneratingJobId] = useState<string | null>(null);
  const [showCostWarning] = useState(true); // Can be made configurable via settings

  const score = paper.scores?.[0];
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(new Date(paper.pubDate));

  // Evidence badges (include all badges for detail view)
  const evidenceBadges = getEvidenceBadges(paper, true);

  const mathDepth = paper.enriched?.mathDepth || 0;
  const mathDepthPercent = Math.round(mathDepth * 100);

  // Check for existing analyses
  const analysisAQuery = trpc.analysis.getAnalysis.useQuery({ paperId: paper.id, depth: 'A' });
  const analysisBQuery = trpc.analysis.getAnalysis.useQuery({ paperId: paper.id, depth: 'B' });
  const analysisCQuery = trpc.analysis.getAnalysis.useQuery({ paperId: paper.id, depth: 'C' });

  // Destructure refetch functions (stable references)
  const { refetch: refetchA } = analysisAQuery;
  const { refetch: refetchB } = analysisBQuery;
  const { refetch: refetchC } = analysisCQuery;

  // Poll for job status when generating
  const jobStatusQuery = trpc.analysis.getJobStatus.useQuery(
    { jobId: generatingJobId! },
    {
      enabled: !!generatingJobId,
      refetchInterval: (query) => {
        const data = query.state.data;
        // Stop polling if job is completed or failed, or after 10 minutes
        if (!data || data.state === 'completed' || data.state === 'failed') {
          return false;
        }
        return 2000; // Poll every 2 seconds
      },
    }
  );

  // Stop polling and refetch analysis when job completes
  useEffect(() => {
    if (jobStatusQuery.data?.state === 'completed') {
      setGeneratingJobId(null);
      // Refetch the analysis for the selected depth
      if (selectedDepth === 'A') refetchA();
      if (selectedDepth === 'B') refetchB();
      if (selectedDepth === 'C') refetchC();
    }
  }, [jobStatusQuery.data?.state, selectedDepth, refetchA, refetchB, refetchC]);

  const handleAnalysisRequested = (depth: 'A' | 'B' | 'C', jobId: string | null) => {
    setSelectedDepth(depth);
    setGeneratingJobId(jobId);
  };

  const isGenerating = !!generatingJobId && jobStatusQuery.data?.state !== 'completed' && jobStatusQuery.data?.state !== 'failed';

  return (
    <div className="h-full overflow-y-auto">
      <div className="p-6 space-y-6">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold mb-2">{paper.title}</h1>
          <p className="text-sm text-muted-foreground">
            {paper.authors.join(', ')}
          </p>
        </div>

        {/* Metadata */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>{formattedDate}</span>
          <span>•</span>
          <span>{paper.primaryCategory}</span>
          {paper.pdfUrl && (
            <>
              <span>•</span>
              <Link
                href={paper.pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-primary hover:underline"
              >
                View PDF
                <ExternalLink className="h-3 w-3" />
              </Link>
            </>
          )}
        </div>

        {/* Feedback Actions */}
        <FeedbackActions
          onSave={onSave}
          onDismiss={onDismiss}
          onThumbsUp={onThumbsUp}
          onThumbsDown={onThumbsDown}
          onHide={onHide}
        />

        <Separator />

        {/* Score Breakdown */}
        {score && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Score Breakdown</CardTitle>
            </CardHeader>
            <CardContent>
              <ScoreBreakdown score={score} />
            </CardContent>
          </Card>
        )}

        {/* Why Shown */}
        {score?.whyShown && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Why Shown</CardTitle>
            </CardHeader>
            <CardContent>
              <WhyShown
                whyShown={score.whyShown as Record<string, number>}
                matchedTopics={paper.enriched?.topics}
              />
            </CardContent>
          </Card>
        )}

        {/* AI Summary */}
        <SummaryPanel paperId={paper.id} />

        {/* Critical Analysis */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Critical Analysis</h2>
            <GenerateCritiqueDropdown
              paperId={paper.id}
              showCostWarning={showCostWarning}
              onAnalysisRequested={handleAnalysisRequested}
            />
          </div>

          {/* Progress indicator when generating */}
          {isGenerating && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <div>
                    <p className="text-sm font-medium">Generating {selectedDepth} analysis...</p>
                    <p className="text-xs text-muted-foreground">
                      {jobStatusQuery.data?.state === 'active'
                        ? 'Processing...'
                        : 'Queued...'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Show analysis panels for each completed depth */}
          {analysisAQuery.data && (
            <AnalysisPanel paperId={paper.id} depth="A" showRegenerate />
          )}
          {analysisBQuery.data && (
            <AnalysisPanel paperId={paper.id} depth="B" showRegenerate />
          )}
          {analysisCQuery.data && (
            <AnalysisPanel paperId={paper.id} depth="C" showRegenerate />
          )}
        </div>

        <Separator />

        {/* Abstract */}
        <div>
          <h2 className="text-lg font-semibold mb-2">Abstract</h2>
          <p className="text-sm leading-relaxed">{paper.abstract}</p>
        </div>

        {/* Topics */}
        {paper.enriched?.topics && paper.enriched.topics.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2">Topics</h3>
            <div className="flex flex-wrap gap-2">
              {paper.enriched.topics.map((topic) => (
                <Badge key={topic} variant="outline">
                  {topic}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Evidence Signals */}
        {evidenceBadges.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-2">Evidence</h3>
            <div className="flex flex-wrap gap-2">
              {evidenceBadges.map(({ label, icon: Icon }) => (
                <Badge key={label} variant="secondary">
                  <Icon className="h-3 w-3 mr-1" />
                  {label}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Math Depth */}
        {paper.enriched?.mathDepth !== undefined && (
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Math Depth</h3>
              <span className="text-sm text-muted-foreground">
                {mathDepthPercent}%
              </span>
            </div>
            <Progress value={mathDepthPercent} className="h-2" />
          </div>
        )}
      </div>
    </div>
  );
}
