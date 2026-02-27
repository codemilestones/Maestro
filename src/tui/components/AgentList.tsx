import React from 'react';
import { Box, Text } from 'ink';
import { AgentInfo } from '../../shared/types.js';
import { getStatusIcon, getStatusColor, getStatusText } from '../../agent/state/state.js';

interface AgentListProps {
  agents: AgentInfo[];
  selectedIndex: number;
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);

  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

function getRunningDuration(agent: AgentInfo): string {
  const startTime = agent.startedAt || agent.createdAt;
  const endTime = agent.finishedAt || new Date();
  return formatDuration(endTime.getTime() - startTime.getTime());
}

function StatusBadge({ status }: { status: AgentInfo['status'] }) {
  const icon = getStatusIcon(status);
  const color = getStatusColor(status);
  const text = getStatusText(status);

  return (
    <Text color={color}>
      {icon} {text.padEnd(8)}
    </Text>
  );
}

function AgentRow({ agent, index, isSelected }: { agent: AgentInfo; index: number; isSelected: boolean }) {
  const bgColor = isSelected ? 'blue' : undefined;
  const promptPreview = agent.prompt.slice(0, 35) + (agent.prompt.length > 35 ? '...' : '');

  return (
    <Box paddingX={1}>
      <Text backgroundColor={bgColor} color={isSelected ? 'white' : undefined}>
        <Text dimColor>[{index + 1}]</Text>
        {' '}
        <StatusBadge status={agent.status} />
        {' '}
        <Text bold>{(agent.branch || agent.id).slice(0, 20).padEnd(20)}</Text>
        {' '}
        <Text dimColor>{getRunningDuration(agent).padStart(8)}</Text>
        {' '}
        <Text>{promptPreview}</Text>
      </Text>
    </Box>
  );
}

export function AgentList({ agents, selectedIndex }: AgentListProps) {
  if (agents.length === 0) {
    return (
      <Box flexDirection="column" paddingX={1}>
        <Text dimColor>No agents found.</Text>
        <Text dimColor>Press 'n' to create a new agent.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray">
      <Box paddingX={1}>
        <Text bold>AGENTS ({agents.length})</Text>
      </Box>
      {agents.map((agent, index) => (
        <AgentRow
          key={agent.id}
          agent={agent}
          index={index}
          isSelected={index === selectedIndex}
        />
      ))}
    </Box>
  );
}
