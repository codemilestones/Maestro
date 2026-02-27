import React from 'react';
import { Box, Text } from 'ink';

interface HelpModalProps {
  onClose: () => void;
}

export function HelpModal({ onClose }: HelpModalProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="cyan"
      padding={1}
    >
      <Box justifyContent="center" marginBottom={1}>
        <Text bold color="cyan">Maestro Keyboard Shortcuts</Text>
      </Box>

      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text bold>Navigation</Text>
          <Text>  <Text color="yellow">1-9</Text>     Select agent by number</Text>
          <Text>  <Text color="yellow">↑/↓</Text>     Move selection up/down</Text>
          <Text>  <Text color="yellow">Enter</Text>   Attach to selected agent</Text>
          <Text>  <Text color="yellow">Esc</Text>     Exit attached mode / Close modal</Text>
        </Box>

        <Box flexDirection="column">
          <Text bold>Actions</Text>
          <Text>  <Text color="yellow">n</Text>       Create new agent</Text>
          <Text>  <Text color="yellow">k</Text>       Kill selected agent</Text>
          <Text>  <Text color="yellow">p</Text>       Create PR for agent</Text>
          <Text>  <Text color="yellow">l</Text>       View full logs</Text>
          <Text>  <Text color="yellow">r</Text>       Refresh status</Text>
        </Box>

        <Box flexDirection="column">
          <Text bold>Application</Text>
          <Text>  <Text color="yellow">?</Text>       Show this help</Text>
          <Text>  <Text color="yellow">q</Text>       Quit Maestro TUI</Text>
        </Box>
      </Box>

      <Box marginTop={1} justifyContent="center">
        <Text dimColor>Press any key to close</Text>
      </Box>
    </Box>
  );
}
