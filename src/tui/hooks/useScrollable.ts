import { useState, useEffect, useCallback } from 'react';

interface UseScrollableOptions {
  totalLines: number;
  visibleLines: number;
  /** When true, auto-scroll to bottom on new content */
  autoScroll?: boolean;
  /** Enable/disable this hook */
  isActive?: boolean;
}

interface UseScrollableResult {
  scrollOffset: number;
  scrollUp: (lines?: number) => void;
  scrollDown: (lines?: number) => void;
  scrollToBottom: () => void;
  isAtBottom: boolean;
}

export function useScrollable({
  totalLines,
  visibleLines,
  autoScroll = true,
  isActive = true,
}: UseScrollableOptions): UseScrollableResult {
  const maxOffset = Math.max(0, totalLines - visibleLines);
  const [scrollOffset, setScrollOffset] = useState(maxOffset);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (autoScroll) {
      setScrollOffset(maxOffset);
    }
  }, [autoScroll, maxOffset]);

  const scrollUp = useCallback(
    (lines = 3) => {
      setScrollOffset((prev) => Math.max(0, prev - lines));
    },
    []
  );

  const scrollDown = useCallback(
    (lines = 3) => {
      setScrollOffset((prev) => Math.min(Math.max(0, totalLines - visibleLines), prev + lines));
    },
    [totalLines, visibleLines]
  );

  const scrollToBottom = useCallback(() => {
    setScrollOffset(Math.max(0, totalLines - visibleLines));
  }, [totalLines, visibleLines]);

  return {
    scrollOffset,
    scrollUp,
    scrollDown,
    scrollToBottom,
    isAtBottom: scrollOffset >= maxOffset,
  };
}
