/**
 * Ollama LLM Integration
 *
 * Local LLM integration using Ollama (llama3.2)
 * Phase 4: Summaries
 */

import { Ollama } from 'ollama';
import type { GenerateSummaryInput, GenerateSummaryOutput } from '../llm';

const SYSTEM_PROMPT = `You are a research paper summarization assistant.
Your job is to read a paper's title and abstract and generate:
1. A "What's New" summary (2-3 sentences) explaining the key contribution
2. A list of 3-5 "Key Points" highlighting specific claims or findings

Be concise, specific, and technical. Focus on novelty and contributions.

Output format (JSON):
{
  "whats_new": "2-3 sentence summary here",
  "key_points": [
    "First key point",
    "Second key point",
    "Third key point"
  ]
}`;

function buildPrompt(input: GenerateSummaryInput): string {
  return `Title: ${input.title}

Authors: ${input.authors.join(', ')}

Abstract:
${input.abstract}

Generate a concise summary following the output format.`;
}

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
    model: 'llama3.2',
    messages: [
      {
        role: 'system',
        content: SYSTEM_PROMPT,
      },
      {
        role: 'user',
        content: buildPrompt(input),
      },
    ],
    format: 'json', // Request JSON output
    options: {
      temperature: 0.3, // Low temperature for consistency
      top_p: 0.9,
    },
  });

  // Parse JSON response
  const parsed = JSON.parse(response.message.content);

  // Validate response structure
  if (!parsed.whats_new || !Array.isArray(parsed.key_points)) {
    throw new Error('Invalid response structure from Ollama');
  }

  return {
    whatsNew: parsed.whats_new,
    keyPoints: parsed.key_points,
  };
}
