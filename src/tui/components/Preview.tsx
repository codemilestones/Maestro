import React from 'react';
import { Box, Text } from 'ink';
import { AgentInfo, OutputLine } from '../../shared/types.js';
import { useScrollable } from '../hooks/useScrollable.js';

interface PreviewProps {
  agent: AgentInfo | null;
  lines: OutputLine[];
  maxLines?: number;
  isActive?: boolean;
}

export function Preview({ agent, lines, maxLines = 15, isActive = true }: PreviewProps) {
  const { scrollOffset, isAtBottom } = useScrollable({
    totalLines: lines.length,
    visibleLines: maxLines,
    autoScroll: true,
    isActive,
  });

  const displayLines = lines.slice(scrollOffset, scrollOffset + maxLines);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" height={maxLines + 2}>
      <Box paddingX={1} justifyContent="space-between">
        <Text bold>
          PREVIEW
          {agent && (
            <Text dimColor> [{agent.name || agent.id}]</Text>
          )}
        </Text>
        {lines.length > maxLines && (
          <Text dimColor>
            {isAtBottom ? '(end)' : `↑↓ scroll (${scrollOffset + 1}-${Math.min(scrollOffset + maxLines, lines.length)}/${lines.length})`}
          </Text>
        )}
      </Box>
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {displayLines.length === 0 ? (
          <Text dimColor>
            {agent ? 'Waiting for output...' : 'Select an agent to view output'}
          </Text>
        ) : (
          displayLines.map((line, index) => (
            <Text key={scrollOffset + index} wrap="truncate">
              {line.role === 'user' ? (
                <Text color="green" bold>{'> '}{line.content}</Text>
              ) : (
                <Text>{line.content}</Text>
              )}
            </Text>
          ))
        )}
      </Box>
    </Box>
  );
}
