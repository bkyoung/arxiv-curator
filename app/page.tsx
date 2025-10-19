'use client';

import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, Settings2, Activity, Loader2 } from 'lucide-react';

export default function Home() {
  const { data: health, isLoading } = trpc.health.check.useQuery();
  const { data: stats } = trpc.papers.stats.useQuery();

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold mb-2">ArXiv Curator</h1>
          <p className="text-muted-foreground">
            AI-powered research paper curation system
          </p>
        </header>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.href = '/papers'}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Browse Papers
              </CardTitle>
              <CardDescription>View and search enriched arXiv papers</CardDescription>
            </CardHeader>
            <CardContent>
              {stats && (
                <div className="text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total papers:</span>
                    <span className="font-medium">{stats.total}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Enriched:</span>
                    <span className="font-medium">{stats.enriched}</span>
                  </div>
                </div>
              )}
              <Button className="w-full mt-4" asChild>
                <a href="/papers">View Papers</a>
              </Button>
            </CardContent>
          </Card>

          <Card className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.href = '/settings'}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5" />
                Settings
              </CardTitle>
              <CardDescription>Configure categories and preferences</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Choose arXiv categories to track and configure processing options
              </p>
              <Button variant="outline" className="w-full" asChild>
                <a href="/settings">Configure Settings</a>
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* System Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              System Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking services...
              </div>
            ) : health ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block w-3 h-3 rounded-full ${
                      health.status === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'
                    }`}
                  />
                  <span className="font-medium">Overall: {health.status}</span>
                </div>
                <div className="ml-5 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        health.services.database === 'connected' ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                    <span>Database: {health.services.database}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span
                      className={`inline-block w-2 h-2 rounded-full ${
                        health.services.storage === 'connected' ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                    <span>Storage: {health.services.storage}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Last checked: {new Date(health.timestamp).toLocaleString()}
                </p>
              </div>
            ) : (
              <p className="text-red-500">Failed to fetch health status</p>
            )}
          </CardContent>
        </Card>

        <footer className="text-center text-sm text-muted-foreground mt-8">
          <p>Built with Next.js 15, React 19, and TypeScript</p>
        </footer>
      </div>
    </div>
  );
}
