import { describe, it, expect, beforeAll } from 'vitest';
import {
  s3Client,
  BUCKET_NAME,
  validateStorageConnection,
} from '@/server/storage';
import {
  CreateBucketCommand,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';

describe('MinIO Storage', () => {
  beforeAll(async () => {
    // Ensure bucket exists
    try {
      await s3Client.send(new HeadBucketCommand({ Bucket: BUCKET_NAME }));
    } catch (error) {
      // Bucket doesn't exist, create it
      await s3Client.send(new CreateBucketCommand({ Bucket: BUCKET_NAME }));
    }
  });

  it('should validate storage connection', async () => {
    const isConnected = await validateStorageConnection();
    expect(isConnected).toBe(true);
  });

  it('should upload a file to MinIO', async () => {
    const testKey = 'test-file.txt';
    const testContent = 'test content';

    const result = await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: testKey,
        Body: testContent,
      })
    );

    expect(result.$metadata.httpStatusCode).toBe(200);

    // Cleanup
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: testKey,
      })
    );
  });

  it('should retrieve a file from MinIO', async () => {
    const testKey = 'test-retrieve.txt';
    const testContent = 'retrieve test';

    // Upload first
    await s3Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: testKey,
        Body: testContent,
      })
    );

    // Retrieve
    const result = await s3Client.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: testKey,
      })
    );

    expect(result.$metadata.httpStatusCode).toBe(200);
    expect(result.Body).toBeDefined();

    // Cleanup
    await s3Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: testKey,
      })
    );
  });
});
