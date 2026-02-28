// Agent Status
export type AgentStatus =
  | 'pending'
  | 'starting'
  | 'running'
  | 'waiting_input'
  | 'finished'
  | 'failed';

// Agent Metrics
export interface AgentMetrics {
  tokensUsed: number;
  toolCalls: number;
  filesModified: string[];
  duration?: number;
}

// Agent Information
export interface AgentInfo {
  id: string;
  name?: string;
  prompt: string;
  worktreeId: string;
  branch: string;
  status: AgentStatus;
  pid?: number;
  createdAt: Date;
  spawnedAt?: Date; // Timestamp when process was actually spawned (for grace period checking)
  startedAt?: Date;
  finishedAt?: Date;
  exitCode?: number;
  error?: string;
  metrics: AgentMetrics;
}

// Worktree Status
export type WorktreeStatus = 'active' | 'archived' | 'deleted';

// Worktree Information
export interface WorktreeInfo {
  id: string;
  path: string;
  branch: string;
  baseBranch: string;
  createdAt: Date;
  status: WorktreeStatus;
}

// Spawn Options (from CLI)
export interface SpawnOptions {
  prompt: string;
  branch?: string;
  base?: string;
  name?: string;
  autoCommit?: boolean;
  autoPR?: boolean;
}

// Agent Spawn Options (internal)
export interface AgentSpawnOptions {
  prompt: string;
  worktreePath: string;
  name?: string;
  env?: Record<string, string>;
  timeout?: number;
}

// Create Worktree Options
export interface CreateWorktreeOptions {
  branch: string;
  base?: string;
  taskId?: string;
}

// Remove Worktree Options
export interface RemoveWorktreeOptions {
  force?: boolean;
  deleteRemoteBranch?: boolean;
}

// PR Options
export interface PROptions {
  agentId: string;
  title?: string;
  draft?: boolean;
  reviewers?: string[];
  labels?: string[];
  autoMerge?: boolean;
}

// PR Information
export interface PRInfo {
  url: string;
  number: number;
  title: string;
  branch: string;
  baseBranch: string;
}

// Architecture Contract
export interface InterfaceChange {
  file: string;
  type: 'added' | 'modified' | 'removed';
  name: string;
  signature?: string;
}

export interface Dependency {
  name: string;
  version: string;
  type: 'dependencies' | 'devDependencies';
}

export interface FileChange {
  path: string;
  type: 'added' | 'modified' | 'deleted';
  additions?: number;
  deletions?: number;
}

export interface ArchitectureContract {
  interfaceChanges: InterfaceChange[];
  newDependencies: Dependency[];
  fileChanges: FileChange[];
}

// Claude Code Stream Events
export interface ClaudeStreamEvent {
  type: 'assistant' | 'user' | 'system' | 'result';
  message?: {
    content: string;
  };
  tool_use?: {
    name: string;
    input: Record<string, unknown>;
  };
  subtype?: 'input_request';
}

// State Storage Types
export interface AgentsState {
  version: number;
  agents: Record<string, AgentInfo>;
}

export interface WorktreesState {
  version: number;
  worktrees: Record<string, WorktreeInfo>;
}

// Command Context
export interface CommandContext {
  projectRoot: string;
  config: import('./config.js').MaestroConfig;
  logger: import('./logger.js').Logger;
}

// Event Types
export type AgentEventType =
  | 'status_change'
  | 'output'
  | 'input_request'
  | 'metrics_update'
  | 'error';

export interface AgentEvent {
  type: AgentEventType;
  agentId: string;
  timestamp: Date;
  data?: unknown;
}

export type AgentEventHandler = (event: AgentEvent) => void;
