/**
 * Scout-Enrich Workflow
 *
 * Workflow that orchestrates paper ingestion and enrichment
 */

import { ingestRecentPapers } from '@/server/agents/scout';
import { enrichPaper } from '@/server/agents/enricher';
import { prisma } from '@/server/db';

/**
 * Workflow state interface
 */
interface PipelineState {
  categories: string[];
  maxResults: number;
  paperIds: string[];
  enrichedCount: number;
}

/**
 * Scout-Enrich workflow
 *
 * Executes a two-stage pipeline:
 * 1. Scout: Ingest papers from arXiv
 * 2. Enrich: Generate embeddings and classify papers
 *
 * @param categories - arXiv categories to ingest (e.g., ['cs.AI', 'cs.LG'])
 * @param maxResults - Maximum number of papers to ingest
 * @returns Final workflow state with paper IDs and enrichment count
 */
export async function scoutEnrichWorkflow(
  categories: string[],
  maxResults: number = 100
): Promise<PipelineState> {
  console.log('[Workflow] Starting scout-enrich workflow');
  console.log(`[Workflow] Categories: ${categories.join(', ')}`);
  console.log(`[Workflow] Max results: ${maxResults}`);

  // For now, execute the workflow manually until LangGraph API is stable
  // TODO: Use LangGraph once API is clarified

  console.log(`[Scout Node] Scouting papers for ${categories.length} categories`);
  let paperIds: string[] = [];
  try {
    paperIds = await ingestRecentPapers(categories, maxResults);
    console.log(`[Scout Node] Scouted ${paperIds.length} papers`);
  } catch (error) {
    console.error('[Scout Node] Error:', error);
  }

  console.log(`[Enrich Node] Enriching ${paperIds.length} papers`);
  let enrichedCount = 0;

  for (const paperId of paperIds) {
    try {
      const paper = await prisma.paper.findUnique({ where: { id: paperId } });
      if (!paper) {
        console.warn(`[Enrich Node] Paper ${paperId} not found, skipping`);
        continue;
      }

      // Only enrich papers with status="new"
      if (paper.status === 'new') {
        await enrichPaper(paper, true, true); // Use local models by default
        enrichedCount++;
      } else {
        console.log(`[Enrich Node] Skipping paper ${paperId} (status: ${paper.status})`);
      }
    } catch (error) {
      console.error(`[Enrich Node] Error enriching paper ${paperId}:`, error);
      // Continue processing other papers
    }
  }

  console.log(`[Enrich Node] Enriched ${enrichedCount} papers`);

  const result = {
    categories,
    maxResults,
    paperIds,
    enrichedCount,
  };

  console.log('[Workflow] Completed');
  console.log(`[Workflow] Total papers: ${result.paperIds.length}`);
  console.log(`[Workflow] Enriched: ${result.enrichedCount}`);

  return result;
}
