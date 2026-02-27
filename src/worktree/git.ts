import { simpleGit, SimpleGit, SimpleGitOptions } from 'simple-git';
import { join } from 'node:path';

export interface WorktreeEntry {
  worktree: string;
  branch: string;
  head: string;
  bare: boolean;
  detached: boolean;
  locked: boolean;
  prunable: boolean;
}

export interface BranchInfo {
  name: string;
  commit: string;
  current: boolean;
}

export function createGit(cwd?: string): SimpleGit {
  const options: Partial<SimpleGitOptions> = {
    baseDir: cwd || process.cwd(),
    binary: 'git',
    maxConcurrentProcesses: 6,
    trimmed: true,
  };
  return simpleGit(options);
}

export async function worktreeAdd(
  git: SimpleGit,
  path: string,
  branch: string,
  baseBranch: string,
  createBranch: boolean = true
): Promise<void> {
  const args = ['worktree', 'add'];

  if (createBranch) {
    args.push('-b', branch);
  }

  args.push(path);

  if (!createBranch) {
    args.push(branch);
  } else {
    args.push(baseBranch);
  }

  await git.raw(args);
}

export async function worktreeRemove(
  git: SimpleGit,
  path: string,
  force: boolean = false
): Promise<void> {
  const args = ['worktree', 'remove'];

  if (force) {
    args.push('--force');
  }

  args.push(path);

  await git.raw(args);
}

export async function worktreeList(git: SimpleGit): Promise<WorktreeEntry[]> {
  const output = await git.raw(['worktree', 'list', '--porcelain']);
  return parseWorktreeList(output);
}

export async function worktreePrune(git: SimpleGit): Promise<void> {
  await git.raw(['worktree', 'prune']);
}

export async function branchExists(git: SimpleGit, branch: string): Promise<boolean> {
  try {
    await git.raw(['rev-parse', '--verify', branch]);
    return true;
  } catch {
    return false;
  }
}

export async function branchDelete(
  git: SimpleGit,
  branch: string,
  force: boolean = false
): Promise<void> {
  const flag = force ? '-D' : '-d';
  await git.raw(['branch', flag, branch]);
}

export async function remoteBranchDelete(
  git: SimpleGit,
  remote: string,
  branch: string
): Promise<void> {
  await git.raw(['push', remote, '--delete', branch]);
}

export async function getCurrentBranch(git: SimpleGit): Promise<string> {
  return git.revparse(['--abbrev-ref', 'HEAD']);
}

export async function getDefaultBranch(git: SimpleGit): Promise<string> {
  try {
    // Try to get the default branch from remote
    const remoteInfo = await git.raw(['remote', 'show', 'origin']);
    const match = remoteInfo.match(/HEAD branch: (.+)/);
    if (match) {
      return match[1].trim();
    }
  } catch {
    // Fallback to checking common names
  }

  // Check for common default branch names
  for (const name of ['main', 'master']) {
    if (await branchExists(git, name)) {
      return name;
    }
  }

  return 'main';
}

export async function isGitRepository(path: string): Promise<boolean> {
  const git = createGit(path);
  try {
    await git.raw(['rev-parse', '--git-dir']);
    return true;
  } catch {
    return false;
  }
}

export async function getRepoRoot(git: SimpleGit): Promise<string> {
  return git.revparse(['--show-toplevel']);
}

export async function hasUncommittedChanges(git: SimpleGit): Promise<boolean> {
  const status = await git.status();
  return !status.isClean();
}

export async function stageAll(git: SimpleGit): Promise<void> {
  await git.add('-A');
}

export async function commit(git: SimpleGit, message: string): Promise<string> {
  const result = await git.commit(message);
  return result.commit;
}

export async function push(
  git: SimpleGit,
  remote: string,
  branch: string,
  setUpstream: boolean = false
): Promise<void> {
  const args = ['push'];

  if (setUpstream) {
    args.push('-u');
  }

  args.push(remote, branch);

  await git.raw(args);
}

function parseWorktreeList(output: string): WorktreeEntry[] {
  const entries: WorktreeEntry[] = [];
  const blocks = output.trim().split('\n\n');

  for (const block of blocks) {
    if (!block.trim()) continue;

    const entry: Partial<WorktreeEntry> = {
      bare: false,
      detached: false,
      locked: false,
      prunable: false,
    };

    const lines = block.split('\n');
    for (const line of lines) {
      if (line.startsWith('worktree ')) {
        entry.worktree = line.slice(9);
      } else if (line.startsWith('HEAD ')) {
        entry.head = line.slice(5);
      } else if (line.startsWith('branch ')) {
        entry.branch = line.slice(7).replace('refs/heads/', '');
      } else if (line === 'bare') {
        entry.bare = true;
      } else if (line === 'detached') {
        entry.detached = true;
      } else if (line.startsWith('locked')) {
        entry.locked = true;
      } else if (line.startsWith('prunable')) {
        entry.prunable = true;
      }
    }

    if (entry.worktree) {
      entries.push(entry as WorktreeEntry);
    }
  }

  return entries;
}
