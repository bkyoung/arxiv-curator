#!/usr/bin/env tsx
/**
 * Generate Digest Script
 *
 * Manually triggers digest generation for all users
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

async function generateDigest() {
  // Dynamic imports to ensure env vars are loaded first
  const { boss, startQueue } = await import('../server/queue');
  console.log('📰 Generating daily digest...\n');

  try {
    // Start pg-boss
    await startQueue();
    console.log('✓ Queue started');

    // Enqueue generate-daily-digests job
    const jobId = await boss.send('generate-daily-digests', {});

    console.log(`✓ Enqueued generate-daily-digests job: ${jobId}`);
    console.log('');
    console.log('⏳ Processing will happen in the worker...');
    console.log('   Watch the worker terminal for progress.');
    console.log('');
    console.log('💡 This will:');
    console.log('   1. Load all users from database');
    console.log('   2. Run Recommender agent for each user');
    console.log('   3. Create Briefing with top papers');
    console.log('');

    await boss.stop();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error generating digest:', error);
    process.exit(1);
  }
}

generateDigest();
