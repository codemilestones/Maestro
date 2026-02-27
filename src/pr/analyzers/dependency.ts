import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { Dependency } from '../../shared/types.js';
import { createGit } from '../../worktree/git.js';

interface PackageJson {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export async function analyzeDependencyChanges(
  worktreePath: string,
  baseBranch: string
): Promise<Dependency[]> {
  const newDependencies: Dependency[] = [];

  const packageJsonPath = join(worktreePath, 'package.json');
  if (!existsSync(packageJsonPath)) {
    return [];
  }

  // Get current package.json
  const currentContent = readFileSync(packageJsonPath, 'utf-8');
  const current = JSON.parse(currentContent) as PackageJson;

  // Get base branch package.json
  const git = createGit(worktreePath);
  let base: PackageJson;

  try {
    const baseContent = await git.raw(['show', `${baseBranch}:package.json`]);
    base = JSON.parse(baseContent) as PackageJson;
  } catch {
    // No package.json in base branch
    base = {};
  }

  // Compare dependencies
  const baseDeps = base.dependencies || {};
  const currentDeps = current.dependencies || {};

  for (const [name, version] of Object.entries(currentDeps)) {
    if (!(name in baseDeps)) {
      newDependencies.push({
        name,
        version,
        type: 'dependencies',
      });
    }
  }

  // Compare devDependencies
  const baseDevDeps = base.devDependencies || {};
  const currentDevDeps = current.devDependencies || {};

  for (const [name, version] of Object.entries(currentDevDeps)) {
    if (!(name in baseDevDeps)) {
      newDependencies.push({
        name,
        version,
        type: 'devDependencies',
      });
    }
  }

  return newDependencies;
}
