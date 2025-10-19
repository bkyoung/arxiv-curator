/**
 * arXiv API utilities
 *
 * Provides helper functions for working with arXiv API responses
 */

/**
 * Extract arXiv ID from URL
 *
 * @param url - arXiv URL (e.g., "http://arxiv.org/abs/2401.12345v2")
 * @returns arXiv ID with version (e.g., "2401.12345v2")
 */
export function extractArxivId(url: string): string {
  // Match new-style IDs: YYMM.NNNNN or YYMM.NNNNNN
  const newStyleMatch = url.match(/(\d{4}\.\d{4,5})(v\d+)?/);
  if (newStyleMatch) {
    const baseId = newStyleMatch[1];
    const version = newStyleMatch[2] || 'v1';
    return baseId + version;
  }

  // Match old-style IDs: archive/YYMMNNN
  const oldStyleMatch = url.match(/([a-z-]+\/\d{7})(v\d+)?/);
  if (oldStyleMatch) {
    const baseId = oldStyleMatch[1];
    const version = oldStyleMatch[2] || 'v1';
    return baseId + version;
  }

  throw new Error(`Invalid arXiv URL: ${url}`);
}

/**
 * Parse arXiv ID into base ID and version number
 *
 * @param fullId - Full arXiv ID with version (e.g., "2401.12345v2")
 * @returns Object with baseId and version number
 */
export function parseArxivId(fullId: string): { baseId: string; version: number } {
  const match = fullId.match(/^(.+?)v(\d+)$/);
  if (match) {
    return {
      baseId: match[1],
      version: parseInt(match[2], 10),
    };
  }

  // No version specified, default to v1
  return {
    baseId: fullId,
    version: 1,
  };
}

/**
 * Parse author data from arXiv Atom feed
 *
 * @param authorData - Author data from XML parser (single object or array)
 * @returns Array of author names
 */
export function parseAuthors(authorData: any): string[] {
  const authors = Array.isArray(authorData) ? authorData : [authorData];
  return authors.map((a: any) => a.name);
}

/**
 * Parse category data from arXiv Atom feed
 *
 * @param categoryData - Category data from XML parser (single object or array)
 * @returns Array of category strings
 */
export function parseCategories(categoryData: any): string[] {
  const categories = Array.isArray(categoryData) ? categoryData : [categoryData];
  return categories.map((c: any) => c['@_term']);
}
