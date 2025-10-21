/**
 * Worker Process
 *
 * Processes background jobs for paper ingestion and enrichment
 */

// Load environment variables from .env.local BEFORE any other imports
// This MUST be the very first import to ensure env vars are available
import { config } from 'dotenv';
import { resolve } from 'path';

const envLocalPath = resolve(process.cwd(), '.env.local');
const envPath = resolve(process.cwd(), '.env');

// Load .env.local first (overrides .env)
const resultLocal = config({ path: envLocalPath });
// Then load .env
const resultEnv = config({ path: envPath });

// Debug: Verify environment variables are loaded
if (!process.env.DATABASE_URL) {
  console.error('[Worker] ERROR: DATABASE_URL not found after loading .env files');
  console.error('[Worker] .env.local path:', envLocalPath);
  console.error('[Worker] .env.local loaded:', !resultLocal.error);
  console.error('[Worker] .env path:', envPath);
  console.error('[Worker] .env loaded:', !resultEnv.error);
  if (resultLocal.error) console.error('[Worker] .env.local error:', resultLocal.error);
  if (resultEnv.error) console.error('[Worker] .env error:', resultEnv.error);
  process.exit(1);
}

// IMPORTANT: Use dynamic imports to prevent module loading before dotenv config runs
// Static imports are hoisted and execute before any code, including dotenv
// Dynamic imports delay module loading until after environment variables are set

/**
 * Job data interfaces
 */
interface ScoutPapersJob {
  categories: string[];
  maxResults: number;
}

interface EnrichPaperJob {
  paperId: string;
  useLocalEmbeddings?: boolean;
  useLocalLLM?: boolean;
}

interface CritiquePaperJobData {
  paperId: string;
  userId: string;
  depth: 'A' | 'B' | 'C';
}

/**
 * Main worker process
 */
async function main() {
  console.log('[Worker] Starting worker process...');

  try {
    // Dynamic imports to ensure env vars are loaded first
    const { startQueue, boss } = await import('@/server/queue');
    const { scoutEnrichWorkflow } = await import('./workflows/scout-enrich');
    const { enrichPaper } = await import('@/server/agents/enricher');
    const { generateDailyDigestsJob } = await import('./jobs/generate-daily-digests');
    const { handleCritiquePaperJob } = await import('./jobs/critique-paper');
    const { prisma } = await import('@/server/db');

    // Start pg-boss queue
    await startQueue();
    console.log('[Worker] Queue started');

    // Create queues explicitly (required in pg-boss v11+)
    // Queues must exist before workers can register or jobs can be sent
    await boss.createQueue('scout-papers');
    await boss.createQueue('enrich-paper');
    await boss.createQueue('generate-daily-digests');
    await boss.createQueue('analyze-paper');
    console.log('[Worker] Queues created');

    // Register job handler: scout-papers
    await boss.work<ScoutPapersJob>('scout-papers', async (jobs) => {
      // pg-boss work handler can receive array of jobs
      const jobArray = Array.isArray(jobs) ? jobs : [jobs];

      for (const job of jobArray) {
        const jobId = (job as any).id || 'unknown';
        const { categories, maxResults } = job.data;

        console.log(`[Worker] Processing scout-papers job ${jobId}`);
        console.log(`[Worker] Categories: ${categories.join(', ')}`);
        console.log(`[Worker] Max results: ${maxResults}`);

        try {
          const result = await scoutEnrichWorkflow(categories, maxResults);

          console.log(`[Worker] Job ${jobId} completed`);
          console.log(`[Worker] Scouted ${result.paperIds.length} papers`);
          console.log(`[Worker] Enriched ${result.enrichedCount} papers`);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error(
            `[Worker] Scout-papers job ${jobId} failed (categories: ${categories.join(', ')}):`,
            error
          );
          throw new Error(
            `Scout-papers job ${jobId} failed: ${errorMessage}`
          );
        }
      }

      return { success: true };
    });

    // Register job handler: enrich-paper
    await boss.work<EnrichPaperJob>('enrich-paper', async (jobs) => {
      // pg-boss work handler can receive array of jobs
      const jobArray = Array.isArray(jobs) ? jobs : [jobs];

      for (const job of jobArray) {
        const jobId = (job as any).id || 'unknown';
        const { paperId, useLocalEmbeddings = true, useLocalLLM = true } = job.data;

        console.log(`[Worker] Processing enrich-paper job ${jobId}`);
        console.log(`[Worker] Paper ID: ${paperId}`);

        try {
          const paper = await prisma.paper.findUnique({ where: { id: paperId } });
          if (!paper) {
            throw new Error(`Paper ${paperId} not found`);
          }

          await enrichPaper(paper, useLocalEmbeddings, useLocalLLM);

          console.log(`[Worker] Job ${jobId} completed`);
          console.log(`[Worker] Paper ${paperId} enriched`);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error(
            `[Worker] Enrich-paper job ${jobId} failed (paperId: ${paperId}):`,
            error
          );
          throw new Error(
            `Enrich-paper job ${jobId} failed for paper ${paperId}: ${errorMessage}`
          );
        }
      }

      return { success: true };
    });

    // Register job handler: generate-daily-digests
    await boss.work('generate-daily-digests', async (jobs) => {
      const jobArray = Array.isArray(jobs) ? jobs : [jobs];

      for (const job of jobArray) {
        const jobId = (job as any).id || 'unknown';

        console.log(`[Worker] Processing generate-daily-digests job ${jobId}`);

        try {
          const result = await generateDailyDigestsJob();

          console.log(`[Worker] Job ${jobId} completed`);
          console.log(
            `[Worker] Generated digests: ${result.succeeded} succeeded, ${result.failed} failed (total: ${result.total})`
          );

          return result;
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error(
            `[Worker] Generate-daily-digests job ${jobId} failed:`,
            error
          );
          throw new Error(
            `Generate-daily-digests job ${jobId} failed: ${errorMessage}`
          );
        }
      }

      return { success: true };
    });

    // Register job handler: analyze-paper
    await boss.work<CritiquePaperJobData>('analyze-paper', async (jobs) => {
      const jobArray = Array.isArray(jobs) ? jobs : [jobs];

      for (const job of jobArray) {
        const jobId = (job as any).id || 'unknown';
        const { paperId, userId, depth } = job.data;

        console.log(`[Worker] Processing analyze-paper job ${jobId}`);
        console.log(`[Worker] Paper ID: ${paperId}, Depth: ${depth}`);

        try {
          await handleCritiquePaperJob(job);

          console.log(`[Worker] Job ${jobId} completed`);
          console.log(`[Worker] Generated ${depth} critique for paper ${paperId}`);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          console.error(
            `[Worker] Critique-paper job ${jobId} failed (paperId: ${paperId}, depth: ${depth}):`,
            error
          );
          throw new Error(
            `Critique-paper job ${jobId} failed for paper ${paperId}: ${errorMessage}`
          );
        }
      }

      return { success: true };
    });

    // Schedule daily digest generation at 6:30 AM (after arXiv's 6:00 AM update)
    // Note: Schedule AFTER registering work handler to ensure queue exists
    // First unschedule any existing schedule to avoid conflicts
    await boss.unschedule('generate-daily-digests').catch(() => {
      // Ignore error if schedule doesn't exist
    });

    await boss.schedule(
      'generate-daily-digests',
      '30 6 * * *', // Cron: 6:30 AM every day
      {},
      { tz: 'America/New_York' } // arXiv's timezone
    );

    console.log('[Worker] Daily digest job scheduled for 6:30 AM ET');
    console.log('[Worker] Ready. Waiting for jobs...');

    // Keep process running
    process.on('SIGINT', async () => {
      console.log('[Worker] Shutting down...');
      await boss.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('[Worker] Shutting down...');
      await boss.stop();
      process.exit(0);
    });
  } catch (error) {
    console.error('[Worker] Fatal error:', error);
    process.exit(1);
  }
}

// Run worker if this is the main module
if (require.main === module) {
  main().catch((error) => {
    console.error('[Worker] Startup failed:', error);
    process.exit(1);
  });
}

export { main };
