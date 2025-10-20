/**
 * HelpModal Component
 *
 * Displays keyboard shortcuts help dialog
 */

'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ShortcutRow } from '@/components/ShortcutRow';
import { Separator } from '@/components/ui/separator';

interface HelpModalProps {
  open: boolean;
  onClose: () => void;
}

const navigationShortcuts = [
  { key: 'j', description: 'Next paper' },
  { key: 'k', description: 'Previous paper' },
];

const actionShortcuts = [
  { key: 's', description: 'Save paper' },
  { key: 'h', description: 'Hide paper' },
  { key: 'Enter', description: 'Open PDF in new tab' },
  { key: '?', description: 'Show this help' },
  { key: 'Escape', description: 'Close dialogs' },
];

export function HelpModal({ open, onClose }: HelpModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
          <DialogDescription>
            Navigate and interact with papers using your keyboard
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Navigation Section */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Navigation</h3>
            <div className="space-y-1">
              {navigationShortcuts.map((shortcut) => (
                <ShortcutRow
                  key={shortcut.key}
                  keyName={shortcut.key}
                  description={shortcut.description}
                />
              ))}
            </div>
          </div>

          <Separator />

          {/* Actions Section */}
          <div>
            <h3 className="font-semibold text-sm mb-2">Actions</h3>
            <div className="space-y-1">
              {actionShortcuts.map((shortcut) => (
                <ShortcutRow
                  key={shortcut.key}
                  keyName={shortcut.key}
                  description={shortcut.description}
                />
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
