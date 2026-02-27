import { type ExecaChildProcess } from './process/spawner.js';
import { Readable } from 'node:stream';
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

  private restoreAgents(): void {
    const savedAgents = this.store.listAgents();

    for (const agentInfo of savedAgents) {
      // Skip terminal states older than cleanup delay
      if (isTerminalState(agentInfo.status)) {
        continue;
      }

      // Check if process is still running
      if (agentInfo.pid && !isProcessRunning(agentInfo.pid)) {
        this.logger.warn(`Agent process no longer running, marking as failed`, { id: agentInfo.id, pid: agentInfo.pid });
        agentInfo.status = 'failed';
        agentInfo.error = 'Process terminated unexpectedly';
        agentInfo.finishedAt = new Date();
        this.store.saveAgent(agentInfo);
        continue;
      }

      // Restore agent in memory (without process - can't reattach)
      const managedAgent = this.createManagedAgent(agentInfo);
      this.agents.set(agentInfo.id, managedAgent);
    }
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

      const { process, pid } = spawnClaude({
        prompt: options.prompt,
        cwd: options.worktreePath,
        env: options.env,
        timeout: options.timeout || this.config.agent.defaultTimeout,
      }, this.config);

      managedAgent.process = process;
      managedAgent.info.pid = pid;
      this.store.saveAgent(managedAgent.info);

      // Transition to running
      managedAgent.stateMachine.run();

      // Handle stdout
      if (process.stdout) {
        process.stdout.on('data', (chunk: Buffer) => {
          const text = chunk.toString();
          const events = managedAgent.parser.feed(text);
          managedAgent.parsedEvents.push(...events);
        });
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

    if (!managedAgent.process) {
      throw new Error(`Agent '${id}' has no associated process`);
    }

    if (isTerminalState(managedAgent.info.status)) {
      this.logger.warn(`Agent already in terminal state`, { id, status: managedAgent.info.status });
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
    return Array.from(this.agents.values()).map((a) => a.info);
  }

  getOutput(id: string): string[] {
    const managedAgent = this.agents.get(id);
    return managedAgent?.outputBuffer || [];
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
