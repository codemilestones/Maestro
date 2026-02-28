import React from 'react';
import { Box, Text } from 'ink';
import { AgentInfo } from '../../shared/types.js';

interface StatusBarProps {
  agents: AgentInfo[];
}

export function StatusBar({ agents }: StatusBarProps) {
  const running = agents.filter((a) => a.status === 'running').length;
  const waiting = agents.filter((a) => a.status === 'waiting_input').length;
  const finished = agents.filter((a) => a.status === 'finished').length;
  const failed = agents.filter((a) => a.status === 'failed').length;

  return (
    <Box borderStyle="single" borderColor="gray" justifyContent="space-between" paddingX={1}>
      <Box>
        <Text dimColor>
          Total: {agents.length}
        </Text>
        <Text> | </Text>
        <Text color="green">{running} running</Text>
        <Text> | </Text>
        <Text color="cyan">{waiting} waiting</Text>
        <Text> | </Text>
        <Text color="blue">{finished} done</Text>
        <Text> | </Text>
        <Text color="red">{failed} failed</Text>
      </Box>
      <Box>
        <Text dimColor>
          [1-9] Select  [Enter] Attach  [x] Kill  [n] New  [q] Quit  [?] Help
        </Text>
      </Box>
    </Box>
  );
}
