/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useOutput } from '../../src/tui/hooks/useOutput.js';
import { AgentController } from '../../src/agent/AgentController.js';
import { AgentEvent } from '../../src/shared/types.js';

// Mock the logger to avoid console noise
vi.mock('../../src/shared/logger.js', () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

describe('useOutput', () => {
  let mockController: Partial<AgentController>;
  let eventCallback: ((event: AgentEvent) => void) | null = null;

  beforeEach(() => {
    eventCallback = null;

    mockController = {
      getOutput: vi.fn().mockReturnValue([]),
      onEvent: vi.fn().mockImplementation((callback) => {
        eventCallback = callback;
        return () => {
          eventCallback = null;
        };
      }),
    };
  });

  it('should return empty lines when no agentId', () => {
    const { result } = renderHook(() =>
      useOutput(mockController as AgentController, null)
    );

    expect(result.current.lines).toEqual([]);
  });

  it('should load existing output on mount', () => {
    const existingOutput = ['Line 1', 'Line 2', 'Line 3'];
    mockController.getOutput = vi.fn().mockReturnValue(existingOutput);

    const { result } = renderHook(() =>
      useOutput(mockController as AgentController, 'agent-123')
    );

    expect(result.current.lines).toEqual(existingOutput);
  });

  it('should subscribe to events on mount', () => {
    renderHook(() =>
      useOutput(mockController as AgentController, 'agent-123')
    );

    expect(mockController.onEvent).toHaveBeenCalled();
    expect(eventCallback).not.toBeNull();
  });

  it('should update lines when output event received', () => {
    const { result } = renderHook(() =>
      useOutput(mockController as AgentController, 'agent-123')
    );

    // Simulate output event
    act(() => {
      eventCallback!({
        type: 'output',
        agentId: 'agent-123',
        timestamp: new Date(),
        data: 'New output line',
      });
    });

    expect(result.current.lines).toContain('New output line');
  });

  it('should ignore output events for other agents', () => {
    const { result } = renderHook(() =>
      useOutput(mockController as AgentController, 'agent-123')
    );

    // Simulate output event for different agent
    act(() => {
      eventCallback!({
        type: 'output',
        agentId: 'agent-other',
        timestamp: new Date(),
        data: 'Other agent output',
      });
    });

    expect(result.current.lines).not.toContain('Other agent output');
  });

  it('should limit lines to MAX_LINES (100)', () => {
    // Pre-fill with 99 lines
    const existingOutput = Array.from({ length: 99 }, (_, i) => `Line ${i + 1}`);
    mockController.getOutput = vi.fn().mockReturnValue(existingOutput);

    const { result } = renderHook(() =>
      useOutput(mockController as AgentController, 'agent-123')
    );

    // Add more lines
    act(() => {
      eventCallback!({
        type: 'output',
        agentId: 'agent-123',
        timestamp: new Date(),
        data: 'Line 100',
      });
      eventCallback!({
        type: 'output',
        agentId: 'agent-123',
        timestamp: new Date(),
        data: 'Line 101',
      });
    });

    // Should have exactly 100 lines
    expect(result.current.lines).toHaveLength(100);
    // First line should have been removed
    expect(result.current.lines).not.toContain('Line 1');
    // Latest line should be present
    expect(result.current.lines).toContain('Line 101');
  });

  it('should clear lines when agentId changes to null', () => {
    const { result, rerender } = renderHook(
      ({ agentId }) => useOutput(mockController as AgentController, agentId),
      { initialProps: { agentId: 'agent-123' as string | null } }
    );

    // Add some output
    act(() => {
      eventCallback!({
        type: 'output',
        agentId: 'agent-123',
        timestamp: new Date(),
        data: 'Some output',
      });
    });

    expect(result.current.lines.length).toBeGreaterThan(0);

    // Change to null
    rerender({ agentId: null });

    expect(result.current.lines).toEqual([]);
  });

  it('should provide clear function', () => {
    const existingOutput = ['Line 1', 'Line 2'];
    mockController.getOutput = vi.fn().mockReturnValue(existingOutput);

    const { result } = renderHook(() =>
      useOutput(mockController as AgentController, 'agent-123')
    );

    expect(result.current.lines.length).toBeGreaterThan(0);

    act(() => {
      result.current.clear();
    });

    expect(result.current.lines).toEqual([]);
  });

  it('should unsubscribe on unmount', () => {
    const unsubscribe = vi.fn();
    mockController.onEvent = vi.fn().mockReturnValue(unsubscribe);

    const { unmount } = renderHook(() =>
      useOutput(mockController as AgentController, 'agent-123')
    );

    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });
});
