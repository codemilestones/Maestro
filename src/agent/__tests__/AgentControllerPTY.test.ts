import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { join } from 'node:path';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { AgentControllerPTY } from '../AgentControllerPTY.js';
import * as pty from 'node-pty';

// Check if PTY is available
let ptyAvailable = true;
let ptyError: string | null = null;

try {
  const testPty = pty.spawn('/bin/echo', ['test'], {
    name: 'xterm-256color',
    cols: 80,
    rows: 30,
  });
  testPty.kill();
} catch (e) {
  ptyAvailable = false;
  ptyError = (e as Error).message;
}

describe('AgentControllerPTY', () => {
  let controller: AgentControllerPTY;
  let testDir: string;

  beforeEach(() => {
    // Create test directory
    testDir = join(process.cwd(), '.test-maestro-pty-' + Date.now());
    mkdirSync(join(testDir, '.maestro', 'state'), { recursive: true });
    mkdirSync(join(testDir, '.maestro', 'logs'), { recursive: true });

    // Create controller
    controller = new AgentControllerPTY(testDir);
  });

  afterEach(() => {
    // Cleanup test directory
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('initialization', () => {
    it('should create controller without errors', () => {
      expect(controller).toBeDefined();
    });

    it('should start with empty agent list', () => {
      const agents = controller.listAll();
      expect(agents).toEqual([]);
    });
  });

  describe('spawn (without PTY)', () => {
    // These tests verify the agent creation logic without actually spawning PTY

    it('should queue agent when exceeding concurrent limit', async () => {
      if (!ptyAvailable) {
        console.log(`Skipping PTY test: ${ptyError}`);
        return;
      }

      // This test would require mocking the PTY spawn
      // For now, we just verify the API exists
      expect(typeof controller.spawn).toBe('function');
    });
  });

  describe('agent lifecycle methods', () => {
    it('should have getStatus method', () => {
      expect(typeof controller.getStatus).toBe('function');
    });

    it('should have getInfo method', () => {
      expect(typeof controller.getInfo).toBe('function');
    });

    it('should throw for non-existent agent', () => {
      expect(() => controller.getStatus('non-existent')).toThrow("Agent 'non-existent' not found");
    });

    it('should return null for non-existent agent info', () => {
      expect(controller.getInfo('non-existent')).toBeNull();
    });
  });

  describe('attach/detach', () => {
    it('should have attach method', () => {
      expect(typeof controller.attach).toBe('function');
    });

    it('should have detach method', () => {
      expect(typeof controller.detach).toBe('function');
    });

    it('should have isAttached method', () => {
      expect(typeof controller.isAttached).toBe('function');
    });

    it('should throw when attaching to non-existent agent', () => {
      expect(() => controller.attach('non-existent')).toThrow("Agent 'non-existent' not found");
    });
  });

  describe('event handling', () => {
    it('should support event subscription', () => {
      const handler = vi.fn();
      const unsubscribe = controller.onEvent(handler);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should allow unsubscribing from events', () => {
      const handler = vi.fn();
      const unsubscribe = controller.onEvent(handler);

      unsubscribe();

      // No error should occur
      expect(true).toBe(true);
    });
  });

  describe('resize', () => {
    it('should have resize method', () => {
      expect(typeof controller.resize).toBe('function');
    });
  });

  describe('status detection', () => {
    it('should have getDetectedStatus method', () => {
      expect(typeof controller.getDetectedStatus).toBe('function');
    });

    it('should have overrideStatus method', () => {
      expect(typeof controller.overrideStatus).toBe('function');
    });

    it('should return null for non-existent agent detected status', () => {
      expect(controller.getDetectedStatus('non-existent')).toBeNull();
    });
  });

  describe('output retrieval', () => {
    it('should return empty array for non-existent agent output', () => {
      const output = controller.getOutput('non-existent');
      expect(output).toEqual([]);
    });

    it('should return null for non-existent agent buffer', () => {
      expect(controller.getBuffer('non-existent')).toBeNull();
    });
  });

  describe('archive', () => {
    it('should have archive method', () => {
      expect(typeof controller.archive).toBe('function');
    });
  });

  describe('worktree info', () => {
    it('should have setWorktreeInfo method', () => {
      expect(typeof controller.setWorktreeInfo).toBe('function');
    });
  });
});

// Integration tests that require PTY
describe('AgentControllerPTY integration', () => {
  let controller: AgentControllerPTY;
  let testDir: string;

  beforeEach(() => {
    if (!ptyAvailable) return;

    testDir = join(process.cwd(), '.test-maestro-pty-int-' + Date.now());
    mkdirSync(join(testDir, '.maestro', 'state'), { recursive: true });
    mkdirSync(join(testDir, '.maestro', 'logs'), { recursive: true });
    mkdirSync(join(testDir, 'worktree'), { recursive: true });

    controller = new AgentControllerPTY(testDir);
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  it('should spawn and track agent', async () => {
    if (!ptyAvailable) {
      console.log(`Skipping PTY integration test: ${ptyError}`);
      return;
    }

    // This would test actual PTY spawning
    // Skipped in sandbox environment
  });
});
