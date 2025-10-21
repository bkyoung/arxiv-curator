/**
 * Queue Names for pg-boss Background Jobs
 *
 * Centralized queue name constants to prevent typos and ensure consistency
 * between job producers (routers) and consumers (workers).
 */

export const QUEUE_NAMES = {
  /** Scout arXiv for new papers in specified categories */
  SCOUT_PAPERS: 'scout-papers',

  /** Enrich a single paper with embeddings and metadata */
  ENRICH_PAPER: 'enrich-paper',

  /** Generate critical analysis for a paper at specified depth (A/B/C) */
  ANALYZE_PAPER: 'analyze-paper',

  /** Generate daily digest briefings for all users */
  GENERATE_DAILY_DIGESTS: 'generate-daily-digests',
} as const;

/** Type-safe queue name type */
export type QueueName = typeof QUEUE_NAMES[keyof typeof QUEUE_NAMES];
