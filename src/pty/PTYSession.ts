import * as pty from 'node-pty';
import { EventEmitter } from 'events';
import { RingBuffer } from './RingBuffer.js';

export interface PTYSessionOptions {
  command: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
  bufferCapacity?: number;
}

export interface PTYSessionEvents {
  data: (data: string) => void;
  exit: (exitCode: number, signal?: number) => void;
  error: (error: Error) => void;
}

type PTYSessionEventMap = {
  [K in keyof PTYSessionEvents]: PTYSessionEvents[K];
};

/**
 * PTY Session wrapper around node-pty.
 * Provides a high-level interface for managing pseudo-terminal sessions.
 */
export class PTYSession extends EventEmitter {
  private ptyProcess: pty.IPty | null = null;
  private outputBuffer: RingBuffer;
  private _isRunning: boolean = false;
  private _exitCode: number | null = null;
  private _pid: number | null = null;

  private cols: number;
  private rows: number;

  constructor(private options: PTYSessionOptions) {
    super();
    this.cols = options.cols || 120;
    this.rows = options.rows || 40;
    this.outputBuffer = new RingBuffer(options.bufferCapacity || 10000);
  }

  /**
   * Start the PTY session.
   */
  spawn(): void {
    if (this.ptyProcess) {
      throw new Error('PTY session already started');
    }

    const env = {
      ...process.env,
      ...this.options.env,
    };

    this.ptyProcess = pty.spawn(this.options.command, this.options.args || [], {
      name: 'xterm-256color',
      cols: this.cols,
      rows: this.rows,
      cwd: this.options.cwd || process.cwd(),
      env: env as Record<string, string>,
    });

    this._pid = this.ptyProcess.pid;
    this._isRunning = true;

    // Handle data output
    this.ptyProcess.onData((data: string) => {
      this.outputBuffer.pushRaw(data);
      this.emit('data', data);
    });

    // Handle exit
    this.ptyProcess.onExit(({ exitCode, signal }) => {
      this._isRunning = false;
      this._exitCode = exitCode;
      this.outputBuffer.flush();
      this.emit('exit', exitCode, signal);
    });
  }

  /**
   * Write data to the PTY stdin.
   */
  write(data: string): void {
    if (!this.ptyProcess) {
      throw new Error('PTY session not started');
    }
    this.ptyProcess.write(data);
  }

  /**
   * Resize the PTY terminal.
   */
  resize(cols: number, rows: number): void {
    if (!this.ptyProcess) {
      throw new Error('PTY session not started');
    }
    this.cols = cols;
    this.rows = rows;
    this.ptyProcess.resize(cols, rows);
  }

  /**
   * Kill the PTY process.
   */
  kill(signal?: string): void {
    if (this.ptyProcess && this._isRunning) {
      this.ptyProcess.kill(signal);
    }
  }

  /**
   * Get the output buffer.
   */
  getBuffer(): RingBuffer {
    return this.outputBuffer;
  }

  /**
   * Get all buffered output as a string.
   */
  getBufferedOutput(): string {
    return this.outputBuffer.getRawContent();
  }

  /**
   * Get the last N lines of output.
   */
  getLastLines(n: number): string[] {
    return this.outputBuffer.getLast(n);
  }

  /**
   * Check if the session is running.
   */
  get isRunning(): boolean {
    return this._isRunning;
  }

  /**
   * Get the exit code (null if still running or not started).
   */
  get exitCode(): number | null {
    return this._exitCode;
  }

  /**
   * Get the process ID.
   */
  get pid(): number | null {
    return this._pid;
  }

  /**
   * Get current terminal dimensions.
   */
  get dimensions(): { cols: number; rows: number } {
    return { cols: this.cols, rows: this.rows };
  }

  /**
   * Get the underlying PTY process (for advanced usage).
   */
  get process(): pty.IPty | null {
    return this.ptyProcess;
  }

  // Type-safe event emitter methods
  override on<K extends keyof PTYSessionEventMap>(
    event: K,
    listener: PTYSessionEventMap[K]
  ): this {
    return super.on(event, listener);
  }

  override emit<K extends keyof PTYSessionEventMap>(
    event: K,
    ...args: Parameters<PTYSessionEventMap[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}
