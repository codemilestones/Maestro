import React from 'react';
import { Box, Text } from 'ink';
import { AgentInfo } from '../../shared/types.js';

interface PreviewProps {
  agent: AgentInfo | null;
  lines: string[];
  maxLines?: number;
}

export function Preview({ agent, lines, maxLines = 15 }: PreviewProps) {
  const displayLines = lines.slice(-maxLines);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" height={maxLines + 2}>
      <Box paddingX={1}>
        <Text bold>
          PREVIEW
          {agent && (
            <Text dimColor> [{agent.name || agent.id}]</Text>
          )}
        </Text>
      </Box>
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {displayLines.length === 0 ? (
          <Text dimColor>
            {agent ? 'Waiting for output...' : 'Select an agent to view output'}
          </Text>
        ) : (
          displayLines.map((line, index) => (
            <Text key={index} wrap="truncate">
              {line}
            </Text>
          ))
        )}
      </Box>
    </Box>
  );
}
