import { describe, it, expect } from 'vitest';
import { generateTaskId, generateAgentId, generateWorktreeId, isValidId, getIdPrefix } from '../../src/shared/id.js';

describe('ID Generators', () => {
  describe('generateTaskId', () => {
    it('should generate ID with task- prefix', () => {
      const id = generateTaskId();
      expect(id).toMatch(/^task-[a-zA-Z0-9_-]+$/);
    });

    it('should generate unique IDs', () => {
      const ids = new Set<string>();
      for (let i = 0; i < 100; i++) {
        ids.add(generateTaskId());
      }
      expect(ids.size).toBe(100);
    });
  });

  describe('generateAgentId', () => {
    it('should generate ID with agent- prefix', () => {
      const id = generateAgentId();
      expect(id).toMatch(/^agent-[a-zA-Z0-9_-]+$/);
    });
  });

  describe('generateWorktreeId', () => {
    it('should generate ID with wt- prefix', () => {
      const id = generateWorktreeId();
      expect(id).toMatch(/^wt-[a-zA-Z0-9_-]+$/);
    });
  });

  describe('isValidId', () => {
    it('should return true for valid IDs', () => {
      expect(isValidId('task-abc123')).toBe(true);
      expect(isValidId('agent-xyz789')).toBe(true);
      expect(isValidId('wt-def456')).toBe(true);
    });

    it('should return false for invalid IDs', () => {
      expect(isValidId('invalid-abc')).toBe(false);
      expect(isValidId('noprefix')).toBe(false);
    });
  });

  describe('getIdPrefix', () => {
    it('should extract prefix from valid IDs', () => {
      expect(getIdPrefix('task-abc123')).toBe('task');
      expect(getIdPrefix('agent-xyz789')).toBe('agent');
      expect(getIdPrefix('wt-def456')).toBe('wt');
    });

    it('should return null for invalid IDs', () => {
      expect(getIdPrefix('invalid-abc')).toBe(null);
      expect(getIdPrefix('noprefix')).toBe(null);
    });
  });
});
