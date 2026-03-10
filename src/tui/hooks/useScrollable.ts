import { useState, useEffect, useCallback } from 'react';
import { useStdin } from 'ink';

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
  const { stdin } = useStdin();

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

  // Mouse scroll support via raw stdin escape sequences
  useEffect(() => {
    if (!isActive || !stdin) return;

    // Enable SGR mouse tracking (scroll wheel reporting)
    process.stdout.write('\x1b[?1000h'); // Enable mouse tracking
    process.stdout.write('\x1b[?1006h'); // Enable SGR extended mode

    const handleData = (data: Buffer) => {
      const str = data.toString();

      // SGR mouse format: \x1b[<Btn;X;Ym or \x1b[<Btn;X;YM
      // Btn 64 = scroll up, Btn 65 = scroll down
      const sgrMatch = str.match(/\x1b\[<(\d+);(\d+);(\d+)[Mm]/);
      if (sgrMatch) {
        const btn = parseInt(sgrMatch[1]!, 10);
        if (btn === 64) {
          scrollUp(3);
        } else if (btn === 65) {
          scrollDown(3);
        }
      }
    };

    stdin.on('data', handleData);

    return () => {
      stdin.off('data', handleData);
      // Disable mouse tracking on cleanup
      process.stdout.write('\x1b[?1006l');
      process.stdout.write('\x1b[?1000l');
    };
  }, [isActive, stdin, scrollUp, scrollDown]);

  return {
    scrollOffset,
    scrollUp,
    scrollDown,
    scrollToBottom,
    isAtBottom: scrollOffset >= maxOffset,
  };
}
