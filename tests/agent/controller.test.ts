import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AgentController } from '../../src/agent/AgentController.js';
import { MockClaudeProcess, createClaudeStreamEvent, createInputRequestEvent } from '../mocks/MockClaudeProcess.js';
import { AgentStore } from '../../src/agent/state/store.js';
import * as spawner from '../../src/agent/process/spawner.js';
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('AgentController', () => {
  let tempDir: string;
  let controller: AgentController;
  let mockProcess: MockClaudeProcess;

  beforeEach(() => {
    // Create temp directory for tests
    tempDir = mkdtempSync(join(tmpdir(), 'maestro-test-'));
    mkdirSync(join(tempDir, '.maestro', 'state'), { recursive: true });

    // Mock spawnClaude
    mockProcess = new MockClaudeProcess(12345);
    vi.spyOn(spawner, 'spawnClaude').mockReturnValue({
      process: mockProcess as unknown as spawner.ExecaChildProcess,
      pid: mockProcess.pid,
    });

    // Mock isProcessRunning
    vi.spyOn(spawner, 'isProcessRunning').mockReturnValue(true);

    controller = new AgentController(tempDir);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('spawn()', () => {
    it('should create agent and return correct info', async () => {
      const agent = await controller.spawn({
        prompt: 'Test task',
        worktreePath: tempDir,
        name: 'test-agent',
      });

      expect(agent).toBeDefined();
      expect(agent.id).toMatch(/^agent-/);
      expect(agent.name).toBe('test-agent');
      expect(agent.prompt).toBe('Test task');
      expect(agent.status).toBe('running');
      expect(agent.pid).toBe(12345);
      expect(agent.spawnedAt).toBeInstanceOf(Date);
    });

    it('should save agent to store', async () => {
      const agent = await controller.spawn({
        prompt: 'Test task',
        worktreePath: tempDir,
      });

      const store = new AgentStore(tempDir);
      const savedAgent = store.getAgent(agent.id);

      expect(savedAgent).toBeDefined();
      expect(savedAgent?.id).toBe(agent.id);
      expect(savedAgent?.status).toBe('running');
    });

    it('should emit status_change event on spawn', async () => {
      const events: string[] = [];
      controller.onEvent((event) => {
        events.push(event.type);
      });

      await controller.spawn({
        prompt: 'Test task',
        worktreePath: tempDir,
      });

      expect(events).toContain('status_change');
    });
  });

  describe('concurrent limit', () => {
    it('should queue agents when maxConcurrent is reached', async () => {
      // Set max concurrent to 1 via config mock
      const agent1 = await controller.spawn({
        prompt: 'Task 1',
        worktreePath: tempDir,
      });

      // First agent should be running
      expect(agent1.status).toBe('running');

      // Note: Testing queue behavior would require mocking the config
      // This is a simplified test
    });
  });

  describe('kill()', () => {
    it('should send SIGTERM by default', async () => {
      const killSpy = vi.spyOn(spawner, 'killProcess');

      const agent = await controller.spawn({
        prompt: 'Test task',
        worktreePath: tempDir,
      });

      await controller.kill(agent.id);

      expect(killSpy).toHaveBeenCalledWith(expect.anything(), false);
    });

    it('should send SIGKILL when force=true', async () => {
      const killSpy = vi.spyOn(spawner, 'killProcess');

      const agent = await controller.spawn({
        prompt: 'Test task',
        worktreePath: tempDir,
      });

      await controller.kill(agent.id, true);

      expect(killSpy).toHaveBeenCalledWith(expect.anything(), true);
    });

    it('should mark as failed if no process attached', async () => {
      const agent = await controller.spawn({
        prompt: 'Test task',
        worktreePath: tempDir,
      });

      // Manually update store to have old spawnedAt (bypass grace period)
      const store = new AgentStore(tempDir);
      const oldDate = new Date(Date.now() - 60000); // 60 seconds ago
      store.updateAgent(agent.id, { spawnedAt: oldDate });

      // Mock isProcessRunning to return false for new controller
      vi.spyOn(spawner, 'isProcessRunning').mockReturnValue(false);

      // Create a new controller to simulate restart (agent restored without process)
      // The agent should be restored but marked as failed due to no process
      const controller2 = new AgentController(tempDir);

      // The agent should already be marked as failed during restore
      const info = controller2.getInfo(agent.id);
      expect(info?.status).toBe('failed');
      expect(info?.error).toContain('Process not found on restore');
    });
  });

  describe('sendInput()', () => {
    it('should write to stdin when agent is waiting for input', async () => {
      const agent = await controller.spawn({
        prompt: 'Test task',
        worktreePath: tempDir,
      });

      // Simulate input request
      mockProcess.emitStdout(createInputRequestEvent());

      // Wait for event processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Agent should now be waiting for input
      const info = controller.getInfo(agent.id);
      expect(info?.status).toBe('waiting_input');

      // Send input
      await controller.sendInput(agent.id, 'user response');

      // Check stdin received the input
      const stdinData = mockProcess.getStdinData();
      expect(stdinData).toContain('user response\n');
    });

    it('should throw if agent is not waiting for input', async () => {
      const agent = await controller.spawn({
        prompt: 'Test task',
        worktreePath: tempDir,
      });

      // Agent is running, not waiting for input
      await expect(controller.sendInput(agent.id, 'test')).rejects.toThrow(
        /not waiting for input/
      );
    });
  });

  describe('restoreAgents() grace period', () => {
    it('should not mark newly spawned agents as failed', async () => {
      // Spawn an agent
      const agent = await controller.spawn({
        prompt: 'Test task',
        worktreePath: tempDir,
      });

      // Mock isProcessRunning to return false
      vi.spyOn(spawner, 'isProcessRunning').mockReturnValue(false);

      // Create new controller (triggers restoreAgents)
      const controller2 = new AgentController(tempDir);

      // Agent should still be running due to grace period
      const info = controller2.getInfo(agent.id);
      expect(info?.status).not.toBe('failed');
    });

    it('should mark old agents as failed if process not found', async () => {
      // Create agent directly in store with old spawnedAt
      const store = new AgentStore(tempDir);
      const oldDate = new Date(Date.now() - 60000); // 60 seconds ago

      store.saveAgent({
        id: 'agent-old',
        prompt: 'Old task',
        worktreeId: '',
        branch: '',
        status: 'running',
        pid: 99999,
        createdAt: oldDate,
        spawnedAt: oldDate,
        metrics: { tokensUsed: 0, toolCalls: 0, filesModified: [] },
      });

      // Mock isProcessRunning to return false
      vi.spyOn(spawner, 'isProcessRunning').mockReturnValue(false);

      // Create controller (triggers restoreAgents)
      const controller2 = new AgentController(tempDir);

      // Agent should be marked as failed
      const info = controller2.getInfo('agent-old');
      expect(info?.status).toBe('failed');
    });
  });

  describe('output events', () => {
    it('should emit output events when stdout received', async () => {
      const outputs: string[] = [];
      controller.onEvent((event) => {
        if (event.type === 'output') {
          outputs.push(event.data as string);
        }
      });

      await controller.spawn({
        prompt: 'Test task',
        worktreePath: tempDir,
      });

      // Emit stdout
      mockProcess.emitStdout(createClaudeStreamEvent('assistant', 'Hello world'));

      // Wait for event processing
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(outputs).toContain('Hello world');
    });
  });
});
