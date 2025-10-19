import Bottleneck from 'bottleneck';

/**
 * Global rate limiter for arXiv API
 *
 * arXiv Terms of Service require:
 * - Maximum 1 request per 3 seconds
 * - Single connection only
 *
 * @see https://info.arxiv.org/help/api/tou.html
 */
export const arxivLimiter = new Bottleneck({
  minTime: 3000, // 3 seconds between requests
  maxConcurrent: 1, // Single connection
  reservoir: 20, // Start with 20 requests
  reservoirRefreshAmount: 20, // Refill to 20
  reservoirRefreshInterval: 60 * 1000, // Every minute
});

/**
 * Exponential backoff strategy for failed requests
 */
arxivLimiter.on('failed', async (error, jobInfo) => {
  const id = jobInfo.options.id || 'unknown';

  console.warn(`[Rate Limiter] Job ${id} failed: ${error}`);

  // Check if it's a rate limit error (503) or similar
  if (error instanceof Error && /503|429/.test(error.message)) {
    // arXiv rate limit hit - use exponential backoff
    const retryCount = jobInfo.retryCount || 0;
    const delay = Math.min(10000 * (retryCount + 1), 60000); // 10s, 20s, 30s, ..., max 60s

    console.log(`[Rate Limiter] Retrying job ${id} in ${delay}ms (attempt ${retryCount + 1})`);
    return delay;
  }

  // For other errors, retry after 5 seconds
  if ((jobInfo.retryCount || 0) < 3) {
    console.log(`[Rate Limiter] Retrying job ${id} in 5000ms`);
    return 5000;
  }

  // Give up after 3 retries
  return undefined;
});

/**
 * Log when jobs are dropped
 */
arxivLimiter.on('dropped', (dropped) => {
  console.error(`[Rate Limiter] Job dropped:`, dropped);
});

/**
 * Log rate limiter statistics
 */
arxivLimiter.on('done', (info) => {
  console.log(`[Rate Limiter] Job completed in ${info.duration}ms`);
});
