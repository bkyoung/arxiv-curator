/**
 * Paper Helper Utilities
 *
 * Shared functions for paper display and formatting
 */

import { Code, BarChart2, FlaskConical, Database } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { BriefingPaper } from '@/types/briefing';

export interface EvidenceBadge {
  label: string;
  icon: LucideIcon;
}

/**
 * Get evidence badges for a paper based on its enriched data
 *
 * @param paper - Paper with enriched data
 * @param includeData - Whether to include the Data badge (default: true)
 * @returns Array of evidence badges
 */
export function getEvidenceBadges(
  paper: BriefingPaper,
  includeData = true
): EvidenceBadge[] {
  const badges: EvidenceBadge[] = [];

  if (paper.enriched?.hasCode) {
    badges.push({ label: 'Code', icon: Code });
  }

  if (paper.enriched?.hasBaselines) {
    badges.push({ label: 'Baselines', icon: BarChart2 });
  }

  if (paper.enriched?.hasAblations) {
    badges.push({ label: 'Ablations', icon: FlaskConical });
  }

  if (includeData && paper.enriched?.hasData) {
    badges.push({ label: 'Data', icon: Database });
  }

  return badges;
}

/**
 * Get top N "why shown" signals from a paper's score
 *
 * @param score - Paper score object
 * @param limit - Maximum number of signals to return (default: 2)
 * @returns Array of signal names sorted by contribution
 */
export function getTopWhyShownSignals(
  score: { whyShown?: unknown } | undefined,
  limit = 2
): string[] {
  if (!score?.whyShown) {
    return [];
  }

  if (typeof score.whyShown !== 'object' || Array.isArray(score.whyShown)) {
    return [];
  }

  return Object.entries(score.whyShown as Record<string, number>)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([signal]) => signal);
}

/**
 * Format paper authors for display
 *
 * @param authors - Array of author names
 * @param maxDisplay - Maximum number of authors to display (default: 3)
 * @returns Formatted author string
 */
export function formatAuthors(authors: string[], maxDisplay = 3): string {
  const displayAuthors = authors.slice(0, maxDisplay);
  const remainingCount = authors.length - maxDisplay;

  let formatted = displayAuthors.join(', ');
  if (remainingCount > 0) {
    formatted += ` +${remainingCount} more`;
  }

  return formatted;
}

/**
 * Calculate score percentage from a paper's score
 *
 * @param score - Paper score object with finalScore
 * @returns Score as a percentage (0-100)
 */
export function getScorePercent(score: { finalScore?: number } | undefined): number {
  return score?.finalScore ? Math.round(score.finalScore * 100) : 0;
}
