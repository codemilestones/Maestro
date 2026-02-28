import { type ExecaChildProcess } from './process/spawner.js';
import { Readable } from 'node:stream';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { AgentInfo, AgentStatus, AgentMetrics, AgentSpawnOptions, AgentEvent, AgentEventHandler } from '../shared/types.js';
import { generateAgentId } from '../shared/id.js';
import { loadConfig, MaestroConfig } from '../shared/config.js';
import { getLogger, createAgentLogger, Logger } from '../shared/logger.js';
import { spawnClaude, killProcess, sendInput as sendProcessInput, isProcessRunning } from './process/spawner.js';
import { OutputParser, ParsedEvent, extractFilesFromToolCalls } from './output/parser.js';
import { AgentStateMachine, isTerminalState, isRunningState } from './state/state.js';
import { AgentStore } from './state/store.js';

interface ManagedAgent {
  info: AgentInfo;
  process?: ExecaChildProcess;
  stateMachine: AgentStateMachine;
  parser: OutputParser;
  outputBuffer: string[];
  parsedEvents: ParsedEvent[];
  agentLogger: Logger;
}

export class AgentController {
  private agents: Map<string, ManagedAgent> = new Map();
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

    // Restore agents from store
    this.restoreAgents();
  }

  /** Get the path to the agent's stdout log file */
  private getStdoutLogPath(agentId: string): string {
    const logsDir = join(this.projectRoot, '.maestro', 'logs');
    return join(logsDir, `${agentId}.stdout.jsonl`);
  }

  /** Ensure logs directory exists */
  private ensureLogsDir(): void {
    const logsDir = join(this.projectRoot, '.maestro', 'logs');
    if (!existsSync(logsDir)) {
      mkdirSync(logsDir, { recursive: true });
    }
  }

  /** Check if agent completed successfully by analyzing stdout log */
  private checkAgentCompletionFromLog(agentId: string): 'finished' | 'failed' | null {
    const logPath = this.getStdoutLogPath(agentId);
    if (!existsSync(logPath)) {
      this.logger.debug(`No stdout log found for agent`, { id: agentId, path: logPath });
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
            this.logger.debug(`Found result event in log, agent completed successfully`, { id: agentId });
            return 'finished';
          }
        } catch {
          // Ignore parse errors for individual lines
        }
      }

      // No result event found - check for error indicators
      this.logger.debug(`No result event found in log`, { id: agentId, lineCount: lines.length });
      return lines.length > 0 ? 'failed' : null;
    } catch (error) {
      this.logger.warn(`Error reading stdout log`, { id: agentId, error: (error as Error).message });
      return null;
    }
  }

  private restoreAgents(): void {
    const savedAgents = this.store.listAgents();
    this.logger.debug(`Restoring agents from store`, { count: savedAgents.length });

    for (const agentInfo of savedAgents) {
      // Include terminal state agents in memory map (for status display)
      // Skip only very old terminal agents (older than 7 days)
      if (isTerminalState(agentInfo.status)) {
        const finishedAt = agentInfo.finishedAt ? new Date(agentInfo.finishedAt) : null;
        const daysSinceFinished = finishedAt
          ? (Date.now() - finishedAt.getTime()) / (1000 * 60 * 60 * 24)
          : 0;

        if (daysSinceFinished > 7) {
          this.logger.debug(`Skipping old terminal agent`, { id: agentInfo.id, status: agentInfo.status, daysSinceFinished });
          continue;
        }

        // Add terminal agent to memory map for status display
        this.logger.debug(`Restoring terminal agent`, { id: agentInfo.id, status: agentInfo.status });
        const managedAgent = this.createManagedAgent(agentInfo);
        this.agents.set(agentInfo.id, managedAgent);
        continue;
      }

      // Check grace period for newly spawned agents (5 seconds)
      const spawnedAt = agentInfo.spawnedAt ? new Date(agentInfo.spawnedAt) : null;
      const gracePeriodMs = 5000;
      const isWithinGracePeriod = spawnedAt && (Date.now() - spawnedAt.getTime()) < gracePeriodMs;

      if (isWithinGracePeriod) {
        this.logger.debug(`Agent within grace period, skipping process check`, {
          id: agentInfo.id,
          spawnedAt: spawnedAt?.toISOString(),
          ageMs: spawnedAt ? Date.now() - spawnedAt.getTime() : null,
        });
        // Restore agent without process check
        const managedAgent = this.createManagedAgent(agentInfo);
        this.agents.set(agentInfo.id, managedAgent);
        continue;
      }

      // Check if process is still running
      this.logger.debug(`Checking process for agent`, { id: agentInfo.id, pid: agentInfo.pid });
      if (agentInfo.pid && !isProcessRunning(agentInfo.pid)) {
        // Process not running - check stdout log to determine if it finished successfully
        const completionStatus = this.checkAgentCompletionFromLog(agentInfo.id);

        if (completionStatus === 'finished') {
          this.logger.info(`Agent completed successfully (from log analysis)`, { id: agentInfo.id });
          agentInfo.status = 'finished';
          agentInfo.finishedAt = new Date();
        } else {
          this.logger.warn(`Agent process no longer running, marking as failed`, { id: agentInfo.id, pid: agentInfo.pid });
          agentInfo.status = 'failed';
          agentInfo.error = 'Process not found on restore';
          agentInfo.finishedAt = new Date();
        }

        this.store.saveAgent(agentInfo);
        // Still add to memory map so getInfo can find it
        const managedAgent = this.createManagedAgent(agentInfo);
        this.agents.set(agentInfo.id, managedAgent);
        continue;
      }

      // Restore agent in memory (without process - can't reattach)
      this.logger.debug(`Restoring agent in memory`, { id: agentInfo.id, status: agentInfo.status });
      const managedAgent = this.createManagedAgent(agentInfo);
      this.agents.set(agentInfo.id, managedAgent);
    }

    this.logger.debug(`Restore complete`, { restoredCount: this.agents.size });
  }

  private createManagedAgent(info: AgentInfo): ManagedAgent {
    const stateMachine = new AgentStateMachine(info.status);
    const agentLogger = createAgentLogger(info.id, this.projectRoot);

    const parser = new OutputParser({
      onMessage: (content) => {
        const agent = this.agents.get(info.id);
        if (agent) {
          agent.outputBuffer.push(content);
          agentLogger.debug(`Output: ${content}`);
          this.emitEvent({ type: 'output', agentId: info.id, timestamp: new Date(), data: content });
        }
      },
      onToolUse: (name, input) => {
        const agent = this.agents.get(info.id);
        if (agent) {
          agent.info.metrics.toolCalls++;
          agentLogger.debug(`Tool use: ${name}`, { input });
        }
      },
      onInputRequest: () => {
        const agent = this.agents.get(info.id);
        if (agent && agent.stateMachine.canTransitionTo('waiting_input')) {
          this.updateStatus(info.id, 'waiting_input');
          this.emitEvent({ type: 'input_request', agentId: info.id, timestamp: new Date() });
        }
      },
      onError: (error) => {
        agentLogger.error(`Parser error: ${error.message}`);
      },
    });

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
      stateMachine,
      parser,
      outputBuffer: [],
      parsedEvents: [],
      agentLogger,
    };
  }

  async spawn(options: AgentSpawnOptions): Promise<AgentInfo> {
    const id = generateAgentId();

    // Create initial agent info
    const info: AgentInfo = {
      id,
      name: options.name,
      prompt: options.prompt,
      worktreeId: '', // Will be set by caller
      branch: '', // Will be set by caller
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
      this.logger.info(`Agent queued due to concurrent limit`, { id, runningCount, max: this.config.agent.maxConcurrent });
      this.pendingQueue.push(id);
      return info;
    }

    // Start immediately
    await this.startAgent(id, options);

    return info;
  }

  private async startAgent(id: string, options: AgentSpawnOptions): Promise<void> {
    const managedAgent = this.agents.get(id);
    if (!managedAgent) {
      throw new Error(`Agent '${id}' not found`);
    }

    try {
      managedAgent.stateMachine.start();
      managedAgent.info.startedAt = new Date();
      managedAgent.info.spawnedAt = new Date(); // Record spawn time for grace period checking

      // Ensure logs directory exists and get stdout log path
      this.ensureLogsDir();
      const stdoutLogPath = this.getStdoutLogPath(id);

      const { process, pid } = spawnClaude({
        prompt: options.prompt,
        cwd: options.worktreePath,
        env: options.env,
        timeout: options.timeout || this.config.agent.defaultTimeout,
        stdoutLogPath, // Pass log path for tee persistence
      }, this.config);

      managedAgent.process = process;
      managedAgent.info.pid = pid;
      this.store.saveAgent(managedAgent.info);

      // Transition to running
      managedAgent.stateMachine.run();

      // Handle stdout (tee handles file persistence, we just parse here)
      if (process.stdout) {
        this.logger.debug(`Setting up stdout handler`, { id, stdoutLogPath });

        process.stdout.on('data', (chunk: Buffer) => {
          const text = chunk.toString();
          this.logger.debug(`Received stdout data`, { id, length: text.length, preview: text.slice(0, 100) });

          const events = managedAgent.parser.feed(text);
          this.logger.debug(`Parsed events from stdout`, { id, eventCount: events.length });
          managedAgent.parsedEvents.push(...events);
        });
      } else {
        this.logger.warn(`Process has no stdout`, { id });
      }

      // Handle stderr
      if (process.stderr) {
        process.stderr.on('data', (chunk: Buffer) => {
          managedAgent.agentLogger.warn(`stderr: ${chunk.toString()}`);
        });
      }

      // Handle process exit
      process.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
        managedAgent.parser.flush();
        managedAgent.info.exitCode = code ?? undefined;
        managedAgent.info.finishedAt = new Date();
        managedAgent.info.metrics.duration =
          managedAgent.info.finishedAt.getTime() - (managedAgent.info.startedAt?.getTime() || managedAgent.info.createdAt.getTime());
        managedAgent.info.metrics.filesModified = extractFilesFromToolCalls(managedAgent.parsedEvents);

        if (code === 0) {
          managedAgent.stateMachine.finish();
        } else {
          managedAgent.info.error = signal ? `Killed by ${signal}` : `Exited with code ${code}`;
          managedAgent.stateMachine.fail();
        }

        this.store.saveAgent(managedAgent.info);
        this.logger.info(`Agent finished`, { id, code, signal });
      });

      process.on('error', (error: Error) => {
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

  private processQueue(): void {
    if (this.pendingQueue.length === 0) return;

    const runningCount = this.getRunningCount();
    const available = this.config.agent.maxConcurrent - runningCount;

    for (let i = 0; i < available && this.pendingQueue.length > 0; i++) {
      const id = this.pendingQueue.shift()!;
      const agent = this.agents.get(id);

      if (agent && agent.info.status === 'pending') {
        // We need the original spawn options - retrieve from stored info
        this.startAgent(id, {
          prompt: agent.info.prompt,
          worktreePath: '', // This is a limitation - we'd need to store worktreePath
          name: agent.info.name,
        }).catch((error) => {
          this.logger.error(`Failed to start queued agent`, { id, error });
        });
      }
    }
  }

  async kill(id: string, force: boolean = false): Promise<void> {
    const managedAgent = this.agents.get(id);
    if (!managedAgent) {
      throw new Error(`Agent '${id}' not found`);
    }

    if (isTerminalState(managedAgent.info.status)) {
      this.logger.warn(`Agent already in terminal state`, { id, status: managedAgent.info.status });
      return;
    }

    if (!managedAgent.process) {
      // Agent was restored without process, mark as failed directly
      this.logger.warn(`Agent has no associated process, marking as failed`, { id });
      managedAgent.info.status = 'failed';
      managedAgent.info.error = 'Killed by user (no process attached)';
      managedAgent.info.finishedAt = new Date();
      managedAgent.stateMachine.fail();
      this.store.saveAgent(managedAgent.info);
      return;
    }

    killProcess(managedAgent.process, force);
  }

  async sendInput(id: string, input: string): Promise<void> {
    const managedAgent = this.agents.get(id);
    if (!managedAgent) {
      throw new Error(`Agent '${id}' not found`);
    }

    if (managedAgent.info.status !== 'waiting_input') {
      throw new Error(`Agent '${id}' is not waiting for input (current status: ${managedAgent.info.status})`);
    }

    if (!managedAgent.process) {
      throw new Error(`Agent '${id}' has no associated process`);
    }

    sendProcessInput(managedAgent.process, input);
    managedAgent.stateMachine.run();
  }

  getStatus(id: string): AgentStatus {
    const managedAgent = this.agents.get(id);
    if (!managedAgent) {
      throw new Error(`Agent '${id}' not found`);
    }
    return managedAgent.info.status;
  }

  getInfo(id: string): AgentInfo | null {
    const managedAgent = this.agents.get(id);
    return managedAgent?.info || null;
  }

  listAll(): AgentInfo[] {
    return Array.from(this.agents.values())
      .filter((a) => !a.info.archived)
      .map((a) => a.info);
  }

  archive(id: string): void {
    const managedAgent = this.agents.get(id);
    if (!managedAgent) {
      this.logger.debug(`Agent not found for archive`, { id });
      return;
    }

    if (!isTerminalState(managedAgent.info.status)) {
      this.logger.warn(`Cannot archive non-terminal agent`, { id, status: managedAgent.info.status });
      return;
    }

    managedAgent.info.archived = true;
    this.store.saveAgent(managedAgent.info);
    this.logger.info(`Agent archived`, { id });
  }

  getOutput(id: string): string[] {
    const managedAgent = this.agents.get(id);
    if (!managedAgent) return [];

    // If outputBuffer is empty and agent is in terminal state, try loading from log file
    if (managedAgent.outputBuffer.length === 0 && isTerminalState(managedAgent.info.status)) {
      const loadedOutput = this.loadOutputFromLog(id);
      if (loadedOutput.length > 0) {
        managedAgent.outputBuffer = loadedOutput;
      }
    }

    return managedAgent.outputBuffer;
  }

  /** Load output from persisted stdout log file */
  private loadOutputFromLog(agentId: string): string[] {
    const logPath = this.getStdoutLogPath(agentId);
    if (!existsSync(logPath)) {
      this.logger.debug(`No stdout log found for loading output`, { id: agentId });
      return [];
    }

    try {
      const content = readFileSync(logPath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      const output: string[] = [];

      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          // Extract message content from assistant events
          if (event.type === 'assistant' && event.message?.content) {
            const messageContent = event.message.content;
            if (Array.isArray(messageContent)) {
              for (const block of messageContent) {
                if (block.type === 'text' && block.text) {
                  output.push(block.text);
                }
              }
            } else if (typeof messageContent === 'string') {
              output.push(messageContent);
            }
          }
        } catch {
          // Ignore parse errors for individual lines
        }
      }

      this.logger.debug(`Loaded output from log file`, { id: agentId, lineCount: output.length });
      // Return only the last 100 lines to limit memory usage
      return output.slice(-100);
    } catch (error) {
      this.logger.warn(`Error loading output from log`, { id: agentId, error: (error as Error).message });
      return [];
    }
  }

  getOutputStream(id: string): Readable | null {
    const managedAgent = this.agents.get(id);
    return managedAgent?.process?.stdout || null;
  }

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

  private updateStatus(id: string, status: AgentStatus): void {
    const managedAgent = this.agents.get(id);
    if (managedAgent) {
      managedAgent.stateMachine.transition(status);
    }
  }

  private getRunningCount(): number {
    return Array.from(this.agents.values()).filter((a) => isRunningState(a.info.status)).length;
  }

  setWorktreeInfo(id: string, worktreeId: string, branch: string): void {
    const managedAgent = this.agents.get(id);
    if (managedAgent) {
      managedAgent.info.worktreeId = worktreeId;
      managedAgent.info.branch = branch;
      this.store.saveAgent(managedAgent.info);
    }
  }
}
