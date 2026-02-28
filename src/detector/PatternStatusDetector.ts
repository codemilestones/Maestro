import {
  StatusDetector,
  DetectedStatus,
  StatusChangeCallback,
  StatusPatterns,
  PatternDetectorOptions,
} from './types.js';

/**
 * Default patterns for Claude Code status detection
 */
export const CLAUDE_CODE_PATTERNS: StatusPatterns = {
  // Idle patterns - prompt indicators
  idle: [
    /❯\s*$/, // Claude Code prompt
    />\s*$/, // Generic prompt
    /\$\s*$/, // Shell prompt
    /claude>\s*$/i, // Claude prompt
  ],
  // Running patterns - spinner and activity indicators
  running: [
    /[⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏]/, // Spinner characters
    /\.\.\.$/, // Trailing dots (thinking)
    /Loading/, // Loading indicator
    /Processing/, // Processing indicator
    /Running/, // Running indicator
  ],
  // Waiting input patterns - confirmation prompts
  waiting_input: [
    /\(y\/n\)/i, // Yes/No prompt
    /\[Y\/n\]/i, // Yes/No with default
    /\[y\/N\]/i, // Yes/No with default No
    /Continue\?/i, // Continue prompt
    /Confirm/i, // Confirmation
    /Press.*to continue/i, // Press key prompt
    /Do you want to/i, // Question prompt
    /Would you like to/i, // Question prompt
    /Enter.*:/i, // Input prompt
    /Permission.*\?/i, // Permission prompt
  ],
};

/**
 * Pattern-based status detector
 *
 * Analyzes PTY output using regex patterns to detect agent status.
 * Implements debouncing to avoid rapid state transitions.
 */
export class PatternStatusDetector implements StatusDetector {
  private patterns: StatusPatterns;
  private debounceMs: number;
  private _currentStatus: DetectedStatus = 'unknown';
  private pendingStatus: DetectedStatus | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private callbacks: Set<StatusChangeCallback> = new Set();
  private overrideUntil: number = 0;
  private outputBuffer: string = '';
  private bufferMaxLength: number = 2000; // Keep last N characters for analysis

  constructor(options: PatternDetectorOptions = {}) {
    this.patterns = options.patterns || CLAUDE_CODE_PATTERNS;
    this.debounceMs = options.debounceMs ?? 100;
  }

  feed(data: string): void {
    // Skip if paused due to manual override
    if (this.isPaused()) {
      return;
    }

    // Append to buffer, keeping it bounded
    this.outputBuffer += data;
    if (this.outputBuffer.length > this.bufferMaxLength) {
      this.outputBuffer = this.outputBuffer.slice(-this.bufferMaxLength);
    }

    // Detect status from recent output
    const detected = this.detectFromOutput(data);

    if (detected !== 'unknown' && detected !== this._currentStatus) {
      this.scheduleStatusChange(detected);
    }
  }

  private detectFromOutput(data: string): DetectedStatus {
    // Check in priority order: waiting_input > running > idle
    if (this.matchesAny(data, this.patterns.waiting_input)) {
      return 'waiting_input';
    }

    if (this.matchesAny(data, this.patterns.running)) {
      return 'running';
    }

    if (this.matchesAny(data, this.patterns.idle)) {
      return 'idle';
    }

    return 'unknown';
  }

  private matchesAny(data: string, patterns?: RegExp[]): boolean {
    if (!patterns || patterns.length === 0) {
      return false;
    }

    return patterns.some((pattern) => pattern.test(data));
  }

  private scheduleStatusChange(newStatus: DetectedStatus): void {
    this.pendingStatus = newStatus;

    // Clear existing timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    // Schedule status change after debounce period
    this.debounceTimer = setTimeout(() => {
      if (this.pendingStatus !== null && this.pendingStatus !== this._currentStatus) {
        const oldStatus = this._currentStatus;
        this._currentStatus = this.pendingStatus;
        this.pendingStatus = null;

        // Notify callbacks
        for (const callback of this.callbacks) {
          try {
            callback(this._currentStatus, oldStatus);
          } catch {
            // Ignore callback errors
          }
        }
      }
    }, this.debounceMs);
  }

  currentStatus(): DetectedStatus {
    return this._currentStatus;
  }

  onStatusChange(callback: StatusChangeCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  override(status: DetectedStatus, pauseDurationMs: number = 30000): void {
    // Clear any pending debounce
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    const oldStatus = this._currentStatus;
    this._currentStatus = status;
    this.pendingStatus = null;
    this.overrideUntil = Date.now() + pauseDurationMs;

    // Notify callbacks
    if (status !== oldStatus) {
      for (const callback of this.callbacks) {
        try {
          callback(status, oldStatus);
        } catch {
          // Ignore callback errors
        }
      }
    }
  }

  isPaused(): boolean {
    return Date.now() < this.overrideUntil;
  }

  reset(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    this._currentStatus = 'unknown';
    this.pendingStatus = null;
    this.overrideUntil = 0;
    this.outputBuffer = '';
  }

  /**
   * Get the output buffer (for debugging)
   */
  getOutputBuffer(): string {
    return this.outputBuffer;
  }

  /**
   * Configure custom patterns
   */
  setPatterns(patterns: StatusPatterns): void {
    this.patterns = patterns;
  }

  /**
   * Add patterns to existing configuration
   */
  addPatterns(patterns: Partial<StatusPatterns>): void {
    if (patterns.idle) {
      this.patterns.idle = [...(this.patterns.idle || []), ...patterns.idle];
    }
    if (patterns.running) {
      this.patterns.running = [...(this.patterns.running || []), ...patterns.running];
    }
    if (patterns.waiting_input) {
      this.patterns.waiting_input = [
        ...(this.patterns.waiting_input || []),
        ...patterns.waiting_input,
      ];
    }
  }
}

/**
 * Create a detector with Claude Code patterns
 */
export function createClaudeCodeDetector(
  options?: Omit<PatternDetectorOptions, 'patterns'>
): PatternStatusDetector {
  return new PatternStatusDetector({
    ...options,
    patterns: CLAUDE_CODE_PATTERNS,
  });
}
