import React, { useState, useCallback } from 'react';
import { Box, Text, useInput } from 'ink';

interface NewAgentModalProps {
  onSubmit: (prompt: string) => void;
  onCancel: () => void;
}

export function NewAgentModal({ onSubmit, onCancel }: NewAgentModalProps) {
  const [prompt, setPrompt] = useState('');

  useInput(
    useCallback(
      (input, key) => {
        if (key.escape) {
          onCancel();
          return;
        }

        if (key.return) {
          if (prompt.trim()) {
            onSubmit(prompt.trim());
          }
          return;
        }

        if (key.backspace || key.delete) {
          setPrompt((prev) => prev.slice(0, -1));
          return;
        }

        // Add printable characters
        if (input && !key.ctrl && !key.meta) {
          setPrompt((prev) => prev + input);
        }
      },
      [prompt, onSubmit, onCancel]
    )
  );

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="cyan"
      padding={1}
    >
      <Box justifyContent="center" marginBottom={1}>
        <Text bold color="cyan">Create New Agent</Text>
      </Box>

      <Box flexDirection="column" gap={1}>
        <Text>Enter task description for the new agent:</Text>

        <Box borderStyle="single" borderColor="gray" paddingX={1}>
          <Text>{prompt || ' '}</Text>
          <Text color="cyan">▋</Text>
        </Box>

        <Text dimColor>
          The agent will be created in a new worktree and start executing immediately.
        </Text>
      </Box>

      <Box marginTop={1} justifyContent="space-between">
        <Text dimColor>Press Enter to create, Esc to cancel</Text>
      </Box>
    </Box>
  );
}
