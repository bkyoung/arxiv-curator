import PgBoss from 'pg-boss';
import { env } from './env';

export const boss = new PgBoss({
  connectionString: env.DATABASE_URL,
  schema: 'pgboss', // Separate schema for job tables
});

export async function startQueue() {
  await boss.start();
  console.log('pg-boss queue started');
  return boss;
}

export async function stopQueue() {
  await boss.stop();
  console.log('pg-boss queue stopped');
}

// Job type definitions for type safety
export type JobName =
  | 'scout-papers'          // Phase 1
  | 'enrich-paper'          // Phase 1
  | 'score-paper'           // Phase 2
  | 'generate-briefing'     // Phase 3
  | 'generate-summary'      // Phase 4
  | 'analyze-paper'         // Phase 5
  | 'synthesize-notebook';  // Phase 6

export interface JobData {
  'scout-papers': { date: string };
  'enrich-paper': { paperId: string };
  'score-paper': { paperId: string; userId: string };
  'generate-briefing': { userId: string; date: string };
  'generate-summary': { paperId: string };
  'analyze-paper': { paperId: string; userId: string; depth: 'A' | 'B' | 'C' };
  'synthesize-notebook': { notebookId: string };
}
