import { useState, useEffect, useCallback } from 'react';
import { AgentInfo, AgentEvent } from '../../shared/types.js';
import { AgentControllerPTY } from '../../agent/AgentControllerPTY.js';

export interface UseAgentsResult {
  agents: AgentInfo[];
  selectedAgent: AgentInfo | null;
  selectedIndex: number;
  selectAgent: (id: string) => void;
  selectByIndex: (index: number) => void;
  refresh: () => void;
}

export function useAgents(controller: AgentControllerPTY): UseAgentsResult {
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const refresh = useCallback(() => {
    setAgents(controller.listAll());
  }, [controller]);

  useEffect(() => {
    // Initial load
    refresh();

    // Subscribe to events
    const unsubscribe = controller.onEvent((event: AgentEvent) => {
      if (event.type === 'status_change') {
        refresh();
      }
    });

    // Periodic refresh as backup
    const interval = setInterval(refresh, 2000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [controller, refresh]);

  const selectAgent = useCallback(
    (id: string) => {
      const index = agents.findIndex((a) => a.id === id);
      if (index !== -1) {
        setSelectedIndex(index);
      }
    },
    [agents]
  );

  const selectByIndex = useCallback(
    (index: number) => {
      if (index >= 0 && index < agents.length) {
        setSelectedIndex(index);
      }
    },
    [agents.length]
  );

  const selectedAgent = agents[selectedIndex] || null;

  return {
    agents,
    selectedAgent,
    selectedIndex,
    selectAgent,
    selectByIndex,
    refresh,
  };
}
