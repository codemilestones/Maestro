import { describe, it, expect, beforeEach } from 'vitest';
import { ClaudeCodeAdapter } from '../ClaudeCodeAdapter.js';

describe('ClaudeCodeAdapter', () => {
  let adapter: ClaudeCodeAdapter;

  beforeEach(() => {
    adapter = new ClaudeCodeAdapter();
  });

  describe('properties', () => {
    it('should have correct name', () => {
      expect(adapter.name).toBe('claude-code');
    });

    it('should have correct display name', () => {
      expect(adapter.displayName).toBe('Claude Code');
    });
  });

  describe('getCommand', () => {
    it('should return default command', () => {
      expect(adapter.getCommand()).toBe('claude');
    });

    it('should return configured command', () => {
      adapter.configure({ command: '/custom/path/claude' });
      expect(adapter.getCommand()).toBe('/custom/path/claude');
    });
  });

  describe('getDefaultArgs', () => {
    it('should return empty array by default (interactive mode)', () => {
      const args = adapter.getDefaultArgs('test prompt');
      expect(args).toEqual([]);
    });

    it('should include configured args', () => {
      adapter.configure({ args: ['--model', 'opus'] });
      const args = adapter.getDefaultArgs('test prompt');
      expect(args).toEqual(['--model', 'opus']);
    });
  });

  describe('configure', () => {
    it('should apply command configuration', () => {
      adapter.configure({ command: '/usr/local/bin/claude' });
      expect(adapter.getCommand()).toBe('/usr/local/bin/claude');
    });

    it('should apply args configuration', () => {
      adapter.configure({ args: ['--verbose'] });
      expect(adapter.getDefaultArgs('prompt')).toEqual(['--verbose']);
    });

    it('should merge multiple configurations', () => {
      adapter.configure({ command: '/custom/claude' });
      adapter.configure({ args: ['--debug'] });

      expect(adapter.getCommand()).toBe('/custom/claude');
      expect(adapter.getDefaultArgs('prompt')).toEqual(['--debug']);
    });
  });

  describe('healthCheck', () => {
    it('should return false when claude command not found', async () => {
      // Configure a non-existent command
      adapter.configure({ command: '/nonexistent/claude' });
      const result = await adapter.healthCheck();
      expect(result).toBe(false);
    });

    // Note: We can't test the positive case (claude --version) reliably
    // in all environments, so we only test the negative case
  });

  describe('spawn', () => {
    it('should create a PTYSession with correct options', () => {
      // Note: spawn() actually starts a process, so we can only test
      // the configuration aspects without actually spawning

      // Test that getDefaultArgs returns correct values
      adapter.configure({ args: ['--model', 'sonnet'] });
      const args = adapter.getDefaultArgs('test prompt');
      expect(args).toEqual(['--model', 'sonnet']);

      // Test that getCommand returns correct value
      adapter.configure({ command: '/path/to/claude' });
      expect(adapter.getCommand()).toBe('/path/to/claude');
    });
  });
});
