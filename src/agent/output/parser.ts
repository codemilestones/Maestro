import { ClaudeStreamEvent } from '../../shared/types.js';
import { getLogger } from '../../shared/logger.js';

export type ParsedEventType =
  | 'message'
  | 'tool_use'
  | 'input_request'
  | 'result'
  | 'system'
  | 'unknown';

export interface ParsedEvent {
  type: ParsedEventType;
  raw: ClaudeStreamEvent;
  content?: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
}

export interface ParserCallbacks {
  onMessage?: (content: string) => void;
  onToolUse?: (name: string, input: Record<string, unknown>) => void;
  onInputRequest?: () => void;
  onResult?: (content: string) => void;
  onError?: (error: Error) => void;
}

export class OutputParser {
  private buffer: string = '';
  private callbacks: ParserCallbacks;
  private logger = getLogger();

  constructor(callbacks: ParserCallbacks = {}) {
    this.callbacks = callbacks;
  }

  feed(chunk: string): ParsedEvent[] {
    this.buffer += chunk;
    const events: ParsedEvent[] = [];

    // Process complete JSON lines
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line in buffer

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const event = this.parseLine(trimmed);
        if (event) {
          events.push(event);
          this.dispatchEvent(event);
        } else {
          // parseLine returned null (not valid JSON), emit as raw text
          this.logger.debug(`Non-JSON output, emitting as raw text`, { line: trimmed.slice(0, 100) });
          if (this.callbacks.onMessage) {
            this.callbacks.onMessage(trimmed);
          }
          events.push({
            type: 'message',
            raw: { type: 'system', message: { content: trimmed } },
            content: trimmed,
          });
        }
      } catch (error) {
        this.logger.debug(`Failed to parse line: ${trimmed}`, {
          error: error instanceof Error ? error.message : String(error),
        });
        // Fallback: emit as raw text message
        if (this.callbacks.onMessage) {
          this.callbacks.onMessage(trimmed);
        }
      }
    }

    return events;
  }

  private parseLine(line: string): ParsedEvent | null {
    let parsed: ClaudeStreamEvent;

    try {
      parsed = JSON.parse(line) as ClaudeStreamEvent;
    } catch {
      // Not valid JSON, skip
      return null;
    }

    return this.categorizeEvent(parsed);
  }

  private categorizeEvent(event: ClaudeStreamEvent): ParsedEvent {
    // Check for input request first
    if (event.subtype === 'input_request') {
      return {
        type: 'input_request',
        raw: event,
      };
    }

    // Check for tool use
    if (event.tool_use) {
      return {
        type: 'tool_use',
        raw: event,
        toolName: event.tool_use.name,
        toolInput: event.tool_use.input,
      };
    }

    // Categorize by type
    switch (event.type) {
      case 'assistant':
        return {
          type: 'message',
          raw: event,
          content: event.message?.content,
        };

      case 'result':
        return {
          type: 'result',
          raw: event,
          content: event.message?.content,
        };

      case 'system':
        return {
          type: 'system',
          raw: event,
          content: event.message?.content,
        };

      case 'user':
        return {
          type: 'message',
          raw: event,
          content: event.message?.content,
        };

      default:
        return {
          type: 'unknown',
          raw: event,
        };
    }
  }

  private dispatchEvent(event: ParsedEvent): void {
    try {
      switch (event.type) {
        case 'message':
          if (event.content && this.callbacks.onMessage) {
            this.callbacks.onMessage(event.content);
          }
          break;

        case 'tool_use':
          if (event.toolName && this.callbacks.onToolUse) {
            this.callbacks.onToolUse(event.toolName, event.toolInput || {});
          }
          break;

        case 'input_request':
          if (this.callbacks.onInputRequest) {
            this.callbacks.onInputRequest();
          }
          break;

        case 'result':
          if (event.content && this.callbacks.onResult) {
            this.callbacks.onResult(event.content);
          }
          break;
      }
    } catch (error) {
      if (this.callbacks.onError) {
        this.callbacks.onError(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  flush(): ParsedEvent[] {
    if (!this.buffer.trim()) {
      return [];
    }

    const events: ParsedEvent[] = [];
    try {
      const event = this.parseLine(this.buffer.trim());
      if (event) {
        events.push(event);
        this.dispatchEvent(event);
      }
    } catch {
      // Ignore incomplete data
    }

    this.buffer = '';
    return events;
  }

  reset(): void {
    this.buffer = '';
  }
}

export function extractFilesFromToolCalls(events: ParsedEvent[]): string[] {
  const files = new Set<string>();

  for (const event of events) {
    if (event.type !== 'tool_use' || !event.toolInput) continue;

    const input = event.toolInput;

    // Common file-related tool inputs
    if (typeof input.path === 'string') {
      files.add(input.path);
    }
    if (typeof input.file_path === 'string') {
      files.add(input.file_path);
    }
    if (typeof input.filePath === 'string') {
      files.add(input.filePath);
    }
  }

  return Array.from(files);
}
