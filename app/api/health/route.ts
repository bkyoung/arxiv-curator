import { NextResponse } from 'next/server';
import { prisma } from '@/server/db';
import { s3Client, BUCKET_NAME } from '@/server/storage';
import { HeadBucketCommand } from '@aws-sdk/client-s3';

/**
 * Health check endpoint for Docker/Kubernetes monitoring
 * GET /api/health
 */
export async function GET() {
  const checks: {
    status: 'healthy' | 'unhealthy';
    timestamp: string;
    services: {
      database: 'connected' | 'disconnected' | 'error';
      storage: 'connected' | 'disconnected' | 'error';
    };
    error?: string;
  } = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    services: {
      database: 'disconnected',
      storage: 'disconnected',
    },
  };

  try {
    // Check database connection
    await prisma.$queryRaw`SELECT 1`;
    checks.services.database = 'connected';
  } catch (err) {
    checks.services.database = 'error';
    checks.status = 'unhealthy';
    checks.error = err instanceof Error ? err.message : 'Database check failed';
  }

  try {
    // Check storage (MinIO) connection
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    checks.services.storage = 'connected';
  } catch (err) {
    checks.services.storage = 'error';
    checks.status = 'unhealthy';
    checks.error = err instanceof Error ? err.message : 'Storage check failed';
  }

  const statusCode = checks.status === 'healthy' ? 200 : 503;

  return NextResponse.json(checks, { status: statusCode });
}
