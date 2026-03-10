import React, { useState, useMemo, useCallback } from 'react';
import { Box, Text, useApp, useStdout } from 'ink';
import { AgentController } from '../agent/AgentController.js';
import { isTerminalState } from '../agent/state/state.js';
import { WorktreeManager } from '../worktree/WorktreeManager.js';
import { generateTaskId } from '../shared/id.js';
import { loadConfig } from '../shared/config.js';
import { AgentList } from './components/AgentList.js';
import { Preview } from './components/Preview.js';
import { StatusBar } from './components/StatusBar.js';
import { StatusIndicator } from './components/StatusIndicator.js';
import { ConversationInput } from './components/ConversationInput.js';
import { HelpModal } from './components/HelpModal.js';
import { NewAgentModal } from './components/NewAgentModal.js';
import { useAgents } from './hooks/useAgents.js';
import { useOutput } from './hooks/useOutput.js';
import { useKeyboard } from './hooks/useKeyboard.js';
import { useScrollable } from './hooks/useScrollable.js';

interface AppProps {
  projectRoot?: string;
}

type ViewMode = 'list' | 'attached' | 'help' | 'new_agent';

export function App({ projectRoot }: AppProps) {
  const { exit } = useApp();
  const controller = useMemo(() => new AgentController(projectRoot), [projectRoot]);

  const { agents, selectedAgent, selectedIndex, selectByIndex, refresh } = useAgents(controller);
  const { lines } = useOutput(controller, selectedAgent?.id || null);

  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // In attached mode, only handle Esc (ConversationInput handles the rest)
  const keyboardHandlers = useMemo(
    () => {
      if (viewMode === 'attached') {
        return {
          escape: () => {
            setViewMode('list');
          },
        };
      }

      return {
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

        // Escape - close modals
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

        // Navigation (arrow keys)
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

        // Navigation (vim keys j/k)
        j: () => {
          if (viewMode === 'list') {
            selectByIndex(Math.min(agents.length - 1, selectedIndex + 1));
          }
        },
        k: () => {
          if (viewMode === 'list') {
            selectByIndex(Math.max(0, selectedIndex - 1));
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

        // Kill agent (x key, as per README)
        x: async () => {
          if (viewMode === 'list' && selectedAgent) {
            try {
              await controller.kill(selectedAgent.id);
              refresh();
            } catch {
              // Ignore errors in TUI
            }
          }
        },

        // New agent (n key)
        n: () => {
          if (viewMode === 'list') {
            setViewMode('new_agent');
          }
        },

        // Archive agent (a key)
        a: () => {
          if (viewMode === 'list' && selectedAgent && isTerminalState(selectedAgent.status)) {
            controller.archive(selectedAgent.id);
            refresh();
          }
        },
      };
    },
    [viewMode, selectedAgent, selectedIndex, agents.length, selectByIndex, refresh, controller, exit]
  );

  // Handle conversation input in attached view
  const handleConversationInput = useCallback(
    async (text: string) => {
      if (!selectedAgent) return;
      try {
        await controller.handleConversationInput(selectedAgent.id, text);
        refresh();
      } catch {
        // Ignore errors in TUI
      }
    },
    [controller, selectedAgent, refresh]
  );

  // Handle creating a new agent
  const handleCreateAgent = useCallback(
    async (prompt: string) => {
      try {
        const config = loadConfig(projectRoot);
        const worktreeManager = new WorktreeManager(projectRoot);
        const taskId = generateTaskId();

        // Create worktree
        const worktree = await worktreeManager.create({
          branch: taskId,
          base: config.worktree.defaultBase,
          taskId,
        });

        // Create agent
        const agent = await controller.create({
          prompt,
          worktreePath: worktree.path,
        });

        // Link agent to worktree
        controller.setWorktreeInfo(agent.id, worktree.id, worktree.branch);

        // Refresh and return to list
        refresh();
        setViewMode('list');
      } catch {
        // Return to list on error
        setViewMode('list');
      }
    },
    [controller, projectRoot, refresh]
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

  // New agent modal
  if (viewMode === 'new_agent') {
    return (
      <Box flexDirection="column" width="100%">
        <Header />
        <NewAgentModal
          onSubmit={handleCreateAgent}
          onCancel={() => setViewMode('list')}
        />
      </Box>
    );
  }

  // Attached mode - output + conversation input
  if (viewMode === 'attached' && selectedAgent) {
    return (
      <AttachedView
        agent={selectedAgent}
        lines={lines}
        onConversationInput={handleConversationInput}
        onDetach={() => setViewMode('list')}
      />
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

import { OutputLine } from '../shared/types.js';

interface AttachedViewProps {
  agent: import('../shared/types.js').AgentInfo;
  lines: OutputLine[];
  onConversationInput: (text: string) => void;
  onDetach: () => void;
}

function AttachedView({ agent, lines, onConversationInput, onDetach }: AttachedViewProps) {
  const { stdout } = useStdout();
  const termHeight = stdout?.rows || 24;
  // Reserve 3 for header, 3 for input area
  const visibleLines = Math.max(5, termHeight - 6);

  const { scrollOffset, isAtBottom } = useScrollable({
    totalLines: lines.length,
    visibleLines,
    autoScroll: true,
    isActive: true,
  });

  const displayLines = lines.slice(scrollOffset, scrollOffset + visibleLines);

  return (
    <Box flexDirection="column" width="100%">
      <Box borderStyle="single" borderColor="cyan" paddingX={1} justifyContent="space-between">
        <Box>
          <Text bold color="cyan">
            {agent.name || agent.id}
          </Text>
          <Text> </Text>
          <StatusIndicator status={agent.status} />
        </Box>
        <Box>
          {lines.length > visibleLines && !isAtBottom && (
            <Text dimColor>
              {`${scrollOffset + 1}-${Math.min(scrollOffset + visibleLines, lines.length)}/${lines.length}  `}
            </Text>
          )}
          <Text dimColor>Esc to detach</Text>
        </Box>
      </Box>
      <Box flexDirection="column" flexGrow={1} paddingX={1}>
        {displayLines.map((line, i) => (
          <Text key={scrollOffset + i} wrap="truncate">
            {line.role === 'user' ? (
              <Text color="green" bold>{'> '}{line.content}</Text>
            ) : (
              <Text>{line.content}</Text>
            )}
          </Text>
        ))}
      </Box>
      <ConversationInput
        agent={agent}
        onSubmit={onConversationInput}
      />
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
