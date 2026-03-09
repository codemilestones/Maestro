import { Command } from 'commander';
import chalk from 'chalk';
import { isMaestroInitialized, loadConfig } from '../../shared/config.js';
import { WorktreeManager } from '../../worktree/WorktreeManager.js';
import { AgentController } from '../../agent/AgentController.js';
import { generateTaskId } from '../../shared/id.js';

export const newCommand = new Command('new')
  .description('Create a new Agent to execute a task')
  .argument('<prompt>', 'Task description for the Agent')
  .option('-b, --branch <name>', 'Branch name for the worktree')
  .option('--base <branch>', 'Base branch to create from (default: main)')
  .option('-n, --name <name>', 'Friendly name for the Agent')
  .option('--continue-from <agent-id>', 'Reuse worktree and session from an existing agent')
  .action(async (prompt, options) => {
    // Check initialization
    if (!isMaestroInitialized()) {
      console.error(chalk.red('Error: Maestro is not initialized.'));
      console.error(chalk.gray(`Run ${chalk.cyan('maestro init')} first.`));
      process.exit(1);
    }

    const config = loadConfig();
    const worktreeManager = new WorktreeManager();
    const agentController = new AgentController();

    console.log(chalk.gray(`Creating agent for: "${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}"`));

    try {
      let worktreePath: string;
      let worktreeId: string;
      let worktreeBranch: string;
      let resumeSessionId: string | undefined;

      if (options.continueFrom) {
        // Reuse worktree and session from existing agent
        const sourceAgent = agentController.getInfo(options.continueFrom);
        if (!sourceAgent) {
          console.error(chalk.red(`Error: Source agent '${options.continueFrom}' not found.`));
          process.exit(1);
        }

        worktreeId = sourceAgent.worktreeId;
        worktreeBranch = sourceAgent.branch;
        resumeSessionId = sourceAgent.sessionId;

        try {
          worktreePath = worktreeManager.getPath(worktreeId);
        } catch {
          console.error(chalk.red(`Error: Worktree '${worktreeId}' not found.`));
          process.exit(1);
        }

        console.log(chalk.gray(`Continuing from agent ${options.continueFrom}...`));
        if (resumeSessionId) {
          console.log(chalk.gray(`  Resuming session: ${resumeSessionId}`));
        }
      } else {
        // Generate IDs and create new worktree
        const taskId = generateTaskId();
        const branchName = options.branch || taskId;

        console.log(chalk.gray('Creating worktree...'));
        const worktree = await worktreeManager.create({
          branch: branchName,
          base: options.base || config.worktree.defaultBase,
          taskId,
        });

        worktreePath = worktree.path;
        worktreeId = worktree.id;
        worktreeBranch = worktree.branch;
      }

      // Create agent
      console.log(chalk.gray('Starting Claude Code...'));
      const agent = await agentController.create({
        prompt,
        worktreePath,
        name: options.name,
        resumeSessionId,
      });

      // Link agent to worktree
      agentController.setWorktreeInfo(agent.id, worktreeId, worktreeBranch);

      console.log();
      console.log(chalk.green('✓ Agent created successfully!'));
      console.log();
      console.log(`  ${chalk.bold('ID:')}      ${agent.id}`);
      console.log(`  ${chalk.bold('Branch:')}  ${worktreeBranch}`);
      console.log(`  ${chalk.bold('Path:')}    ${worktreePath}`);
      if (resumeSessionId) {
        console.log(`  ${chalk.bold('Session:')} ${resumeSessionId} (continued)`);
      }
      console.log();
      console.log('Commands:');
      console.log(chalk.cyan(`  maestro status           `) + chalk.gray('- View all agents'));
      console.log(chalk.cyan(`  maestro attach           `) + chalk.gray('- Open TUI'));
      console.log(chalk.cyan(`  maestro logs ${agent.id} `) + chalk.gray('- View logs'));

      // Exit cleanly - agent runs in background
      process.exit(0);

    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  });
