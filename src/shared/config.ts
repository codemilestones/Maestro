import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse, stringify } from 'yaml';

export interface MaestroConfig {
  worktree: {
    baseDir: string;
    defaultBase: string;
    branchPrefix: string;
    autoCleanup: boolean;
    cleanupDelay: number;
  };
  agent: {
    maxConcurrent: number;
    defaultTimeout: number;
    claudePath: string;
    skipPermissions: boolean;
    autoRetry: boolean;
    maxRetries: number;
  };
  pr: {
    template: string;
    defaultBase: string;
    draft: boolean;
    autoLabels: boolean;
    labelMapping: Record<string, string>;
    contractAnalysis: boolean;
  };
}

const DEFAULT_CONFIG: MaestroConfig = {
  worktree: {
    baseDir: './worktrees',
    defaultBase: 'main',
    branchPrefix: 'maestro/',
    autoCleanup: true,
    cleanupDelay: 3600,
  },
  agent: {
    maxConcurrent: 5,
    defaultTimeout: 1800000, // 30 minutes
    claudePath: 'claude',
    skipPermissions: false,
    autoRetry: true,
    maxRetries: 2,
  },
  pr: {
    template: 'default',
    defaultBase: 'main',
    draft: false,
    autoLabels: true,
    labelMapping: {
      feat: 'enhancement',
      fix: 'bug',
      docs: 'documentation',
    },
    contractAnalysis: true,
  },
};

export const MAESTRO_DIR = '.maestro';
export const CONFIG_FILE = 'config.yaml';
export const STATE_DIR = 'state';
export const LOGS_DIR = 'logs';
export const TEMPLATES_DIR = 'templates';

export function getMaestroDir(projectRoot?: string): string {
  return join(projectRoot || process.cwd(), MAESTRO_DIR);
}

export function getConfigPath(projectRoot?: string): string {
  return join(getMaestroDir(projectRoot), CONFIG_FILE);
}

export function loadConfig(projectRoot?: string): MaestroConfig {
  const configPath = getConfigPath(projectRoot);

  if (!existsSync(configPath)) {
    return DEFAULT_CONFIG;
  }

  try {
    const content = readFileSync(configPath, 'utf-8');
    const userConfig = parse(content) as Partial<MaestroConfig>;
    return mergeConfig(DEFAULT_CONFIG, userConfig);
  } catch {
    return DEFAULT_CONFIG;
  }
}

export function saveConfig(config: MaestroConfig, projectRoot?: string): void {
  const configPath = getConfigPath(projectRoot);
  const maestroDir = getMaestroDir(projectRoot);

  if (!existsSync(maestroDir)) {
    mkdirSync(maestroDir, { recursive: true, mode: 0o700 });
  }

  writeFileSync(configPath, stringify(config), 'utf-8');
}

export function initMaestroDir(projectRoot?: string): void {
  const maestroDir = getMaestroDir(projectRoot);

  // Create directory structure
  const dirs = [
    maestroDir,
    join(maestroDir, STATE_DIR),
    join(maestroDir, LOGS_DIR),
    join(maestroDir, TEMPLATES_DIR),
  ];

  for (const dir of dirs) {
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true, mode: 0o700 });
    }
  }

  // Create default config if not exists
  const configPath = getConfigPath(projectRoot);
  if (!existsSync(configPath)) {
    saveConfig(DEFAULT_CONFIG, projectRoot);
  }
}

export function isMaestroInitialized(projectRoot?: string): boolean {
  return existsSync(getMaestroDir(projectRoot));
}

export function getConfigValue(key: string, projectRoot?: string): unknown {
  const config = loadConfig(projectRoot);
  const keys = key.split('.');
  let value: unknown = config;

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k];
    } else {
      return undefined;
    }
  }

  return value;
}

export function setConfigValue(key: string, value: unknown, projectRoot?: string): void {
  const config = loadConfig(projectRoot);
  const keys = key.split('.');
  let current: Record<string, unknown> = config as unknown as Record<string, unknown>;

  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i];
    if (!(k in current) || typeof current[k] !== 'object') {
      current[k] = {};
    }
    current = current[k] as Record<string, unknown>;
  }

  const lastKey = keys[keys.length - 1];
  current[lastKey] = value;

  saveConfig(config, projectRoot);
}

function mergeConfig(
  defaults: MaestroConfig,
  user: Partial<MaestroConfig>
): MaestroConfig {
  return {
    worktree: { ...defaults.worktree, ...user.worktree },
    agent: { ...defaults.agent, ...user.agent },
    pr: {
      ...defaults.pr,
      ...user.pr,
      labelMapping: { ...defaults.pr.labelMapping, ...user.pr?.labelMapping },
    },
  };
}
