/**
 * Shared LLM utilities for summary generation
 *
 * Common prompts, validation, and configuration shared across LLM providers
 * Phase 4: Summaries
 */

import type { GenerateSummaryInput, GenerateSummaryOutput } from '../llm';

/**
 * System prompt for paper summarization
 */
export const SUMMARY_SYSTEM_PROMPT = `You are a research paper summarization assistant.
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

/**
 * Shared LLM generation parameters
 */
export const SUMMARY_TEMPERATURE = 0.3; // Low temperature for consistency
export const SUMMARY_TOP_P = 0.9;

/**
 * Build user prompt from paper metadata
 *
 * @param input - Paper metadata
 * @returns Formatted prompt string
 */
export function buildSummaryPrompt(input: GenerateSummaryInput): string {
  return `Title: ${input.title}

Authors: ${input.authors.join(', ')}

Abstract:
${input.abstract}

Generate a concise summary following the output format.`;
}

/**
 * Validate LLM response structure
 *
 * @param parsed - Parsed JSON response
 * @returns Type guard for valid response
 */
export function validateSummaryResponse(
  parsed: any
): parsed is { whats_new: string; key_points: string[] } {
  return (
    typeof parsed === 'object' &&
    parsed !== null &&
    typeof parsed.whats_new === 'string' &&
    Array.isArray(parsed.key_points)
  );
}

/**
 * Normalize LLM response to standard output format
 *
 * @param parsed - Validated response
 * @returns Normalized summary output
 */
export function normalizeSummaryResponse(parsed: {
  whats_new: string;
  key_points: string[];
}): GenerateSummaryOutput {
  return {
    whatsNew: parsed.whats_new,
    keyPoints: parsed.key_points,
  };
}
