import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  loadConfig,
  saveConfig,
  initMaestroDir,
  isMaestroInitialized,
  getConfigValue,
  setConfigValue,
  getMaestroDir,
  MAESTRO_DIR,
} from '../../src/shared/config.js';

describe('Config', () => {
  let testDir: string;

  beforeEach(() => {
    testDir = join(tmpdir(), `maestro-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('loadConfig', () => {
    it('should return default config when no config file exists', () => {
      const config = loadConfig(testDir);
      expect(config.agent.maxConcurrent).toBe(5);
      expect(config.worktree.branchPrefix).toBe('maestro/');
    });

    it('should merge user config with defaults', () => {
      const maestroDir = join(testDir, MAESTRO_DIR);
      mkdirSync(maestroDir, { recursive: true });
      writeFileSync(
        join(maestroDir, 'config.yaml'),
        'agent:\n  maxConcurrent: 10\n'
      );

      const config = loadConfig(testDir);
      expect(config.agent.maxConcurrent).toBe(10);
      expect(config.agent.defaultTimeout).toBe(1800000); // Default preserved
    });
  });

  describe('initMaestroDir', () => {
    it('should create .maestro directory structure', () => {
      initMaestroDir(testDir);

      expect(existsSync(join(testDir, '.maestro'))).toBe(true);
      expect(existsSync(join(testDir, '.maestro', 'state'))).toBe(true);
      expect(existsSync(join(testDir, '.maestro', 'logs'))).toBe(true);
      expect(existsSync(join(testDir, '.maestro', 'templates'))).toBe(true);
      expect(existsSync(join(testDir, '.maestro', 'config.yaml'))).toBe(true);
    });

    it('should not overwrite existing config', () => {
      const maestroDir = join(testDir, MAESTRO_DIR);
      mkdirSync(maestroDir, { recursive: true });
      writeFileSync(
        join(maestroDir, 'config.yaml'),
        'agent:\n  maxConcurrent: 99\n'
      );

      initMaestroDir(testDir);

      const config = loadConfig(testDir);
      expect(config.agent.maxConcurrent).toBe(99);
    });
  });

  describe('isMaestroInitialized', () => {
    it('should return false when not initialized', () => {
      expect(isMaestroInitialized(testDir)).toBe(false);
    });

    it('should return true when initialized', () => {
      initMaestroDir(testDir);
      expect(isMaestroInitialized(testDir)).toBe(true);
    });
  });

  describe('getConfigValue', () => {
    it('should get nested config values', () => {
      initMaestroDir(testDir);

      expect(getConfigValue('agent.maxConcurrent', testDir)).toBe(5);
      expect(getConfigValue('worktree.branchPrefix', testDir)).toBe('maestro/');
    });

    it('should return undefined for non-existent keys', () => {
      initMaestroDir(testDir);

      expect(getConfigValue('nonexistent.key', testDir)).toBeUndefined();
    });
  });

  describe('setConfigValue', () => {
    it('should set nested config values', () => {
      initMaestroDir(testDir);

      setConfigValue('agent.maxConcurrent', 15, testDir);

      const config = loadConfig(testDir);
      expect(config.agent.maxConcurrent).toBe(15);
    });
  });
});
