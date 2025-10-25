/**
 * Script to manually trigger paper ingestion
 */
import { boss } from '../server/queue';
import { QUEUE_NAMES } from '../server/lib/queue-constants';

async function main() {
  console.log('Triggering paper ingestion job...');

  const jobId = await boss.send(QUEUE_NAMES.SCOUT_PAPERS, {
    categories: [
      'cs.AI',
      'cs.LG',
      'cs.CL',
      'cs.CV',
      'cs.IR',
    ],
    maxResults: 50, // Smaller batch for testing
  });

  console.log(`✓ Job queued with ID: ${jobId}`);
  console.log('Monitor progress in worker logs:');
  console.log('  docker compose -f docker-compose.prod.yml logs -f worker');

  // Give time to see the job ID before exiting
  await new Promise(resolve => setTimeout(resolve, 1000));
  process.exit(0);
}

main().catch((error) => {
  console.error('Error triggering job:', error);
  process.exit(1);
});
