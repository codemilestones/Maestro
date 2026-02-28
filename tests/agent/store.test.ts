import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentStore } from '../../src/agent/state/store.js';
import { AgentInfo } from '../../src/shared/types.js';
import { mkdtempSync, rmSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('AgentStore', () => {
  let tempDir: string;
  let store: AgentStore;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'maestro-store-test-'));
    mkdirSync(join(tempDir, '.maestro', 'state'), { recursive: true });
    store = new AgentStore(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  const createTestAgent = (id: string, status: AgentInfo['status'] = 'running'): AgentInfo => ({
    id,
    prompt: `Test prompt for ${id}`,
    worktreeId: 'wt-123',
    branch: 'test-branch',
    status,
    pid: 12345,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    spawnedAt: new Date('2024-01-01T00:00:01Z'),
    startedAt: new Date('2024-01-01T00:00:02Z'),
    metrics: {
      tokensUsed: 100,
      toolCalls: 5,
      filesModified: ['file1.ts', 'file2.ts'],
    },
  });

  describe('saveAgent() and getAgent()', () => {
    it('should save and retrieve agent correctly', () => {
      const agent = createTestAgent('agent-123');
      store.saveAgent(agent);

      const retrieved = store.getAgent('agent-123');

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe('agent-123');
      expect(retrieved?.status).toBe('running');
      expect(retrieved?.prompt).toBe('Test prompt for agent-123');
    });

    it('should preserve date fields as Date objects', () => {
      const agent = createTestAgent('agent-dates');
      store.saveAgent(agent);

      // Create new store instance to force reload
      const store2 = new AgentStore(tempDir);
      const retrieved = store2.getAgent('agent-dates');

      expect(retrieved?.createdAt).toBeInstanceOf(Date);
      expect(retrieved?.spawnedAt).toBeInstanceOf(Date);
      expect(retrieved?.startedAt).toBeInstanceOf(Date);
    });

    it('should return null for non-existent agent', () => {
      const retrieved = store.getAgent('non-existent');
      expect(retrieved).toBeNull();
    });
  });

  describe('listAgents()', () => {
    it('should return all saved agents', () => {
      store.saveAgent(createTestAgent('agent-1'));
      store.saveAgent(createTestAgent('agent-2'));
      store.saveAgent(createTestAgent('agent-3'));

      const agents = store.listAgents();

      expect(agents).toHaveLength(3);
      expect(agents.map((a) => a.id).sort()).toEqual(['agent-1', 'agent-2', 'agent-3']);
    });

    it('should return empty array when no agents', () => {
      const agents = store.listAgents();
      expect(agents).toEqual([]);
    });
  });

  describe('deleteAgent()', () => {
    it('should remove agent from store', () => {
      store.saveAgent(createTestAgent('agent-to-delete'));

      expect(store.getAgent('agent-to-delete')).toBeDefined();

      store.deleteAgent('agent-to-delete');

      expect(store.getAgent('agent-to-delete')).toBeNull();
    });

    it('should not affect other agents', () => {
      store.saveAgent(createTestAgent('agent-1'));
      store.saveAgent(createTestAgent('agent-2'));

      store.deleteAgent('agent-1');

      expect(store.getAgent('agent-1')).toBeNull();
      expect(store.getAgent('agent-2')).toBeDefined();
    });
  });

  describe('updateAgent()', () => {
    it('should update specific fields', () => {
      store.saveAgent(createTestAgent('agent-update'));

      const updated = store.updateAgent('agent-update', {
        status: 'finished',
        finishedAt: new Date('2024-01-01T01:00:00Z'),
      });

      expect(updated?.status).toBe('finished');
      expect(updated?.finishedAt).toBeInstanceOf(Date);
      expect(updated?.prompt).toBe('Test prompt for agent-update'); // Unchanged
    });

    it('should return null for non-existent agent', () => {
      const result = store.updateAgent('non-existent', { status: 'finished' });
      expect(result).toBeNull();
    });
  });

  describe('atomic writes', () => {
    it('should use temp file for atomic write', () => {
      const agent = createTestAgent('agent-atomic');
      store.saveAgent(agent);

      // Check that final file exists
      const filePath = join(tempDir, '.maestro', 'state', 'agents.json');
      expect(existsSync(filePath)).toBe(true);

      // Check that temp file doesn't exist (cleanup)
      const tempPath = `${filePath}.tmp`;
      expect(existsSync(tempPath)).toBe(false);
    });

    it('should maintain data integrity after multiple saves', () => {
      // Save multiple agents in sequence
      for (let i = 0; i < 10; i++) {
        store.saveAgent(createTestAgent(`agent-${i}`));
      }

      // Verify all data is intact
      const agents = store.listAgents();
      expect(agents).toHaveLength(10);

      // Check JSON is valid
      const filePath = join(tempDir, '.maestro', 'state', 'agents.json');
      const content = readFileSync(filePath, 'utf-8');
      expect(() => JSON.parse(content)).not.toThrow();
    });
  });

  describe('empty/missing file handling', () => {
    it('should return empty state when file does not exist', () => {
      const newStore = new AgentStore(tempDir);
      const agents = newStore.listAgents();
      expect(agents).toEqual([]);
    });

    it('should create directory structure on first save', () => {
      const newTempDir = mkdtempSync(join(tmpdir(), 'maestro-new-'));
      const newStore = new AgentStore(newTempDir);

      newStore.saveAgent(createTestAgent('first-agent'));

      const filePath = join(newTempDir, '.maestro', 'state', 'agents.json');
      expect(existsSync(filePath)).toBe(true);

      rmSync(newTempDir, { recursive: true, force: true });
    });
  });
});
