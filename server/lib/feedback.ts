/**
 * Feedback System
 *
 * Handles user feedback actions and vector profile learning
 * Phase 2: Personalization & Scoring
 */

import { prisma } from '@/server/db';

export interface RecordFeedbackInput {
  userId: string;
  paperId: string;
  action: 'save' | 'dismiss' | 'thumbs_up' | 'thumbs_down' | 'hide';
  weight?: number;
  context?: string;
}

export interface UpdateVectorInput {
  userId: string;
  paperEmbedding: number[];
  action: 'save' | 'dismiss' | 'thumbs_up' | 'thumbs_down' | 'hide';
}

export interface FeedbackHistoryInput {
  userId: string;
  action?: string;
  limit?: number;
}

/**
 * Record user feedback on a paper
 *
 * Stores feedback in database for tracking and analytics
 *
 * @param input - Feedback record input
 * @returns Created feedback record
 */
export async function recordFeedback(input: RecordFeedbackInput) {
  const feedback = await prisma.feedback.create({
    data: {
      userId: input.userId,
      paperId: input.paperId,
      action: input.action,
      weight: input.weight ?? 1.0,
      context: input.context,
    },
  });

  return feedback;
}

/**
 * Update user's interest vector based on feedback using EMA
 *
 * Positive feedback (save, thumbs_up):
 *   newVector = 0.9 × oldVector + 0.1 × paperEmbedding
 *
 * Negative feedback (dismiss, thumbs_down, hide):
 *   newVector = 0.9 × oldVector - 0.1 × paperEmbedding
 *
 * Vector is normalized after update
 *
 * @param input - Vector update input
 * @returns Updated user profile
 */
export async function updateUserVectorFromFeedback(input: UpdateVectorInput) {
  // Get user's current profile
  const userProfile = await prisma.userProfile.findUnique({
    where: { userId: input.userId },
  });

  if (!userProfile) {
    throw new Error(`User profile not found for user ${input.userId}`);
  }

  const currentVector = userProfile.interestVector as number[];
  const paperEmbedding = input.paperEmbedding;

  // Determine if feedback is positive or negative
  const isPositive =
    input.action === 'save' || input.action === 'thumbs_up';

  // EMA constants
  const alpha = 0.1; // Learning rate
  const beta = 1 - alpha; // Memory retention (0.9)

  // Calculate new vector using EMA
  const newVector = currentVector.map((oldVal, i) => {
    if (isPositive) {
      // Move towards paper
      return beta * oldVal + alpha * paperEmbedding[i];
    } else {
      // Move away from paper
      return beta * oldVal - alpha * paperEmbedding[i];
    }
  });

  // Normalize vector to unit length
  const magnitude = Math.sqrt(
    newVector.reduce((sum, val) => sum + val * val, 0)
  );

  const normalizedVector =
    magnitude > 0 ? newVector.map((val) => val / magnitude) : newVector;

  // Update user profile
  const updatedProfile = await prisma.userProfile.update({
    where: { userId: input.userId },
    data: {
      interestVector: normalizedVector,
    },
  });

  return updatedProfile;
}

/**
 * Get user's feedback history
 *
 * @param input - Feedback history query input
 * @returns List of feedback records
 */
export async function getFeedbackHistory(input: FeedbackHistoryInput) {
  const feedback = await prisma.feedback.findMany({
    where: {
      userId: input.userId,
      ...(input.action && { action: input.action }),
    },
    orderBy: {
      createdAt: 'desc',
    },
    ...(input.limit && { take: input.limit }),
  });

  return feedback;
}
