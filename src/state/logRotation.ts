import { existsSync, readdirSync, statSync, unlinkSync, renameSync, mkdirSync } from 'node:fs';
import { join, basename, extname } from 'node:path';
import { getMaestroDir, LOGS_DIR, loadConfig } from '../shared/config.js';
import { getLogger } from '../shared/logger.js';

export interface LogRotationOptions {
  maxSize?: number; // Max file size in bytes before rotation
  maxFiles?: number; // Max number of log files to keep
  maxAge?: number; // Max age in days
  compress?: boolean; // Whether to compress rotated logs (not implemented yet)
}

const DEFAULT_OPTIONS: LogRotationOptions = {
  maxSize: 10 * 1024 * 1024, // 10 MB
  maxFiles: 10,
  maxAge: 30, // 30 days
  compress: false,
};

export class LogRotation {
  private projectRoot: string;
  private options: LogRotationOptions;
  private logger = getLogger();

  constructor(projectRoot?: string, options?: LogRotationOptions) {
    this.projectRoot = projectRoot || process.cwd();
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  private getLogsDir(): string {
    return join(getMaestroDir(this.projectRoot), LOGS_DIR);
  }

  /**
   * Rotate a specific log file
   */
  rotateFile(filePath: string): void {
    if (!existsSync(filePath)) {
      return;
    }

    const stats = statSync(filePath);
    if (stats.size < (this.options.maxSize || DEFAULT_OPTIONS.maxSize!)) {
      return;
    }

    this.logger.debug('Rotating log file', { path: filePath, size: stats.size });

    const dir = join(filePath, '..');
    const base = basename(filePath, extname(filePath));
    const ext = extname(filePath);

    // Find existing rotated files
    const rotatedFiles = this.getRotatedFiles(dir, base, ext);

    // Rename existing rotated files (log.1.log -> log.2.log)
    for (let i = rotatedFiles.length - 1; i >= 0; i--) {
      const oldPath = join(dir, `${base}.${i + 1}${ext}`);
      const newPath = join(dir, `${base}.${i + 2}${ext}`);

      if (existsSync(oldPath)) {
        if (i + 2 > (this.options.maxFiles || DEFAULT_OPTIONS.maxFiles!)) {
          // Delete files exceeding maxFiles
          unlinkSync(oldPath);
        } else {
          renameSync(oldPath, newPath);
        }
      }
    }

    // Rename current file to .1
    const rotatedPath = join(dir, `${base}.1${ext}`);
    renameSync(filePath, rotatedPath);

    this.logger.info('Log file rotated', { from: filePath, to: rotatedPath });
  }

  /**
   * Get list of rotated files for a base name
   */
  private getRotatedFiles(dir: string, base: string, ext: string): string[] {
    if (!existsSync(dir)) {
      return [];
    }

    const files = readdirSync(dir);
    const pattern = new RegExp(`^${base}\\.(\\d+)${ext.replace('.', '\\.')}$`);

    return files
      .filter((f) => pattern.test(f))
      .sort((a, b) => {
        const numA = parseInt(a.match(pattern)![1], 10);
        const numB = parseInt(b.match(pattern)![1], 10);
        return numA - numB;
      });
  }

  /**
   * Clean up old log files based on age
   */
  cleanupOldLogs(): number {
    const logsDir = this.getLogsDir();
    if (!existsSync(logsDir)) {
      return 0;
    }

    const maxAgeMs = (this.options.maxAge || DEFAULT_OPTIONS.maxAge!) * 24 * 60 * 60 * 1000;
    const cutoffTime = Date.now() - maxAgeMs;
    let deletedCount = 0;

    const processDir = (dir: string) => {
      const entries = readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          processDir(fullPath);
          // Remove empty directories
          try {
            const contents = readdirSync(fullPath);
            if (contents.length === 0) {
              const fs = require('node:fs');
              fs.rmdirSync(fullPath);
            }
          } catch {
            // Ignore errors
          }
        } else if (entry.isFile() && entry.name.endsWith('.log')) {
          const stats = statSync(fullPath);
          if (stats.mtimeMs < cutoffTime) {
            this.logger.debug('Deleting old log file', { path: fullPath, age: Date.now() - stats.mtimeMs });
            unlinkSync(fullPath);
            deletedCount++;
          }
        }
      }
    };

    processDir(logsDir);

    if (deletedCount > 0) {
      this.logger.info('Cleaned up old log files', { count: deletedCount });
    }

    return deletedCount;
  }

  /**
   * Rotate all log files that need rotation
   */
  rotateAll(): void {
    const logsDir = this.getLogsDir();
    if (!existsSync(logsDir)) {
      return;
    }

    const processDir = (dir: string) => {
      const entries = readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          processDir(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.log') && !entry.name.match(/\.\d+\.log$/)) {
          // Only rotate primary log files, not already rotated ones
          this.rotateFile(fullPath);
        }
      }
    };

    processDir(logsDir);
  }

  /**
   * Get total size of logs directory
   */
  getTotalLogsSize(): number {
    const logsDir = this.getLogsDir();
    if (!existsSync(logsDir)) {
      return 0;
    }

    let totalSize = 0;

    const processDir = (dir: string) => {
      const entries = readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
          processDir(fullPath);
        } else if (entry.isFile()) {
          totalSize += statSync(fullPath).size;
        }
      }
    };

    processDir(logsDir);

    return totalSize;
  }

  /**
   * Perform full maintenance: rotate and cleanup
   */
  maintain(): { rotated: number; deleted: number; totalSize: number } {
    this.rotateAll();
    const deleted = this.cleanupOldLogs();
    const totalSize = this.getTotalLogsSize();

    return { rotated: 0, deleted, totalSize };
  }
}

/**
 * Schedule periodic log maintenance
 */
export function scheduleLogMaintenance(
  projectRoot?: string,
  intervalMs: number = 60 * 60 * 1000 // 1 hour
): NodeJS.Timeout {
  const rotation = new LogRotation(projectRoot);

  return setInterval(() => {
    try {
      rotation.maintain();
    } catch (error) {
      getLogger().warn('Log maintenance failed', { error });
    }
  }, intervalMs);
}
