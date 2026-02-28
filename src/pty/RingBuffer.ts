/**
 * Ring Buffer for PTY output buffering.
 * Maintains a fixed-size circular buffer of output lines.
 */
export class RingBuffer {
  private buffer: string[];
  private capacity: number;
  private head: number = 0;
  private size: number = 0;

  constructor(capacity: number = 10000) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  /**
   * Push a line to the buffer.
   * If buffer is full, overwrites the oldest entry.
   */
  push(line: string): void {
    this.buffer[this.head] = line;
    this.head = (this.head + 1) % this.capacity;
    if (this.size < this.capacity) {
      this.size++;
    }
  }

  /**
   * Push raw data, splitting by newlines.
   * Handles partial lines by buffering incomplete ones.
   */
  private partialLine: string = '';

  pushRaw(data: string): void {
    const combined = this.partialLine + data;
    const lines = combined.split('\n');

    // Last element might be incomplete (no newline at end)
    this.partialLine = lines.pop() || '';

    for (const line of lines) {
      this.push(line);
    }
  }

  /**
   * Flush any remaining partial line.
   */
  flush(): void {
    if (this.partialLine) {
      this.push(this.partialLine);
      this.partialLine = '';
    }
  }

  /**
   * Get all lines in chronological order.
   */
  getAll(): string[] {
    if (this.size === 0) return [];

    const result: string[] = [];
    const start = this.size < this.capacity ? 0 : this.head;

    for (let i = 0; i < this.size; i++) {
      const index = (start + i) % this.capacity;
      result.push(this.buffer[index]);
    }

    return result;
  }

  /**
   * Get the last N lines.
   */
  getLast(n: number): string[] {
    const all = this.getAll();
    return all.slice(-n);
  }

  /**
   * Get current size (number of lines).
   */
  getSize(): number {
    return this.size;
  }

  /**
   * Clear the buffer.
   */
  clear(): void {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.size = 0;
    this.partialLine = '';
  }

  /**
   * Get raw content as a single string (for terminal rendering).
   */
  getRawContent(): string {
    return this.getAll().join('\n');
  }
}
