import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  PatternStatusDetector,
  CLAUDE_CODE_PATTERNS,
  createClaudeCodeDetector,
} from '../PatternStatusDetector.js';
import { DetectedStatus } from '../types.js';

describe('PatternStatusDetector', () => {
  let detector: PatternStatusDetector;

  beforeEach(() => {
    vi.useFakeTimers();
    detector = new PatternStatusDetector({ debounceMs: 100 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('initial state', () => {
    it('should start with unknown status', () => {
      expect(detector.currentStatus()).toBe('unknown');
    });

    it('should not be paused initially', () => {
      expect(detector.isPaused()).toBe(false);
    });
  });

  describe('idle detection', () => {
    it('should detect Claude Code prompt as idle', () => {
      detector.feed('Some output❯ ');
      vi.advanceTimersByTime(100);

      expect(detector.currentStatus()).toBe('idle');
    });

    it('should detect shell prompt as idle', () => {
      detector.feed('$ ');
      vi.advanceTimersByTime(100);

      expect(detector.currentStatus()).toBe('idle');
    });

    it('should detect generic prompt as idle', () => {
      detector.feed('> ');
      vi.advanceTimersByTime(100);

      expect(detector.currentStatus()).toBe('idle');
    });
  });

  describe('running detection', () => {
    it('should detect spinner characters as running', () => {
      const spinners = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧'];

      for (const spinner of spinners) {
        detector.reset();
        detector.feed(`Working ${spinner}`);
        vi.advanceTimersByTime(100);

        expect(detector.currentStatus()).toBe('running');
      }
    });

    it('should detect trailing dots as running', () => {
      detector.feed('Thinking...');
      vi.advanceTimersByTime(100);

      expect(detector.currentStatus()).toBe('running');
    });

    it('should detect Loading indicator as running', () => {
      detector.feed('Loading resources');
      vi.advanceTimersByTime(100);

      expect(detector.currentStatus()).toBe('running');
    });
  });

  describe('waiting_input detection', () => {
    it('should detect y/n prompt as waiting_input', () => {
      detector.feed('Continue? (y/n)');
      vi.advanceTimersByTime(100);

      expect(detector.currentStatus()).toBe('waiting_input');
    });

    it('should detect Y/n prompt as waiting_input', () => {
      detector.feed('Apply changes? [Y/n]');
      vi.advanceTimersByTime(100);

      expect(detector.currentStatus()).toBe('waiting_input');
    });

    it('should detect permission prompt as waiting_input', () => {
      detector.feed('Permission required?');
      vi.advanceTimersByTime(100);

      expect(detector.currentStatus()).toBe('waiting_input');
    });

    it('should detect input prompt as waiting_input', () => {
      detector.feed('Enter filename:');
      vi.advanceTimersByTime(100);

      expect(detector.currentStatus()).toBe('waiting_input');
    });
  });

  describe('priority order', () => {
    it('should prioritize waiting_input over running', () => {
      detector.feed('Loading... Continue? (y/n)');
      vi.advanceTimersByTime(100);

      expect(detector.currentStatus()).toBe('waiting_input');
    });

    it('should prioritize waiting_input over idle', () => {
      detector.feed('> Do you want to continue?');
      vi.advanceTimersByTime(100);

      expect(detector.currentStatus()).toBe('waiting_input');
    });

    it('should prioritize running over idle', () => {
      detector.feed('❯ Processing ⠋');
      vi.advanceTimersByTime(100);

      expect(detector.currentStatus()).toBe('running');
    });
  });

  describe('debouncing', () => {
    it('should debounce rapid status changes', () => {
      const callback = vi.fn();
      detector.onStatusChange(callback);

      // Rapid status changes
      detector.feed('⠋');
      vi.advanceTimersByTime(50);
      detector.feed('❯ ');
      vi.advanceTimersByTime(50);
      detector.feed('(y/n)');
      vi.advanceTimersByTime(100);

      // Should only call once with final status
      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith('waiting_input', 'unknown');
    });

    it('should wait for debounce period before notifying', () => {
      const callback = vi.fn();
      detector.onStatusChange(callback);

      detector.feed('⠋');
      vi.advanceTimersByTime(50);

      expect(callback).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);

      expect(callback).toHaveBeenCalledWith('running', 'unknown');
    });
  });

  describe('status change callbacks', () => {
    it('should notify on status change', () => {
      const callback = vi.fn();
      detector.onStatusChange(callback);

      detector.feed('⠋');
      vi.advanceTimersByTime(100);

      expect(callback).toHaveBeenCalledWith('running', 'unknown');
    });

    it('should support multiple callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      detector.onStatusChange(callback1);
      detector.onStatusChange(callback2);

      detector.feed('⠋');
      vi.advanceTimersByTime(100);

      expect(callback1).toHaveBeenCalled();
      expect(callback2).toHaveBeenCalled();
    });

    it('should allow unsubscribing', () => {
      const callback = vi.fn();
      const unsubscribe = detector.onStatusChange(callback);

      unsubscribe();

      detector.feed('⠋');
      vi.advanceTimersByTime(100);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should not notify if status unchanged', () => {
      const callback = vi.fn();

      detector.feed('⠋');
      vi.advanceTimersByTime(100);

      detector.onStatusChange(callback);

      detector.feed('⠙');
      vi.advanceTimersByTime(100);

      expect(callback).not.toHaveBeenCalled();
    });
  });

  describe('override', () => {
    it('should immediately set status', () => {
      detector.override('running');

      expect(detector.currentStatus()).toBe('running');
    });

    it('should pause auto-detection', () => {
      detector.override('running', 1000);

      expect(detector.isPaused()).toBe(true);

      detector.feed('❯ ');
      vi.advanceTimersByTime(100);

      expect(detector.currentStatus()).toBe('running');
    });

    it('should resume auto-detection after pause duration', () => {
      detector.override('running', 1000);

      vi.advanceTimersByTime(1000);

      expect(detector.isPaused()).toBe(false);

      detector.feed('❯ ');
      vi.advanceTimersByTime(100);

      expect(detector.currentStatus()).toBe('idle');
    });

    it('should notify callback on override', () => {
      const callback = vi.fn();
      detector.onStatusChange(callback);

      detector.override('running');

      expect(callback).toHaveBeenCalledWith('running', 'unknown');
    });
  });

  describe('reset', () => {
    it('should reset status to unknown', () => {
      detector.feed('⠋');
      vi.advanceTimersByTime(100);

      detector.reset();

      expect(detector.currentStatus()).toBe('unknown');
    });

    it('should clear pending debounce', () => {
      const callback = vi.fn();
      detector.onStatusChange(callback);

      detector.feed('⠋');
      vi.advanceTimersByTime(50);

      detector.reset();
      vi.advanceTimersByTime(100);

      expect(callback).not.toHaveBeenCalled();
    });

    it('should clear output buffer', () => {
      detector.feed('some output');
      detector.reset();

      expect(detector.getOutputBuffer()).toBe('');
    });

    it('should clear override', () => {
      detector.override('running', 10000);
      detector.reset();

      expect(detector.isPaused()).toBe(false);
    });
  });

  describe('custom patterns', () => {
    it('should support custom patterns via constructor', () => {
      const customDetector = new PatternStatusDetector({
        patterns: {
          idle: [/^READY$/],
          running: [/^BUSY$/],
          waiting_input: [/^INPUT$/],
        },
        debounceMs: 0,
      });

      customDetector.feed('READY');
      vi.advanceTimersByTime(0);
      expect(customDetector.currentStatus()).toBe('idle');

      customDetector.reset();
      customDetector.feed('BUSY');
      vi.advanceTimersByTime(0);
      expect(customDetector.currentStatus()).toBe('running');

      customDetector.reset();
      customDetector.feed('INPUT');
      vi.advanceTimersByTime(0);
      expect(customDetector.currentStatus()).toBe('waiting_input');
    });

    it('should allow adding patterns', () => {
      detector.addPatterns({
        idle: [/^CUSTOM_IDLE$/],
      });

      detector.feed('CUSTOM_IDLE');
      vi.advanceTimersByTime(100);

      expect(detector.currentStatus()).toBe('idle');
    });
  });

  describe('createClaudeCodeDetector', () => {
    it('should create detector with Claude Code patterns', () => {
      const ccDetector = createClaudeCodeDetector({ debounceMs: 0 });

      ccDetector.feed('❯ ');
      vi.advanceTimersByTime(0);

      expect(ccDetector.currentStatus()).toBe('idle');
    });
  });
});

describe('CLAUDE_CODE_PATTERNS', () => {
  it('should have idle patterns', () => {
    expect(CLAUDE_CODE_PATTERNS.idle).toBeDefined();
    expect(CLAUDE_CODE_PATTERNS.idle!.length).toBeGreaterThan(0);
  });

  it('should have running patterns', () => {
    expect(CLAUDE_CODE_PATTERNS.running).toBeDefined();
    expect(CLAUDE_CODE_PATTERNS.running!.length).toBeGreaterThan(0);
  });

  it('should have waiting_input patterns', () => {
    expect(CLAUDE_CODE_PATTERNS.waiting_input).toBeDefined();
    expect(CLAUDE_CODE_PATTERNS.waiting_input!.length).toBeGreaterThan(0);
  });
});
