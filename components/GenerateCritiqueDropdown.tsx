/**
 * GenerateCritiqueDropdown Component
 *
 * Dropdown menu to trigger critical analysis generation at different depths
 * Phase 5: Critical Analysis
 */

'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FileSearch, Zap, GitCompare, ChevronDown } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { useEffect } from 'react';

interface GenerateCritiqueDropdownProps {
  paperId: string;
  showCostWarning?: boolean;
  onAnalysisRequested?: (depth: 'A' | 'B' | 'C', jobId: string | null) => void;
}

const DEPTH_OPTIONS = [
  {
    depth: 'A' as const,
    label: 'Quick Critique (A)',
    description: 'Fast analysis (~1 min)',
    icon: Zap,
    estimatedTime: '~1 min',
    usesCloudLLM: false,
  },
  {
    depth: 'B' as const,
    label: 'Compare to Similar (B)',
    description: 'Comparison with related papers (~2 min)',
    icon: GitCompare,
    estimatedTime: '~2 min',
    usesCloudLLM: true,
  },
  {
    depth: 'C' as const,
    label: 'Deep Analysis (C)',
    description: 'Comprehensive critique (~5 min)',
    icon: FileSearch,
    estimatedTime: '~5 min',
    usesCloudLLM: true,
  },
] as const;

export function GenerateCritiqueDropdown({
  paperId,
  showCostWarning = false,
  onAnalysisRequested,
}: GenerateCritiqueDropdownProps) {
  const requestAnalysisMutation = trpc.analysis.requestAnalysis.useMutation();

  // Call callback when mutation succeeds
  useEffect(() => {
    if (requestAnalysisMutation.data && onAnalysisRequested) {
      const { cached, jobId, analysis } = requestAnalysisMutation.data;

      if (cached && analysis) {
        // Analysis was cached, no job ID
        onAnalysisRequested(analysis.depth as 'A' | 'B' | 'C', null);
      } else if (jobId) {
        // New job was created
        // Extract depth from the mutation variables
        const variables = requestAnalysisMutation.variables as { paperId: string; depth: 'A' | 'B' | 'C' } | undefined;
        const depth = variables?.depth || 'A';
        onAnalysisRequested(depth, jobId);
      }
    }
  }, [requestAnalysisMutation.data, onAnalysisRequested, requestAnalysisMutation.variables]);

  const handleSelectDepth = (depth: 'A' | 'B' | 'C') => {
    requestAnalysisMutation.mutate({
      paperId,
      depth,
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={requestAnalysisMutation.isPending}>
          <FileSearch className="h-4 w-4 mr-2" />
          Generate Critique
          <ChevronDown className="h-4 w-4 ml-2" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64 bg-background border-border shadow-lg">
        {DEPTH_OPTIONS.map(({ depth, label, description, icon: Icon, estimatedTime, usesCloudLLM }) => (
          <DropdownMenuItem
            key={depth}
            onClick={() => handleSelectDepth(depth)}
            className="flex items-start gap-3 py-3 cursor-pointer"
          >
            <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <div className="flex-1 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-medium">{label}</span>
                <span className="text-xs text-muted-foreground">{estimatedTime}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {description}
              </p>
              {showCostWarning && usesCloudLLM && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Uses cloud LLM
                </p>
              )}
            </div>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
