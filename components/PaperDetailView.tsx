/**
 * PaperDetailView Component
 *
 * Full paper details in the right pane
 */

'use client';

import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { ExternalLink } from 'lucide-react';
import { FeedbackActions } from '@/components/FeedbackActions';
import { ScoreBreakdown } from '@/components/ScoreBreakdown';
import { WhyShown } from '@/components/WhyShown';
import { BriefingPaper } from '@/types/briefing';
import { getEvidenceBadges } from '@/lib/paper-helpers';

interface PaperDetailViewProps {
  paper: BriefingPaper;
  onSave: () => void;
  onDismiss: () => void;
  onThumbsUp: () => void;
  onThumbsDown: () => void;
  onHide: () => void;
}

export function PaperDetailView({ paper, onSave, onDismiss, onThumbsUp, onThumbsDown, onHide }: PaperDetailViewProps) {
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
