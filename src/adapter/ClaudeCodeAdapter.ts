import { execSync } from 'child_process';
import { BaseToolAdapter, AdapterSpawnOptions, AdapterSpawnResult, ToolConfig } from './types.js';
import { PTYSession } from '../pty/index.js';

/**
 * Claude Code adapter - default built-in adapter for Claude Code CLI
 *
 * Spawns Claude Code in interactive mode (without -p flag)
 * and sends the initial prompt via stdin.
 */
export class ClaudeCodeAdapter extends BaseToolAdapter {
  readonly name = 'claude-code';
  readonly displayName = 'Claude Code';

  private defaultCommand = 'claude';

  getCommand(): string {
    return this.config.command || this.defaultCommand;
  }

  getDefaultArgs(_prompt: string): string[] {
    // Interactive mode - no -p flag
    // The prompt will be sent via stdin after spawning
    const args: string[] = [];

    // Add any configured args
    if (this.config.args) {
      args.push(...this.config.args);
    }

    return args;
  }

  spawn(options: AdapterSpawnOptions): AdapterSpawnResult {
    const command = this.getCommand();
    const args = this.getDefaultArgs(options.prompt);

    // Merge environment variables
    const env: Record<string, string> = {
      ...options.env,
      ...this.config.env,
    };

    const session = new PTYSession({
      command,
      args,
      cwd: options.cwd,
      env,
      cols: options.cols || 120,
      rows: options.rows || 40,
    });

    // Spawn the PTY session
    session.spawn();

    // Send the initial prompt via stdin
    // Claude Code expects input after startup
    // We delay slightly to ensure the process is ready
    setTimeout(() => {
      if (session.isRunning) {
        session.write(options.prompt + '\n');
      }
    }, 100);

    return { session };
  }

  async healthCheck(): Promise<boolean> {
    try {
      const command = this.getCommand();
      execSync(`${command} --version`, {
        timeout: 5000,
        stdio: 'pipe',
      });
      return true;
    } catch {
      return false;
    }
  }

  override configure(config: ToolConfig): void {
    super.configure(config);

    // Allow overriding the default command
    if (config.command) {
      this.defaultCommand = config.command;
    }
  }
}

// Export singleton instance
export const claudeCodeAdapter = new ClaudeCodeAdapter();
