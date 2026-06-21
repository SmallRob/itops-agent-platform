import { useEffect, useCallback } from 'react';

interface UseEscapeKeyOptions {
  onEscape: () => void;
  enabled?: boolean;
}

/**
 * Hook to handle ESC key press for closing modals/dialogs
 */
export function useEscapeKey({ onEscape, enabled = true }: UseEscapeKeyOptions) {
  const handleEscape = useCallback((event: KeyboardEvent) => {
    if (event.key === 'Escape' && enabled) {
      onEscape();
    }
  }, [onEscape, enabled]);

  useEffect(() => {
    if (enabled) {
      document.addEventListener('keydown', handleEscape);
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [handleEscape, enabled]);
}
