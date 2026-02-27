import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import chalk from 'chalk';
import { getMaestroDir, LOGS_DIR } from './config.js';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const LOG_COLORS: Record<LogLevel, (text: string) => string> = {
  debug: chalk.gray,
  info: chalk.blue,
  warn: chalk.yellow,
  error: chalk.red,
};

const LOG_PREFIXES: Record<LogLevel, string> = {
  debug: 'DBG',
  info: 'INF',
  warn: 'WRN',
  error: 'ERR',
};

export interface LoggerOptions {
  level?: LogLevel;
  file?: string;
  console?: boolean;
  projectRoot?: string;
}

export class Logger {
  private level: LogLevel;
  private filePath?: string;
  private consoleEnabled: boolean;

  constructor(options: LoggerOptions = {}) {
    this.level = options.level || 'info';
    this.consoleEnabled = options.console !== false;

    if (options.file) {
      const logsDir = join(getMaestroDir(options.projectRoot), LOGS_DIR);
      this.filePath = join(logsDir, options.file);

      const dir = dirname(this.filePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.level];
  }

  private formatMessage(level: LogLevel, message: string, meta?: object): string {
    const timestamp = new Date().toISOString();
    const prefix = LOG_PREFIXES[level];
    const metaStr = meta ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${prefix}] ${message}${metaStr}`;
  }

  private log(level: LogLevel, message: string, meta?: object): void {
    if (!this.shouldLog(level)) return;

    const formattedMessage = this.formatMessage(level, message, meta);

    // Console output with colors
    if (this.consoleEnabled) {
      const colorFn = LOG_COLORS[level];
      const prefix = LOG_PREFIXES[level];
      const timestamp = chalk.dim(new Date().toISOString().split('T')[1].slice(0, 8));
      const metaStr = meta ? chalk.dim(` ${JSON.stringify(meta)}`) : '';
      console.log(`${timestamp} ${colorFn(`[${prefix}]`)} ${message}${metaStr}`);
    }

    // File output
    if (this.filePath) {
      appendFileSync(this.filePath, formattedMessage + '\n');
    }
  }

  debug(message: string, meta?: object): void {
    this.log('debug', message, meta);
  }

  info(message: string, meta?: object): void {
    this.log('info', message, meta);
  }

  warn(message: string, meta?: object): void {
    this.log('warn', message, meta);
  }

  error(message: string, meta?: object): void {
    this.log('error', message, meta);
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setConsole(enabled: boolean): void {
    this.consoleEnabled = enabled;
  }
}

// Global logger instance
let globalLogger: Logger | null = null;

export function getLogger(): Logger {
  if (!globalLogger) {
    globalLogger = new Logger({
      level: 'info',
      file: 'maestro.log',
      console: true,
    });
  }
  return globalLogger;
}

export function setGlobalLogger(logger: Logger): void {
  globalLogger = logger;
}

export function createAgentLogger(agentId: string, projectRoot?: string): Logger {
  return new Logger({
    level: 'debug',
    file: `${agentId}.log`,
    console: false,
    projectRoot,
  });
}
