import { describe, it, expect, beforeEach } from 'vitest';
import { AdapterRegistry } from '../AdapterRegistry.js';
import { BaseToolAdapter, AdapterSpawnOptions, AdapterSpawnResult } from '../types.js';
import { PTYSession } from '../../pty/index.js';

// Mock adapter for testing
class MockAdapter extends BaseToolAdapter {
  readonly name = 'mock-tool';
  readonly displayName = 'Mock Tool';

  private mockHealthy = true;

  setHealthy(healthy: boolean): void {
    this.mockHealthy = healthy;
  }

  getCommand(): string {
    return this.config.command || '/usr/bin/mock';
  }

  getDefaultArgs(prompt: string): string[] {
    return ['--prompt', prompt];
  }

  spawn(options: AdapterSpawnOptions): AdapterSpawnResult {
    const session = new PTYSession({
      command: this.getCommand(),
      args: this.getDefaultArgs(options.prompt),
      cwd: options.cwd,
    });
    return { session };
  }

  async healthCheck(): Promise<boolean> {
    return this.mockHealthy;
  }
}

describe('AdapterRegistry', () => {
  let registry: AdapterRegistry;

  beforeEach(() => {
    registry = new AdapterRegistry();
  });

  describe('built-in adapters', () => {
    it('should have claude-code adapter registered by default', () => {
      expect(registry.has('claude-code')).toBe(true);
    });

    it('should set claude-code as default adapter', () => {
      expect(registry.getDefaultName()).toBe('claude-code');
    });

    it('should return claude-code adapter as default', () => {
      const adapter = registry.getDefault();
      expect(adapter.name).toBe('claude-code');
      expect(adapter.displayName).toBe('Claude Code');
    });
  });

  describe('register', () => {
    it('should register a new adapter', () => {
      const mockAdapter = new MockAdapter();
      registry.register(mockAdapter);

      expect(registry.has('mock-tool')).toBe(true);
      expect(registry.get('mock-tool')).toBe(mockAdapter);
    });

    it('should throw when registering duplicate adapter', () => {
      const mockAdapter = new MockAdapter();
      registry.register(mockAdapter);

      expect(() => registry.register(mockAdapter)).toThrow(
        "Adapter 'mock-tool' is already registered"
      );
    });
  });

  describe('unregister', () => {
    it('should unregister an adapter', () => {
      const mockAdapter = new MockAdapter();
      registry.register(mockAdapter);

      expect(registry.unregister('mock-tool')).toBe(true);
      expect(registry.has('mock-tool')).toBe(false);
    });

    it('should return false when unregistering non-existent adapter', () => {
      expect(registry.unregister('non-existent')).toBe(false);
    });
  });

  describe('get', () => {
    it('should return adapter by name', () => {
      const adapter = registry.get('claude-code');
      expect(adapter).toBeDefined();
      expect(adapter!.name).toBe('claude-code');
    });

    it('should return undefined for non-existent adapter', () => {
      expect(registry.get('non-existent')).toBeUndefined();
    });
  });

  describe('setDefault', () => {
    it('should change the default adapter', () => {
      const mockAdapter = new MockAdapter();
      registry.register(mockAdapter);
      registry.setDefault('mock-tool');

      expect(registry.getDefaultName()).toBe('mock-tool');
      expect(registry.getDefault().name).toBe('mock-tool');
    });

    it('should throw when setting non-existent adapter as default', () => {
      expect(() => registry.setDefault('non-existent')).toThrow(
        "Cannot set default: adapter 'non-existent' not registered"
      );
    });
  });

  describe('list', () => {
    it('should list all registered adapters', () => {
      const adapters = registry.list();

      expect(adapters.length).toBeGreaterThanOrEqual(1);
      expect(adapters.some((a) => a.name === 'claude-code')).toBe(true);
    });
  });

  describe('listInfo', () => {
    it('should list adapter info with default flag', () => {
      const mockAdapter = new MockAdapter();
      registry.register(mockAdapter);

      const info = registry.listInfo();

      const claudeInfo = info.find((i) => i.name === 'claude-code');
      expect(claudeInfo).toBeDefined();
      expect(claudeInfo!.isDefault).toBe(true);
      expect(claudeInfo!.displayName).toBe('Claude Code');

      const mockInfo = info.find((i) => i.name === 'mock-tool');
      expect(mockInfo).toBeDefined();
      expect(mockInfo!.isDefault).toBe(false);
    });
  });

  describe('configure', () => {
    it('should configure an adapter', () => {
      registry.configure('claude-code', { command: '/custom/claude' });

      const adapter = registry.get('claude-code')!;
      expect(adapter.getCommand()).toBe('/custom/claude');
    });

    it('should throw when configuring non-existent adapter', () => {
      expect(() => registry.configure('non-existent', {})).toThrow(
        "Adapter 'non-existent' not found"
      );
    });
  });

  describe('healthCheck', () => {
    it('should return false for non-existent adapter', async () => {
      const result = await registry.healthCheck('non-existent');
      expect(result).toBe(false);
    });

    it('should return health status from adapter', async () => {
      const mockAdapter = new MockAdapter();
      registry.register(mockAdapter);

      mockAdapter.setHealthy(true);
      expect(await registry.healthCheck('mock-tool')).toBe(true);

      mockAdapter.setHealthy(false);
      expect(await registry.healthCheck('mock-tool')).toBe(false);
    });
  });

  describe('healthCheckAll', () => {
    it('should check all adapters', async () => {
      const mockAdapter = new MockAdapter();
      mockAdapter.setHealthy(true);
      registry.register(mockAdapter);

      const results = await registry.healthCheckAll();

      expect(results.has('claude-code')).toBe(true);
      expect(results.has('mock-tool')).toBe(true);
      expect(results.get('mock-tool')).toBe(true);
    });
  });
});
