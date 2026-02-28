/**
 * Prefix key commands
 */
export type PrefixCommand = 'd' | 'n' | 'p' | 'k' | '?' | 'prefix';

/**
 * Attach session options
 */
export interface AttachOptions {
  agentId: string;
  force?: boolean;
  prefixKey?: string; // e.g., "C-]" for Ctrl+]
  prefixTimeout?: number; // milliseconds
}

/**
 * Attach session state
 */
export type AttachState = 'idle' | 'attached' | 'prefix_pending';

/**
 * Prefix key configuration
 */
export interface PrefixKeyConfig {
  key: string; // Key sequence like "C-]" or "C-b"
  timeout: number; // Timeout in milliseconds
}

/**
 * Callbacks for attach session events
 */
export interface AttachCallbacks {
  onDetach?: () => void;
  onNextSession?: () => void;
  onPrevSession?: () => void;
  onKillSession?: () => void;
  onShowHelp?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Parse key notation like "C-]" to character code
 */
export function parseKeyNotation(notation: string): string | null {
  const match = notation.match(/^C-(.+)$/i);
  if (match) {
    const key = match[1];

    // Handle special cases
    if (key === ']') {
      // Ctrl+] is ASCII 29 (GS - Group Separator)
      return String.fromCharCode(29);
    }
    if (key === 'b' || key === 'B') {
      // Ctrl+B is ASCII 2 (STX)
      return String.fromCharCode(2);
    }
    if (key === 'a' || key === 'A') {
      // Ctrl+A is ASCII 1 (SOH)
      return String.fromCharCode(1);
    }

    // Generic Ctrl+letter (A-Z maps to 1-26)
    const upper = key.toUpperCase();
    if (upper.length === 1 && upper >= 'A' && upper <= 'Z') {
      return String.fromCharCode(upper.charCodeAt(0) - 64);
    }
  }

  return null;
}

/**
 * Format key notation for display
 */
export function formatKeyNotation(notation: string): string {
  const match = notation.match(/^C-(.+)$/i);
  if (match) {
    return `Ctrl+${match[1]}`;
  }
  return notation;
}
