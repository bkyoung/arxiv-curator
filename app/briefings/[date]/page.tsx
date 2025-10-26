'use client';

/**
 * Date-Specific Briefing Page
 *
 * View briefing for a specific date
 */

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc';
import { NavigationPane } from '@/components/NavigationPane';
import { BriefingList } from '@/components/BriefingList';
import { PaperDetailView } from '@/components/PaperDetailView';
import { HelpModal } from '@/components/HelpModal';
import { useHotkeys } from '@/hooks/useHotkeys';
import { Loader2 } from 'lucide-react';

export default function BriefingByDatePage() {
  const params = useParams();
  const dateParam = params.date as string;
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  // Parse date from URL parameter (YYYY-MM-DD)
  const date = new Date(dateParam);

  // Fetch briefing for specific date
  const { data: briefing, isLoading, error, refetch } = trpc.briefings.getByDate.useQuery({
    date,
  });

  // Fetch saved count for navigation badge
  const { data: savedFeedback } = trpc.feedback.getHistory.useQuery({
    action: 'save',
  });

  // Feedback mutations
  const saveMutation = trpc.feedback.save.useMutation({
    onSuccess: () => refetch(),
  });

  const unsaveMutation = trpc.feedback.removeByPaperAndAction.useMutation({
    onSuccess: () => refetch(),
  });

  const hideMutation = trpc.feedback.hide.useMutation({
    onSuccess: () => refetch(),
  });

  const thumbsUpMutation = trpc.feedback.thumbsUp.useMutation({
    onSuccess: () => refetch(),
  });

  const thumbsDownMutation = trpc.feedback.thumbsDown.useMutation({
    onSuccess: () => refetch(),
  });

  const savedCount = savedFeedback?.length || 0;

  // Keyboard navigation handlers (defined before early returns to satisfy hooks rules)
  const handleNext = () => {
    if (briefing?.papers) {
      setSelectedIndex((prev) => Math.min(prev + 1, briefing.papers.length - 1));
    }
  };

  const handlePrev = () => {
    setSelectedIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleSave = () => {
    const selectedPaper = briefing?.papers?.[selectedIndex];
    if (selectedPaper) {
      const isSaved = selectedPaper.feedback?.some((f) => f.action === 'save');
      if (isSaved) {
        unsaveMutation.mutate({ paperId: selectedPaper.id, action: 'save' });
      } else {
        saveMutation.mutate({ paperId: selectedPaper.id });
      }
    }
  };

  const handleHide = () => {
    const selectedPaper = briefing?.papers?.[selectedIndex];
    if (selectedPaper) {
      hideMutation.mutate({ paperId: selectedPaper.id });
    }
  };

  const handleOpenPdf = () => {
    const selectedPaper = briefing?.papers?.[selectedIndex];
    if (selectedPaper?.pdfUrl) {
      window.open(selectedPaper.pdfUrl, '_blank');
    }
  };

  const handleToggleHelp = () => {
    setShowHelp((prev) => !prev);
  };

  const handleCloseHelp = () => {
    setShowHelp(false);
  };

  // Register keyboard shortcuts (must be called unconditionally)
  useHotkeys([
    { key: 'j', action: handleNext },
    { key: 'k', action: handlePrev },
    { key: 's', action: handleSave },
    { key: 'h', action: handleHide },
    { key: 'Enter', action: handleOpenPdf },
    { key: '?', action: handleToggleHelp },
    { key: 'Escape', action: handleCloseHelp },
  ]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !briefing) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">
            No briefing found for{' '}
            {new Intl.DateTimeFormat('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            }).format(date)}
          </p>
        </div>
      </div>
    );
  }

  const selectedPaper = briefing.papers?.[selectedIndex];
  const formattedDate = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(date);

  // Individual feedback handlers for the selected paper
  const handleSavePaper = () => {
    if (selectedPaper) {
      const isSaved = selectedPaper.feedback?.some((f) => f.action === 'save');
      if (isSaved) {
        unsaveMutation.mutate({ paperId: selectedPaper.id, action: 'save' });
      } else {
        saveMutation.mutate({ paperId: selectedPaper.id });
      }
    }
  };

  const handleThumbsUpPaper = () => {
    if (selectedPaper) {
      thumbsUpMutation.mutate({ paperId: selectedPaper.id });
    }
  };

  const handleThumbsDownPaper = () => {
    if (selectedPaper) {
      thumbsDownMutation.mutate({ paperId: selectedPaper.id });
    }
  };

  const handleHidePaper = () => {
    if (selectedPaper) {
      hideMutation.mutate({ paperId: selectedPaper.id });
    }
  };

  return (
    <div className="flex h-screen">
      {/* Navigation Pane */}
      <div className="w-48 border-r bg-muted/10">
        <NavigationPane savedCount={savedCount} />
      </div>

      {/* Briefing List Pane */}
      <div className="w-96 border-r">
        <div className="p-4 border-b">
          <h2 className="font-semibold">{formattedDate}</h2>
          <p className="text-sm text-muted-foreground">
            {briefing.paperCount} papers • {Math.round((briefing.avgScore || 0) * 100)}%
            avg score
          </p>
        </div>
        <BriefingList
          papers={briefing.papers || []}
          selectedIndex={selectedIndex}
          onSelectPaper={setSelectedIndex}
        />
      </div>

      {/* Paper Detail Pane */}
      <div className="flex-1">
        {selectedPaper ? (
          <PaperDetailView
            paper={selectedPaper}
            onSave={handleSavePaper}
            onThumbsUp={handleThumbsUpPaper}
            onThumbsDown={handleThumbsDownPaper}
            onHide={handleHidePaper}
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">Select a paper to view details</p>
          </div>
        )}
      </div>

      {/* Help Modal */}
      <HelpModal open={showHelp} onClose={handleCloseHelp} />
    </div>
  );
}
