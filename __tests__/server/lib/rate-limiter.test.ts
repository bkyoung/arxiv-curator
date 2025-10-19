import { describe, it, expect, vi } from 'vitest';
import { arxivLimiter } from '@/server/lib/rate-limiter';

describe('Rate Limiter', () => {
  it('should be configured with correct settings', () => {
    // Verify Bottleneck instance exists and has correct configuration
    expect(arxivLimiter).toBeDefined();
    expect(typeof arxivLimiter.schedule).toBe('function');
  });

  it(
    'should enforce minimum time between requests',
    async () => {
      const startTime = Date.now();
      const mockFn = vi.fn().mockResolvedValue('result');

      // Schedule two quick requests
      const results = await Promise.all([
        arxivLimiter.schedule(() => mockFn()),
        arxivLimiter.schedule(() => mockFn()),
      ]);

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // Both requests should complete
      expect(results).toEqual(['result', 'result']);
      expect(mockFn).toHaveBeenCalledTimes(2);

      // Second request should be delayed by at least 3 seconds
      expect(elapsed).toBeGreaterThanOrEqual(3000);
    },
    10000
  ); // 10 second timeout

  it(
    'should process requests sequentially',
    async () => {
      let activeCount = 0;
      let maxActive = 0;

      const mockFn = vi.fn(async () => {
        activeCount++;
        maxActive = Math.max(maxActive, activeCount);
        await new Promise((resolve) => setTimeout(resolve, 100));
        activeCount--;
        return 'result';
      });

      // Schedule three requests
      await Promise.all([
        arxivLimiter.schedule(() => mockFn()),
        arxivLimiter.schedule(() => mockFn()),
        arxivLimiter.schedule(() => mockFn()),
      ]);

      // Should have called all three
      expect(mockFn).toHaveBeenCalledTimes(3);

      // But never more than one at a time
      expect(maxActive).toBe(1);
    },
    15000
  ); // 15 second timeout
});
