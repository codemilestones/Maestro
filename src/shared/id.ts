import { nanoid } from 'nanoid';

const ID_LENGTH = 8;

export function generateTaskId(): string {
  return `task-${nanoid(ID_LENGTH)}`;
}

export function generateAgentId(): string {
  return `agent-${nanoid(ID_LENGTH)}`;
}

export function generateWorktreeId(): string {
  return `wt-${nanoid(ID_LENGTH)}`;
}

export function isValidId(id: string): boolean {
  const pattern = /^(task|agent|wt)-[a-zA-Z0-9_-]+$/;
  return pattern.test(id);
}

export function getIdPrefix(id: string): string | null {
  const match = id.match(/^(task|agent|wt)-/);
  return match ? match[1] : null;
}
