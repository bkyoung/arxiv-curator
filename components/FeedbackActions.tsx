/**
 * FeedbackActions Component
 *
 * Provides feedback action buttons for papers
 * Includes save, thumbs up/down, and hide actions
 */

import { Button } from '@/components/ui/button';
import {
  Bookmark,
  BookmarkCheck,
  ThumbsUp,
  ThumbsDown,
  EyeOff,
} from 'lucide-react';

interface FeedbackActionsProps {
  onSave: () => void;
  onThumbsUp: () => void;
  onThumbsDown: () => void;
  onHide: () => void;
  isSaved?: boolean;
  isThumbsUp?: boolean;
  isThumbsDown?: boolean;
  compact?: boolean;
  disabled?: boolean;
}

export function FeedbackActions({
  onSave,
  onThumbsUp,
  onThumbsDown,
  onHide,
  isSaved = false,
  isThumbsUp = false,
  isThumbsDown = false,
  compact = false,
  disabled = false,
}: FeedbackActionsProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-1">
        <Button
          variant={isSaved ? 'default' : 'outline'}
          size="sm"
          onClick={onSave}
          disabled={disabled}
          aria-label={isSaved ? 'Saved' : 'Save'}
        >
          {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
        </Button>

        <Button
          variant={isThumbsUp ? 'default' : 'outline'}
          size="sm"
          onClick={onThumbsUp}
          disabled={disabled}
          aria-label="Thumbs up"
        >
          <ThumbsUp className="h-4 w-4" />
        </Button>

        <Button
          variant={isThumbsDown ? 'default' : 'outline'}
          size="sm"
          onClick={onThumbsDown}
          disabled={disabled}
          aria-label="Thumbs down"
        >
          <ThumbsDown className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant={isSaved ? 'default' : 'outline'}
        size="sm"
        onClick={onSave}
        disabled={disabled}
        aria-label={isSaved ? 'Saved' : 'Save'}
        className="gap-2"
      >
        {isSaved ? (
          <>
            <BookmarkCheck className="h-4 w-4" />
            Saved
          </>
        ) : (
          <>
            <Bookmark className="h-4 w-4" />
            Save
          </>
        )}
      </Button>

      <Button
        variant={isThumbsUp ? 'default' : 'outline'}
        size="sm"
        onClick={onThumbsUp}
        disabled={disabled}
        aria-label="Thumbs up"
        className="gap-2"
      >
        <ThumbsUp className="h-4 w-4" />
        Thumbs up
      </Button>

      <Button
        variant={isThumbsDown ? 'default' : 'outline'}
        size="sm"
        onClick={onThumbsDown}
        disabled={disabled}
        aria-label="Thumbs down"
        className="gap-2"
      >
        <ThumbsDown className="h-4 w-4" />
        Thumbs down
      </Button>

      <Button
        variant="outline"
        size="sm"
        onClick={onHide}
        disabled={disabled}
        aria-label="Hide"
        className="gap-2"
      >
        <EyeOff className="h-4 w-4" />
        Hide
      </Button>
    </div>
  );
}
