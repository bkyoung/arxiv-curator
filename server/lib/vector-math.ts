/**
 * Vector Math Utilities
 *
 * Shared vector operations for embeddings and similarity calculations
 */

/**
 * Calculate cosine similarity between two vectors
 *
 * @param vec1 - First vector
 * @param vec2 - Second vector
 * @param normalize - If true, normalize to [0, 1] range (default: false)
 * @returns Similarity score
 *   - If normalize=false: raw cosine similarity in range [-1, 1]
 *   - If normalize=true: normalized similarity in range [0, 1]
 */
export function cosineSimilarity(
  vec1: number[],
  vec2: number[],
  normalize = false
): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let magnitude1 = 0;
  let magnitude2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    magnitude1 += vec1[i] * vec1[i];
    magnitude2 += vec2[i] * vec2[i];
  }

  magnitude1 = Math.sqrt(magnitude1);
  magnitude2 = Math.sqrt(magnitude2);

  // Handle zero vectors
  if (magnitude1 === 0 || magnitude2 === 0) {
    return 0;
  }

  // Calculate cosine similarity (raw range: [-1, 1])
  const cosineSim = dotProduct / (magnitude1 * magnitude2);

  // Normalize to [0, 1] range if requested: (cos + 1) / 2
  return normalize ? (cosineSim + 1) / 2 : cosineSim;
}

/**
 * Calculate the magnitude (L2 norm) of a vector
 *
 * @param vec - Input vector
 * @returns Vector magnitude
 */
export function magnitude(vec: number[]): number {
  return Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
}

/**
 * Calculate the dot product of two vectors
 *
 * @param vec1 - First vector
 * @param vec2 - Second vector
 * @returns Dot product
 */
export function dotProduct(vec1: number[], vec2: number[]): number {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have the same length');
  }

  return vec1.reduce((sum, val, i) => sum + val * vec2[i], 0);
}

/**
 * Normalize a vector to unit length
 *
 * @param vec - Input vector
 * @returns Normalized vector
 */
export function normalize(vec: number[]): number[] {
  const mag = magnitude(vec);
  if (mag === 0) {
    return vec.map(() => 0);
  }
  return vec.map((val) => val / mag);
}
