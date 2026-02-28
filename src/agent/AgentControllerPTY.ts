import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  AgentInfo,
  AgentStatus,
  AgentMetrics,
  AgentSpawnOptions,
  AgentEvent,
  AgentEventHandler,
} from '../shared/types.js';
import { generateAgentId } from '../shared/id.js';
import { loadConfig, MaestroConfig } from '../shared/config.js';
import { getLogger, createAgentLogger, Logger } from '../shared/logger.js';
import { isProcessRunning } from './process/spawner.js';
import { AgentStateMachine, isTerminalState, isRunningState } from './state/state.js';
import { AgentStore } from './state/store.js';
import { PTYSession, RingBuffer } from '../pty/index.js';
import { PatternStatusDetector, createClaudeCodeDetector, DetectedStatus } from '../detector/index.js';
import { adapterRegistry, ToolAdapter, AdapterSpawnOptions } from '../adapter/index.js';

/**
 * Extended spawn options for PTY-based agent
 */
export interface PTYAgentSpawnOptions extends AgentSpawnOptions {
  tool?: string; // Tool adapter name (default: config.tools.default)
}

interface ManagedPTYAgent {
  info: AgentInfo;
  session?: PTYSession;
  detector: PatternStatusDetector;
  stateMachine: AgentStateMachine;
  agentLogger: Logger;
  outputBuffer: string[];
  attachedClientId?: string; // ID of attached client (for exclusive attach)
}

/**
 * PTY-based AgentController
 *
 * Manages AI tool sessions using pseudo-terminals (PTY) instead of
 * headless JSON streaming mode. This enables:
 * - Interactive sessions with full terminal support
 * - Attach/detach functionality (like tmux)
 * - Heuristic status detection from terminal output
 * - Support for multiple AI tools via adapter framework
 */
export class AgentControllerPTY {
  private agents: Map<string, ManagedPTYAgent> = new Map();
  private eventHandlers: Set<AgentEventHandler> = new Set();
  private config: MaestroConfig;
  private store: AgentStore;
  private logger: Logger;
  private projectRoot: string;
  private pendingQueue: string[] = [];

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
    this.config = loadConfig(this.projectRoot);
    this.store = new AgentStore(this.projectRoot);
    this.logger = getLogger();

    // Apply tool configurations from config
    this.applyToolConfigs();

    // Restore agents from store
    this.restoreAgents();
  }

  private applyToolConfigs(): void {
    const toolConfigs = this.config.tools.configs;

    for (const [name, config] of Object.entries(toolConfigs)) {
      if (adapterRegistry.has(name)) {
        adapterRegistry.configure(name, config);
      }
    }

    // Set default tool
    if (this.config.tools.default && adapterRegistry.has(this.config.tools.default)) {
      adapterRegistry.setDefault(this.config.tools.default);
    }
  }

  private getOutputLogPath(agentId: string): string {
    const logsDir = join(this.projectRoot, '.maestro', 'logs');
    return join(logsDir, `${agentId}.output.log`);
  }

  private ensureLogsDir(): void {
    const logsDir = join(this.projectRoot, '.maestro', 'logs');
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }
  }

  private restoreAgents(): void {
    const savedAgents = this.store.listAgents();
    this.logger.debug(`Restoring agents from store`, { count: savedAgents.length });

    for (const agentInfo of savedAgents) {
      // Skip archived agents
      if (agentInfo.archived) continue;

      // Include terminal state agents in memory map (for status display)
      if (isTerminalState(agentInfo.status)) {
        const finishedAt = agentInfo.finishedAt ? new Date(agentInfo.finishedAt) : null;
        const daysSinceFinished = finishedAt
          ? (Date.now() - finishedAt.getTime()) / (1000 * 60 * 60 * 24)
          : 0;

        if (daysSinceFinished > 7) {
          continue;
        }

        const managedAgent = this.createManagedAgent(agentInfo);
        this.agents.set(agentInfo.id, managedAgent);
        continue;
      }

      // Check if process is still running
      if (agentInfo.pid && !isProcessRunning(agentInfo.pid)) {
        this.logger.warn(`Agent process no longer running, marking as failed`, {
          id: agentInfo.id,
          pid: agentInfo.pid,
        });
        agentInfo.status = 'failed';
        agentInfo.error = 'Process not found on restore';
        agentInfo.finishedAt = new Date();
        this.store.saveAgent(agentInfo);
      }

      const managedAgent = this.createManagedAgent(agentInfo);
      this.agents.set(agentInfo.id, managedAgent);
    }

    this.logger.debug(`Restore complete`, { restoredCount: this.agents.size });
  }

  private createManagedAgent(info: AgentInfo): ManagedPTYAgent {
    const stateMachine = new AgentStateMachine(info.status);
    const agentLogger = createAgentLogger(info.id, this.projectRoot);
    const detector = createClaudeCodeDetector({ debounceMs: 100 });

    // Listen for state changes
    stateMachine.onTransition((newStatus, oldStatus) => {
      info.status = newStatus;
      this.store.saveAgent(info);
      this.emitEvent({
        type: 'status_change',
        agentId: info.id,
        timestamp: new Date(),
        data: { from: oldStatus, to: newStatus },
      });

      // Process pending queue when an agent finishes
      if (isTerminalState(newStatus)) {
        this.processQueue();
      }
    });

    return {
      info,
      detector,
      stateMachine,
      agentLogger,
      outputBuffer: [],
    };
  }

  /**
   * Spawn a new agent session
   */
  async spawn(options: PTYAgentSpawnOptions): Promise<AgentInfo> {
    const id = generateAgentId();

    // Create initial agent info
    const info: AgentInfo = {
      id,
      name: options.name,
      prompt: options.prompt,
      worktreeId: '',
      branch: '',
      status: 'pending',
      createdAt: new Date(),
      metrics: {
        tokensUsed: 0,
        toolCalls: 0,
        filesModified: [],
      },
    };

    const managedAgent = this.createManagedAgent(info);
    this.agents.set(id, managedAgent);
    this.store.saveAgent(info);

    this.logger.info(`Agent created`, { id, name: options.name });

    // Check concurrent limit
    const runningCount = this.getRunningCount();
    if (runningCount >= this.config.agent.maxConcurrent) {
      this.logger.info(`Agent queued due to concurrent limit`, {
        id,
        runningCount,
        max: this.config.agent.maxConcurrent,
      });
      this.pendingQueue.push(id);
      return info;
    }

    // Start immediately
    await this.startAgent(id, options);

    return info;
  }

  private async startAgent(id: string, options: PTYAgentSpawnOptions): Promise<void> {
    const managedAgent = this.agents.get(id);
    if (!managedAgent) {
      throw new Error(`Agent '${id}' not found`);
    }

    try {
      managedAgent.stateMachine.start();
      managedAgent.info.startedAt = new Date();
      managedAgent.info.spawnedAt = new Date();

      // Get the tool adapter
      const toolName = options.tool || this.config.tools.default;
      const adapter = adapterRegistry.get(toolName);

      if (!adapter) {
        throw new Error(`Tool adapter '${toolName}' not found`);
      }

      // Ensure logs directory exists
      this.ensureLogsDir();
      const outputLogPath = this.getOutputLogPath(id);

      // Spawn PTY session via adapter
      const spawnOptions: AdapterSpawnOptions = {
        prompt: options.prompt,
        cwd: options.worktreePath,
        env: options.env,
      };

      const { session } = adapter.spawn(spawnOptions);
      managedAgent.session = session;
      managedAgent.info.pid = session.pid ?? undefined;
      this.store.saveAgent(managedAgent.info);

      // Transition to running
      managedAgent.stateMachine.run();

      // Handle PTY data output
      session.on('data', (data: string) => {
        // Store in output buffer
        managedAgent.outputBuffer.push(data);

        // Persist to log file
        try {
          writeFileSync(outputLogPath, data, { flag: 'a' });
        } catch (error) {
          this.logger.warn(`Failed to persist output`, { id, error });
        }

        // Feed to status detector
        managedAgent.detector.feed(data);

        // Emit output event
        this.emitEvent({
          type: 'output',
          agentId: id,
          timestamp: new Date(),
          data,
        });
      });

      // Handle detected status changes
      managedAgent.detector.onStatusChange((newStatus, oldStatus) => {
        this.handleDetectedStatusChange(id, newStatus, oldStatus);
      });

      // Handle PTY exit
      session.on('exit', (exitCode: number, signal?: number) => {
        managedAgent.info.exitCode = exitCode;
        managedAgent.info.finishedAt = new Date();
        managedAgent.info.metrics.duration =
          managedAgent.info.finishedAt.getTime() -
          (managedAgent.info.startedAt?.getTime() || managedAgent.info.createdAt.getTime());

        if (exitCode === 0) {
          managedAgent.stateMachine.finish();
        } else {
          managedAgent.info.error = signal
            ? `Killed by signal ${signal}`
            : `Exited with code ${exitCode}`;
          managedAgent.stateMachine.fail();
        }

        this.store.saveAgent(managedAgent.info);
        this.logger.info(`Agent finished`, { id, exitCode, signal });
      });

      session.on('error', (error: Error) => {
        managedAgent.info.error = error.message;
        managedAgent.info.finishedAt = new Date();
        managedAgent.stateMachine.fail();
        this.store.saveAgent(managedAgent.info);
        this.logger.error(`Agent error`, { id, error: error.message });
      });
    } catch (error) {
      managedAgent.info.error = error instanceof Error ? error.message : String(error);
      managedAgent.info.finishedAt = new Date();
      managedAgent.stateMachine.fail();
      this.store.saveAgent(managedAgent.info);
      throw error;
    }
  }

  private handleDetectedStatusChange(
    agentId: string,
    newStatus: DetectedStatus,
    _oldStatus: DetectedStatus
  ): void {
    const managedAgent = this.agents.get(agentId);
    if (!managedAgent) return;

    // Map detected status to agent status
    if (newStatus === 'waiting_input' && managedAgent.stateMachine.canTransitionTo('waiting_input')) {
      managedAgent.stateMachine.transition('waiting_input');
      this.emitEvent({
        type: 'input_request',
        agentId,
        timestamp: new Date(),
      });
    } else if (newStatus === 'running' && managedAgent.info.status === 'waiting_input') {
      // Resume running after input was provided
      managedAgent.stateMachine.run();
    }
  }

  private processQueue(): void {
    if (this.pendingQueue.length === 0) return;

    const runningCount = this.getRunningCount();
    const available = this.config.agent.maxConcurrent - runningCount;

    for (let i = 0; i < available && this.pendingQueue.length > 0; i++) {
      const id = this.pendingQueue.shift()!;
      const agent = this.agents.get(id);

      if (agent && agent.info.status === 'pending') {
        this.startAgent(id, {
          prompt: agent.info.prompt,
          worktreePath: '',
          name: agent.info.name,
        }).catch((error) => {
          this.logger.error(`Failed to start queued agent`, { id, error });
        });
      }
    }
  }

  /**
   * Attach to an agent's PTY session
   * Returns the PTY session for direct I/O passthrough
   */
  attach(id: string, clientId?: string, force: boolean = false): PTYSession | null {
    const managedAgent = this.agents.get(id);
    if (!managedAgent) {
      throw new Error(`Agent '${id}' not found`);
    }

    if (!managedAgent.session) {
      throw new Error(`Agent '${id}' has no active PTY session`);
    }

    // Check for exclusive attach
    if (managedAgent.attachedClientId && managedAgent.attachedClientId !== clientId) {
      if (!force) {
        throw new Error(
          `Agent '${id}' is already attached by another client. Use --force to override.`
        );
      }
      this.logger.warn(`Force detaching existing client`, {
        id,
        previousClient: managedAgent.attachedClientId,
        newClient: clientId,
      });
    }

    managedAgent.attachedClientId = clientId;
    this.logger.info(`Client attached to agent`, { id, clientId });

    return managedAgent.session;
  }

  /**
   * Detach from an agent's PTY session
   */
  detach(id: string, clientId?: string): void {
    const managedAgent = this.agents.get(id);
    if (!managedAgent) return;

    if (managedAgent.attachedClientId === clientId || !clientId) {
      managedAgent.attachedClientId = undefined;
      this.logger.info(`Client detached from agent`, { id, clientId });
    }
  }

  /**
   * Check if an agent is currently attached
   */
  isAttached(id: string): boolean {
    const managedAgent = this.agents.get(id);
    return !!managedAgent?.attachedClientId;
  }

  /**
   * Send input to an agent
   */
  async sendInput(id: string, input: string): Promise<void> {
    const managedAgent = this.agents.get(id);
    if (!managedAgent) {
      throw new Error(`Agent '${id}' not found`);
    }

    if (!managedAgent.session) {
      throw new Error(`Agent '${id}' has no active PTY session`);
    }

    managedAgent.session.write(input);

    // If was waiting for input, resume running
    if (managedAgent.info.status === 'waiting_input') {
      managedAgent.stateMachine.run();
    }
  }

  /**
   * Kill an agent
   */
  async kill(id: string, force: boolean = false): Promise<void> {
    const managedAgent = this.agents.get(id);
    if (!managedAgent) {
      throw new Error(`Agent '${id}' not found`);
    }

    if (isTerminalState(managedAgent.info.status)) {
      this.logger.warn(`Agent already in terminal state`, {
        id,
        status: managedAgent.info.status,
      });
      return;
    }

    if (managedAgent.session) {
      managedAgent.session.kill(force ? 'SIGKILL' : 'SIGTERM');
    } else {
      managedAgent.info.status = 'failed';
      managedAgent.info.error = 'Killed by user (no session attached)';
      managedAgent.info.finishedAt = new Date();
      managedAgent.stateMachine.fail();
      this.store.saveAgent(managedAgent.info);
    }
  }

  /**
   * Get agent status
   */
  getStatus(id: string): AgentStatus {
    const managedAgent = this.agents.get(id);
    if (!managedAgent) {
      throw new Error(`Agent '${id}' not found`);
    }
    return managedAgent.info.status;
  }

  /**
   * Get agent info
   */
  getInfo(id: string): AgentInfo | null {
    const managedAgent = this.agents.get(id);
    return managedAgent?.info || null;
  }

  /**
   * List all agents
   */
  listAll(): AgentInfo[] {
    return Array.from(this.agents.values())
      .filter((a) => !a.info.archived)
      .map((a) => a.info);
  }

  /**
   * Archive an agent
   */
  archive(id: string): void {
    const managedAgent = this.agents.get(id);
    if (!managedAgent) return;

    if (!isTerminalState(managedAgent.info.status)) {
      this.logger.warn(`Cannot archive non-terminal agent`, {
        id,
        status: managedAgent.info.status,
      });
      return;
    }

    managedAgent.info.archived = true;
    this.store.saveAgent(managedAgent.info);
    this.logger.info(`Agent archived`, { id });
  }

  /**
   * Get agent output
   */
  getOutput(id: string): string[] {
    const managedAgent = this.agents.get(id);
    if (!managedAgent) return [];

    // If buffer is empty, try loading from log file
    if (managedAgent.outputBuffer.length === 0 && isTerminalState(managedAgent.info.status)) {
      const loadedOutput = this.loadOutputFromLog(id);
      if (loadedOutput) {
        managedAgent.outputBuffer = [loadedOutput];
      }
    }

    return managedAgent.outputBuffer;
  }

  private loadOutputFromLog(agentId: string): string | null {
    const logPath = this.getOutputLogPath(agentId);
    if (!existsSync(logPath)) {
      return null;
    }

    try {
      return readFileSync(logPath, 'utf-8');
    } catch (error) {
      this.logger.warn(`Error loading output from log`, {
        id: agentId,
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * Get PTY buffer for an agent
   */
  getBuffer(id: string): RingBuffer | null {
    const managedAgent = this.agents.get(id);
    return managedAgent?.session?.getBuffer() || null;
  }

  /**
   * Register event handler
   */
  onEvent(handler: AgentEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => this.eventHandlers.delete(handler);
  }

  private emitEvent(event: AgentEvent): void {
    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (error) {
        this.logger.error(`Event handler error`, { error });
      }
    }
  }

  private getRunningCount(): number {
    return Array.from(this.agents.values()).filter((a) => isRunningState(a.info.status)).length;
  }

  /**
   * Set worktree info for an agent
   */
  setWorktreeInfo(id: string, worktreeId: string, branch: string): void {
    const managedAgent = this.agents.get(id);
    if (managedAgent) {
      managedAgent.info.worktreeId = worktreeId;
      managedAgent.info.branch = branch;
      this.store.saveAgent(managedAgent.info);
    }
  }

  /**
   * Resize agent PTY terminal
   */
  resize(id: string, cols: number, rows: number): void {
    const managedAgent = this.agents.get(id);
    if (managedAgent?.session?.isRunning) {
      managedAgent.session.resize(cols, rows);
    }
  }

  /**
   * Get detected status for an agent
   */
  getDetectedStatus(id: string): DetectedStatus | null {
    const managedAgent = this.agents.get(id);
    return managedAgent?.detector.currentStatus() || null;
  }

  /**
   * Override detected status (manual correction)
   */
  overrideStatus(id: string, status: DetectedStatus, pauseDurationMs?: number): void {
    const managedAgent = this.agents.get(id);
    if (managedAgent) {
      managedAgent.detector.override(status, pauseDurationMs);
    }
  }
}
