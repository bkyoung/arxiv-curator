# Scripts Directory

Utility scripts for manual operations and testing.

## Setup

Before running any scripts, make sure you have a `.env.local` file configured:

```bash
# Copy the example file
cp .env.local.example .env.local

# Edit with your actual values
nano .env.local
```

**Required variables**:
- `DATABASE_URL` - PostgreSQL connection string
- `MINIO_ACCESS_KEY` - MinIO/S3 access key
- `MINIO_SECRET_KEY` - MinIO/S3 secret key
- `AUTH_SECRET` - NextAuth secret (generate with `openssl rand -base64 32`)

## Available Scripts

### `seed-papers.ts`
Fetches papers from arXiv for initial setup or testing.

**Usage**:
```bash
npm run seed:papers
```

**What it does**:
1. Enqueues a `scout-papers` job
2. Fetches 50 recent papers from cs.AI, cs.LG, cs.CL, cs.CV
3. Papers are enriched automatically (topics, embeddings, signals)

**Expected time**: 2-5 minutes (watch worker terminal for progress)

**When to use**:
- First time setup (empty database)
- Testing with fresh data
- After clearing papers table

---

### `generate-digest.ts`
Generates daily briefings for all users.

**Usage**:
```bash
npm run seed:digest
```

**What it does**:
1. Enqueues a `generate-daily-digests` job
2. Runs Recommender agent for each user
3. Creates Briefing with top-ranked papers

**Expected time**: 10-30 seconds (watch worker terminal for progress)

**When to use**:
- After ingesting new papers
- Testing personalization/ranking
- Manually triggering digest generation

---

## Workflow for Fresh Setup

```bash
# Terminal 1: Start dev server
npm run dev

# Terminal 2: Start worker
npm run worker

# Terminal 3: Seed data
npm run seed:papers    # Wait 2-5 minutes
npm run seed:digest    # Wait 10-30 seconds

# Now visit http://localhost:3000
```

---

## Creating New Scripts

Template for a new script:

```typescript
#!/usr/bin/env tsx
/**
 * Script Name
 *
 * Description of what it does
 */

import { boss, startQueue } from '../server/queue';

async function main() {
  console.log('🚀 Starting...\n');

  try {
    await startQueue();
    console.log('✓ Queue started');

    // Your logic here

    await boss.stop();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
```

Then add to `package.json`:
```json
{
  "scripts": {
    "your-script": "tsx scripts/your-script.ts"
  }
}
```
