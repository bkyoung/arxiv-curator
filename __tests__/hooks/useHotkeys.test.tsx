/**
 * useHotkeys Hook Tests
 *
 * Tests for keyboard navigation hook
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useHotkeys } from '@/hooks/useHotkeys';

describe('useHotkeys', () => {
  afterEach(() => {
    // Clear any remaining elements
    document.body.innerHTML = '';
    // Reset active element property if it was overridden
    const descriptor = Object.getOwnPropertyDescriptor(document, 'activeElement');
    if (descriptor && descriptor.configurable) {
      delete (document as any).activeElement;
    }
  });
  it('should call action when key is pressed', () => {
    const handleJ = vi.fn();

    renderHook(() =>
      useHotkeys([
        { key: 'j', action: handleJ },
      ])
    );

    // Simulate keydown event
    const event = new KeyboardEvent('keydown', { key: 'j' });
    document.dispatchEvent(event);

    expect(handleJ).toHaveBeenCalledTimes(1);
  });

  it('should prevent default when preventDefault is true', () => {
    const handleEnter = vi.fn();

    renderHook(() =>
      useHotkeys([
        { key: 'Enter', action: handleEnter, preventDefault: true },
      ])
    );

    const event = new KeyboardEvent('keydown', { key: 'Enter' });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    document.dispatchEvent(event);

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(handleEnter).toHaveBeenCalledTimes(1);
  });

  it('should not prevent default when preventDefault is false', () => {
    const handleK = vi.fn();

    renderHook(() =>
      useHotkeys([
        { key: 'k', action: handleK, preventDefault: false },
      ])
    );

    const event = new KeyboardEvent('keydown', { key: 'k' });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');
    document.dispatchEvent(event);

    expect(preventDefaultSpy).not.toHaveBeenCalled();
    expect(handleK).toHaveBeenCalledTimes(1);
  });

  it('should ignore hotkeys when typing in input element', () => {
    const handleS = vi.fn();

    renderHook(() =>
      useHotkeys([
        { key: 's', action: handleS },
      ])
    );

    // Create input element and focus it
    const input = document.createElement('input');
    document.body.appendChild(input);
    Object.defineProperty(document, 'activeElement', {
      value: input,
      writable: true,
      configurable: true,
    });

    const event = new KeyboardEvent('keydown', { key: 's' });
    document.dispatchEvent(event);

    expect(handleS).not.toHaveBeenCalled();

    // Cleanup
    document.body.removeChild(input);
  });

  it('should ignore hotkeys when typing in textarea element', () => {
    const handleH = vi.fn();

    renderHook(() =>
      useHotkeys([
        { key: 'h', action: handleH },
      ])
    );

    // Create textarea element and focus it
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    Object.defineProperty(document, 'activeElement', {
      value: textarea,
      writable: true,
      configurable: true,
    });

    const event = new KeyboardEvent('keydown', { key: 'h' });
    document.dispatchEvent(event);

    expect(handleH).not.toHaveBeenCalled();

    // Cleanup
    document.body.removeChild(textarea);
  });

  it('should handle multiple hotkeys', () => {
    const handleJ = vi.fn();
    const handleK = vi.fn();
    const handleS = vi.fn();

    // Use stable array reference
    const hotkeys = [
      { key: 'j', action: handleJ },
      { key: 'k', action: handleK },
      { key: 's', action: handleS },
    ];

    renderHook(() => useHotkeys(hotkeys));

    // Press j
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
    expect(handleJ).toHaveBeenCalledTimes(1);
    expect(handleK).not.toHaveBeenCalled();
    expect(handleS).not.toHaveBeenCalled();

    // Press k
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k' }));
    expect(handleJ).toHaveBeenCalledTimes(1);
    expect(handleK).toHaveBeenCalledTimes(1);
    expect(handleS).not.toHaveBeenCalled();

    // Press s
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));
    expect(handleJ).toHaveBeenCalledTimes(1);
    expect(handleK).toHaveBeenCalledTimes(1);
    expect(handleS).toHaveBeenCalledTimes(1);
  });

  it('should cleanup event listener on unmount', () => {
    const handleJ = vi.fn();
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() =>
      useHotkeys([
        { key: 'j', action: handleJ },
      ])
    );

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

    // Verify handler no longer called
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'j' }));
    expect(handleJ).not.toHaveBeenCalled();
  });
});
