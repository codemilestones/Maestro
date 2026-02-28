import { describe, it, expect, beforeEach } from 'vitest';
import { RingBuffer } from '../RingBuffer.js';

describe('RingBuffer', () => {
  let buffer: RingBuffer;

  beforeEach(() => {
    buffer = new RingBuffer(5);
  });

  describe('push and getAll', () => {
    it('should store lines in order', () => {
      buffer.push('line1');
      buffer.push('line2');
      buffer.push('line3');

      expect(buffer.getAll()).toEqual(['line1', 'line2', 'line3']);
    });

    it('should overwrite oldest entries when full', () => {
      buffer.push('line1');
      buffer.push('line2');
      buffer.push('line3');
      buffer.push('line4');
      buffer.push('line5');
      buffer.push('line6'); // Should overwrite line1

      expect(buffer.getAll()).toEqual(['line2', 'line3', 'line4', 'line5', 'line6']);
    });

    it('should handle multiple overwrites', () => {
      for (let i = 1; i <= 10; i++) {
        buffer.push(`line${i}`);
      }

      expect(buffer.getAll()).toEqual(['line6', 'line7', 'line8', 'line9', 'line10']);
    });
  });

  describe('pushRaw', () => {
    it('should split data by newlines', () => {
      buffer.pushRaw('line1\nline2\nline3\n');

      expect(buffer.getAll()).toEqual(['line1', 'line2', 'line3']);
    });

    it('should handle partial lines', () => {
      buffer.pushRaw('line1\npar');
      buffer.pushRaw('tial\nline3\n');

      expect(buffer.getAll()).toEqual(['line1', 'partial', 'line3']);
    });

    it('should flush partial line', () => {
      buffer.pushRaw('line1\npartial');
      buffer.flush();

      expect(buffer.getAll()).toEqual(['line1', 'partial']);
    });
  });

  describe('getLast', () => {
    it('should return last N lines', () => {
      buffer.push('line1');
      buffer.push('line2');
      buffer.push('line3');
      buffer.push('line4');

      expect(buffer.getLast(2)).toEqual(['line3', 'line4']);
    });

    it('should return all lines if N > size', () => {
      buffer.push('line1');
      buffer.push('line2');

      expect(buffer.getLast(10)).toEqual(['line1', 'line2']);
    });
  });

  describe('getSize', () => {
    it('should return current size', () => {
      expect(buffer.getSize()).toBe(0);

      buffer.push('line1');
      expect(buffer.getSize()).toBe(1);

      buffer.push('line2');
      buffer.push('line3');
      expect(buffer.getSize()).toBe(3);
    });

    it('should not exceed capacity', () => {
      for (let i = 0; i < 10; i++) {
        buffer.push(`line${i}`);
      }

      expect(buffer.getSize()).toBe(5);
    });
  });

  describe('clear', () => {
    it('should clear all data', () => {
      buffer.push('line1');
      buffer.push('line2');
      buffer.clear();

      expect(buffer.getAll()).toEqual([]);
      expect(buffer.getSize()).toBe(0);
    });
  });

  describe('getRawContent', () => {
    it('should return joined content', () => {
      buffer.push('line1');
      buffer.push('line2');
      buffer.push('line3');

      expect(buffer.getRawContent()).toBe('line1\nline2\nline3');
    });
  });
});
