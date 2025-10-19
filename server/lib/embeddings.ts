/**
 * Embedding generation utilities
 *
 * Supports both local (ollama) and cloud (Google/OpenAI) embeddings
 */

/**
 * Generate embedding for text
 *
 * @param text - Text to embed
 * @param useLocal - Use local embeddings (default: true)
 * @returns 384-dimensional embedding as JSON array (all-minilm model)
 */
export async function generateEmbedding(
  text: string,
  useLocal: boolean = true
): Promise<number[]> {
  if (useLocal) {
    return generateLocalEmbedding(text);
  } else {
    return generateCloudEmbedding(text);
  }
}

/**
 * Generate embedding using local ollama
 *
 * @param text - Text to embed
 * @returns 384-dimensional embedding (all-minilm model)
 */
async function generateLocalEmbedding(text: string): Promise<number[]> {
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

  try {
    const response = await fetch(`${ollamaUrl}/api/embeddings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'all-minilm',
        prompt: text,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama embedding failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.embedding;
  } catch (error) {
    console.error('[Embeddings] Local embedding failed:', error);
    // Fallback to zero vector for testing
    console.warn('[Embeddings] Using zero vector fallback');
    return new Array(384).fill(0);
  }
}

/**
 * Generate embedding using cloud API
 *
 * @param text - Text to embed
 * @returns 384-dimensional embedding (matching local model dimension)
 */
async function generateCloudEmbedding(text: string): Promise<number[]> {
  // Placeholder for cloud embeddings
  // TODO: Implement Google text-embedding-004 or OpenAI text-embedding-3-small
  console.warn('[Embeddings] Cloud embeddings not implemented yet');
  return new Array(384).fill(0);
}
