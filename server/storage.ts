import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import { env } from './env';

/**
 * Validate storage credentials are not using insecure defaults in production
 */
if (env.NODE_ENV === 'production') {
  if (env.MINIO_ACCESS_KEY === 'minioadmin' || env.MINIO_SECRET_KEY === 'minioadmin') {
    throw new Error('Insecure MinIO credentials detected in production. Please set MINIO_ACCESS_KEY and MINIO_SECRET_KEY.');
  }
}

const useSSL = env.MINIO_USE_SSL === 'true';

export const s3Client = new S3Client({
  endpoint: `${useSSL ? 'https' : 'http'}://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}`,
  region: 'us-east-1', // MinIO ignores region, but SDK requires it
  credentials: {
    accessKeyId: env.MINIO_ACCESS_KEY,
    secretAccessKey: env.MINIO_SECRET_KEY,
  },
  forcePathStyle: true, // Required for MinIO
});

export const BUCKET_NAME = env.MINIO_BUCKET;

/**
 * Validates storage connection by checking if bucket exists
 */
export async function validateStorageConnection(): Promise<boolean> {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    return true;
  } catch (error) {
    console.error('Storage connection failed:', error);
    return false;
  }
}
