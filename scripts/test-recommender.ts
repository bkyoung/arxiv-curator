#!/usr/bin/env tsx
/**
 * Test Recommender Script
 *
 * Directly tests the recommender to see what's happening
 */

// Load environment variables from .env.local
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '.env.local') });
config({ path: resolve(process.cwd(), '.env') });

async function testRecommender() {
  console.log('🧪 Testing recommender...\n');

  try {
    const { generateDailyDigest } = await import('../server/agents/recommender');
    const { prisma } = await import('../server/db');

    // Find test user
    const user = await prisma.user.findFirst({
      where: { email: 'test@example.com' },
    });

    if (!user) {
      console.error('❌ Test user not found');
      process.exit(1);
    }

    console.log(`✓ Found user: ${user.email} (${user.id})\n`);

    // Generate briefing
    console.log('Generating daily digest...\n');
    const briefing = await generateDailyDigest(user.id);

    console.log('\n✅ Briefing generated:');
    console.log(`  ID: ${briefing.id}`);
    console.log(`  Date: ${briefing.date}`);
    console.log(`  Paper count: ${briefing.paperCount}`);
    console.log(`  Average score: ${briefing.avgScore}`);
    console.log(`  Status: ${briefing.status}`);

    if (briefing.paperIds.length > 0) {
      console.log(`\nFirst 3 paper IDs:`);
      briefing.paperIds.slice(0, 3).forEach((id, idx) => {
        console.log(`  ${idx + 1}. ${id}`);
      });
    }

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

testRecommender();
