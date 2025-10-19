/**
 * Paper classification utilities
 *
 * Zero-shot classification of papers into topics and facets
 */

import type { Paper } from '@prisma/client';

export interface Classification {
  topics: string[];
  facets: string[];
}

/**
 * Classify paper into topics and facets using LLM
 *
 * @param paper - Paper to classify
 * @param useLocal - Use local LLM (default: true)
 * @returns Topics and facets
 */
export async function classifyPaper(
  paper: Paper,
  useLocal: boolean = true
): Promise<Classification> {
  const prompt = `
Classify this research paper into relevant topics and facets.

Title: ${paper.title}
Abstract: ${paper.abstract}

Topics (select all that apply):
- agents: Papers about AI agents or agentic systems
- rag: Retrieval-augmented generation
- multimodal: Multimodal language models (vision, audio, etc.)
- architectures: Novel model architectures
- surveys: Survey or review papers
- applications: Real-world applications

Facets (select all that apply):
- planning: Planning and reasoning
- memory: Memory systems
- tool_use: Tool use and function calling
- evaluation: Evaluation methods or benchmarks
- safety: AI safety and alignment
- protocols: Interaction protocols

Output ONLY valid JSON in this exact format:
{"topics": ["...", "..."], "facets": ["...", "..."]}
`.trim();

  try {
    const response = await callLLM(prompt, { useLocal, format: 'json' });
    const parsed = JSON.parse(response);

    return {
      topics: parsed.topics || [],
      facets: parsed.facets || [],
    };
  } catch (error) {
    console.error('[Classifier] Classification failed:', error);

    // Fallback: keyword-based classification
    return keywordBasedClassification(paper);
  }
}

/**
 * Fallback keyword-based classification
 */
function keywordBasedClassification(paper: Paper): Classification {
  const text = `${paper.title} ${paper.abstract}`.toLowerCase();

  const topics: string[] = [];
  const facets: string[] = [];

  // Topic detection
  if (/agent|agentic/i.test(text)) topics.push('agents');
  if (/rag|retrieval.?augmented/i.test(text)) topics.push('rag');
  if (/multimodal|vision|audio/i.test(text)) topics.push('multimodal');
  if (/architecture|transformer|attention/i.test(text)) topics.push('architectures');
  if (/survey|review/i.test(text)) topics.push('surveys');
  if (/application|real.?world/i.test(text)) topics.push('applications');

  // Facet detection
  if (/planning|plan|reasoning/i.test(text)) facets.push('planning');
  if (/memory/i.test(text)) facets.push('memory');
  if (/tool|function.?calling/i.test(text)) facets.push('tool_use');
  if (/evaluation|benchmark/i.test(text)) facets.push('evaluation');
  if (/safety|alignment/i.test(text)) facets.push('safety');
  if (/protocol|interaction/i.test(text)) facets.push('protocols');

  return { topics, facets };
}

/**
 * Call LLM for classification
 */
async function callLLM(
  prompt: string,
  options: { useLocal?: boolean; format?: string } = {}
): Promise<string> {
  const { useLocal = true, format = 'text' } = options;

  if (useLocal) {
    return callOllamaLLM(prompt, { format, model: 'llama3.2' });
  } else {
    // Placeholder for cloud LLM
    throw new Error('Cloud LLM not implemented yet');
  }
}

/**
 * Call ollama LLM
 */
async function callOllamaLLM(
  prompt: string,
  options: { format?: string; model: string }
): Promise<string> {
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

  try {
    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: options.model,
        prompt,
        stream: false,
        format: options.format,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama LLM call failed: ${response.statusText}`);
    }

    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('[Classifier] Ollama LLM call failed:', error);
    throw error;
  }
}
