import { describe, it, expect } from 'vitest';
import {
  AgentStateMachine,
  isTerminalState,
  canTransition,
  isRunningState,
  isPendingState,
} from '../../src/agent/state/state.js';

describe('AgentStateMachine', () => {
  describe('transition', () => {
    it('should transition from pending to starting via start()', () => {
      const machine = new AgentStateMachine('pending');
      machine.start();
      expect(machine.getStatus()).toBe('starting');
    });

    it('should transition from starting to running via run()', () => {
      const machine = new AgentStateMachine('starting');
      machine.run();
      expect(machine.getStatus()).toBe('running');
    });

    it('should transition from running to waiting_input via waitForInput()', () => {
      const machine = new AgentStateMachine('running');
      machine.waitForInput();
      expect(machine.getStatus()).toBe('waiting_input');
    });

    it('should transition from waiting_input to running via run()', () => {
      const machine = new AgentStateMachine('waiting_input');
      machine.run();
      expect(machine.getStatus()).toBe('running');
    });

    it('should transition from running to finished via finish()', () => {
      const machine = new AgentStateMachine('running');
      machine.finish();
      expect(machine.getStatus()).toBe('finished');
    });

    it('should transition from running to failed via fail()', () => {
      const machine = new AgentStateMachine('running');
      machine.fail();
      expect(machine.getStatus()).toBe('failed');
    });

    it('should not allow invalid transitions', () => {
      const machine = new AgentStateMachine('pending');
      expect(() => machine.finish()).toThrow('Invalid state transition');
      expect(machine.getStatus()).toBe('pending');
    });

    it('should not allow transitions from terminal states', () => {
      const machine = new AgentStateMachine('finished');
      expect(() => machine.start()).toThrow('Invalid state transition');
      expect(machine.getStatus()).toBe('finished');
    });
  });

  describe('isTerminalState', () => {
    it('should return true for finished state', () => {
      expect(isTerminalState('finished')).toBe(true);
    });

    it('should return true for failed state', () => {
      expect(isTerminalState('failed')).toBe(true);
    });

    it('should return false for running state', () => {
      expect(isTerminalState('running')).toBe(false);
    });

    it('should return false for pending state', () => {
      expect(isTerminalState('pending')).toBe(false);
    });
  });

  describe('canTransition', () => {
    it('should return true for valid transitions', () => {
      expect(canTransition('pending', 'starting')).toBe(true);
      expect(canTransition('starting', 'running')).toBe(true);
      expect(canTransition('running', 'waiting_input')).toBe(true);
    });

    it('should return false for invalid transitions', () => {
      expect(canTransition('pending', 'running')).toBe(false);
      expect(canTransition('finished', 'running')).toBe(false);
    });
  });

  describe('isRunningState', () => {
    it('should return true for running states', () => {
      expect(isRunningState('running')).toBe(true);
      expect(isRunningState('starting')).toBe(true);
      expect(isRunningState('waiting_input')).toBe(true);
    });

    it('should return false for non-running states', () => {
      expect(isRunningState('pending')).toBe(false);
      expect(isRunningState('finished')).toBe(false);
      expect(isRunningState('failed')).toBe(false);
    });
  });

  describe('isPendingState', () => {
    it('should return true for pending state', () => {
      expect(isPendingState('pending')).toBe(true);
    });

    it('should return false for other states', () => {
      expect(isPendingState('running')).toBe(false);
      expect(isPendingState('finished')).toBe(false);
    });
  });
});
