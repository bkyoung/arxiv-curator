/**
 * Rules Engine
 *
 * Handles personalization rules for inclusion/exclusion filtering
 */

export interface ExclusionInput {
  paperTopics: string[];
  excludedTopics: string[];
  excludedKeywords: string[];
  paperText: string;
}

/**
 * Check if paper should be excluded based on exclusion rules
 *
 * Hard filtering - returns true if paper matches ANY exclusion rule
 *
 * @param input - Exclusion rule inputs
 * @returns true if paper should be excluded
 */
export function shouldExcludePaper(input: ExclusionInput): boolean {
  // Check topic exclusions
  for (const topic of input.paperTopics) {
    if (input.excludedTopics.includes(topic)) {
      return true; // Hard filter
    }
  }

  // Check keyword exclusions
  const lowerText = input.paperText.toLowerCase();
  for (const keyword of input.excludedKeywords) {
    if (lowerText.includes(keyword.toLowerCase())) {
      return true; // Hard filter
    }
  }

  return false;
}
