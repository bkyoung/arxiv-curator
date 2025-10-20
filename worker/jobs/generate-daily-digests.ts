import { prisma } from '../../server/db';
import { generateDailyDigest } from '../../server/agents/recommender';

/**
 * Daily digest generation job
 *
 * Scheduled to run at 6:30 AM daily (after arXiv's 6:00 AM update)
 * Generates personalized briefings for all users with digestEnabled = true
 */
export async function generateDailyDigestsJob() {
  console.log('[Digest Job] Starting daily digest generation');

  try {
    // Get all active users with digest enabled
    const users = await prisma.user.findMany({
      where: {
        profile: {
          digestEnabled: true,
        },
      },
      select: {
        id: true,
        email: true,
      },
    });

    console.log(`[Digest Job] Generating digests for ${users.length} users`);

    if (users.length === 0) {
      console.log('[Digest Job] No users with digest enabled');
      return { succeeded: 0, failed: 0, total: 0 };
    }

    // Generate digests in parallel (with concurrency limit)
    const results = await Promise.allSettled(
      users.map((user) =>
        generateDailyDigest(user.id).catch((error) => {
          console.error(
            `[Digest Job] Failed to generate digest for user ${user.id}:`,
            error
          );
          throw error;
        })
      )
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    console.log(
      `[Digest Job] Complete: ${succeeded} succeeded, ${failed} failed`
    );

    return { succeeded, failed, total: users.length };
  } catch (error) {
    console.error('[Digest Job] Job failed with error:', error);
    throw error;
  }
}
