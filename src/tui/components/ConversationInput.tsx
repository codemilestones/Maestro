import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';
import { AgentInfo } from '../../shared/types.js';
import { isTerminalState } from '../../agent/state/state.js';

interface ConversationInputProps {
  agent: AgentInfo;
  onSubmit: (text: string) => void;
}

function getPlaceholder(agent: AgentInfo): string {
  if (agent.status === 'waiting_input') {
    return 'Type your response...';
  }
  if (isTerminalState(agent.status)) {
    if (!agent.sessionId) {
      return 'No session available for resume';
    }
    return 'Continue conversation...';
  }
  return 'Agent is running...';
}

function isInputEnabled(agent: AgentInfo): boolean {
  if (agent.status === 'waiting_input') return true;
  if (isTerminalState(agent.status) && agent.sessionId) return true;
  return false;
}

export function ConversationInput({ agent, onSubmit }: ConversationInputProps) {
  const [input, setInput] = useState('');
  const enabled = isInputEnabled(agent);
  const placeholder = getPlaceholder(agent);

  useInput(
    useCallback(
      (char, key) => {
        if (!enabled) return;

        if (key.return) {
          if (input.trim()) {
            onSubmit(input.trim());
            setInput('');
          }
          return;
        }

        // Esc is handled by parent (App.tsx), don't consume it here

        if (key.backspace || key.delete) {
          setInput((prev) => prev.slice(0, -1));
          return;
        }

        if (char && !key.ctrl && !key.meta && !key.escape) {
          setInput((prev) => prev + char);
        }
      },
      [enabled, input, onSubmit]
    )
  );

  return (
    <Box flexDirection="column" borderStyle="single" borderColor={enabled ? 'cyan' : 'gray'} paddingX={1}>
      <Box>
        <Text color={enabled ? 'cyan' : 'gray'}>{'> '}</Text>
        {input ? (
          <>
            <Text>{input}</Text>
            {enabled && <Text color="cyan">▋</Text>}
          </>
        ) : (
          <Text dimColor>{placeholder}</Text>
        )}
      </Box>
      <Box>
        <Text dimColor>
          {enabled ? 'Enter to send, Esc to detach' : 'Esc to detach'}
        </Text>
      </Box>
    </Box>
  );
}
