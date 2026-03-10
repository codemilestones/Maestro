import React, { useState, useEffect } from 'react';
import { Text } from 'ink';
import { AgentStatus } from '../../shared/types.js';

interface StatusIndicatorProps {
  status: AgentStatus;
}

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

export function StatusIndicator({ status }: StatusIndicatorProps) {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (status !== 'running' && status !== 'starting') return;

    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % SPINNER_FRAMES.length);
    }, 80);

    return () => clearInterval(timer);
  }, [status]);

  switch (status) {
    case 'running':
    case 'starting':
      return <Text color="cyan">{SPINNER_FRAMES[frame]} Running...</Text>;
    case 'waiting_input':
      return <Text color="yellow">● Waiting for input...</Text>;
    case 'finished':
      return <Text color="green">✓ Completed</Text>;
    case 'failed':
      return <Text color="red">✗ Failed</Text>;
    case 'pending':
      return <Text dimColor>◌ Pending</Text>;
    default:
      return <Text dimColor>{status}</Text>;
  }
}
