/**
 * Ollama LLM Integration
 *
 * Local LLM integration using Ollama (gemma3:27b)
 * Phase 4: Summaries
 */

import { Ollama } from 'ollama';
import type { GenerateSummaryInput, GenerateSummaryOutput } from '../llm';
import {
  SUMMARY_SYSTEM_PROMPT,
  SUMMARY_TEMPERATURE,
  SUMMARY_TOP_P,
  buildSummaryPrompt,
  validateSummaryResponse,
  normalizeSummaryResponse,
} from './shared';

/**
 * Generate summary using Ollama (local LLM)
 *
 * @param input - Paper metadata
 * @returns Structured summary
 */
export async function generateSummaryOllama(
  input: GenerateSummaryInput
): Promise<GenerateSummaryOutput> {
  const ollama = new Ollama({
    host: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
  });

  const response = await ollama.chat({
    model: 'gemma3:27b',
    messages: [
      {
        role: 'system',
        content: SUMMARY_SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: buildSummaryPrompt(input),
      },
    ],
    format: 'json', // Request JSON output
    options: {
      temperature: SUMMARY_TEMPERATURE,
      top_p: SUMMARY_TOP_P,
    },
  });

  // Parse JSON response
  const parsed = JSON.parse(response.message.content);

  // Validate response structure
  if (!validateSummaryResponse(parsed)) {
    throw new Error('Invalid response structure from Ollama');
  }

  return normalizeSummaryResponse(parsed);
}
