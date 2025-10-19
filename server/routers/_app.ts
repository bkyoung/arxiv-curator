import { router } from '../trpc';
import { healthRouter } from './health';
import { papersRouter } from './papers';
import { settingsRouter } from './settings';
import { feedbackRouter } from './feedback';

export const appRouter = router({
  health: healthRouter,
  papers: papersRouter,
  settings: settingsRouter,
  feedback: feedbackRouter,
});

export type AppRouter = typeof appRouter;
