import { ToolAdapter, ToolConfig } from './types.js';
import { ClaudeCodeAdapter } from './ClaudeCodeAdapter.js';

/**
 * Registry for tool adapters
 *
 * Manages registered adapters and provides lookup functionality.
 * Built-in adapters are registered by default.
 */
export class AdapterRegistry {
  private adapters: Map<string, ToolAdapter> = new Map();
  private defaultAdapterName: string = 'claude-code';

  constructor() {
    // Register built-in adapters
    this.registerBuiltinAdapters();
  }

  private registerBuiltinAdapters(): void {
    this.register(new ClaudeCodeAdapter());
  }

  /**
   * Register a tool adapter
   */
  register(adapter: ToolAdapter): void {
    if (this.adapters.has(adapter.name)) {
      throw new Error(`Adapter '${adapter.name}' is already registered`);
    }
    this.adapters.set(adapter.name, adapter);
  }

  /**
   * Unregister a tool adapter
   */
  unregister(name: string): boolean {
    return this.adapters.delete(name);
  }

  /**
   * Get an adapter by name
   */
  get(name: string): ToolAdapter | undefined {
    return this.adapters.get(name);
  }

  /**
   * Get the default adapter
   */
  getDefault(): ToolAdapter {
    const adapter = this.adapters.get(this.defaultAdapterName);
    if (!adapter) {
      throw new Error(`Default adapter '${this.defaultAdapterName}' not found`);
    }
    return adapter;
  }

  /**
   * Set the default adapter name
   */
  setDefault(name: string): void {
    if (!this.adapters.has(name)) {
      throw new Error(`Cannot set default: adapter '${name}' not registered`);
    }
    this.defaultAdapterName = name;
  }

  /**
   * Get the default adapter name
   */
  getDefaultName(): string {
    return this.defaultAdapterName;
  }

  /**
   * Check if an adapter exists
   */
  has(name: string): boolean {
    return this.adapters.has(name);
  }

  /**
   * List all registered adapters
   */
  list(): ToolAdapter[] {
    return Array.from(this.adapters.values());
  }

  /**
   * List adapter info (name, displayName, isDefault)
   */
  listInfo(): Array<{ name: string; displayName: string; isDefault: boolean }> {
    return this.list().map((adapter) => ({
      name: adapter.name,
      displayName: adapter.displayName,
      isDefault: adapter.name === this.defaultAdapterName,
    }));
  }

  /**
   * Configure an adapter with custom settings
   */
  configure(name: string, config: ToolConfig): void {
    const adapter = this.adapters.get(name);
    if (!adapter) {
      throw new Error(`Adapter '${name}' not found`);
    }
    adapter.configure(config);
  }

  /**
   * Run health check on an adapter
   */
  async healthCheck(name: string): Promise<boolean> {
    const adapter = this.adapters.get(name);
    if (!adapter) {
      return false;
    }
    return adapter.healthCheck();
  }

  /**
   * Run health check on all adapters
   */
  async healthCheckAll(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const [name, adapter] of this.adapters) {
      try {
        results.set(name, await adapter.healthCheck());
      } catch {
        results.set(name, false);
      }
    }

    return results;
  }
}

// Export singleton instance
export const adapterRegistry = new AdapterRegistry();
