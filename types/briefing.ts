/**
 * Shared types for briefing components
 */

import { Prisma } from '@prisma/client';

/**
 * Paper type with enrichment and scores as returned by briefings router
 */
export type BriefingPaper = Prisma.PaperGetPayload<{
  include: {
    enriched: true;
    scores: true;
  };
}>;
