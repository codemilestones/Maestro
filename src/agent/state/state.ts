import { AgentStatus } from '../../shared/types.js';

// Valid state transitions
const VALID_TRANSITIONS: Record<AgentStatus, AgentStatus[]> = {
  pending: ['starting', 'failed'],
  starting: ['running', 'failed'],
  running: ['waiting_input', 'finished', 'failed'],
  waiting_input: ['running', 'finished', 'failed'],
  finished: [],
  failed: [],
};

export function canTransition(from: AgentStatus, to: AgentStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export function validateTransition(from: AgentStatus, to: AgentStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid state transition from '${from}' to '${to}'`);
  }
}

export function isTerminalState(status: AgentStatus): boolean {
  return status === 'finished' || status === 'failed';
}

export function isRunningState(status: AgentStatus): boolean {
  return status === 'running' || status === 'starting' || status === 'waiting_input';
}

export function isPendingState(status: AgentStatus): boolean {
  return status === 'pending';
}

export function getStatusIcon(status: AgentStatus): string {
  switch (status) {
    case 'pending':
      return '○';
    case 'starting':
      return '◔';
    case 'running':
      return '●';
    case 'waiting_input':
      return '◐';
    case 'finished':
      return '✓';
    case 'failed':
      return '✗';
  }
}

export function getStatusColor(status: AgentStatus): string {
  switch (status) {
    case 'pending':
      return 'gray';
    case 'starting':
      return 'yellow';
    case 'running':
      return 'green';
    case 'waiting_input':
      return 'cyan';
    case 'finished':
      return 'blue';
    case 'failed':
      return 'red';
  }
}

export function getStatusText(status: AgentStatus): string {
  switch (status) {
    case 'pending':
      return 'Pending';
    case 'starting':
      return 'Starting';
    case 'running':
      return 'Running';
    case 'waiting_input':
      return 'Waiting';
    case 'finished':
      return 'Finished';
    case 'failed':
      return 'Failed';
  }
}

export class AgentStateMachine {
  private status: AgentStatus;
  private listeners: Set<(status: AgentStatus, previousStatus: AgentStatus) => void>;

  constructor(initialStatus: AgentStatus = 'pending') {
    this.status = initialStatus;
    this.listeners = new Set();
  }

  getStatus(): AgentStatus {
    return this.status;
  }

  transition(to: AgentStatus): void {
    const from = this.status;

    if (from === to) {
      return; // No-op for same state
    }

    validateTransition(from, to);
    this.status = to;

    // Notify listeners
    for (const listener of this.listeners) {
      listener(to, from);
    }
  }

  canTransitionTo(to: AgentStatus): boolean {
    return canTransition(this.status, to);
  }

  isTerminal(): boolean {
    return isTerminalState(this.status);
  }

  isRunning(): boolean {
    return isRunningState(this.status);
  }

  onTransition(callback: (status: AgentStatus, previousStatus: AgentStatus) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  // Convenience methods for common transitions
  start(): void {
    this.transition('starting');
  }

  run(): void {
    this.transition('running');
  }

  waitForInput(): void {
    this.transition('waiting_input');
  }

  finish(): void {
    this.transition('finished');
  }

  fail(): void {
    this.transition('failed');
  }
}
