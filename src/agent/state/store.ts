import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { AgentInfo, AgentsState } from '../../shared/types.js';
import { getMaestroDir, STATE_DIR } from '../../shared/config.js';
import { getLogger } from '../../shared/logger.js';

const AGENTS_FILE = 'agents.json';
const STATE_VERSION = 1;

export class AgentStore {
  private projectRoot: string;
  private logger = getLogger();

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
  }

  private getFilePath(): string {
    return join(getMaestroDir(this.projectRoot), STATE_DIR, AGENTS_FILE);
  }

  load(): AgentsState {
    const filePath = this.getFilePath();

    if (!existsSync(filePath)) {
      return { version: STATE_VERSION, agents: {} };
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      const state = JSON.parse(content) as AgentsState;

      // Convert date strings back to Date objects
      for (const agent of Object.values(state.agents)) {
        agent.createdAt = new Date(agent.createdAt);
        if (agent.spawnedAt) agent.spawnedAt = new Date(agent.spawnedAt);
        if (agent.startedAt) agent.startedAt = new Date(agent.startedAt);
        if (agent.finishedAt) agent.finishedAt = new Date(agent.finishedAt);
      }

      return state;
    } catch (error) {
      this.logger.warn('Failed to load agents state', { error });
      return { version: STATE_VERSION, agents: {} };
    }
  }

  save(state: AgentsState): void {
    const filePath = this.getFilePath();
    const dir = join(getMaestroDir(this.projectRoot), STATE_DIR);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Atomic write
    const tempPath = `${filePath}.tmp`;
    writeFileSync(tempPath, JSON.stringify(state, null, 2), 'utf-8');
    renameSync(tempPath, filePath);
  }

  getAgent(id: string): AgentInfo | null {
    const state = this.load();
    return state.agents[id] || null;
  }

  saveAgent(agent: AgentInfo): void {
    this.logger.debug(`Saving agent`, { id: agent.id, status: agent.status });
    const state = this.load();
    state.agents[agent.id] = agent;
    this.save(state);
    this.logger.debug(`Agent saved successfully`, { id: agent.id });
  }

  deleteAgent(id: string): void {
    const state = this.load();
    delete state.agents[id];
    this.save(state);
  }

  listAgents(): AgentInfo[] {
    const state = this.load();
    return Object.values(state.agents);
  }

  updateAgent(id: string, updates: Partial<AgentInfo>): AgentInfo | null {
    const state = this.load();
    const agent = state.agents[id];

    if (!agent) {
      return null;
    }

    Object.assign(agent, updates);
    this.save(state);

    return agent;
  }
}
