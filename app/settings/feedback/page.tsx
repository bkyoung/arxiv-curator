'use client';

/**
 * Feedback Management Page
 *
 * Allows users to view and manage their feedback history
 */

import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Trash2, ThumbsUp, ThumbsDown, Bookmark, EyeOff, X } from 'lucide-react';

export default function FeedbackManagementPage() {
  const [selectedAction, setSelectedAction] = useState<string>('all');

  // Fetch feedback history
  const { data: feedbackHistory, isLoading, refetch } = trpc.feedback.getHistory.useQuery({
    action: selectedAction === 'all' ? undefined : selectedAction,
  });

  // Remove feedback mutation
  const removeMutation = trpc.feedback.remove.useMutation({
    onSuccess: () => {
      refetch();
    },
  });

  const handleRemoveFeedback = (feedbackId: string) => {
    if (confirm('Are you sure you want to remove this feedback? This will affect your personalized recommendations.')) {
      removeMutation.mutate({ feedbackId });
    }
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'save':
        return <Bookmark className="h-4 w-4" />;
      case 'thumbs_up':
        return <ThumbsUp className="h-4 w-4" />;
      case 'thumbs_down':
        return <ThumbsDown className="h-4 w-4" />;
      case 'hide':
        return <EyeOff className="h-4 w-4" />;
      case 'dismiss':
        return <X className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getActionLabel = (action: string) => {
    switch (action) {
      case 'save':
        return 'Saved';
      case 'thumbs_up':
        return 'Thumbs Up';
      case 'thumbs_down':
        return 'Thumbs Down';
      case 'hide':
        return 'Hidden';
      case 'dismiss':
        return 'Dismissed';
      default:
        return action;
    }
  };

  const getActionVariant = (action: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (action) {
      case 'save':
      case 'thumbs_up':
        return 'default';
      case 'thumbs_down':
        return 'secondary';
      case 'hide':
      case 'dismiss':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  if (isLoading) {
    return (
      <div className="container max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Feedback History</h1>
        <p className="text-muted-foreground">
          View and manage your feedback on papers. Removing feedback will affect your personalized recommendations.
        </p>
      </div>

      {/* Filter */}
      <div className="mb-6 flex items-center gap-4">
        <label htmlFor="action-filter" className="text-sm font-medium">
          Filter by action:
        </label>
        <Select value={selectedAction} onValueChange={setSelectedAction}>
          <SelectTrigger id="action-filter" className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Actions</SelectItem>
            <SelectItem value="save">Saved</SelectItem>
            <SelectItem value="thumbs_up">Thumbs Up</SelectItem>
            <SelectItem value="thumbs_down">Thumbs Down</SelectItem>
            <SelectItem value="hide">Hidden</SelectItem>
            <SelectItem value="dismiss">Dismissed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Feedback List */}
      {!feedbackHistory || feedbackHistory.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No feedback found
              {selectedAction !== 'all' && ` for "${getActionLabel(selectedAction)}"`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {feedbackHistory.map((feedback) => (
            <Card key={feedback.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg">
                      {feedback.paper.title}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {feedback.paper.authors?.slice(0, 3).join(', ')}
                      {feedback.paper.authors && feedback.paper.authors.length > 3 && ', et al.'}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Badge variant={getActionVariant(feedback.action)} className="gap-1">
                      {getActionIcon(feedback.action)}
                      {getActionLabel(feedback.action)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">
                    {new Date(feedback.createdAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveFeedback(feedback.id)}
                    disabled={removeMutation.isPending}
                    className="gap-2 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
