import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/server/db';

describe('Database Connection', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('should connect to the database successfully', async () => {
    // Test raw query execution to verify connection
    const result = await prisma.$queryRaw`SELECT 1 as value`;
    expect(result).toEqual([{ value: 1 }]);
  });

  it('should have pgvector extension enabled', async () => {
    // Query to check if pgvector extension is installed
    const result = await prisma.$queryRaw<Array<{ extname: string }>>`
      SELECT extname FROM pg_extension WHERE extname = 'vector'
    `;

    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.extname).toBe('vector');
  });

  it('should be able to create and read a User', async () => {
    // Cleanup any existing test user first (for idempotent tests)
    await prisma.user.deleteMany({
      where: { email: 'test@example.com' },
    });

    // Create a test user
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User',
      },
    });

    expect(user.id).toBeDefined();
    expect(user.email).toBe('test@example.com');
    expect(user.name).toBe('Test User');

    // Read the user back
    const foundUser = await prisma.user.findUnique({
      where: { email: 'test@example.com' },
    });

    expect(foundUser).toBeDefined();
    expect(foundUser?.id).toBe(user.id);

    // Cleanup
    await prisma.user.delete({
      where: { id: user.id },
    });
  });
});
