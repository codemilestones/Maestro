import { execa, type ResultPromise, type Options as ExecaOptions } from 'execa';
import { spawn as nodeSpawn, type ChildProcess, type SpawnOptions } from 'node:child_process';
import { mkdirSync, existsSync, openSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, MaestroConfig } from '../../shared/config.js';
import { getLogger, Logger } from '../../shared/logger.js';

export type ExecaChildProcess = ResultPromise;

export interface SpawnerOptions {
  prompt: string;
  cwd: string;
  env?: Record<string, string>;
  timeout?: number;
  skipPermissions?: boolean;
  stdoutLogPath?: string; // Path to persist stdout for recovery
}

export interface SpawnedProcess {
  process: ExecaChildProcess;
  pid: number;
}

export function buildClaudeArgs(options: SpawnerOptions, config: MaestroConfig): string[] {
  const args: string[] = [
    '--print',
    '--output-format', 'stream-json',
    '--verbose',
  ];

  const skipPermissions = options.skipPermissions ?? config.agent.skipPermissions;
  if (skipPermissions) {
    args.push('--dangerously-skip-permissions');
  }

  args.push('-p', options.prompt);

  return args;
}

export function spawnClaude(options: SpawnerOptions, config?: MaestroConfig): SpawnedProcess {
  const logger = getLogger();
  const effectiveConfig = config || loadConfig();
  const claudePath = effectiveConfig.agent.claudePath;
  const args = buildClaudeArgs(options, effectiveConfig);

  logger.debug(`Spawning Claude Code`, {
    claudePath,
    args: args.slice(0, -2).concat(['[prompt]']), // Don't log full prompt
    cwd: options.cwd,
    stdoutLogPath: options.stdoutLogPath,
  });

  // If stdoutLogPath is provided, use detached process with file descriptor logging
  if (options.stdoutLogPath) {
    // Ensure log directory exists
    const logDir = join(options.stdoutLogPath, '..');
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }

    // Open file descriptor for stdout persistence (will be inherited by child process)
    const stdoutFd = openSync(options.stdoutLogPath, 'a');

    logger.debug(`Using detached process with file descriptor logging`, {
      stdoutLogPath: options.stdoutLogPath,
      stdoutFd,
    });

    // Use native spawn with detached mode for process independence
    // Use file descriptor directly so writes persist after parent exits
    const childProcess = nodeSpawn(claudePath, args, {
      cwd: options.cwd,
      env: {
        ...process.env,
        ...options.env,
        CLAUDE_CODE_ENTRYPOINT: 'cli',
      },
      detached: true,
      stdio: ['ignore', stdoutFd, stdoutFd], // stdout and stderr go to file
    });

    if (!childProcess.pid) {
      throw new Error('Failed to spawn Claude Code process - no PID assigned');
    }

    // Allow parent to exit independently
    childProcess.unref();

    logger.info(`Claude Code process spawned (detached)`, { pid: childProcess.pid });

    // Wrap in execa-compatible interface (limited functionality)
    return {
      process: childProcess as unknown as ExecaChildProcess,
      pid: childProcess.pid,
    };
  }

  // Standard spawn without persistence
  const execaOptions: ExecaOptions = {
    cwd: options.cwd,
    env: {
      ...process.env,
      ...options.env,
      CLAUDE_CODE_ENTRYPOINT: 'cli',
    },
    timeout: options.timeout || effectiveConfig.agent.defaultTimeout,
    buffer: false,
    stdin: 'pipe',
    stdout: 'pipe',
    stderr: 'pipe',
  };

  const childProcess = execa(claudePath, args, execaOptions);

  if (!childProcess.pid) {
    throw new Error('Failed to spawn Claude Code process - no PID assigned');
  }

  logger.info(`Claude Code process spawned`, { pid: childProcess.pid });

  return {
    process: childProcess,
    pid: childProcess.pid,
  };
}

export function killProcess(process: ExecaChildProcess, force: boolean = false): void {
  const logger = getLogger();
  const signal = force ? 'SIGKILL' : 'SIGTERM';

  logger.debug(`Killing process`, { pid: process.pid, signal });

  process.kill(signal);
}

export function sendInput(process: ExecaChildProcess, input: string): void {
  const logger = getLogger();

  if (!process.stdin) {
    throw new Error('Process stdin is not available');
  }

  logger.debug(`Sending input to process`, { pid: process.pid, inputLength: input.length });

  process.stdin.write(input + '\n');
}

export function isProcessRunning(pid: number): boolean {
  const logger = getLogger();
  try {
    // Sending signal 0 checks if process exists without affecting it
    process.kill(pid, 0);
    logger.debug(`Process check: alive`, { pid });
    return true;
  } catch (error) {
    logger.debug(`Process check: not found`, { pid, error: (error as Error).message });
    return false;
  }
}
