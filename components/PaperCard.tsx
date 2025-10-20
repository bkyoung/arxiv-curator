/**
 * PaperCard Component
 *
 * Compact paper card for briefing list
 */

'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { BriefingPaper } from '@/types/briefing';
import {
  getEvidenceBadges,
  getTopWhyShownSignals,
  formatAuthors,
  getScorePercent,
} from '@/lib/paper-helpers';

interface PaperCardProps {
  paper: BriefingPaper;
  isActive: boolean;
  onClick: () => void;
}

export function PaperCard({ paper, isActive, onClick }: PaperCardProps) {
  const score = paper.scores?.[0];
  const scorePercent = getScorePercent(score);

  // Authors: show first 3, then +N more
  const authorsText = formatAuthors(paper.authors, 3);

  // Topics: show first 3
  const topics = paper.enriched?.topics?.slice(0, 3) || [];

  // Evidence badges (exclude Data badge for compact view)
  const evidenceBadges = getEvidenceBadges(paper, false);

  // Why shown: top 2 signals
  const whyShownSignals = getTopWhyShownSignals(score, 2);

  return (
    <Card
      className={cn(
        'cursor-pointer transition-colors hover:bg-accent',
        isActive && 'border-primary bg-accent'
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        {/* Score Badge */}
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="text-sm font-medium line-clamp-2 flex-1">{paper.title}</h3>
          <Badge variant="default" className="shrink-0">
            {scorePercent}%
          </Badge>
        </div>

        {/* Authors */}
        <p className="text-xs text-muted-foreground mb-2">
          {authorsText}
        </p>

        {/* Topic badges */}
        {topics.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {topics.map((topic) => (
              <Badge key={topic} variant="outline" className="text-xs">
                {topic}
              </Badge>
            ))}
          </div>
        )}

        {/* Evidence badges */}
        {evidenceBadges.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {evidenceBadges.map(({ label, icon: Icon }) => (
              <Badge key={label} variant="secondary" className="text-xs">
                <Icon className="h-3 w-3 mr-1" />
                {label}
              </Badge>
            ))}
          </div>
        )}

        {/* Why shown preview */}
        {whyShownSignals.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Why: {whyShownSignals.join(', ')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
