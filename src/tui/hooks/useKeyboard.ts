import { useInput } from 'ink';
import { useCallback } from 'react';

export interface KeyboardHandlers {
  [key: string]: () => void;
}

export function useKeyboard(handlers: KeyboardHandlers): void {
  useInput(
    useCallback(
      (input, key) => {
        // Handle special keys
        if (key.escape && handlers['escape']) {
          handlers['escape']();
          return;
        }

        if (key.return && handlers['enter']) {
          handlers['enter']();
          return;
        }

        if (key.upArrow && handlers['up']) {
          handlers['up']();
          return;
        }

        if (key.downArrow && handlers['down']) {
          handlers['down']();
          return;
        }

        // Handle character keys
        const handler = handlers[input.toLowerCase()];
        if (handler) {
          handler();
        }

        // Handle number keys (1-9)
        if (/^[1-9]$/.test(input)) {
          const numHandler = handlers[`num${input}`];
          if (numHandler) {
            numHandler();
          }
        }
      },
      [handlers]
    )
  );
}
