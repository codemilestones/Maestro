import { createGit } from '../../worktree/git.js';
import { FileChange } from '../../shared/types.js';

export interface DiffStats {
  additions: number;
  deletions: number;
  files: FileChange[];
}

export async function analyzeDiff(worktreePath: string, baseBranch: string): Promise<DiffStats> {
  const git = createGit(worktreePath);

  // Get diff stats
  const diffOutput = await git.raw([
    'diff',
    '--stat',
    '--numstat',
    `${baseBranch}...HEAD`,
  ]);

  const files: FileChange[] = [];
  let totalAdditions = 0;
  let totalDeletions = 0;

  const lines = diffOutput.trim().split('\n');

  for (const line of lines) {
    // Parse numstat format: additions<tab>deletions<tab>filename
    const match = line.match(/^(\d+|-)\t(\d+|-)\t(.+)$/);
    if (match) {
      const additions = match[1] === '-' ? 0 : parseInt(match[1], 10);
      const deletions = match[2] === '-' ? 0 : parseInt(match[2], 10);
      const path = match[3];

      files.push({
        path,
        type: 'modified',
        additions,
        deletions,
      });

      totalAdditions += additions;
      totalDeletions += deletions;
    }
  }

  // Determine file types (added, modified, deleted)
  const statusOutput = await git.raw([
    'diff',
    '--name-status',
    `${baseBranch}...HEAD`,
  ]);

  const statusLines = statusOutput.trim().split('\n');
  const statusMap = new Map<string, 'added' | 'modified' | 'deleted'>();

  for (const line of statusLines) {
    const [status, path] = line.split('\t');
    if (!status || !path) continue;

    switch (status[0]) {
      case 'A':
        statusMap.set(path, 'added');
        break;
      case 'D':
        statusMap.set(path, 'deleted');
        break;
      case 'M':
      case 'R':
      case 'C':
      default:
        statusMap.set(path, 'modified');
        break;
    }
  }

  // Update file types
  for (const file of files) {
    const status = statusMap.get(file.path);
    if (status) {
      file.type = status;
    }
  }

  return {
    additions: totalAdditions,
    deletions: totalDeletions,
    files,
  };
}

export async function getChangedFiles(worktreePath: string, baseBranch: string): Promise<string[]> {
  const git = createGit(worktreePath);

  const output = await git.raw([
    'diff',
    '--name-only',
    `${baseBranch}...HEAD`,
  ]);

  return output.trim().split('\n').filter((f) => f.trim());
}
