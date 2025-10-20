/**
 * BriefingList Component
 *
 * Scrollable list of paper cards
 */

'use client';

import { useEffect, useRef } from 'react';
import { PaperCard } from './PaperCard';
import { ScrollArea } from '@/components/ui/scroll-area';
import { BriefingPaper } from '@/types/briefing';

interface BriefingListProps {
  papers: BriefingPaper[];
  selectedIndex: number;
  onSelectPaper: (index: number) => void;
}

export function BriefingList({
  papers,
  selectedIndex,
  onSelectPaper,
}: BriefingListProps) {
  const cardRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Scroll selected card into view
  useEffect(() => {
    if (selectedIndex >= 0 && selectedIndex < cardRefs.current.length) {
      cardRefs.current[selectedIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [selectedIndex]);

  if (papers.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-center">
        <div>
          <p className="text-muted-foreground">No papers in this briefing</p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="flex flex-col gap-3 p-4">
        {papers.map((paper, index) => (
          <div
            key={paper.id}
            ref={(el) => {
              cardRefs.current[index] = el;
            }}
          >
            <PaperCard
              paper={paper}
              isActive={index === selectedIndex}
              onClick={() => onSelectPaper(index)}
            />
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
