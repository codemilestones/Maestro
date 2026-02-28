import { EventEmitter } from 'events';
import {
  PrefixCommand,
  PrefixKeyConfig,
  parseKeyNotation,
  formatKeyNotation,
} from './types.js';

/**
 * Handler events
 */
export interface PrefixKeyHandlerEvents {
  command: (command: PrefixCommand) => void;
  passthrough: (data: Buffer) => void;
}

type PrefixKeyHandlerEventMap = {
  [K in keyof PrefixKeyHandlerEvents]: PrefixKeyHandlerEvents[K];
};

/**
 * State of the prefix key handler
 */
type HandlerState = 'normal' | 'prefix_pending';

/**
 * PrefixKeyHandler
 *
 * Handles prefix key detection and command parsing for attach mode.
 * Similar to tmux's prefix key mechanism.
 */
export class PrefixKeyHandler extends EventEmitter {
  private config: PrefixKeyConfig;
  private prefixChar: string;
  private state: HandlerState = 'normal';
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  constructor(config: PrefixKeyConfig) {
    super();
    this.config = config;

    const parsed = parseKeyNotation(config.key);
    if (!parsed) {
      throw new Error(`Invalid prefix key notation: ${config.key}`);
    }
    this.prefixChar = parsed;
  }

  /**
   * Process input data from stdin
   * Returns any data that should be passed through to PTY
   */
  feed(data: Buffer): void {
    const str = data.toString();

    for (let i = 0; i < str.length; i++) {
      const char = str[i];

      if (this.state === 'normal') {
        if (char === this.prefixChar) {
          // Enter prefix pending state
          this.state = 'prefix_pending';
          this.startTimeout();
        } else {
          // Pass through to PTY
          this.emit('passthrough', Buffer.from(char));
        }
      } else if (this.state === 'prefix_pending') {
        this.clearTimeout();

        if (char === this.prefixChar) {
          // Double prefix - pass through one prefix char
          this.emit('passthrough', Buffer.from(this.prefixChar));
          this.state = 'normal';
        } else {
          // Process as command
          const command = this.parseCommand(char);
          if (command) {
            this.emit('command', command);
          }
          this.state = 'normal';
        }
      }
    }
  }

  private parseCommand(char: string): PrefixCommand | null {
    switch (char.toLowerCase()) {
      case 'd':
        return 'd'; // detach
      case 'n':
        return 'n'; // next session
      case 'p':
        return 'p'; // previous session
      case 'k':
        return 'k'; // kill session
      case '?':
        return '?'; // show help
      default:
        return null;
    }
  }

  private startTimeout(): void {
    this.clearTimeout();
    this.timeoutHandle = setTimeout(() => {
      if (this.state === 'prefix_pending') {
        // Timeout - execute default action (detach)
        this.emit('command', 'd');
        this.state = 'normal';
      }
    }, this.config.timeout);
  }

  private clearTimeout(): void {
    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }
  }

  /**
   * Reset handler state
   */
  reset(): void {
    this.clearTimeout();
    this.state = 'normal';
  }

  /**
   * Get current state
   */
  getState(): HandlerState {
    return this.state;
  }

  /**
   * Check if waiting for command after prefix
   */
  isPrefixPending(): boolean {
    return this.state === 'prefix_pending';
  }

  /**
   * Get help text for prefix commands
   */
  getHelpText(): string {
    const prefixDisplay = formatKeyNotation(this.config.key);
    return `
Maestro Attach Mode - Prefix Key Commands
==========================================
${prefixDisplay}         - Detach from session (return to list)
${prefixDisplay} d       - Detach from session (same as above)
${prefixDisplay} n       - Switch to next session
${prefixDisplay} p       - Switch to previous session
${prefixDisplay} k       - Kill current session
${prefixDisplay} ?       - Show this help
${prefixDisplay} ${prefixDisplay}  - Send ${prefixDisplay} to the session
==========================================
`;
  }

  // Type-safe event emitter methods
  override on<K extends keyof PrefixKeyHandlerEventMap>(
    event: K,
    listener: PrefixKeyHandlerEventMap[K]
  ): this {
    return super.on(event, listener);
  }

  override emit<K extends keyof PrefixKeyHandlerEventMap>(
    event: K,
    ...args: Parameters<PrefixKeyHandlerEventMap[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}
