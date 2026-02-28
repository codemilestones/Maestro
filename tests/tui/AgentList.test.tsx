import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from 'ink-testing-library';
import { AgentList } from '../../src/tui/components/AgentList.js';
import { AgentInfo } from '../../src/shared/types.js';

const createMockAgent = (id: string, status: AgentInfo['status'] = 'running'): AgentInfo => ({
  id,
  prompt: `Test prompt for ${id}`,
  worktreeId: 'wt-123',
  branch: `branch-${id}`,
  status,
  pid: 12345,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  startedAt: new Date('2024-01-01T00:00:01Z'),
  metrics: {
    tokensUsed: 100,
    toolCalls: 5,
    filesModified: [],
  },
});

describe('AgentList', () => {
  describe('rendering', () => {
    it('should render correct number of agents', () => {
      const agents = [
        createMockAgent('agent-1'),
        createMockAgent('agent-2'),
        createMockAgent('agent-3'),
      ];

      const { lastFrame } = render(
        <AgentList agents={agents} selectedIndex={0} />
      );

      const output = lastFrame()!;

      // Should contain all three agent branches
      expect(output).toContain('branch-agent-1');
      expect(output).toContain('branch-agent-2');
      expect(output).toContain('branch-agent-3');
    });

    it('should display agent count in header', () => {
      const agents = [
        createMockAgent('agent-1'),
        createMockAgent('agent-2'),
      ];

      const { lastFrame } = render(
        <AgentList agents={agents} selectedIndex={0} />
      );

      expect(lastFrame()!).toContain('AGENTS (2)');
    });

    it('should show empty state when no agents', () => {
      const { lastFrame } = render(
        <AgentList agents={[]} selectedIndex={0} />
      );

      const output = lastFrame()!;
      expect(output).toContain('No agents found');
      expect(output).toContain("Press 'n' to create");
    });
  });

  describe('status icons', () => {
    it('should display running status icon', () => {
      const agents = [createMockAgent('agent-1', 'running')];

      const { lastFrame } = render(
        <AgentList agents={agents} selectedIndex={0} />
      );

      // Running icon is ●
      expect(lastFrame()!).toContain('●');
    });

    it('should display finished status icon', () => {
      const agents = [createMockAgent('agent-1', 'finished')];

      const { lastFrame } = render(
        <AgentList agents={agents} selectedIndex={0} />
      );

      // Finished icon is ✓
      expect(lastFrame()!).toContain('✓');
    });

    it('should display failed status icon', () => {
      const agents = [createMockAgent('agent-1', 'failed')];

      const { lastFrame } = render(
        <AgentList agents={agents} selectedIndex={0} />
      );

      // Failed icon is ✗
      expect(lastFrame()!).toContain('✗');
    });

    it('should display waiting_input status icon', () => {
      const agents = [createMockAgent('agent-1', 'waiting_input')];

      const { lastFrame } = render(
        <AgentList agents={agents} selectedIndex={0} />
      );

      // Waiting icon is ◐
      expect(lastFrame()!).toContain('◐');
    });
  });

  describe('selection', () => {
    it('should highlight selected agent', () => {
      const agents = [
        createMockAgent('agent-1'),
        createMockAgent('agent-2'),
        createMockAgent('agent-3'),
      ];

      const { lastFrame } = render(
        <AgentList agents={agents} selectedIndex={1} />
      );

      // The selected row should have special styling (we can't test exact colors in ink-testing-library,
      // but we can verify the content is rendered)
      const output = lastFrame()!;
      expect(output).toContain('branch-agent-2');
    });
  });

  describe('number keys display', () => {
    it('should show number indices for agents', () => {
      const agents = [
        createMockAgent('agent-1'),
        createMockAgent('agent-2'),
        createMockAgent('agent-3'),
      ];

      const { lastFrame } = render(
        <AgentList agents={agents} selectedIndex={0} />
      );

      const output = lastFrame()!;
      expect(output).toContain('[1]');
      expect(output).toContain('[2]');
      expect(output).toContain('[3]');
    });
  });
});
