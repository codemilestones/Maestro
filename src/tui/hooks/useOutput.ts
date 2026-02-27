import { useState, useEffect, useCallback } from 'react';
import { AgentController } from '../../agent/AgentController.js';
import { AgentEvent } from '../../shared/types.js';

const MAX_LINES = 100;

export interface UseOutputResult {
  lines: string[];
  clear: () => void;
}

export function useOutput(controller: AgentController, agentId: string | null): UseOutputResult {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    if (!agentId) {
      setLines([]);
      return;
    }

    // Load existing output
    const existingOutput = controller.getOutput(agentId);
    setLines(existingOutput.slice(-MAX_LINES));

    // Subscribe to new output
    const unsubscribe = controller.onEvent((event: AgentEvent) => {
      if (event.type === 'output' && event.agentId === agentId && typeof event.data === 'string') {
        setLines((prev) => {
          const newLines = [...prev, event.data as string];
          return newLines.slice(-MAX_LINES);
        });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [controller, agentId]);

  const clear = useCallback(() => {
    setLines([]);
  }, []);

  return { lines, clear };
}
