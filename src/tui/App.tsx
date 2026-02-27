import React, { useState, useMemo } from 'react';
import { Box, Text, useApp } from 'ink';
import { AgentController } from '../agent/AgentController.js';
import { AgentList } from './components/AgentList.js';
import { Preview } from './components/Preview.js';
import { StatusBar } from './components/StatusBar.js';
import { HelpModal } from './components/HelpModal.js';
import { useAgents } from './hooks/useAgents.js';
import { useOutput } from './hooks/useOutput.js';
import { useKeyboard } from './hooks/useKeyboard.js';

interface AppProps {
  projectRoot?: string;
}

type ViewMode = 'list' | 'attached' | 'help';

export function App({ projectRoot }: AppProps) {
  const { exit } = useApp();
  const controller = useMemo(() => new AgentController(projectRoot), [projectRoot]);

  const { agents, selectedAgent, selectedIndex, selectByIndex, refresh } = useAgents(controller);
  const { lines } = useOutput(controller, selectedAgent?.id || null);

  const [viewMode, setViewMode] = useState<ViewMode>('list');

  const keyboardHandlers = useMemo(
    () => ({
      // Quit
      q: () => {
        if (viewMode === 'list') {
          exit();
        }
      },

      // Help
      '?': () => {
        setViewMode(viewMode === 'help' ? 'list' : 'help');
      },

      // Escape - close modals or exit attached mode
      escape: () => {
        if (viewMode !== 'list') {
          setViewMode('list');
        }
      },

      // Enter - attach to agent
      enter: () => {
        if (viewMode === 'list' && selectedAgent) {
          setViewMode('attached');
        } else if (viewMode === 'help') {
          setViewMode('list');
        }
      },

      // Navigation
      up: () => {
        if (viewMode === 'list') {
          selectByIndex(Math.max(0, selectedIndex - 1));
        }
      },
      down: () => {
        if (viewMode === 'list') {
          selectByIndex(Math.min(agents.length - 1, selectedIndex + 1));
        }
      },

      // Number keys 1-9
      ...Object.fromEntries(
        Array.from({ length: 9 }, (_, i) => [
          `num${i + 1}`,
          () => {
            if (viewMode === 'list') {
              selectByIndex(i);
            }
          },
        ])
      ),

      // Refresh
      r: () => {
        refresh();
      },

      // Kill
      k: async () => {
        if (viewMode === 'list' && selectedAgent) {
          try {
            await controller.kill(selectedAgent.id);
            refresh();
          } catch {
            // Ignore errors in TUI
          }
        }
      },
    }),
    [viewMode, selectedAgent, selectedIndex, agents.length, selectByIndex, refresh, controller, exit]
  );

  useKeyboard(keyboardHandlers);

  // Help modal
  if (viewMode === 'help') {
    return (
      <Box flexDirection="column" width="100%">
        <Header />
        <HelpModal onClose={() => setViewMode('list')} />
      </Box>
    );
  }

  // Attached mode - full screen output
  if (viewMode === 'attached' && selectedAgent) {
    return (
      <Box flexDirection="column" width="100%">
        <Box borderStyle="single" borderColor="cyan" paddingX={1}>
          <Text bold color="cyan">
            Attached to: {selectedAgent.name || selectedAgent.id}
          </Text>
          <Text dimColor> (Press Esc to detach)</Text>
        </Box>
        <Box flexDirection="column" flexGrow={1} paddingX={1}>
          {lines.slice(-30).map((line, i) => (
            <Text key={i}>{line}</Text>
          ))}
        </Box>
      </Box>
    );
  }

  // Main list view
  return (
    <Box flexDirection="column" width="100%">
      <Header />
      <AgentList agents={agents} selectedIndex={selectedIndex} />
      <Preview agent={selectedAgent} lines={lines} />
      <StatusBar agents={agents} />
    </Box>
  );
}

function Header() {
  return (
    <Box borderStyle="single" borderColor="gray" justifyContent="space-between" paddingX={1}>
      <Text bold color="cyan">Maestro</Text>
      <Text dimColor>v1.0.0</Text>
    </Box>
  );
}
