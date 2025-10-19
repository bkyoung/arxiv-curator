/**
 * ScoreBreakdown Component
 *
 * Displays the multi-signal score breakdown for a paper
 * Shows all 6 signals (N, E, V, P, L, M) and final score
 */

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';

export interface ScoreData {
  novelty: number;
  evidence: number;
  velocity: number;
  personalFit: number;
  labPrior: number;
  mathPenalty: number;
  finalScore: number;
}

interface ScoreBreakdownProps {
  score: ScoreData;
  compact?: boolean;
}

const signals = [
  { key: 'novelty' as keyof ScoreData, label: 'Novelty', color: 'bg-purple-100 text-purple-800' },
  { key: 'evidence' as keyof ScoreData, label: 'Evidence', color: 'bg-blue-100 text-blue-800' },
  { key: 'velocity' as keyof ScoreData, label: 'Velocity', color: 'bg-green-100 text-green-800' },
  { key: 'personalFit' as keyof ScoreData, label: 'Personal Fit', color: 'bg-yellow-100 text-yellow-800' },
  { key: 'labPrior' as keyof ScoreData, label: 'Lab Prior', color: 'bg-pink-100 text-pink-800' },
  { key: 'mathPenalty' as keyof ScoreData, label: 'Math Penalty', color: 'bg-red-100 text-red-800' },
];

export function ScoreBreakdown({ score, compact = false }: ScoreBreakdownProps) {
  const formatScore = (value: number) => value.toFixed(2);

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Score:</span>
        <Badge variant="default" className="font-mono">
          {formatScore(score.finalScore)}
        </Badge>
      </div>
    );
  }

  return (
    <Card className="p-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b pb-2">
          <h3 className="text-lg font-semibold">Score Breakdown</h3>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Final Score:</span>
            <Badge variant="default" className="text-lg font-mono">
              {formatScore(score.finalScore)}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          {signals.map(({ key, label, color }) => (
            <div key={key} className="flex items-center justify-between rounded-lg border p-3">
              <span className="text-sm text-muted-foreground">{label}:</span>
              <Badge className={`font-mono ${color}`}>
                {formatScore(score[key])}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
