import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { boss, startQueue, stopQueue } from '@/server/queue';

describe('Job Queue (pg-boss)', () => {
  beforeAll(async () => {
    await startQueue();
    // Create test queues explicitly
    await boss.createQueue('scout-papers');
    await boss.createQueue('enrich-paper');
  });

  afterAll(async () => {
    await stopQueue();
  });

  it('should start successfully', () => {
    // If we reach here, startQueue() succeeded
    expect(boss).toBeDefined();
  });

  it('should enqueue a test job', async () => {
    const jobId = await boss.send('scout-papers', { date: '2025-01-19' });
    expect(jobId).toBeDefined();
    expect(typeof jobId).toBe('string');
  });

  it('should handle job data with correct typing', async () => {
    // Test type-safe job enqueueing
    const jobId = await boss.send('enrich-paper', { paperId: 'test-123' });
    expect(jobId).toBeDefined();
  });
});
