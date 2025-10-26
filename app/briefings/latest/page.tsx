'use client';

/**
 * Today's Briefing Page
 *
 * Three-pane layout: Navigation | Paper List | Paper Detail
 */

import { useState, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { NavigationPane } from '@/components/NavigationPane';
import { BriefingList } from '@/components/BriefingList';
import { PaperDetailView } from '@/components/PaperDetailView';
import { HelpModal } from '@/components/HelpModal';
import { useHotkeys } from '@/hooks/useHotkeys';
import { Loader2 } from 'lucide-react';
// import { toast } from 'sonner';

export default function LatestBriefingPage() {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [showHelp, setShowHelp] = useState(false);

  // Fetch today's briefing
  const { data: briefing, isLoading, refetch } = trpc.briefings.getLatest.useQuery();

  // Filter out hidden papers
  const visiblePapers = useMemo(() => {
    if (!briefing?.papers) return [];

    return briefing.papers.filter(paper => {
      const feedback = paper.feedback || [];
      const isHidden = feedback.some(f => f.action === 'hide');
      return !isHidden;
    });
  }, [briefing?.papers]);

  // Fetch saved count for navigation badge
  const { data: savedFeedback } = trpc.feedback.getHistory.useQuery({
    action: 'save',
  });

  // Feedback mutations (toasts temporarily disabled due to build issues)
  const saveMutation = trpc.feedback.save.useMutation({
    onSuccess: () => {
      refetch();
      // toast.success('Paper saved');
    },
    onError: () => {
      // toast.error('Failed to save paper');
    },
  });

  const unsaveMutation = trpc.feedback.removeByPaperAndAction.useMutation({
    onSuccess: () => {
      refetch();
      // toast.success('Paper unsaved');
    },
    onError: () => {
      // toast.error('Failed to unsave paper');
    },
  });

  const hideMutation = trpc.feedback.hide.useMutation({
    onSuccess: () => {
      refetch();
      // toast.success('Paper hidden');
    },
    onError: () => {
      // toast.error('Failed to hide paper');
    },
  });


  const thumbsUpMutation = trpc.feedback.thumbsUp.useMutation({
    onSuccess: () => {
      refetch();
      // toast.success('Thanks for your feedback!');
    },
    onError: () => {
      // toast.error('Failed to record feedback');
    },
  });

  const thumbsDownMutation = trpc.feedback.thumbsDown.useMutation({
    onSuccess: () => {
      refetch();
      // toast.success('We\'ll show fewer papers like this');
    },
    onError: () => {
      // toast.error('Failed to record feedback');
    },
  });

  // Keyboard navigation handlers (defined before early returns to satisfy hooks rules)
  const handleNext = () => {
    if (visiblePapers.length > 0) {
      setSelectedIndex((prev) => Math.min(prev + 1, visiblePapers.length - 1));
    }
  };

  const handlePrev = () => {
    setSelectedIndex((prev) => Math.max(prev - 1, 0));
  };

  const handleSave = () => {
    const selectedPaper = visiblePapers[selectedIndex];
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
    if (visiblePapers[selectedIndex]) {
      hideMutation.mutate({ paperId: visiblePapers[selectedIndex].id });
    }
  };

  const handleOpenPdf = () => {
    const selectedPaper = visiblePapers[selectedIndex];
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

  if (!briefing || visiblePapers.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-muted-foreground">No papers available</p>
          {briefing?.papers && briefing.papers.length > 0 && (
            <p className="text-sm text-muted-foreground mt-2">
              All papers have been hidden
            </p>
          )}
        </div>
      </div>
    );
  }

  const selectedPaper = visiblePapers[selectedIndex];
  const savedCount = savedFeedback?.length || 0;

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
          <h2 className="font-semibold">Today&apos;s Briefing</h2>
          <p className="text-sm text-muted-foreground">
            {briefing.paperCount} papers • {Math.round((briefing.avgScore || 0) * 100)}%
            avg score
          </p>
        </div>
        <BriefingList
          papers={visiblePapers}
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
