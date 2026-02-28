import { EventEmitter } from 'node:events';
import { Readable, Writable } from 'node:stream';

/**
 * Mock Claude Code process for testing AgentController
 */
export class MockClaudeProcess extends EventEmitter {
  public pid: number;
  public stdout: Readable;
  public stderr: Readable;
  public stdin: Writable;
  public killed: boolean = false;

  private stdoutEmitter: EventEmitter;
  private stderrEmitter: EventEmitter;
  private stdinBuffer: string[] = [];

  constructor(pid: number = Math.floor(Math.random() * 100000)) {
    super();
    this.pid = pid;

    // Create stdout stream
    this.stdoutEmitter = new EventEmitter();
    this.stdout = new Readable({
      read() {},
    });
    // Forward data events
    this.stdoutEmitter.on('data', (chunk) => {
      this.stdout.push(chunk);
    });

    // Create stderr stream
    this.stderrEmitter = new EventEmitter();
    this.stderr = new Readable({
      read() {},
    });
    this.stderrEmitter.on('data', (chunk) => {
      this.stderr.push(chunk);
    });

    // Create stdin stream
    this.stdin = new Writable({
      write: (chunk, encoding, callback) => {
        this.stdinBuffer.push(chunk.toString());
        callback();
      },
    });
  }

  /**
   * Emit stdout data (simulates Claude Code output)
   */
  emitStdout(data: string | Buffer): void {
    const chunk = typeof data === 'string' ? Buffer.from(data) : data;
    this.stdout.emit('data', chunk);
  }

  /**
   * Emit stderr data
   */
  emitStderr(data: string | Buffer): void {
    const chunk = typeof data === 'string' ? Buffer.from(data) : data;
    this.stderr.emit('data', chunk);
  }

  /**
   * Simulate process exit
   */
  exit(code: number = 0, signal: NodeJS.Signals | null = null): void {
    this.emit('exit', code, signal);
    this.stdout.push(null);
    this.stderr.push(null);
  }

  /**
   * Simulate process error
   */
  error(err: Error): void {
    this.emit('error', err);
  }

  /**
   * Get all data written to stdin
   */
  getStdinData(): string[] {
    return [...this.stdinBuffer];
  }

  /**
   * Simulate kill signal
   */
  kill(signal: NodeJS.Signals = 'SIGTERM'): boolean {
    this.killed = true;
    this.exit(signal === 'SIGKILL' ? 137 : 143, signal);
    return true;
  }
}

/**
 * Helper to create JSON stream output like Claude Code
 */
export function createClaudeStreamEvent(type: 'assistant' | 'result' | 'system', content: string): string {
  return JSON.stringify({
    type,
    message: { content },
  }) + '\n';
}

export function createToolUseEvent(name: string, input: Record<string, unknown>): string {
  return JSON.stringify({
    type: 'assistant',
    tool_use: { name, input },
  }) + '\n';
}

export function createInputRequestEvent(): string {
  return JSON.stringify({
    type: 'system',
    subtype: 'input_request',
    message: { content: 'Waiting for input...' },
  }) + '\n';
}
