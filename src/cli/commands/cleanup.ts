import { Command } from 'commander';
import chalk from 'chalk';
import { isMaestroInitialized } from '../../shared/config.js';
import { WorktreeManager } from '../../worktree/WorktreeManager.js';
import { AgentControllerPTY } from '../../agent/AgentControllerPTY.js';
import { isTerminalState } from '../../agent/state/state.js';

export const cleanupCommand = new Command('cleanup')
  .description('Clean up completed worktrees')
  .option('-a, --all', 'Clean up all worktrees (including running)')
  .option('-d, --dry-run', 'Show what would be cleaned up without actually doing it')
  .option('--delete-remote', 'Also delete remote branches')
  .action(async (options) => {
    if (!isMaestroInitialized()) {
      console.error(chalk.red('Error: Maestro is not initialized.'));
      process.exit(1);
    }

    const worktreeManager = new WorktreeManager();
    const agentController = new AgentControllerPTY();

    const agents = agentController.listAll();
    const worktrees = await worktreeManager.list();

    // Find worktrees to clean up
    const toCleanup: { worktreeId: string; agentId?: string; branch: string; reason: string }[] = [];

    for (const worktree of worktrees) {
      // Find associated agent
      const agent = agents.find((a) => a.worktreeId === worktree.id);

      if (!agent) {
        // Orphaned worktree
        toCleanup.push({
          worktreeId: worktree.id,
          branch: worktree.branch,
          reason: 'orphaned (no associated agent)',
        });
        continue;
      }

      if (options.all) {
        toCleanup.push({
          worktreeId: worktree.id,
          agentId: agent.id,
          branch: worktree.branch,
          reason: '--all flag',
        });
      } else if (isTerminalState(agent.status)) {
        toCleanup.push({
          worktreeId: worktree.id,
          agentId: agent.id,
          branch: worktree.branch,
          reason: `agent ${agent.status}`,
        });
      }
    }

    if (toCleanup.length === 0) {
      console.log(chalk.gray('No worktrees to clean up.'));
      return;
    }

    console.log(chalk.bold(`Worktrees to clean up (${toCleanup.length}):`));
    console.log();

    for (const item of toCleanup) {
      console.log(
        `  ${chalk.yellow(item.worktreeId)} ` +
        chalk.gray(`(${item.branch})`) +
        ` - ${item.reason}`
      );
    }
    console.log();

    if (options.dryRun) {
      console.log(chalk.yellow('Dry run - no changes made.'));
      return;
    }

    // Confirm if cleaning running agents
    if (options.all) {
      const runningCount = toCleanup.filter((t) => {
        const agent = agents.find((a) => a.id === t.agentId);
        return agent && !isTerminalState(agent.status);
      }).length;

      if (runningCount > 0) {
        console.log(chalk.yellow(`Warning: This will terminate ${runningCount} running agent(s).`));
        // In a real implementation, we'd prompt for confirmation here
      }
    }

    // Perform cleanup
    let cleaned = 0;
    let errors = 0;

    for (const item of toCleanup) {
      try {
        // Kill agent if running
        if (item.agentId) {
          const agent = agentController.getInfo(item.agentId);
          if (agent && !isTerminalState(agent.status)) {
            await agentController.kill(item.agentId, true);
          }
        }

        // Remove worktree
        await worktreeManager.remove(item.worktreeId, {
          force: true,
          deleteRemoteBranch: options.deleteRemote,
        });

        console.log(chalk.green(`  ✓ Cleaned ${item.worktreeId}`));
        cleaned++;
      } catch (error) {
        console.log(chalk.red(`  ✗ Failed to clean ${item.worktreeId}: ${error instanceof Error ? error.message : error}`));
        errors++;
      }
    }

    console.log();
    console.log(chalk.bold(`Summary: ${cleaned} cleaned, ${errors} errors`));
  });
