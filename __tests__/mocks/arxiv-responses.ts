/**
 * Mock arXiv API responses
 *
 * These are realistic snapshots of actual arXiv API responses
 */

export const mockOAIPMHCategoriesResponse = `<?xml version="1.0" encoding="UTF-8"?>
<OAI-PMH xmlns="http://www.openarchives.org/OAI/2.0/">
  <responseDate>2024-01-20T12:00:00Z</responseDate>
  <request verb="ListSets">http://export.arxiv.org/oai2</request>
  <ListSets>
    <set>
      <setSpec>cs</setSpec>
      <setName>Computer Science</setName>
    </set>
    <set>
      <setSpec>cs.AI</setSpec>
      <setName>Artificial Intelligence</setName>
    </set>
    <set>
      <setSpec>cs.CL</setSpec>
      <setName>Computation and Language</setName>
    </set>
    <set>
      <setSpec>cs.LG</setSpec>
      <setName>Machine Learning</setName>
    </set>
    <set>
      <setSpec>math.AG</setSpec>
      <setName>Algebraic Geometry</setName>
    </set>
  </ListSets>
</OAI-PMH>`;

export const mockAtomFeedResponse = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>ArXiv Query: search_query=cat:cs.AI&amp;id_list=&amp;start=0&amp;max_results=1</title>
  <id>http://arxiv.org/api/cHxbiOdZaP56ODnBPIenZhzg5f8</id>
  <updated>2024-01-20T00:00:00-05:00</updated>
  <link href="http://arxiv.org/api/query?search_query=cat:cs.AI&amp;id_list=&amp;start=0&amp;max_results=1" rel="self" type="application/atom+xml"/>
  <entry>
    <id>http://arxiv.org/abs/2401.12345v1</id>
    <updated>2024-01-15T10:00:00Z</updated>
    <published>2024-01-15T10:00:00Z</published>
    <title>Language Agents for Planning and Tool Use</title>
    <summary>We present a comprehensive framework for building language agents that can perform complex planning and tool use tasks. Our approach leverages large language models to coordinate multiple tools and reason about multi-step plans. We evaluate on benchmarks including WebShop and ALFWorld, achieving state-of-the-art results. Code is available on GitHub.</summary>
    <author>
      <name>Alice Smith</name>
    </author>
    <author>
      <name>Bob Johnson</name>
    </author>
    <arxiv:comment xmlns:arxiv="http://arxiv.org/schemas/atom">23 pages, 8 figures</arxiv:comment>
    <link href="http://arxiv.org/abs/2401.12345v1" rel="alternate" type="text/html"/>
    <link title="pdf" href="http://arxiv.org/pdf/2401.12345v1" rel="related" type="application/pdf"/>
    <arxiv:primary_category xmlns:arxiv="http://arxiv.org/schemas/atom" term="cs.AI" scheme="http://arxiv.org/schemas/atom"/>
    <category term="cs.AI" scheme="http://arxiv.org/schemas/atom"/>
    <category term="cs.LG" scheme="http://arxiv.org/schemas/atom"/>
  </entry>
</feed>`;

export const mockAtomFeedMultipleEntries = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <title>ArXiv Query: search_query=cat:cs.AI&amp;id_list=&amp;start=0&amp;max_results=2</title>
  <entry>
    <id>http://arxiv.org/abs/2401.12345v1</id>
    <updated>2024-01-15T10:00:00Z</updated>
    <published>2024-01-15T10:00:00Z</published>
    <title>Language Agents for Planning and Tool Use</title>
    <summary>We present a comprehensive framework for building language agents that can perform complex planning and tool use tasks.</summary>
    <author><name>Alice Smith</name></author>
    <link title="pdf" href="http://arxiv.org/pdf/2401.12345v1" rel="related" type="application/pdf"/>
    <category term="cs.AI" scheme="http://arxiv.org/schemas/atom"/>
  </entry>
  <entry>
    <id>http://arxiv.org/abs/2401.67890v2</id>
    <updated>2024-01-16T10:00:00Z</updated>
    <published>2024-01-14T10:00:00Z</published>
    <title>Convergence Analysis of Gradient Descent</title>
    <summary>We prove a novel convergence theorem for gradient descent with momentum. The theorem establishes optimal convergence rates under mild assumptions.</summary>
    <author><name>Charlie Brown</name></author>
    <link title="pdf" href="http://arxiv.org/pdf/2401.67890v2" rel="related" type="application/pdf"/>
    <category term="cs.LG" scheme="http://arxiv.org/schemas/atom"/>
  </entry>
</feed>`;

export const mockOllamaEmbeddingResponse = {
  embedding: new Array(384).fill(0).map((_, i) => Math.sin(i / 100)),
};

export const mockOllamaClassificationResponse = {
  response: JSON.stringify({
    topics: ['agents', 'applications'],
    facets: ['planning', 'tool_use', 'evaluation'],
  }),
};

export const mockPaperData = {
  id: 'test-paper-id-123',
  arxivId: '2401.12345',
  version: 1,
  title: 'Language Agents for Planning and Tool Use',
  authors: ['Alice Smith', 'Bob Johnson'],
  abstract:
    'We present a comprehensive framework for building language agents that can perform complex planning and tool use tasks. ' +
    'Our approach leverages large language models to coordinate multiple tools and reason about multi-step plans. ' +
    'We evaluate on benchmarks including WebShop and ALFWorld, achieving state-of-the-art results. ' +
    'Code is available on GitHub.',
  categories: ['cs.AI', 'cs.LG'],
  primaryCategory: 'cs.AI',
  pdfUrl: 'http://arxiv.org/pdf/2401.12345v1',
  codeUrl: null,
  pubDate: new Date('2024-01-15T10:00:00Z'),
  updatedDate: new Date('2024-01-15T10:00:00Z'),
  rawMetadata: {},
  status: 'new',
  createdAt: new Date('2024-01-20T12:00:00Z'),
  updatedAt: new Date('2024-01-20T12:00:00Z'),
};

export const mockEnrichedPaperData = {
  id: 'test-enriched-id-123',
  paperId: 'test-paper-id-123',
  topics: ['agents', 'applications'],
  facets: ['planning', 'tool_use', 'evaluation'],
  embedding: mockOllamaEmbeddingResponse.embedding,
  mathDepth: 0.05,
  hasCode: true,
  hasData: false,
  hasBaselines: true,
  hasAblations: false,
  hasMultipleEvals: true,
  enrichedAt: new Date('2024-01-20T12:05:00Z'),
};
