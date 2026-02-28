import { AgentStatus } from '../shared/types.js';
import { PTYSession, PTYSessionOptions } from '../pty/index.js';

/**
 * Options for spawning a tool process via adapter
 */
export interface AdapterSpawnOptions {
  prompt: string;
  cwd: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
}

/**
 * Result of spawning a tool process
 */
export interface AdapterSpawnResult {
  session: PTYSession;
}

/**
 * Tool configuration from config file
 */
export interface ToolConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  statusPatterns?: {
    idle?: string;
    running?: string;
    waiting_input?: string;
  };
}

/**
 * ToolAdapter interface - abstracts different AI tool interactions
 *
 * Each adapter implements tool-specific logic for:
 * - Spawning the tool process
 * - Building command arguments
 * - Health checking
 */
export interface ToolAdapter {
  /**
   * Unique identifier for this tool
   */
  readonly name: string;

  /**
   * Human-readable display name
   */
  readonly displayName: string;

  /**
   * Spawn a PTY session for this tool
   */
  spawn(options: AdapterSpawnOptions): AdapterSpawnResult;

  /**
   * Get default command line arguments for the tool
   */
  getDefaultArgs(prompt: string): string[];

  /**
   * Check if the tool is available and properly installed
   */
  healthCheck(): Promise<boolean>;

  /**
   * Get the command to execute
   */
  getCommand(): string;

  /**
   * Apply configuration overrides
   */
  configure(config: ToolConfig): void;
}

/**
 * Abstract base class for tool adapters
 * Provides common functionality and configuration handling
 */
export abstract class BaseToolAdapter implements ToolAdapter {
  abstract readonly name: string;
  abstract readonly displayName: string;

  protected config: ToolConfig = {};

  configure(config: ToolConfig): void {
    this.config = { ...this.config, ...config };
  }

  abstract spawn(options: AdapterSpawnOptions): AdapterSpawnResult;
  abstract getDefaultArgs(prompt: string): string[];
  abstract healthCheck(): Promise<boolean>;
  abstract getCommand(): string;
}
