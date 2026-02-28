import { EventEmitter } from 'events';
import { PTYSession } from '../pty/index.js';
import { PrefixKeyHandler } from './PrefixKeyHandler.js';
import { AttachCallbacks, AttachState, PrefixCommand, formatKeyNotation } from './types.js';

/**
 * Terminal state for saving/restoring
 */
interface TerminalState {
  isRaw: boolean;
  savedSettings?: unknown;
}

/**
 * AttachSession events
 */
export interface AttachSessionEvents {
  attached: () => void;
  detached: () => void;
  data: (data: string) => void;
  error: (error: Error) => void;
}

type AttachSessionEventMap = {
  [K in keyof AttachSessionEvents]: AttachSessionEvents[K];
};

/**
 * AttachSession
 *
 * Manages a full-screen attach session to a PTY.
 * Handles:
 * - stdin/stdout passthrough
 * - Prefix key commands
 * - Terminal state preservation
 * - Window resize propagation
 */
export class AttachSession extends EventEmitter {
  private ptySession: PTYSession;
  private prefixHandler: PrefixKeyHandler;
  private callbacks: AttachCallbacks;
  private state: AttachState = 'idle';
  private terminalState: TerminalState = { isRaw: false };
  private stdin: NodeJS.ReadStream;
  private stdout: NodeJS.WriteStream;
  private resizeHandler?: () => void;
  private dataHandler?: (data: string) => void;

  constructor(
    ptySession: PTYSession,
    options: {
      prefixKey?: string;
      prefixTimeout?: number;
      callbacks?: AttachCallbacks;
      stdin?: NodeJS.ReadStream;
      stdout?: NodeJS.WriteStream;
    } = {}
  ) {
    super();
    this.ptySession = ptySession;
    this.callbacks = options.callbacks || {};
    this.stdin = options.stdin || process.stdin;
    this.stdout = options.stdout || process.stdout;

    this.prefixHandler = new PrefixKeyHandler({
      key: options.prefixKey || 'C-]',
      timeout: options.prefixTimeout || 500,
    });

    this.setupPrefixHandler();
  }

  private setupPrefixHandler(): void {
    // Handle prefix commands
    this.prefixHandler.on('command', (command: PrefixCommand) => {
      this.handleCommand(command);
    });

    // Handle passthrough data
    this.prefixHandler.on('passthrough', (data: Buffer) => {
      if (this.state === 'attached' && this.ptySession.isRunning) {
        this.ptySession.write(data.toString());
      }
    });
  }

  private handleCommand(command: PrefixCommand): void {
    switch (command) {
      case 'd':
        this.detach();
        this.callbacks.onDetach?.();
        break;
      case 'n':
        this.callbacks.onNextSession?.();
        break;
      case 'p':
        this.callbacks.onPrevSession?.();
        break;
      case 'k':
        this.callbacks.onKillSession?.();
        break;
      case '?':
        this.showHelp();
        this.callbacks.onShowHelp?.();
        break;
    }
  }

  /**
   * Attach to the PTY session
   */
  attach(): void {
    if (this.state === 'attached') {
      return;
    }

    // Save terminal state and enter raw mode
    this.saveTerminalState();
    this.enterRawMode();

    this.state = 'attached';

    // Clear screen and show initial buffer
    this.clearScreen();
    this.showInitialBuffer();

    // Setup stdin handler
    this.stdin.on('data', this.handleStdinData);

    // Setup PTY data handler
    this.dataHandler = (data: string) => {
      this.stdout.write(data);
      this.emit('data', data);
    };
    this.ptySession.on('data', this.dataHandler);

    // Setup resize handler
    this.resizeHandler = () => {
      this.handleResize();
    };
    this.stdout.on('resize', this.resizeHandler);

    // Initial resize to match terminal
    this.handleResize();

    this.emit('attached');
  }

  /**
   * Detach from the PTY session
   */
  detach(): void {
    if (this.state === 'idle') {
      return;
    }

    this.state = 'idle';

    // Remove handlers
    this.stdin.removeListener('data', this.handleStdinData);

    if (this.dataHandler) {
      this.ptySession.removeListener('data', this.dataHandler);
      this.dataHandler = undefined;
    }

    if (this.resizeHandler) {
      this.stdout.removeListener('resize', this.resizeHandler);
      this.resizeHandler = undefined;
    }

    // Reset prefix handler
    this.prefixHandler.reset();

    // Restore terminal state
    this.restoreTerminalState();

    this.emit('detached');
  }

  /**
   * Handle stdin data
   */
  private handleStdinData = (data: Buffer): void => {
    if (this.state !== 'attached') {
      return;
    }

    this.prefixHandler.feed(data);
  };

  /**
   * Handle terminal resize
   */
  private handleResize(): void {
    if (!this.ptySession.isRunning) {
      return;
    }

    const cols = this.stdout.columns || 80;
    const rows = this.stdout.rows || 24;

    this.ptySession.resize(cols, rows);
  }

  /**
   * Save current terminal state
   */
  private saveTerminalState(): void {
    this.terminalState = {
      isRaw: this.stdin.isRaw || false,
    };
  }

  /**
   * Enter raw mode for direct input
   */
  private enterRawMode(): void {
    if (this.stdin.isTTY && !this.stdin.isRaw) {
      this.stdin.setRawMode(true);
    }
    this.stdin.resume();
  }

  /**
   * Restore terminal state
   */
  private restoreTerminalState(): void {
    if (this.stdin.isTTY) {
      this.stdin.setRawMode(this.terminalState.isRaw);
    }
  }

  /**
   * Clear screen
   */
  private clearScreen(): void {
    // ANSI escape sequence to clear screen and move cursor to home
    this.stdout.write('\x1b[2J\x1b[H');
  }

  /**
   * Show initial buffer content
   */
  private showInitialBuffer(): void {
    const buffer = this.ptySession.getBufferedOutput();
    if (buffer) {
      this.stdout.write(buffer);
    }
  }

  /**
   * Show help overlay
   */
  private showHelp(): void {
    const helpText = this.prefixHandler.getHelpText();
    this.stdout.write('\n' + helpText + '\n');
  }

  /**
   * Get current state
   */
  getState(): AttachState {
    return this.state;
  }

  /**
   * Check if attached
   */
  isAttached(): boolean {
    return this.state === 'attached';
  }

  // Type-safe event emitter methods
  override on<K extends keyof AttachSessionEventMap>(
    event: K,
    listener: AttachSessionEventMap[K]
  ): this {
    return super.on(event, listener);
  }

  override emit<K extends keyof AttachSessionEventMap>(
    event: K,
    ...args: Parameters<AttachSessionEventMap[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}
