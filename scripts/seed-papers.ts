#!/usr/bin/env tsx
/**
 * Seed Papers Script
 *
 * Manually triggers paper ingestion from arXiv for initial setup
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local first (overrides .env)
config({ path: resolve(process.cwd(), '.env.local') });
// Then load .env
config({ path: resolve(process.cwd(), '.env') });

// IMPORTANT: Use dynamic imports to prevent module loading before dotenv config runs
// Static imports are hoisted and execute before any code, including dotenv

async function seedPapers() {
  // Dynamic imports to ensure env vars are loaded first
  const { boss, startQueue } = await import('../server/queue');
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
