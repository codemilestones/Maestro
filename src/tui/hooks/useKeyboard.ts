import { useInput } from 'ink';
import { useCallback } from 'react';
import { getLogger } from '../../shared/logger.js';

export interface KeyboardHandlers {
  [key: string]: () => void;
}

const logger = getLogger();

export function useKeyboard(handlers: KeyboardHandlers): void {
  useInput(
    useCallback(
      (input, key) => {
        logger.debug(`Key pressed`, { input, key });

        // Handle special keys
        if (key.escape && handlers['escape']) {
          logger.debug(`Handling escape key`);
          handlers['escape']();
          return;
        }

        if (key.return && handlers['enter']) {
          logger.debug(`Handling enter key`);
          handlers['enter']();
          return;
        }

        if (key.upArrow && handlers['up']) {
          logger.debug(`Handling up arrow`);
          handlers['up']();
          return;
        }

        if (key.downArrow && handlers['down']) {
          logger.debug(`Handling down arrow`);
          handlers['down']();
          return;
        }

        // Handle character keys
        const handler = handlers[input.toLowerCase()];
        if (handler) {
          logger.debug(`Handling character key`, { key: input.toLowerCase() });
          handler();
        }

        // Handle number keys (1-9)
        if (/^[1-9]$/.test(input)) {
          const numHandler = handlers[`num${input}`];
          if (numHandler) {
            logger.debug(`Handling number key`, { num: input });
            numHandler();
          }
        }
      },
      [handlers]
    )
  );
}
