/**
 * Script to create a test user for development/testing
 */
import { prisma } from '../server/db';

async function main() {
  // Fixed user ID that matches hard-coded value in server/trpc.ts
  const userId = 'test-user-1';
  const email = 'test@example.com';
  const name = 'Test User';

  console.log('Creating test user...');

  // Check if user already exists
  const existing = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (existing) {
    console.log(`User ${email} already exists with ID: ${existing.id}`);
    return existing.id;
  }

  // Create user with profile (using fixed ID to match server/trpc.ts)
  const user = await prisma.user.create({
    data: {
      id: userId,
      email,
      name,
      profile: {
        create: {
          interestVector: [],
          digestEnabled: true,
          scoreThreshold: 0.5,
          arxivCategories: ['cs.AI', 'cs.LG', 'cs.CL', 'cs.CV'],
        },
      },
    },
    include: {
      profile: true,
    },
  });

  console.log(`✓ Created user: ${user.email} (ID: ${user.id})`);
  console.log(`✓ Created profile with digestEnabled: ${user.profile?.digestEnabled}`);

  return user.id;
}

main()
  .then((userId) => {
    console.log(`\nTest user ready! User ID: ${userId}`);
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error creating test user:', error);
    process.exit(1);
  });
