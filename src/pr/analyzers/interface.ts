import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { InterfaceChange } from '../../shared/types.js';
import { getChangedFiles } from './diff.js';

// Simple regex-based TypeScript export detection
// For a full implementation, consider using TypeScript compiler API

const EXPORT_PATTERNS = [
  // export interface Name
  /export\s+interface\s+(\w+)/g,
  // export type Name
  /export\s+type\s+(\w+)/g,
  // export class Name
  /export\s+class\s+(\w+)/g,
  // export function name
  /export\s+function\s+(\w+)/g,
  // export const name
  /export\s+const\s+(\w+)/g,
  // export { name }
  /export\s*\{\s*([^}]+)\s*\}/g,
];

function extractExports(content: string): Set<string> {
  const exports = new Set<string>();

  for (const pattern of EXPORT_PATTERNS) {
    const matches = content.matchAll(new RegExp(pattern));
    for (const match of matches) {
      if (match[1]) {
        // Handle export { a, b, c }
        if (match[1].includes(',')) {
          const names = match[1].split(',').map((n) => n.trim().split(/\s+/)[0]);
          names.forEach((n) => exports.add(n));
        } else {
          exports.add(match[1].trim());
        }
      }
    }
  }

  return exports;
}

export async function analyzeInterfaceChanges(
  worktreePath: string,
  baseBranch: string
): Promise<InterfaceChange[]> {
  const changes: InterfaceChange[] = [];

  const changedFiles = await getChangedFiles(worktreePath, baseBranch);
  const tsFiles = changedFiles.filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));

  for (const file of tsFiles) {
    const filePath = join(worktreePath, file);

    if (!existsSync(filePath)) {
      // File was deleted
      changes.push({
        file,
        type: 'removed',
        name: file,
      });
      continue;
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      const exports = extractExports(content);

      for (const name of exports) {
        changes.push({
          file,
          type: 'added', // Simplified: we'd need git history to determine if modified
          name,
        });
      }
    } catch {
      // Skip files that can't be read
    }
  }

  return changes;
}
