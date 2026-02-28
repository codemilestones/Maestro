import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AgentInfo, AgentStatus } from '../shared/types.js';
import { AgentStore } from '../agent/state/store.js';
import { WorktreeManager } from '../worktree/WorktreeManager.js';
import { getLogger } from '../shared/logger.js';

/**
 * Check if a process is running by PID
 */
function isProcessRunning(pid: number): boolean {
  try {
    // Send signal 0 to check if process exists
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get the path to the agent's stdout log file
 */
function getStdoutLogPath(agentId: string, projectRoot: string): string {
  return join(projectRoot, '.maestro', 'logs', `${agentId}.stdout.jsonl`);
}

/**
 * Check if agent completed successfully by analyzing stdout log
 * Returns 'finished' if result event found, 'failed' if log exists but no result, null if no log
 */
function checkAgentCompletionFromLog(agentId: string, projectRoot: string): 'finished' | 'failed' | null {
  const logger = getLogger();
  const logPath = getStdoutLogPath(agentId, projectRoot);

  if (!existsSync(logPath)) {
    logger.debug('No stdout log found for agent', { id: agentId, path: logPath });
    return null;
  }

  try {
    const content = readFileSync(logPath, 'utf-8');
    const lines = content.trim().split('\n').filter(Boolean);

    // Look for result event (indicates successful completion)
    for (const line of lines) {
      try {
        const event = JSON.parse(line);
        if (event.type === 'result') {
          logger.debug('Found result event in log, agent completed successfully', { id: agentId });
          return 'finished';
        }
      } catch {
        // Ignore parse errors for individual lines
      }
    }

    // No result event found - check for error indicators
    logger.debug('No result event found in log', { id: agentId, lineCount: lines.length });
    return lines.length > 0 ? 'failed' : null;
  } catch (error) {
    logger.warn('Error reading stdout log', { id: agentId, error: (error as Error).message });
    return null;
  }
}

/**
 * Determine if an agent state needs recovery
 */
function needsRecovery(agent: AgentInfo): boolean {
  // Running or starting agents need recovery check
  return agent.status === 'running' || agent.status === 'starting' || agent.status === 'waiting_input';
}

export interface RecoveryResult {
  recovered: AgentInfo[];
  failed: AgentInfo[];
  unchanged: AgentInfo[];
}

/**
 * Recover agent states on startup
 * - Checks if running agents are still alive
 * - Updates states for dead processes
 * - Syncs with actual worktree state
 */
export async function recoverState(projectRoot?: string): Promise<RecoveryResult> {
  const logger = getLogger();
  const store = new AgentStore(projectRoot);
  const worktreeManager = new WorktreeManager(projectRoot);

  const result: RecoveryResult = {
    recovered: [],
    failed: [],
    unchanged: [],
  };

  // Sync worktree state first
  try {
    await worktreeManager.sync();
    logger.debug('Worktree state synced');
  } catch (error) {
    logger.warn('Failed to sync worktree state', { error });
  }

  // Load all agents
  const agents = store.listAgents();

  const gracePeriodMs = 5000; // 5 seconds grace period for newly spawned agents

  for (const agent of agents) {
    if (!needsRecovery(agent)) {
      result.unchanged.push(agent);
      continue;
    }

    logger.debug('Checking agent process', { id: agent.id, pid: agent.pid });

    // Check grace period for newly spawned agents
    const spawnedAt = agent.spawnedAt ? new Date(agent.spawnedAt) : null;
    const isWithinGracePeriod = spawnedAt && (Date.now() - spawnedAt.getTime()) < gracePeriodMs;

    if (isWithinGracePeriod) {
      // Agent is within grace period, assume it's still starting up
      logger.debug('Agent within grace period, skipping process check', {
        id: agent.id,
        spawnedAt: spawnedAt?.toISOString(),
        ageMs: spawnedAt ? Date.now() - spawnedAt.getTime() : null,
      });
      result.recovered.push(agent);
      continue;
    }

    // Check if process is still running
    const isAlive = agent.pid ? isProcessRunning(agent.pid) : false;

    if (isAlive) {
      // Process is still running, mark as recovered
      result.recovered.push(agent);
      logger.info('Agent process still running', { id: agent.id, pid: agent.pid });
    } else {
      // Process is not running - check stdout log to determine if it finished successfully
      const effectiveProjectRoot = projectRoot || process.cwd();
      const completionStatus = checkAgentCompletionFromLog(agent.id, effectiveProjectRoot);

      if (completionStatus === 'finished') {
        logger.info('Agent completed successfully (from log analysis)', { id: agent.id });
        agent.status = 'finished';
        agent.finishedAt = new Date();
        store.saveAgent(agent);
        result.recovered.push(agent);
      } else {
        // Process died unexpectedly or failed
        logger.warn('Agent process not found, marking as failed', { id: agent.id, pid: agent.pid });

        const previousStatus = agent.status;
        agent.status = 'failed';
        agent.finishedAt = new Date();
        agent.error = completionStatus === 'failed'
          ? 'Process completed without success result'
          : `Process terminated unexpectedly (was ${previousStatus})`;

        store.saveAgent(agent);
        result.failed.push(agent);
      }
    }
  }

  // Check for orphaned worktrees (worktrees without agents)
  try {
    const worktrees = await worktreeManager.list();
    const agentWorktreeIds = new Set(agents.map((a) => a.worktreeId).filter(Boolean));

    for (const worktree of worktrees) {
      if (!agentWorktreeIds.has(worktree.id)) {
        logger.warn('Found orphaned worktree', { id: worktree.id, path: worktree.path });
        // Don't auto-remove, just log for now
      }
    }
  } catch (error) {
    logger.warn('Failed to check for orphaned worktrees', { error });
  }

  return result;
}

/**
 * Clean up stale state files and resources
 */
export async function cleanupStaleState(projectRoot?: string): Promise<void> {
  const logger = getLogger();
  const store = new AgentStore(projectRoot);
  const worktreeManager = new WorktreeManager(projectRoot);

  const agents = store.listAgents();

  for (const agent of agents) {
    // Check if worktree still exists
    if (agent.worktreeId && !worktreeManager.exists(agent.worktreeId)) {
      logger.info('Removing agent with missing worktree', { id: agent.id, worktreeId: agent.worktreeId });
      store.deleteAgent(agent.id);
    }

    // Check if agent is in terminal state and older than 7 days
    if (agent.status === 'finished' || agent.status === 'failed') {
      const finishedAt = agent.finishedAt ? new Date(agent.finishedAt) : null;
      if (finishedAt) {
        const daysSinceFinished = (Date.now() - finishedAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceFinished > 7) {
          logger.info('Removing old finished agent', { id: agent.id, daysSinceFinished });
          store.deleteAgent(agent.id);
        }
      }
    }
  }
}

/**
 * Validate state consistency
 */
export async function validateState(projectRoot?: string): Promise<{
  valid: boolean;
  issues: string[];
}> {
  const logger = getLogger();
  const store = new AgentStore(projectRoot);
  const worktreeManager = new WorktreeManager(projectRoot);

  const issues: string[] = [];

  const agents = store.listAgents();
  const worktrees = await worktreeManager.list();
  const worktreeIds = new Set(worktrees.map((w) => w.id));

  for (const agent of agents) {
    // Check worktree reference
    if (agent.worktreeId && !worktreeIds.has(agent.worktreeId)) {
      issues.push(`Agent ${agent.id} references non-existent worktree ${agent.worktreeId}`);
    }

    // Check running agent has PID
    if ((agent.status === 'running' || agent.status === 'waiting_input') && !agent.pid) {
      issues.push(`Agent ${agent.id} is ${agent.status} but has no PID`);
    }

    // Check finished agent has finishedAt
    if ((agent.status === 'finished' || agent.status === 'failed') && !agent.finishedAt) {
      issues.push(`Agent ${agent.id} is ${agent.status} but has no finishedAt timestamp`);
    }
  }

  if (issues.length > 0) {
    logger.warn('State validation found issues', { count: issues.length });
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
