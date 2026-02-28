/**
 * Detected agent status from PTY output
 * Note: This is a subset of AgentStatus for runtime detection
 */
export type DetectedStatus = 'idle' | 'running' | 'waiting_input' | 'unknown';

/**
 * Status change callback type
 */
export type StatusChangeCallback = (
  newStatus: DetectedStatus,
  oldStatus: DetectedStatus
) => void;

/**
 * Pattern configuration for status detection
 */
export interface StatusPatterns {
  idle?: RegExp[];
  running?: RegExp[];
  waiting_input?: RegExp[];
}

/**
 * Options for PatternStatusDetector
 */
export interface PatternDetectorOptions {
  patterns?: StatusPatterns;
  debounceMs?: number;
}

/**
 * StatusDetector interface
 *
 * Provides heuristic status detection from PTY output.
 * Implementations analyze raw terminal output to infer agent state.
 */
export interface StatusDetector {
  /**
   * Feed new output data to the detector
   */
  feed(data: string): void;

  /**
   * Get the current detected status
   */
  currentStatus(): DetectedStatus;

  /**
   * Register a callback for status changes
   * Returns unsubscribe function
   */
  onStatusChange(callback: StatusChangeCallback): () => void;

  /**
   * Manually override the detected status
   * Pauses auto-detection for specified duration
   */
  override(status: DetectedStatus, pauseDurationMs?: number): void;

  /**
   * Check if auto-detection is currently paused
   */
  isPaused(): boolean;

  /**
   * Reset the detector state
   */
  reset(): void;
}
