/**
 * WhyShown Component
 *
 * Explains why a paper was shown to the user
 * Highlights top contributing signals and matched topics/keywords
 */

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Info } from 'lucide-react';

interface WhyShownProps {
  whyShown: Record<string, number>;
  matchedTopics?: string[];
  matchedKeywords?: string[];
  collapsible?: boolean;
  maxSignals?: number;
}

const signalDescriptions: Record<string, string> = {
  novelty: 'This paper explores novel ideas different from your usual interests',
  evidence: 'Strong evidence quality with baselines, ablations, and empirical validation',
  velocity: 'This topic is gaining momentum in recent research',
  personalFit: 'Closely matches your research interests and preferences',
  labPrior: 'From a research lab you follow',
  mathPenalty: 'Mathematical complexity adjusted to your preferences',
};

const signalLabels: Record<string, string> = {
  novelty: 'Novelty',
  evidence: 'Evidence',
  velocity: 'Velocity',
  personalFit: 'Personal Fit',
  labPrior: 'Lab Prior',
  mathPenalty: 'Math Penalty',
};

export function WhyShown({
  whyShown,
  matchedTopics = [],
  matchedKeywords = [],
  collapsible = false,
  maxSignals = 3,
}: WhyShownProps) {
  // Sort signals by contribution (highest first)
  const sortedSignals = Object.entries(whyShown)
    .filter(([, value]) => value > 0)
    .sort(([, a], [, b]) => b - a)
    .slice(0, maxSignals);

  const content = (
    <div className="space-y-3" role="article">
      <div className="flex items-center gap-2">
        <Info className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold">Why Shown</h4>
      </div>

      {sortedSignals.length > 0 && (
        <div className="space-y-2">
          {sortedSignals.map(([key, value]) => (
            <div key={key} className="flex items-start gap-2">
              <Badge variant="outline" className="shrink-0">
                {value.toFixed(2)}
              </Badge>
              <div className="flex-1">
                <p className="text-sm font-medium">{signalLabels[key]}</p>
                <p className="text-xs text-muted-foreground">
                  {signalDescriptions[key]}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {matchedTopics.length > 0 && (
        <>
          <Separator />
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Matched Topics
            </p>
            <div className="flex flex-wrap gap-1">
              {matchedTopics.map((topic) => (
                <Badge key={topic} variant="secondary" className="text-xs">
                  {topic}
                </Badge>
              ))}
            </div>
          </div>
        </>
      )}

      {matchedKeywords.length > 0 && (
        <>
          <Separator />
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2">
              Matched Keywords
            </p>
            <div className="flex flex-wrap gap-1">
              {matchedKeywords.map((keyword) => (
                <Badge key={keyword} variant="secondary" className="text-xs">
                  {keyword}
                </Badge>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );

  if (collapsible) {
    return (
      <details className="group">
        <summary className="cursor-pointer list-none">
          <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <Info className="h-4 w-4" />
            <span>Why shown?</span>
          </button>
        </summary>
        <Card className="mt-2 p-3">{content}</Card>
      </details>
    );
  }

  return <Card className="p-3">{content}</Card>;
}
