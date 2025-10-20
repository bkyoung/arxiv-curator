/**
 * Google Gemini LLM Integration
 *
 * Cloud LLM integration using Google Gemini (gemini-2.5-flash)
 * Phase 4: Summaries
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { GenerateSummaryInput, GenerateSummaryOutput } from '../llm';
import {
  SUMMARY_SYSTEM_PROMPT,
  SUMMARY_TEMPERATURE,
  buildSummaryPrompt,
  validateSummaryResponse,
  normalizeSummaryResponse,
} from './shared';

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
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: SUMMARY_TEMPERATURE,
    },
  });

  // Gemini doesn't support separate system messages, so combine system prompt with user prompt
  const fullPrompt = `${SUMMARY_SYSTEM_PROMPT}

${buildSummaryPrompt(input)}`;

  const result = await model.generateContent(fullPrompt);
  const response = result.response;

  // Parse JSON response
  const parsed = JSON.parse(response.text());

  // Validate response structure
  if (!validateSummaryResponse(parsed)) {
    throw new Error('Invalid response structure from Gemini');
  }

  return normalizeSummaryResponse(parsed);
}
