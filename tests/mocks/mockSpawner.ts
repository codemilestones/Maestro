import { MockClaudeProcess } from './MockClaudeProcess.js';
import type { SpawnerOptions, SpawnedProcess } from '../../src/agent/process/spawner.js';
import type { MaestroConfig } from '../../src/shared/config.js';

/**
 * Mock spawner for testing
 */
export class MockSpawner {
  public spawnedProcesses: Map<number, MockClaudeProcess> = new Map();
  public spawnCalls: SpawnerOptions[] = [];
  private nextPid: number = 10000;

  /**
   * Create a mock spawnClaude function
   */
  createSpawnFn(): (options: SpawnerOptions, config?: MaestroConfig) => SpawnedProcess {
    return (options: SpawnerOptions, _config?: MaestroConfig): SpawnedProcess => {
      this.spawnCalls.push(options);

      const pid = this.nextPid++;
      const mockProcess = new MockClaudeProcess(pid);
      this.spawnedProcesses.set(pid, mockProcess);

      return {
        process: mockProcess as unknown as SpawnedProcess['process'],
        pid,
      };
    };
  }

  /**
   * Get mock process by PID
   */
  getProcess(pid: number): MockClaudeProcess | undefined {
    return this.spawnedProcesses.get(pid);
  }

  /**
   * Get the last spawned process
   */
  getLastProcess(): MockClaudeProcess | undefined {
    const pids = Array.from(this.spawnedProcesses.keys());
    if (pids.length === 0) return undefined;
    return this.spawnedProcesses.get(pids[pids.length - 1]);
  }

  /**
   * Reset all state
   */
  reset(): void {
    this.spawnedProcesses.clear();
    this.spawnCalls = [];
    this.nextPid = 10000;
  }
}

// Singleton instance for easy import
export const mockSpawner = new MockSpawner();
