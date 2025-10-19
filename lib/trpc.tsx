'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { httpBatchLink, TRPCClientError } from '@trpc/client';
import { createTRPCReact } from '@trpc/react-query';
import { useState } from 'react';
import superjson from 'superjson';
import type { AppRouter } from '@/server/routers/_app';

/**
 * Create tRPC React query hooks
 */
export const trpc = createTRPCReact<AppRouter>();

/**
 * Get the base URL for tRPC API calls
 */
function getBaseUrl() {
  if (typeof window !== 'undefined') return ''; // Browser uses relative URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`; // Vercel deployment
  return `http://localhost:${process.env.PORT ?? 3000}`; // Local dev
}

/**
 * tRPC Provider wrapper for React components
 * Provides tRPC client and React Query to the app
 */
export function TRPCProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Don't retry on 4xx errors
            retry(failureCount, error) {
              if (error instanceof TRPCClientError) {
                const httpStatus = error.data?.httpStatus;
                if (httpStatus && httpStatus >= 400 && httpStatus < 500) {
                  return false;
                }
              }
              return failureCount < 3;
            },
          },
        },
      })
  );

  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          transformer: superjson,
          headers() {
            return {
              // Add any custom headers here
            };
          },
        }),
      ],
    })
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
}
