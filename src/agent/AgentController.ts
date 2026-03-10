import { type ExecaChildProcess } from './process/launcher.js';
import { Readable } from 'node:stream';
import { existsSync, readFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { AgentInfo, AgentStatus, AgentMetrics, AgentCreateOptions, AgentEvent, AgentEventHandler, OutputLine } from '../shared/types.js';
import { generateAgentId } from '../shared/id.js';
import { loadConfig, MaestroConfig } from '../shared/config.js';
import { getLogger, createAgentLogger, Logger } from '../shared/logger.js';
import { launchClaude, killProcess, sendInput as sendProcessInput, isProcessRunning } from './process/launcher.js';
import { OutputParser, ParsedEvent, extractFilesFromToolCalls } from './output/parser.js';
import { AgentStateMachine, isTerminalState, isRunningState } from './state/state.js';
import { AgentStore } from './state/store.js';
import { WorktreeManager } from '../worktree/WorktreeManager.js';
import { extractSessionIdFromLog } from '../shared/logUtils.js';

interface ManagedAgent {
  info: AgentInfo;
  process?: ExecaChildProcess;
  stateMachine: AgentStateMachine;
  parser: OutputParser;
  outputBuffer: OutputLine[];
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

  /** Extract session_id from the stdout log's init event */
  private extractSessionIdFromLog(agentId: string): string | null {
    const logPath = this.getStdoutLogPath(agentId);
    return extractSessionIdFromLog(logPath);
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

        // Recover sessionId from log if missing (fd mode doesn't capture via pipe)
        if (!agentInfo.sessionId) {
          const sessionId = this.extractSessionIdFromLog(agentInfo.id);
          if (sessionId) {
            agentInfo.sessionId = sessionId;
            this.store.saveAgent(agentInfo);
            this.logger.debug(`Session ID recovered for terminal agent`, { id: agentInfo.id, sessionId });
          }
        }

        // Add terminal agent to memory map for status display
        this.logger.debug(`Restoring terminal agent`, { id: agentInfo.id, status: agentInfo.status });
        const managedAgent = this.createManagedAgent(agentInfo);
        this.agents.set(agentInfo.id, managedAgent);
        continue;
      }

      // Check grace period for newly launched agents (5 seconds)
      const launchedAt = agentInfo.launchedAt ? new Date(agentInfo.launchedAt) : null;
      const gracePeriodMs = 5000;
      const isWithinGracePeriod = launchedAt && (Date.now() - launchedAt.getTime()) < gracePeriodMs;

      if (isWithinGracePeriod) {
        this.logger.debug(`Agent within grace period, skipping process check`, {
          id: agentInfo.id,
          launchedAt: launchedAt?.toISOString(),
          ageMs: launchedAt ? Date.now() - launchedAt.getTime() : null,
        });
        // Restore agent without process check
        const managedAgent = this.createManagedAgent(agentInfo);
        this.agents.set(agentInfo.id, managedAgent);
        continue;
      }

      // Check if process is still running
      this.logger.debug(`Checking process for agent`, { id: agentInfo.id, pid: agentInfo.pid });
      if (agentInfo.pid && !isProcessRunning(agentInfo.pid)) {
        // Extract sessionId from log if not already captured (fd mode has no pipe)
        if (!agentInfo.sessionId) {
          const sessionId = this.extractSessionIdFromLog(agentInfo.id);
          if (sessionId) {
            agentInfo.sessionId = sessionId;
            this.logger.debug(`Session ID recovered from log on restore`, { id: agentInfo.id, sessionId });
          }
        }

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
      onMessage: (content, role) => {
        const agent = this.agents.get(info.id);
        if (agent) {
          const line: OutputLine = { role: role || 'assistant', content };
          agent.outputBuffer.push(line);
          agentLogger.debug(`Output: ${content}`);
          this.emitEvent({ type: 'output', agentId: info.id, timestamp: new Date(), data: line });
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
      onResult: (content) => {
        const agent = this.agents.get(info.id);
        if (agent && !isTerminalState(agent.info.status)) {
          agent.info.finishedAt = new Date();
          agent.info.metrics.duration =
            agent.info.finishedAt.getTime() - (agent.info.startedAt?.getTime() || agent.info.createdAt.getTime());
          agent.info.metrics.filesModified = extractFilesFromToolCalls(agent.parsedEvents);
          agent.stateMachine.finish();
          this.store.saveAgent(agent.info);
          agentLogger.info('Agent completed via result event');
        }
      },
      onSessionInit: (sessionId) => {
        const agent = this.agents.get(info.id);
        if (agent) {
          agent.info.sessionId = sessionId;
          this.store.saveAgent(agent.info);
          agentLogger.debug(`Session ID captured: ${sessionId}`);
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

  async create(options: AgentCreateOptions): Promise<AgentInfo> {
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

  private async startAgent(id: string, options: AgentCreateOptions): Promise<void> {
    const managedAgent = this.agents.get(id);
    if (!managedAgent) {
      throw new Error(`Agent '${id}' not found`);
    }

    try {
      managedAgent.stateMachine.start();
      managedAgent.info.startedAt = new Date();
      managedAgent.info.launchedAt = new Date(); // Record launch time for grace period checking

      // Ensure logs directory exists and get stdout log path
      this.ensureLogsDir();
      const stdoutLogPath = this.getStdoutLogPath(id);

      const { process, pid } = launchClaude({
        prompt: options.prompt,
        cwd: options.worktreePath,
        env: options.env,
        timeout: options.timeout || this.config.agent.defaultTimeout,
        stdoutLogPath, // Pass log path for tee persistence
        resumeSessionId: options.resumeSessionId,
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
        // We need the original create options - retrieve from stored info
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

  /** Lazy check: verify running agents are still alive, update status if not */
  private refreshRunningAgent(managedAgent: ManagedAgent): void {
    const info = managedAgent.info;
    if (!isRunningState(info.status)) return;

    // Skip if within grace period
    const launchedAt = info.launchedAt ? new Date(info.launchedAt) : null;
    if (launchedAt && (Date.now() - launchedAt.getTime()) < 5000) return;

    // Check if process is still running
    if (info.pid && !isProcessRunning(info.pid)) {
      // Extract sessionId from log if not already captured (fd mode has no pipe)
      if (!info.sessionId) {
        const sessionId = this.extractSessionIdFromLog(info.id);
        if (sessionId) {
          info.sessionId = sessionId;
          this.logger.debug(`Session ID recovered from log`, { id: info.id, sessionId });
        }
      }

      const completionStatus = this.checkAgentCompletionFromLog(info.id);

      if (completionStatus === 'finished') {
        this.logger.info(`Agent completed (lazy check from log)`, { id: info.id });
        info.finishedAt = new Date();
        info.metrics.duration =
          info.finishedAt.getTime() - (info.startedAt?.getTime() || info.createdAt.getTime());
        managedAgent.stateMachine.finish();
      } else {
        this.logger.warn(`Agent process dead (lazy check)`, { id: info.id, pid: info.pid });
        info.error = 'Process not found';
        info.finishedAt = new Date();
        managedAgent.stateMachine.fail();
      }

      this.store.saveAgent(info);
    }
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
    if (!managedAgent) return null;
    this.refreshRunningAgent(managedAgent);
    return managedAgent.info;
  }

  listAll(): AgentInfo[] {
    const agents = Array.from(this.agents.values()).filter((a) => !a.info.archived);
    for (const agent of agents) {
      this.refreshRunningAgent(agent);
    }
    return agents.map((a) => a.info);
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

  getOutput(id: string): OutputLine[] {
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
  private loadOutputFromLog(agentId: string): OutputLine[] {
    const logPath = this.getStdoutLogPath(agentId);
    if (!existsSync(logPath)) {
      this.logger.debug(`No stdout log found for loading output`, { id: agentId });
      return [];
    }

    try {
      const content = readFileSync(logPath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);
      const output: OutputLine[] = [];

      // Insert the initial prompt as the first user message
      // (the initial prompt is not emitted as a stream event)
      const agent = this.agents.get(agentId);
      if (agent?.info.prompt) {
        output.push({ role: 'user', content: agent.info.prompt });
      }

      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          const role: 'user' | 'assistant' = event.type === 'user' ? 'user' : 'assistant';

          // Extract text content from assistant, user, and result events
          if ((event.type === 'assistant' || event.type === 'user' || event.type === 'result') && event.message?.content) {
            const messageContent = event.message.content;
            if (Array.isArray(messageContent)) {
              for (const block of messageContent) {
                // Only extract text blocks (skip tool_result, tool_use, etc.)
                if (block.type === 'text' && block.text) {
                  output.push({ role, content: block.text });
                }
              }
            } else if (typeof messageContent === 'string') {
              output.push({ role, content: messageContent });
            }
          }
        } catch {
          // Ignore parse errors for individual lines
        }
      }

      this.logger.debug(`Loaded output from log file`, { id: agentId, lineCount: output.length });
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

  async resume(id: string, prompt: string, worktreePath: string): Promise<AgentInfo> {
    const managedAgent = this.agents.get(id);
    if (!managedAgent) {
      throw new Error(`Agent '${id}' not found`);
    }

    if (!isTerminalState(managedAgent.info.status)) {
      throw new Error(`Agent '${id}' is not in a terminal state (current: ${managedAgent.info.status}). Use sendInput for running agents.`);
    }

    if (!managedAgent.info.sessionId) {
      throw new Error(`Agent '${id}' has no session ID. Cannot resume without a previous session.`);
    }

    const sessionId = managedAgent.info.sessionId;

    // Reset agent state for new run
    managedAgent.info.prompt = prompt;
    managedAgent.info.error = undefined;
    managedAgent.info.exitCode = undefined;
    managedAgent.info.finishedAt = undefined;
    managedAgent.outputBuffer = [];
    managedAgent.parsedEvents = [];

    // Create fresh state machine (starting from terminal state, transition to starting)
    const newStateMachine = new AgentStateMachine(managedAgent.info.status);
    // Re-register the transition listener
    newStateMachine.onTransition((newStatus, oldStatus) => {
      managedAgent.info.status = newStatus;
      this.store.saveAgent(managedAgent.info);
      this.emitEvent({
        type: 'status_change',
        agentId: id,
        timestamp: new Date(),
        data: { from: oldStatus, to: newStatus },
      });

      if (isTerminalState(newStatus)) {
        this.processQueue();
      }
    });
    managedAgent.stateMachine = newStateMachine;

    this.store.saveAgent(managedAgent.info);
    this.logger.info(`Resuming agent`, { id, sessionId });

    await this.startAgent(id, {
      prompt,
      worktreePath,
      resumeSessionId: sessionId,
    });

    return managedAgent.info;
  }

  setWorktreeInfo(id: string, worktreeId: string, branch: string): void {
    const managedAgent = this.agents.get(id);
    if (managedAgent) {
      managedAgent.info.worktreeId = worktreeId;
      managedAgent.info.branch = branch;
      this.store.saveAgent(managedAgent.info);
    }
  }

  async handleConversationInput(id: string, text: string): Promise<void> {
    const managedAgent = this.agents.get(id);
    if (!managedAgent) {
      throw new Error(`Agent '${id}' not found`);
    }

    if (managedAgent.info.status === 'waiting_input') {
      await this.sendInput(id, text);
    } else if (isTerminalState(managedAgent.info.status)) {
      if (!managedAgent.info.sessionId) {
        throw new Error(`Agent '${id}' has no session ID. Cannot resume.`);
      }
      const worktreePath = this.getWorktreePath(id);
      if (!worktreePath) {
        throw new Error(`Agent '${id}' has no worktree path. Cannot resume.`);
      }
      await this.resume(id, text, worktreePath);
    } else {
      throw new Error(`Agent '${id}' is not accepting input (status: ${managedAgent.info.status})`);
    }
  }

  getWorktreePath(id: string): string | null {
    const managedAgent = this.agents.get(id);
    if (!managedAgent || !managedAgent.info.worktreeId) {
      return null;
    }

    try {
      const worktreeManager = new WorktreeManager(this.projectRoot);
      return worktreeManager.getPath(managedAgent.info.worktreeId);
    } catch {
      this.logger.warn(`Failed to resolve worktree path`, { id, worktreeId: managedAgent.info.worktreeId });
      return null;
    }
  }
}
