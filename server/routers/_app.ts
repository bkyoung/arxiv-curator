import { router } from '../trpc';
import { healthRouter } from './health';
import { papersRouter } from './papers';
import { settingsRouter } from './settings';

export const appRouter = router({
  health: healthRouter,
  papers: papersRouter,
  settings: settingsRouter,
});

export type AppRouter = typeof appRouter;
