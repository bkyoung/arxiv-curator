'use client';

/**
 * Briefings Archives Page
 *
 * List of all past briefings
 */

import Link from 'next/link';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { NavigationPane } from '@/components/NavigationPane';
import { Calendar, ChevronRight, Loader2 } from 'lucide-react';

export default function BriefingsArchivesPage() {
  const { data: briefingsData, isLoading } = trpc.briefings.list.useQuery({
    limit: 30,
    offset: 0,
  });

  // Fetch saved count for navigation badge
  const { data: savedFeedback } = trpc.feedback.getHistory.useQuery({
    action: 'save',
  });

  const savedCount = savedFeedback?.length || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const briefings = briefingsData?.briefings || [];

  return (
    <div className="flex h-screen">
      {/* Navigation Pane */}
      <div className="w-48 border-r bg-muted/10">
        <NavigationPane savedCount={savedCount} />
      </div>

      {/* Archives List */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-8">
          <h1 className="text-3xl font-bold mb-6">Briefing Archives</h1>

          {briefings.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No briefings found</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {briefings.map((briefing) => {
                const date = new Date(briefing.date);
                const formattedDate = new Intl.DateTimeFormat('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                }).format(date);

                const dateParam = date.toISOString().split('T')[0];

                return (
                  <Link key={briefing.id} href={`/briefings/${dateParam}`}>
                    <Card className="hover:bg-accent transition-colors cursor-pointer">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-5 w-5 text-muted-foreground" />
                            <CardTitle className="text-lg">{formattedDate}</CardTitle>
                          </div>
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <CardDescription>
                          {briefing.paperCount} papers • {Math.round(briefing.avgScore * 100)}%
                          avg score
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex items-center gap-2">
                          <Badge variant={briefing.status === 'viewed' ? 'secondary' : 'default'}>
                            {briefing.status}
                          </Badge>
                          {briefing.viewedAt && (
                            <span className="text-xs text-muted-foreground">
                              Viewed{' '}
                              {new Intl.DateTimeFormat('en-US', {
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                              }).format(new Date(briefing.viewedAt))}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
