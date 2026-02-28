import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PrefixKeyHandler } from '../PrefixKeyHandler.js';
import { parseKeyNotation, formatKeyNotation } from '../types.js';

describe('parseKeyNotation', () => {
  it('should parse Ctrl+]', () => {
    const result = parseKeyNotation('C-]');
    expect(result).toBe(String.fromCharCode(29));
  });

  it('should parse Ctrl+b', () => {
    const result = parseKeyNotation('C-b');
    expect(result).toBe(String.fromCharCode(2));
  });

  it('should parse Ctrl+a', () => {
    const result = parseKeyNotation('C-a');
    expect(result).toBe(String.fromCharCode(1));
  });

  it('should be case insensitive', () => {
    expect(parseKeyNotation('C-B')).toBe(parseKeyNotation('C-b'));
    expect(parseKeyNotation('c-b')).toBe(parseKeyNotation('C-b'));
  });

  it('should return null for invalid notation', () => {
    expect(parseKeyNotation('invalid')).toBeNull();
    expect(parseKeyNotation('')).toBeNull();
  });
});

describe('formatKeyNotation', () => {
  it('should format Ctrl notation', () => {
    expect(formatKeyNotation('C-]')).toBe('Ctrl+]');
    expect(formatKeyNotation('C-b')).toBe('Ctrl+b');
  });

  it('should return as-is for non-Ctrl notation', () => {
    expect(formatKeyNotation('Enter')).toBe('Enter');
  });
});

describe('PrefixKeyHandler', () => {
  let handler: PrefixKeyHandler;
  const CTRL_BRACKET = String.fromCharCode(29); // Ctrl+]

  beforeEach(() => {
    vi.useFakeTimers();
    handler = new PrefixKeyHandler({ key: 'C-]', timeout: 500 });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create handler with valid key', () => {
      expect(handler).toBeDefined();
    });

    it('should throw for invalid key notation', () => {
      expect(() => new PrefixKeyHandler({ key: 'invalid', timeout: 500 })).toThrow(
        'Invalid prefix key notation'
      );
    });
  });

  describe('normal state', () => {
    it('should pass through regular characters', () => {
      const passthrough = vi.fn();
      handler.on('passthrough', passthrough);

      handler.feed(Buffer.from('hello'));

      expect(passthrough).toHaveBeenCalledTimes(5);
      expect(passthrough).toHaveBeenNthCalledWith(1, Buffer.from('h'));
      expect(passthrough).toHaveBeenNthCalledWith(2, Buffer.from('e'));
    });

    it('should enter prefix pending state on prefix key', () => {
      handler.feed(Buffer.from(CTRL_BRACKET));

      expect(handler.isPrefixPending()).toBe(true);
    });
  });

  describe('prefix pending state', () => {
    it('should emit detach command on d', () => {
      const command = vi.fn();
      handler.on('command', command);

      handler.feed(Buffer.from(CTRL_BRACKET));
      handler.feed(Buffer.from('d'));

      expect(command).toHaveBeenCalledWith('d');
      expect(handler.isPrefixPending()).toBe(false);
    });

    it('should emit next command on n', () => {
      const command = vi.fn();
      handler.on('command', command);

      handler.feed(Buffer.from(CTRL_BRACKET));
      handler.feed(Buffer.from('n'));

      expect(command).toHaveBeenCalledWith('n');
    });

    it('should emit previous command on p', () => {
      const command = vi.fn();
      handler.on('command', command);

      handler.feed(Buffer.from(CTRL_BRACKET));
      handler.feed(Buffer.from('p'));

      expect(command).toHaveBeenCalledWith('p');
    });

    it('should emit kill command on k', () => {
      const command = vi.fn();
      handler.on('command', command);

      handler.feed(Buffer.from(CTRL_BRACKET));
      handler.feed(Buffer.from('k'));

      expect(command).toHaveBeenCalledWith('k');
    });

    it('should emit help command on ?', () => {
      const command = vi.fn();
      handler.on('command', command);

      handler.feed(Buffer.from(CTRL_BRACKET));
      handler.feed(Buffer.from('?'));

      expect(command).toHaveBeenCalledWith('?');
    });

    it('should pass through prefix key on double press', () => {
      const passthrough = vi.fn();
      handler.on('passthrough', passthrough);

      handler.feed(Buffer.from(CTRL_BRACKET));
      handler.feed(Buffer.from(CTRL_BRACKET));

      expect(passthrough).toHaveBeenCalledWith(Buffer.from(CTRL_BRACKET));
      expect(handler.isPrefixPending()).toBe(false);
    });

    it('should be case insensitive for commands', () => {
      const command = vi.fn();
      handler.on('command', command);

      handler.feed(Buffer.from(CTRL_BRACKET));
      handler.feed(Buffer.from('D'));

      expect(command).toHaveBeenCalledWith('d');
    });
  });

  describe('timeout', () => {
    it('should emit detach on timeout', () => {
      const command = vi.fn();
      handler.on('command', command);

      handler.feed(Buffer.from(CTRL_BRACKET));

      expect(command).not.toHaveBeenCalled();

      vi.advanceTimersByTime(500);

      expect(command).toHaveBeenCalledWith('d');
      expect(handler.isPrefixPending()).toBe(false);
    });

    it('should not timeout if key pressed within timeout', () => {
      const command = vi.fn();
      handler.on('command', command);

      handler.feed(Buffer.from(CTRL_BRACKET));
      vi.advanceTimersByTime(200);
      handler.feed(Buffer.from('n'));

      expect(command).toHaveBeenCalledWith('n');
      expect(command).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(500);
      expect(command).toHaveBeenCalledTimes(1);
    });
  });

  describe('reset', () => {
    it('should reset state', () => {
      handler.feed(Buffer.from(CTRL_BRACKET));
      expect(handler.isPrefixPending()).toBe(true);

      handler.reset();

      expect(handler.isPrefixPending()).toBe(false);
    });

    it('should clear pending timeout', () => {
      const command = vi.fn();
      handler.on('command', command);

      handler.feed(Buffer.from(CTRL_BRACKET));
      handler.reset();

      vi.advanceTimersByTime(500);

      expect(command).not.toHaveBeenCalled();
    });
  });

  describe('getHelpText', () => {
    it('should return help text with formatted key', () => {
      const help = handler.getHelpText();

      expect(help).toContain('Ctrl+]');
      expect(help).toContain('Detach');
      expect(help).toContain('next session');
      expect(help).toContain('previous session');
      expect(help).toContain('Kill');
    });
  });
});
