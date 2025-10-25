# Utility Scripts

This directory contains utility scripts for development, testing, and manual operations.

## Development Scripts

### `create-test-user.ts`

Creates a test user with profile for development/testing purposes.

**Usage:**
```bash
npx tsx scripts/create-test-user.ts
```

**What it does:**
- Creates user with ID `test-user-1` (matches hard-coded value in server/trpc.ts)
- Email: `test@example.com`
- Creates associated UserProfile with default settings
- Sets up digestEnabled and default categories
- Idempotent (safe to run multiple times)

**Use cases:**
- Setting up development environment
- Testing user-specific features
- Resetting test data

---

### `trigger-ingestion.ts`

Manually triggers paper ingestion job for testing.

**Usage:**
```bash
npx tsx scripts/trigger-ingestion.ts
```

**What it does:**
- Queues a scout-papers job with default categories
- Fetches 50 papers (smaller batch for testing)
- Returns job ID for monitoring

**Use cases:**
- Testing ingestion pipeline
- Manually fetching papers outside of schedule
- Debugging scout/enrich workflow

**Monitor job progress:**
```bash
docker compose -f docker-compose.prod.yml logs -f worker
```

---

### `test-production-build.sh`

Tests the production Docker build locally before deployment.

**Usage:**
```bash
./scripts/test-production-build.sh
```

**What it does:**
- Builds production Docker images
- Starts database and storage
- Runs migrations and seeds
- Starts all services
- Tests health endpoint

**Use cases:**
- Pre-deployment testing
- Verifying Docker configuration
- Local production simulation

---

## Production Scripts

### Manual Job Triggers

For production, you can manually trigger jobs using SQL:

**Trigger paper ingestion:**
```sql
INSERT INTO pgboss.job (name, data, state, start_after, created_on)
VALUES (
  'scout-papers',
  '{"categories": ["cs.AI", "cs.LG"], "maxResults": 100}'::jsonb,
  'created',
  NOW(),
  NOW()
);
```

**Trigger digest generation:**
```sql
INSERT INTO pgboss.job (name, data, state, start_after, created_on)
VALUES (
  'generate-daily-digests',
  '{}'::jsonb,
  'created',
  NOW(),
  NOW()
);
```

---

## Notes

- These scripts connect directly to the database via Prisma
- Ensure DATABASE_URL environment variable is set
- Scripts are designed for development/testing, not production automation
- For production job scheduling, see worker/index.ts
- Test user ID is hard-coded to `test-user-1` to match server/trpc.ts mock auth
