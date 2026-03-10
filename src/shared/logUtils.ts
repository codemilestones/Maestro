import { existsSync, readFileSync } from 'node:fs';

/**
 * Extract session_id from the stdout log's init event.
 * Shared between recovery.ts and AgentController.ts.
 */
export function extractSessionIdFromLog(logPath: string): string | null {
  if (!existsSync(logPath)) return null;

  try {
    const content = readFileSync(logPath, 'utf-8');
    // session_id is in the first line (system/init event)
    const firstLine = content.split('\n').find(l => l.trim());
    if (!firstLine) return null;

    const event = JSON.parse(firstLine);
    if (event.type === 'system' && event.subtype === 'init' && event.session_id) {
      return event.session_id;
    }
  } catch {
    // Ignore errors
  }
  return null;
}
