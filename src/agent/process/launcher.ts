import { execa, type ResultPromise, type Options as ExecaOptions } from 'execa';
import { spawn as nodeSpawn, type ChildProcess } from 'node:child_process';
import { mkdirSync, existsSync, createWriteStream, openSync, closeSync } from 'node:fs';
import { join } from 'node:path';
import { loadConfig, MaestroConfig } from '../../shared/config.js';
import { getLogger, Logger } from '../../shared/logger.js';

export type ExecaChildProcess = ResultPromise;

export interface LauncherOptions {
  prompt: string;
  cwd: string;
  env?: Record<string, string>;
  timeout?: number;
  skipPermissions?: boolean;
  stdoutLogPath?: string; // Path to persist stdout for recovery
  resumeSessionId?: string; // Claude Code session ID for conversation resume
}

export interface LaunchedProcess {
  process: ExecaChildProcess;
  pid: number;
}

export function buildClaudeArgs(options: LauncherOptions, config: MaestroConfig): string[] {
  const args: string[] = [
    '--print',
    '--output-format', 'stream-json',
    '--verbose',
  ];

  const skipPermissions = options.skipPermissions ?? config.agent.skipPermissions;
  if (skipPermissions) {
    args.push('--dangerously-skip-permissions');
  }

  if (options.resumeSessionId) {
    args.push('--resume', options.resumeSessionId);
  }

  args.push('-p', options.prompt);

  return args;
}

export function launchClaude(options: LauncherOptions, config?: MaestroConfig): LaunchedProcess {
  const logger = getLogger();
  const effectiveConfig = config || loadConfig();
  const claudePath = effectiveConfig.agent.claudePath;
  const args = buildClaudeArgs(options, effectiveConfig);

  logger.debug(`Launching Claude Code`, {
    claudePath,
    args: args.slice(0, -2).concat(['[prompt]']), // Don't log full prompt
    cwd: options.cwd,
    stdoutLogPath: options.stdoutLogPath,
  });

  // If stdoutLogPath is provided, use file descriptor mode for true detachment.
  // The child writes directly to the log file via fd, so the parent can exit
  // without breaking pipes (which would cause SIGPIPE killing the child).
  if (options.stdoutLogPath) {
    // Ensure log directory exists
    const logDir = join(options.stdoutLogPath, '..');
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }

    logger.debug(`Using detached mode with file descriptor`, {
      stdoutLogPath: options.stdoutLogPath,
    });

    // Open log file as fd - child writes directly, no pipe through parent
    const logFd = openSync(options.stdoutLogPath, 'a');

    const childProcess = nodeSpawn(claudePath, args, {
      cwd: options.cwd,
      env: {
        ...process.env,
        ...options.env,
        CLAUDE_CODE_ENTRYPOINT: 'cli',
      },
      detached: true,
      stdio: ['ignore', logFd, logFd], // stdout/stderr write directly to log file
    });

    if (!childProcess.pid) {
      closeSync(logFd);
      throw new Error('Failed to launch Claude Code process - no PID assigned');
    }

    // Close parent's copy of the fd (child keeps its own copy)
    closeSync(logFd);

    // Allow parent to exit independently - no pipes keeping event loop alive
    childProcess.unref();

    logger.info(`Claude Code process launched (detached+fd)`, { pid: childProcess.pid });

    // Wrap in execa-compatible interface
    // Note: stdout/stderr are null since we use file descriptors, not pipes
    return {
      process: childProcess as unknown as ExecaChildProcess,
      pid: childProcess.pid,
    };
  }

  // Standard launch without persistence
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
    throw new Error('Failed to launch Claude Code process - no PID assigned');
  }

  logger.info(`Claude Code process launched`, { pid: childProcess.pid });

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
