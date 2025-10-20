import { z } from 'zod';

/**
 * Environment variable validation schema.
 * This ensures all required environment variables are present and valid at runtime.
 */
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // Node environment
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  // MinIO S3 Storage
  MINIO_ENDPOINT: z.string().default('localhost'),
  MINIO_PORT: z.string().default('9000'),
  MINIO_ACCESS_KEY: z.string().min(1, 'MINIO_ACCESS_KEY is required'),
  MINIO_SECRET_KEY: z.string().min(1, 'MINIO_SECRET_KEY is required'),
  MINIO_USE_SSL: z.string().default('false'),
  MINIO_BUCKET: z.string().default('arxiv-curator'),

  // Auth (Phase 1+)
  AUTH_SECRET: z.string().min(32).optional(),
  NEXTAUTH_URL: z.string().url().optional(),

  // AI Services (Phase 1+) - Optional for now
  OPENAI_API_KEY: z.string().optional(),
  GOOGLE_AI_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.string().url().optional(),
});

/**
 * Validated environment variables.
 * This will throw an error at startup if any required variables are missing or invalid.
 */
export const env = envSchema.parse(process.env);

// Type export for use in other files
export type Env = z.infer<typeof envSchema>;
