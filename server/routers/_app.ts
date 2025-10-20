import { router } from '../trpc';
import { healthRouter } from './health';
import { papersRouter } from './papers';
import { settingsRouter } from './settings';
import { feedbackRouter } from './feedback';
import { briefingsRouter } from './briefings';
import { summariesRouter } from './summaries';

export const appRouter = router({
  health: healthRouter,
  papers: papersRouter,
  settings: settingsRouter,
  feedback: feedbackRouter,
  briefings: briefingsRouter,
  summaries: summariesRouter,
});

export type AppRouter = typeof appRouter;
