/**
 * LLM Integration Layer
 *
 * Unified interface for local (Ollama) and cloud (Google Gemini) LLMs
 * Phase 4: Summaries
 */

import { generateSummaryOllama } from './llm/ollama';
import { generateSummaryGemini } from './llm/gemini';

export type LLMProvider = 'local' | 'cloud';

export interface GenerateSummaryInput {
  title: string;
  abstract: string;
  authors: string[];
}

export interface GenerateSummaryOutput {
  whatsNew: string; // 2-3 sentence summary
  keyPoints: string[]; // 3-5 bullet points
}

/**
 * Generate a summary using the specified LLM provider
 *
 * @param input - Paper metadata (title, abstract, authors)
 * @param provider - 'local' for Ollama, 'cloud' for Gemini
 * @returns Structured summary with whatsNew and keyPoints
 */
export async function generateSummary(
  input: GenerateSummaryInput,
  provider: LLMProvider
): Promise<GenerateSummaryOutput> {
  if (provider === 'local') {
    return generateSummaryOllama(input);
  } else {
    return generateSummaryGemini(input);
  }
}
