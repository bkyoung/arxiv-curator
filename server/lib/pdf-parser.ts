/**
 * PDF Parser
 *
 * Download, cache, and parse arXiv PDFs
 * Extract text and detect sections (intro, conclusion, methodology)
 * Phase 5: Critical Analysis
 */

import { S3 } from '@aws-sdk/client-s3';
import * as pdfParse from 'pdf-parse';
import { env } from '@/server/env';

/**
 * Get S3 client for MinIO
 */
function getS3Client(): S3 {
  return new S3({
    endpoint: `http://${env.MINIO_ENDPOINT}:${env.MINIO_PORT}`,
    region: 'us-east-1',
    credentials: {
      accessKeyId: env.MINIO_ACCESS_KEY,
      secretAccessKey: env.MINIO_SECRET_KEY,
    },
    forcePathStyle: true, // Required for MinIO
  });
}

/**
 * Download PDF from arXiv and cache in MinIO
 *
 * @param pdfUrl - URL to PDF file on arXiv
 * @param paperId - Unique paper ID for caching
 * @returns PDF as Buffer
 */
export async function downloadPDF(
  pdfUrl: string,
  paperId: string
): Promise<Buffer> {
  const s3 = getS3Client();
  const bucket = 'arxiv-pdfs';
  const key = `${paperId}.pdf`;

  // Check cache first
  try {
    const obj = await s3.getObject({ Bucket: bucket, Key: key });
    if (obj.Body) {
      const bytes = await obj.Body.transformToByteArray();
      return Buffer.from(bytes);
    }
  } catch (err) {
    // Not in cache, proceed to download
  }

  // Download from arXiv
  const response = await fetch(pdfUrl);
  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Cache in MinIO
  try {
    await s3.putObject({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: 'application/pdf',
    });
  } catch (err) {
    // Log error but don't fail - we still have the PDF
    console.warn(`Failed to cache PDF in MinIO: ${err}`);
  }

  return buffer;
}

/**
 * Extract text from PDF buffer
 *
 * @param pdfBuffer - PDF file as Buffer
 * @returns Extracted text content
 */
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  // pdf-parse v1.1.1 has a simple default export function
  const data = await (pdfParse as any).default(pdfBuffer);
  return data.text;
}

/**
 * Extract introduction section (heuristic-based)
 *
 * Looks for section headers like "1 Introduction" or "Introduction"
 * and extracts text until the next section
 *
 * @param pdfText - Full PDF text
 * @returns Introduction text or null if not found
 */
export function extractIntro(pdfText: string): string | null {
  // Look for "Introduction" heading with optional section number
  // Try to match until next section, or up to 3000 chars
  let introMatch = pdfText.match(
    /(?:\d+\s+)?Introduction\s+([\s\S]+?)(?:\n\s*\d+\s+[A-Z]|\n\s*(?:References|Conclusion|Methods?|Results|Evaluation|Experiments?))/i
  );

  // If no terminator found, just grab up to 3000 chars
  if (!introMatch) {
    introMatch = pdfText.match(/(?:\d+\s+)?Introduction\s+([\s\S]{1,3000})/i);
  }

  // Limit to 3000 chars if matched more
  let result = introMatch?.[1]?.trim() ?? null;
  if (result && result.length > 3000) {
    result = result.slice(0, 3000);
  }

  return result;
}

/**
 * Extract conclusion section (heuristic-based)
 *
 * Looks for section headers like "5 Conclusion" or "Conclusions"
 * and extracts text until References or Acknowledgments
 *
 * @param pdfText - Full PDF text
 * @returns Conclusion text or null if not found
 */
export function extractConclusion(pdfText: string): string | null {
  // Look for "Conclusion" or "Conclusions" heading
  // Try to match until references or acknowledgments
  let conclusionMatch = pdfText.match(
    /(?:\d+\s+)?Conclusion[s]?\s+([\s\S]+?)(?:\n\s*(?:References|Acknowledgments?)|\n\s*\[1\])/i
  );

  // If no terminator found, just grab up to 2000 chars
  if (!conclusionMatch) {
    conclusionMatch = pdfText.match(/(?:\d+\s+)?Conclusion[s]?\s+([\s\S]{1,2000})/i);
  }

  // Limit to 2000 chars if matched more
  let result = conclusionMatch?.[1]?.trim() ?? null;
  if (result && result.length > 2000) {
    result = result.slice(0, 2000);
  }

  return result;
}

/**
 * Extract methodology section (heuristic-based, optional)
 *
 * Looks for section headers like "Method", "Methodology", or "Approach"
 * and extracts text until the next section
 *
 * @param pdfText - Full PDF text
 * @returns Methodology text or null if not found
 */
export function extractMethodology(pdfText: string): string | null {
  // Look for "Method", "Methodology", or "Approach" heading
  const methodMatch = pdfText.match(
    /(?:\d+\s+)?(?:Method|Methodology|Approach)\s+([\s\S]{1,4000}?)(?:\n\s*\d+\s+[A-Z]|\n\s*(?:Experiments?|Results|Evaluation|Conclusion)|$)/i
  );
  return methodMatch?.[1]?.trim() ?? null;
}

/**
 * Download and parse PDF (high-level wrapper)
 *
 * Combines download and text extraction into one call
 *
 * @param pdfUrl - URL to PDF file on arXiv
 * @param paperId - Unique paper ID for caching
 * @returns Extracted text content
 */
export async function downloadAndParsePDF(
  pdfUrl: string,
  paperId: string
): Promise<string> {
  const buffer = await downloadPDF(pdfUrl, paperId);
  return await extractTextFromPDF(buffer);
}
