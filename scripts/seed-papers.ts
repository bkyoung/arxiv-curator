#!/usr/bin/env tsx
/**
 * Seed Papers Script
 *
 * Manually triggers paper ingestion from arXiv for initial setup
 */

import { boss, startQueue } from '../server/queue';

async function seedPapers() {
  console.log('🌱 Seeding papers from arXiv...\n');

  try {
    // Start pg-boss
    await startQueue();
    console.log('✓ Queue started');

    // Enqueue scout-papers job
    const jobId = await boss.send('scout-papers', {
      categories: ['cs.AI', 'cs.LG', 'cs.CL', 'cs.CV'], // AI/ML papers
      maxResults: 50, // Fetch 50 recent papers
    });

    console.log(`✓ Enqueued scout-papers job: ${jobId}`);
    console.log('');
    console.log('📋 Job Details:');
    console.log('  - Categories: cs.AI, cs.LG, cs.CL, cs.CV');
    console.log('  - Max Results: 50 papers');
    console.log('');
    console.log('⏳ Processing will happen in the worker...');
    console.log('   Watch the worker terminal for progress.');
    console.log('');
    console.log('💡 Expected timeline:');
    console.log('   - Fetching: ~5-10 seconds');
    console.log('   - Enrichment: ~2-5 minutes (parallel processing)');
    console.log('');

    await boss.stop();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding papers:', error);
    process.exit(1);
  }
}

seedPapers();
