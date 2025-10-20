/**
 * Google Gemini LLM Integration
 *
 * Cloud LLM integration using Google Gemini (gemini-2.0-flash-exp)
 * Phase 4: Summaries
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
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
  return `${SYSTEM_PROMPT}

Title: ${input.title}

Authors: ${input.authors.join(', ')}

Abstract:
${input.abstract}

Generate a concise summary following the output format.`;
}

/**
 * Generate summary using Google Gemini (cloud LLM)
 *
 * @param input - Paper metadata
 * @returns Structured summary
 */
export async function generateSummaryGemini(
  input: GenerateSummaryInput
): Promise<GenerateSummaryOutput> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;

  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY environment variable is not set');
  }

  const genAI = new GoogleGenerativeAI(apiKey);

  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash-exp',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
  });

  const result = await model.generateContent(buildPrompt(input));
  const response = result.response;

  // Parse JSON response
  const parsed = JSON.parse(response.text());

  // Validate response structure
  if (!parsed.whats_new || !Array.isArray(parsed.key_points)) {
    throw new Error('Invalid response structure from Gemini');
  }

  return {
    whatsNew: parsed.whats_new,
    keyPoints: parsed.key_points,
  };
}
