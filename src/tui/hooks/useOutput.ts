import { useState, useEffect, useCallback } from 'react';
import { AgentController } from '../../agent/AgentController.js';
import { AgentEvent, OutputLine } from '../../shared/types.js';
import { getLogger } from '../../shared/logger.js';

const MAX_LINES = 200;
const logger = getLogger();

export interface UseOutputResult {
  lines: OutputLine[];
  clear: () => void;
}

export function useOutput(controller: AgentController, agentId: string | null): UseOutputResult {
  const [lines, setLines] = useState<OutputLine[]>([]);

  useEffect(() => {
    if (!agentId) {
      logger.debug(`useOutput: no agentId, clearing lines`);
      setLines([]);
      return;
    }

    logger.debug(`useOutput: subscribing to agent output`, { agentId });

    // Load existing output
    const existingOutput = controller.getOutput(agentId);
    logger.debug(`useOutput: loaded existing output`, { agentId, lineCount: existingOutput.length });
    setLines(existingOutput.slice(-MAX_LINES));

    // Subscribe to new output
    const unsubscribe = controller.onEvent((event: AgentEvent) => {
      if (event.type === 'output' && event.agentId === agentId && event.data) {
        const line = event.data as OutputLine;
        logger.debug(`useOutput: received output event`, { agentId, role: line.role });
        setLines((prev) => {
          const newLines = [...prev, line];
          return newLines.slice(-MAX_LINES);
        });
      }
    });

    logger.debug(`useOutput: subscribed to events`, { agentId });

    return () => {
      logger.debug(`useOutput: unsubscribing`, { agentId });
      unsubscribe();
    };
  }, [controller, agentId]);

  const clear = useCallback(() => {
    logger.debug(`useOutput: clearing lines`);
    setLines([]);
  }, []);

  return { lines, clear };
}
