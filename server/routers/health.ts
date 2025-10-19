import { router, publicProcedure } from '../trpc';
import { prisma } from '../db';
import { validateStorageConnection } from '../storage';

export const healthRouter = router({
  check: publicProcedure.query(async () => {
    // Check database connectivity
    let databaseStatus: 'connected' | 'disconnected' = 'disconnected';
    try {
      await prisma.$queryRaw`SELECT 1`;
      databaseStatus = 'connected';
    } catch (error) {
      databaseStatus = 'disconnected';
    }

    // Check storage connectivity
    let storageStatus: 'connected' | 'disconnected' = 'disconnected';
    try {
      const isConnected = await validateStorageConnection();
      storageStatus = isConnected ? 'connected' : 'disconnected';
    } catch (error) {
      storageStatus = 'disconnected';
    }

    // Overall health status
    const isHealthy = databaseStatus === 'connected' && storageStatus === 'connected';

    return {
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      services: {
        database: databaseStatus,
        storage: storageStatus,
      },
    };
  }),
});
