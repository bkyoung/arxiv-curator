/**
 * useHotkeys Hook
 *
 * Custom hook for handling keyboard shortcuts
 */

import { useEffect } from 'react';

export interface HotkeyConfig {
  key: string;
  action: () => void;
  preventDefault?: boolean;
}

/**
 * Hook for registering keyboard shortcuts
 *
 * @param hotkeys - Array of hotkey configurations
 *
 * @example
 * useHotkeys([
 *   { key: 'j', action: handleNext },
 *   { key: 'k', action: handlePrev },
 *   { key: '?', action: handleHelp, preventDefault: true },
 * ]);
 */
export function useHotkeys(hotkeys: HotkeyConfig[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ignore if typing in input or textarea
      const activeElement = document.activeElement;
      if (
        activeElement instanceof HTMLInputElement ||
        activeElement instanceof HTMLTextAreaElement
      ) {
        return;
      }

      // Check if any hotkey matches
      for (const hotkey of hotkeys) {
        if (event.key === hotkey.key) {
          if (hotkey.preventDefault) {
            event.preventDefault();
          }
          hotkey.action();
          break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [hotkeys]);
}
