# ArXiv Curator - Automated Daily Workflow

This document describes the automated daily workflow that runs in production.

## Daily Schedule (All times in America/New_York timezone)

### 6:00 AM - arXiv Paper Release
arXiv publishes new papers daily at 6:00 AM ET.

### 6:15 AM - Paper Ingestion & Processing
**Job:** `scout-papers`
**Frequency:** Daily (cron: `15 6 * * *`)
**Duration:** ~10-15 minutes

The worker automatically:
1. **Scouts** new papers from arXiv categories:
   - `cs.AI` - Artificial Intelligence
   - `cs.LG` - Machine Learning
   - `cs.CL` - Computation and Language
   - `cs.CV` - Computer Vision
   - `cs.IR` - Information Retrieval
   - `cs.NE` - Neural and Evolutionary Computing
   - `stat.ML` - Machine Learning (Statistics)

2. **Enriches** each paper:
   - Generates embeddings (vector representation)
   - Extracts key concepts and entities
   - Classifies paper type and methodology

3. **Ranks** each paper:
   - Calculates multi-signal scores:
     - Novelty (28%)
     - Evidence Quality (30%)
     - Velocity (trending/citations) (16%)
     - Personal Fit (user interest alignment) (22%)
     - Lab Prior (author reputation) (4%)
     - Math Penalty (readability adjustment)
   - Stores scores in database

**Configuration:**
- Max papers per run: 200
- Default categories can be customized per user profile
- Uses local embeddings + cloud LLM (configurable)

### 6:30 AM - Digest Generation
**Job:** `generate-daily-digests`
**Frequency:** Daily (cron: `30 6 * * *`)
**Duration:** ~2-5 minutes

The worker automatically:
1. Fetches all users with `digestEnabled: true`
2. For each user:
   - Retrieves ranked papers from last 24 hours
   - Filters by user's score threshold
   - Applies personalization rules (include/exclude topics)
   - Selects top 10-20 papers using exploit/explore strategy
   - Creates Briefing record
3. Sends email notifications (if configured)

**User sees:** Fresh briefing available at `/briefings/latest`

## Manual Triggers

You can manually trigger jobs at any time:

### Trigger Paper Ingestion
```bash
# Using tRPC (from app)
const result = await trpc.papers.ingest.mutate({
  categories: ['cs.AI', 'cs.LG'],
  maxResults: 100
});

# Using pg-boss directly
await boss.send('scout-papers', {
  categories: ['cs.AI', 'cs.LG'],
  maxResults: 100
});
```

### Trigger Digest Generation
```bash
# Generate digest for all users
await boss.send('generate-daily-digests', {});

# Generate digest for specific user
import { generateDailyDigest } from '@/server/agents/recommender';
await generateDailyDigest(userId);
```

## Monitoring

### Check Scheduled Jobs
```bash
# View worker logs
docker compose -f docker-compose.prod.yml logs -f worker

# Expected output:
# [Worker] Daily digest job scheduled for 6:30 AM ET
# [Worker] Daily paper ingestion job scheduled for 6:15 AM ET
# [Worker] Will ingest from: cs.AI, cs.LG, cs.CL, cs.CV, cs.IR, cs.NE, stat.ML
```

### Check Job History
```sql
-- View scheduled jobs
SELECT * FROM pgboss.schedule ORDER BY createdon DESC;

-- View completed jobs (last 24h)
SELECT name, state, data, completedon
FROM pgboss.job
WHERE completedon > NOW() - INTERVAL '24 hours'
ORDER BY completedon DESC;

-- View failed jobs
SELECT name, state, output, completedon
FROM pgboss.job
WHERE state = 'failed'
ORDER BY completedon DESC
LIMIT 10;
```

### Health Checks
```bash
# Check worker is running
docker compose -f docker-compose.prod.yml ps worker

# Should show: Up X seconds (healthy)

# Check health endpoint
curl http://localhost:3000/api/health
```

## Customization

### Change Ingestion Time
Edit `worker/index.ts`:
```typescript
await boss.schedule(
  QUEUE_NAMES.SCOUT_PAPERS,
  '15 6 * * *', // Change this cron expression
  // ...
);
```

### Change Categories
Edit `worker/index.ts`:
```typescript
categories: [
  'cs.AI',
  'your.custom.category',
],
```

### Change Max Papers
Edit `worker/index.ts`:
```typescript
maxResults: 200, // Increase or decrease
```

## Troubleshooting

### No Papers in Briefing
**Symptoms:** "No briefing available for today"

**Possible Causes:**
1. Scout job hasn't run yet (before 6:15 AM)
2. Scout job failed (check logs)
3. No papers met user's score threshold
4. User has `digestEnabled: false`

**Debug:**
```bash
# Check if papers were ingested today
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U postgres -d arxiv_curator -c \
  "SELECT COUNT(*), MAX(\"pubDate\") FROM \"Paper\" WHERE \"pubDate\" > NOW() - INTERVAL '24 hours';"

# Check if papers were scored
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U postgres -d arxiv_curator -c \
  "SELECT COUNT(*) FROM \"Score\" WHERE \"createdAt\" > NOW() - INTERVAL '24 hours';"
```

### Scout Job Failed
**Symptoms:** Worker logs show errors at 6:15 AM

**Common Issues:**
- arXiv API timeout (retry job)
- Out of memory (reduce maxResults)
- LLM API quota exceeded (check API limits)

**Fix:**
```bash
# Manually retry
docker compose -f docker-compose.prod.yml exec app \
  npx tsx -e "
  import { boss } from './server/queue';
  boss.send('scout-papers', { categories: ['cs.AI'], maxResults: 100 });
  "
```

### Digest Job Failed
**Symptoms:** Worker logs show errors at 6:30 AM

**Common Issues:**
- No papers available (scout job failed/delayed)
- Database connection issues
- User profile missing interestVector

**Fix:**
```bash
# Check user profiles
docker compose -f docker-compose.prod.yml exec postgres \
  psql -U postgres -d arxiv_curator -c \
  "SELECT id, \"digestEnabled\", \"interestVector\" IS NULL FROM \"UserProfile\";"
```

## Cost Optimization

### Reduce API Costs
1. Use local embeddings: `useLocalEmbeddings: true`
2. Use local LLM for classification: `useLocalLLM: true`
3. Reduce maxResults: Lower from 200 to 100
4. Limit categories: Only ingest relevant categories

### Batch Processing
Jobs are batched by pg-boss for efficiency:
- Enrichment jobs: Processed in parallel (configurable)
- Digest generation: One per user, parallel execution

## Future Enhancements

Planned improvements:
- [ ] Per-user category preferences
- [ ] Adaptive maxResults based on signal quality
- [ ] Intelligent retry logic for failed jobs
- [ ] Job performance metrics and alerting
- [ ] Email/Slack notifications for digests
- [ ] Weekend/holiday skip logic

---

**Last Updated:** 2025-10-25
**Version:** v0.1.0+
