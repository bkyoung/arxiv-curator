/**
 * LLM Critique Generation
 *
 * Specialized LLM functions for generating critical analysis
 * Phase 5: Critical Analysis
 */

export interface GenerateCritiqueInput {
  prompt: string;
}

export interface GenerateCritiqueOutput {
  markdown: string;
}

/**
 * Generate critique using Ollama (local LLM)
 */
export async function generateCritiqueOllama(
  input: GenerateCritiqueInput
): Promise<GenerateCritiqueOutput> {
  const { prompt } = input;

  const response = await fetch(`${process.env.OLLAMA_BASE_URL}/api/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gemma2:27b',
      prompt,
      stream: false,
      options: {
        temperature: 0.3,
        top_p: 0.9,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.statusText}`);
  }

  const data = await response.json();
  return {
    markdown: data.response,
  };
}

/**
 * Generate critique using Google Gemini (cloud LLM)
 */
export async function generateCritiqueGemini(
  input: GenerateCritiqueInput
): Promise<GenerateCritiqueOutput> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const { prompt } = input;

  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_AI_API_KEY environment variable is not set');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      temperature: 0.3,
      topP: 0.9,
    },
  });

  const result = await model.generateContent(prompt);
  const response = result.response;

  return {
    markdown: response.text(),
  };
}
