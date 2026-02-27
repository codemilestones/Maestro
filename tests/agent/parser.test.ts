import { describe, it, expect, vi } from 'vitest';
import { OutputParser, extractFilesFromToolCalls, ParsedEvent } from '../../src/agent/output/parser.js';

describe('OutputParser', () => {
  describe('feed', () => {
    it('should parse assistant message event', () => {
      const parser = new OutputParser();
      const events = parser.feed('{"type":"assistant","message":{"content":"Hello"}}\n');

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('message');
      expect(events[0].content).toBe('Hello');
    });

    it('should parse tool_use event', () => {
      const parser = new OutputParser();
      const events = parser.feed('{"tool_use":{"name":"Read","input":{"path":"/test.ts"}}}\n');

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('tool_use');
      expect(events[0].toolName).toBe('Read');
    });

    it('should parse result event', () => {
      const parser = new OutputParser();
      const events = parser.feed('{"type":"result","message":{"content":"Task completed"}}\n');

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe('result');
      expect(events[0].content).toBe('Task completed');
    });

    it('should skip invalid JSON lines', () => {
      const parser = new OutputParser();
      const events = parser.feed('not valid json\n');
      expect(events).toHaveLength(0);
    });

    it('should handle incomplete lines (buffer)', () => {
      const parser = new OutputParser();

      const events1 = parser.feed('{"type":"as');
      expect(events1).toHaveLength(0);

      const events2 = parser.feed('sistant","message":{"content":"Hi"}}\n');
      expect(events2).toHaveLength(1);
      expect(events2[0].type).toBe('message');
    });
  });

  describe('callbacks', () => {
    it('should call onMessage callback', () => {
      const onMessage = vi.fn();
      const parser = new OutputParser({ onMessage });

      parser.feed('{"type":"assistant","message":{"content":"Hello world"}}\n');

      expect(onMessage).toHaveBeenCalledWith('Hello world');
    });

    it('should call onToolUse callback', () => {
      const onToolUse = vi.fn();
      const parser = new OutputParser({ onToolUse });

      parser.feed('{"tool_use":{"name":"Write","input":{"path":"/test.ts"}}}\n');

      expect(onToolUse).toHaveBeenCalledWith('Write', { path: '/test.ts' });
    });

    it('should call onInputRequest callback', () => {
      const onInputRequest = vi.fn();
      const parser = new OutputParser({ onInputRequest });

      parser.feed('{"subtype":"input_request"}\n');

      expect(onInputRequest).toHaveBeenCalled();
    });
  });

  describe('flush', () => {
    it('should process remaining buffer', () => {
      const parser = new OutputParser();

      parser.feed('{"type":"assistant","message":{"content":"Final"}}');
      const events = parser.flush();

      expect(events).toHaveLength(1);
      expect(events[0].content).toBe('Final');
    });
  });

  describe('extractFilesFromToolCalls', () => {
    it('should extract file paths from tool events', () => {
      const events: ParsedEvent[] = [
        { type: 'tool_use', toolName: 'Read', toolInput: { path: '/file1.ts' }, raw: {} as any },
        { type: 'tool_use', toolName: 'Write', toolInput: { file_path: '/file2.ts' }, raw: {} as any },
        { type: 'message', content: 'Hello', raw: {} as any },
      ];

      const files = extractFilesFromToolCalls(events);
      expect(files).toContain('/file1.ts');
      expect(files).toContain('/file2.ts');
      expect(files).toHaveLength(2);
    });
  });
});
