import { join } from 'node:path';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { SimpleGit } from 'simple-git';
import {
  createGit,
  worktreeAdd,
  worktreeRemove,
  worktreeList,
  worktreePrune,
  branchExists,
  branchDelete,
  remoteBranchDelete,
  getDefaultBranch,
  getRepoRoot,
} from './git.js';
import {
  WorktreeInfo,
  WorktreeStatus,
  CreateWorktreeOptions,
  RemoveWorktreeOptions,
  WorktreesState,
} from '../shared/types.js';
import { generateWorktreeId } from '../shared/id.js';
import { getMaestroDir, STATE_DIR, loadConfig, MaestroConfig } from '../shared/config.js';
import { getLogger, Logger } from '../shared/logger.js';

const WORKTREES_FILE = 'worktrees.json';
const STATE_VERSION = 1;

export class WorktreeManager {
  private git: SimpleGit;
  private projectRoot: string;
  private config: MaestroConfig;
  private logger: Logger;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
    this.git = createGit(this.projectRoot);
    this.config = loadConfig(this.projectRoot);
    this.logger = getLogger();
  }

  private getWorktreesFilePath(): string {
    return join(getMaestroDir(this.projectRoot), STATE_DIR, WORKTREES_FILE);
  }

  private getWorktreeBaseDir(): string {
    const baseDir = this.config.worktree.baseDir;
    if (baseDir.startsWith('/')) {
      return baseDir;
    }
    return join(this.projectRoot, baseDir);
  }

  private loadState(): WorktreesState {
    const filePath = this.getWorktreesFilePath();

    if (!existsSync(filePath)) {
      // No state file yet - this is normal for new projects
      return { version: STATE_VERSION, worktrees: {} };
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      return JSON.parse(content) as WorktreesState;
    } catch (error) {
      // Only warn if file exists but is corrupted
      this.logger.debug('Failed to parse worktrees state, using empty state', { error });
      return { version: STATE_VERSION, worktrees: {} };
    }
  }

  private saveState(state: WorktreesState): void {
    const filePath = this.getWorktreesFilePath();
    const dir = join(getMaestroDir(this.projectRoot), STATE_DIR);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Atomic write: write to temp file then rename
    const tempPath = `${filePath}.tmp`;
    writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf-8');

    const { renameSync } = require('node:fs');
    renameSync(tempPath, filePath);
  }

  private normalizeBranch(branch: string): string {
    const prefix = this.config.worktree.branchPrefix;

    // If branch already has the prefix, return as-is
    if (branch.startsWith(prefix)) {
      return branch;
    }

    // If branch contains a slash (user specified full path), use as-is
    if (branch.includes('/')) {
      return branch;
    }

    // Add prefix
    return `${prefix}${branch}`;
  }

  async create(options: CreateWorktreeOptions): Promise<WorktreeInfo> {
    const id = options.taskId || generateWorktreeId();
    const branch = this.normalizeBranch(options.branch);

    // Determine base branch with fallback logic
    let baseBranch = options.base || this.config.worktree.defaultBase;

    // Validate that the base branch exists, with fallback to auto-detection
    if (!(await branchExists(this.git, baseBranch))) {
      const detectedBranch = await getDefaultBranch(this.git);
      this.logger.debug(`Configured base branch '${baseBranch}' not found, using detected branch '${detectedBranch}'`);
      baseBranch = detectedBranch;
    }

    // Check if branch already exists
    if (await branchExists(this.git, branch)) {
      throw new Error(`Branch '${branch}' already exists. Use a different branch name or delete the existing branch.`);
    }

    // Create worktree path
    const worktreePath = join(this.getWorktreeBaseDir(), id);

    // Ensure base directory exists
    const baseDir = this.getWorktreeBaseDir();
    if (!existsSync(baseDir)) {
      mkdirSync(baseDir, { recursive: true });
    }

    this.logger.info(`Creating worktree at ${worktreePath}`, { branch, baseBranch });

    try {
      await worktreeAdd(this.git, worktreePath, branch, baseBranch, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to create worktree: ${message}`);
    }

    const worktreeInfo: WorktreeInfo = {
      id,
      path: worktreePath,
      branch,
      baseBranch,
      createdAt: new Date(),
      status: 'active',
    };

    // Persist state
    const state = this.loadState();
    state.worktrees[id] = worktreeInfo;
    this.saveState(state);

    this.logger.info(`Worktree created successfully`, { id, branch });

    return worktreeInfo;
  }

  async remove(id: string, options: RemoveWorktreeOptions = {}): Promise<void> {
    const state = this.loadState();
    const worktree = state.worktrees[id];

    if (!worktree) {
      throw new Error(`Worktree '${id}' not found`);
    }

    this.logger.info(`Removing worktree`, { id, path: worktree.path });

    try {
      // Remove git worktree
      await worktreeRemove(this.git, worktree.path, options.force);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!options.force) {
        throw new Error(`Failed to remove worktree: ${message}. Use --force to force removal.`);
      }
      this.logger.warn(`Failed to remove worktree, but continuing due to --force`, { error: message });
    }

    // Try to delete the branch
    try {
      await branchDelete(this.git, worktree.branch, options.force);
      this.logger.debug(`Deleted local branch`, { branch: worktree.branch });
    } catch (error) {
      this.logger.debug(`Could not delete local branch`, { branch: worktree.branch });
    }

    // Delete remote branch if requested
    if (options.deleteRemoteBranch) {
      try {
        await remoteBranchDelete(this.git, 'origin', worktree.branch);
        this.logger.info(`Deleted remote branch`, { branch: worktree.branch });
      } catch (error) {
        this.logger.warn(`Could not delete remote branch`, { branch: worktree.branch });
      }
    }

    // Prune stale worktrees
    try {
      await worktreePrune(this.git);
    } catch {
      // Ignore prune errors
    }

    // Update state
    worktree.status = 'deleted';
    delete state.worktrees[id];
    this.saveState(state);

    this.logger.info(`Worktree removed successfully`, { id });
  }

  async list(): Promise<WorktreeInfo[]> {
    const state = this.loadState();
    return Object.values(state.worktrees).filter((w) => w.status === 'active');
  }

  async get(id: string): Promise<WorktreeInfo | null> {
    const state = this.loadState();
    return state.worktrees[id] || null;
  }

  exists(id: string): boolean {
    const state = this.loadState();
    return id in state.worktrees && state.worktrees[id].status === 'active';
  }

  getPath(id: string): string {
    const state = this.loadState();
    const worktree = state.worktrees[id];
    if (!worktree) {
      throw new Error(`Worktree '${id}' not found`);
    }
    return worktree.path;
  }

  async sync(): Promise<void> {
    // Load state - if no worktrees exist, silently return
    const state = this.loadState();

    // If no worktrees are tracked, nothing to sync
    if (Object.keys(state.worktrees).length === 0) {
      return;
    }

    // Sync state with actual git worktrees
    const actualWorktrees = await worktreeList(this.git);
    const actualPaths = new Set(actualWorktrees.map((w) => w.worktree));

    let hasChanges = false;

    // Mark worktrees that no longer exist as deleted
    for (const [id, worktree] of Object.entries(state.worktrees)) {
      if (worktree.status === 'active' && !actualPaths.has(worktree.path)) {
        this.logger.debug(`Worktree no longer exists, marking as deleted`, { id, path: worktree.path });
        worktree.status = 'deleted';
        hasChanges = true;
      }
    }

    // Clean up deleted worktrees from state
    for (const id of Object.keys(state.worktrees)) {
      if (state.worktrees[id].status === 'deleted') {
        delete state.worktrees[id];
        hasChanges = true;
      }
    }

    // Only save if there were changes
    if (hasChanges) {
      this.saveState(state);
    }
  }

  async cleanup(options: { dryRun?: boolean } = {}): Promise<string[]> {
    const state = this.loadState();
    const toRemove: string[] = [];

    for (const [id, worktree] of Object.entries(state.worktrees)) {
      if (worktree.status !== 'active') {
        toRemove.push(id);
      }
    }

    if (!options.dryRun) {
      for (const id of toRemove) {
        try {
          await this.remove(id, { force: true });
        } catch (error) {
          this.logger.warn(`Failed to cleanup worktree`, { id, error });
        }
      }
    }

    return toRemove;
  }
}
