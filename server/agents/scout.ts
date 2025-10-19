/**
 * Scout Agent
 *
 * Responsible for ingesting papers from arXiv via OAI-PMH and Atom feeds
 */

import { XMLParser } from 'fast-xml-parser';
import { arxivLimiter } from '@/server/lib/rate-limiter';
import { extractArxivId, parseArxivId, parseAuthors, parseCategories } from '@/server/lib/arxiv';
import { prisma } from '@/server/db';

export interface ArxivCategory {
  id: string;
  name: string;
  description: string;
}

/**
 * Fetch arXiv category taxonomy via OAI-PMH ListSets
 *
 * @returns Array of arXiv categories (cs.* only)
 */
export async function fetchArxivCategories(): Promise<ArxivCategory[]> {
  const url = 'http://export.arxiv.org/oai2?verb=ListSets';

  console.log('[Scout] Fetching arXiv categories...');

  const response = await arxivLimiter.schedule(() => fetch(url));
  const xml = await response.text();

  const parser = new XMLParser({ ignoreAttributes: false });
  const parsed = parser.parse(xml);

  // Extract sets
  const sets = parsed['OAI-PMH']['ListSets']['set'];
  const setsList = Array.isArray(sets) ? sets : [sets];

  // Filter to cs.* categories only
  const categories: ArxivCategory[] = setsList
    .filter((s: any) => s.setSpec.startsWith('cs'))
    .map((s: any) => ({
      id: s.setSpec,
      name: s.setName,
      description: '',
    }));

  console.log(`[Scout] Found ${categories.length} CS categories`);

  // Store in database
  for (const cat of categories) {
    await prisma.arxivCategory.upsert({
      where: { id: cat.id },
      update: { name: cat.name, description: cat.description },
      create: cat,
    });
  }

  return categories;
}

/**
 * Ingest recent papers from arXiv via Atom feed
 *
 * @param categories - arXiv categories to fetch (e.g., ['cs.AI', 'cs.LG'])
 * @param maxResults - Maximum papers per category (default: 100)
 * @returns Array of paper IDs that were created/updated
 */
export async function ingestRecentPapers(
  categories: string[],
  maxResults: number = 100
): Promise<string[]> {
  const paperIds: string[] = [];

  for (const category of categories) {
    const url =
      `http://export.arxiv.org/api/query?` +
      `search_query=cat:${category}&` +
      `start=0&` +
      `max_results=${maxResults}&` +
      `sortBy=submittedDate&` +
      `sortOrder=descending`;

    console.log(`[Scout] Fetching papers for ${category}...`);

    const response = await arxivLimiter.schedule(() => fetch(url));
    const xml = await response.text();

    const parser = new XMLParser({ ignoreAttributes: false });
    const parsed = parser.parse(xml);

    const entries = parsed.feed?.entry || [];
    const entryList = Array.isArray(entries) ? entries : [entries];

    for (const entry of entryList) {
      const paperId = await processPaperEntry(entry);
      if (paperId) {
        paperIds.push(paperId);
      }
    }
  }

  console.log(`[Scout] Ingested ${paperIds.length} papers`);
  return paperIds;
}

/**
 * Process a single paper entry from Atom feed
 *
 * @param entry - Paper entry from XML parser
 * @returns Paper ID if created/updated, null if skipped
 */
async function processPaperEntry(entry: any): Promise<string | null> {
  try {
    // Extract arXiv ID and version
    const fullId = extractArxivId(entry.id);
    const { baseId, version } = parseArxivId(fullId);

    // Check for existing paper
    const existing = await prisma.paper.findUnique({
      where: { arxivId: baseId },
    });

    // Skip if same or older version
    if (existing && existing.version >= version) {
      console.log(`[Scout] Skipping ${baseId} v${version} (have v${existing.version})`);
      return null;
    }

    // Parse authors
    const authors = parseAuthors(entry.author);

    // Parse categories
    const categories = parseCategories(entry.category);

    // Extract PDF URL
    const links = Array.isArray(entry.link) ? entry.link : [entry.link];
    const pdfLink = links.find((l: any) => l['@_title'] === 'pdf');
    const pdfUrl = pdfLink ? pdfLink['@_href'] : undefined;

    // Create or update paper
    const paper = await prisma.paper.upsert({
      where: { arxivId: baseId },
      update: {
        version,
        title: entry.title.trim(),
        authors,
        abstract: entry.summary.trim(),
        categories,
        primaryCategory: categories[0],
        pdfUrl,
        pubDate: new Date(entry.published),
        updatedDate: new Date(entry.updated),
        rawMetadata: entry,
        status: 'new', // Reset status for re-enrichment
      },
      create: {
        arxivId: baseId,
        version,
        title: entry.title.trim(),
        authors,
        abstract: entry.summary.trim(),
        categories,
        primaryCategory: categories[0],
        pdfUrl,
        pubDate: new Date(entry.published),
        updatedDate: new Date(entry.updated),
        rawMetadata: entry,
        status: 'new',
      },
    });

    if (existing) {
      console.log(`[Scout] Updated ${baseId} to v${version}`);
    } else {
      console.log(`[Scout] Created ${baseId} v${version}`);
    }

    return paper.id;
  } catch (error) {
    console.error('[Scout] Error processing paper entry:', error);
    return null;
  }
}
