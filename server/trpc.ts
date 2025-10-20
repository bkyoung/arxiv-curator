import { initTRPC, TRPCError } from '@trpc/server';
import { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import superjson from 'superjson';
import { ZodError } from 'zod';

/**
 * Create tRPC context for each request.
 * Can be extended with auth session in Phase 1.
 */
export const createTRPCContext = async (opts: FetchCreateContextFnOptions) => {
  return {
    headers: opts.req.headers,
    // Mock user for development - will be replaced with real auth in future phase
    user: {
      id: 'user-1',
      email: 'test@test.com',
    },
    // Session will be added here in Phase 1:
    // session: await getServerSession(authOptions),
  };
};

type Context = Awaited<ReturnType<typeof createTRPCContext>>;

/**
 * Initialize tRPC with superjson transformer and Zod error formatting
 */
const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const router = t.router;
export const publicProcedure = t.procedure;

/**
 * Protected procedure that requires authentication.
 * Throws UNAUTHORIZED error if user is not authenticated.
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Authentication required',
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user, // Type-safe: guaranteed to be non-null
    },
  });
});
