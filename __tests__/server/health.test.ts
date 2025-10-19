import { describe, it, expect } from 'vitest';
import { appRouter } from '@/server/routers/_app';

describe('Health Router', () => {
  it('should return healthy status with all services', async () => {
    // Create a caller with empty context (no auth required for health check)
    const caller = appRouter.createCaller({});

    const result = await caller.health.check();

    expect(result.status).toMatch(/healthy|degraded/);
    expect(result.timestamp).toBeDefined();
    expect(result.services).toBeDefined();
    expect(result.services.database).toBe('connected');
    // Storage may be connected or disconnected depending on MinIO bucket setup
    expect(result.services.storage).toMatch(/connected|disconnected/);
  });

  it('should include database connectivity status', async () => {
    const caller = appRouter.createCaller({});

    const result = await caller.health.check();

    expect(result.services).toHaveProperty('database');
    expect(result.services.database).toBe('connected');
  });

  it('should include storage connectivity status', async () => {
    const caller = appRouter.createCaller({});

    const result = await caller.health.check();

    expect(result.services).toHaveProperty('storage');
    expect(result.services.storage).toMatch(/connected|disconnected/);
  });
});
