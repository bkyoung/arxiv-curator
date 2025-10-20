/**
 * ShortcutRow Component
 *
 * Displays a keyboard shortcut with its description
 */

'use client';

import { Badge } from '@/components/ui/badge';

interface ShortcutRowProps {
  keyName: string;
  description: string;
}

export function ShortcutRow({ keyName, description }: ShortcutRowProps) {
  return (
    <div className="flex items-center justify-between py-2">
      <Badge variant="outline" className="font-mono text-sm px-3 py-1">
        {keyName}
      </Badge>
      <span className="text-sm text-muted-foreground ml-4 flex-1">{description}</span>
    </div>
  );
}
