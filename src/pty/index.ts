/**
 * PTY Session Module
 *
 * Provides PTY (pseudo-terminal) management for interactive AI tool sessions.
 * Uses node-pty for real terminal emulation with bidirectional I/O.
 */

export { PTYSession, type PTYSessionOptions, type PTYSessionEvents } from './PTYSession.js';
export { RingBuffer } from './RingBuffer.js';
