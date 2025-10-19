'use client';

import { trpc } from '@/lib/trpc';

export default function Home() {
  const { data: health, isLoading } = trpc.health.check.useQuery();

  return (
    <div className="min-h-screen p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-2">ArXiv Curator</h1>
          <p className="text-gray-600 dark:text-gray-400">
            AI-powered research paper curation system
          </p>
        </header>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-semibold mb-4">Phase 0: Foundation</h2>
          <p className="text-gray-700 dark:text-gray-300 mb-4">
            ✅ Infrastructure complete and operational
          </p>

          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-medium mb-2">System Status</h3>
              {isLoading ? (
                <p className="text-gray-500">Checking services...</p>
              ) : health ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block w-3 h-3 rounded-full ${
                        health.status === 'healthy'
                          ? 'bg-green-500'
                          : 'bg-yellow-500'
                      }`}
                    />
                    <span className="font-medium">
                      Overall: {health.status}
                    </span>
                  </div>
                  <div className="ml-5 space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          health.services.database === 'connected'
                            ? 'bg-green-500'
                            : 'bg-red-500'
                        }`}
                      />
                      <span className="text-sm">
                        Database: {health.services.database}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block w-2 h-2 rounded-full ${
                          health.services.storage === 'connected'
                            ? 'bg-green-500'
                            : 'bg-red-500'
                        }`}
                      />
                      <span className="text-sm">
                        Storage: {health.services.storage}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Last checked: {new Date(health.timestamp).toLocaleString()}
                  </p>
                </div>
              ) : (
                <p className="text-red-500">Failed to fetch health status</p>
              )}
            </div>

            <div>
              <h3 className="text-lg font-medium mb-2">Completed Components</h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                <li>PostgreSQL 17 with pgvector extension</li>
                <li>Prisma ORM with comprehensive schema (17 models)</li>
                <li>tRPC v11 API layer with type safety</li>
                <li>MinIO S3-compatible storage</li>
                <li>pg-boss job queue (PostgreSQL-backed)</li>
                <li>Environment variable validation</li>
                <li>Test suite (8 tests passing)</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-medium mb-2">Next Phase</h3>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <strong>Phase 1: Ingestion & Enrichment</strong> - Scout Agent
                for arXiv OAI-PMH, Enricher Agent for embeddings and
                classification
              </p>
            </div>
          </div>
        </div>

        <footer className="text-center text-sm text-gray-500">
          <p>Built with Next.js 15, React 19, and TypeScript</p>
        </footer>
      </div>
    </div>
  );
}
