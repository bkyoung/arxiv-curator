import { redirect } from 'next/navigation';

/**
 * Root page - redirects to latest briefing
 *
 * The main app interface is the briefings view where users see
 * their personalized daily digest of papers. This redirect ensures
 * users land directly on the most useful page.
 *
 * TODO: When auth is implemented, redirect unauthenticated users
 * to a login/landing page instead.
 */
export default function Home() {
  redirect('/briefings/latest');
}
