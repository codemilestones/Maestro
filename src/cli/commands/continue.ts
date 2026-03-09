import { Command } from 'commander';
import chalk from 'chalk';
import { isMaestroInitialized } from '../../shared/config.js';
import { AgentController } from '../../agent/AgentController.js';
import { WorktreeManager } from '../../worktree/WorktreeManager.js';

export const continueCommand = new Command('continue')
  .description('Resume a finished/failed Agent with a new prompt (continues the conversation)')
  .argument('<agent-id>', 'ID of the agent to resume')
  .argument('<prompt>', 'New task/prompt for the resumed conversation')
  .action(async (agentId: string, prompt: string) => {
    if (!isMaestroInitialized()) {
      console.error(chalk.red('Error: Maestro is not initialized.'));
      console.error(chalk.gray(`Run ${chalk.cyan('maestro init')} first.`));
      process.exit(1);
    }

    const agentController = new AgentController();
    const worktreeManager = new WorktreeManager();

    // Find the agent
    const agentInfo = agentController.getInfo(agentId);
    if (!agentInfo) {
      console.error(chalk.red(`Error: Agent '${agentId}' not found.`));
      process.exit(1);
    }

    // Check if agent has a session ID
    if (!agentInfo.sessionId) {
      console.error(chalk.red(`Error: Agent '${agentId}' has no session ID. Cannot resume.`));
      console.error(chalk.gray('The agent may have been created before session tracking was enabled.'));
      process.exit(1);
    }

    // If agent is running/waiting_input, suggest using sendInput instead
    if (agentInfo.status === 'running' || agentInfo.status === 'waiting_input') {
      console.error(chalk.red(`Error: Agent '${agentId}' is still ${agentInfo.status}.`));
      console.error(chalk.gray('Use the attach command to interact with running agents.'));
      process.exit(1);
    }

    // Get the worktree path
    let worktreePath: string;
    try {
      worktreePath = worktreeManager.getPath(agentInfo.worktreeId);
    } catch {
      console.error(chalk.red(`Error: Worktree '${agentInfo.worktreeId}' not found.`));
      console.error(chalk.gray('The worktree may have been cleaned up.'));
      process.exit(1);
    }

    console.log(chalk.gray(`Resuming agent ${agentId}...`));
    console.log(chalk.gray(`  Session: ${agentInfo.sessionId}`));
    console.log(chalk.gray(`  Prompt: "${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}"`));

    try {
      const resumed = await agentController.resume(agentId, prompt, worktreePath);

      console.log();
      console.log(chalk.green('✓ Agent resumed successfully!'));
      console.log();
      console.log(`  ${chalk.bold('ID:')}        ${resumed.id}`);
      console.log(`  ${chalk.bold('Session:')}   ${resumed.sessionId}`);
      console.log(`  ${chalk.bold('Branch:')}    ${resumed.branch}`);
      console.log();
      console.log('Commands:');
      console.log(chalk.cyan(`  maestro status           `) + chalk.gray('- View all agents'));
      console.log(chalk.cyan(`  maestro attach           `) + chalk.gray('- Open TUI'));
      console.log(chalk.cyan(`  maestro logs ${resumed.id} `) + chalk.gray('- View logs'));

      process.exit(0);
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  });
