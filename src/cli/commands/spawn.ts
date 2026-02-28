import { Command } from 'commander';
import chalk from 'chalk';
import { isMaestroInitialized, loadConfig } from '../../shared/config.js';
import { WorktreeManager } from '../../worktree/WorktreeManager.js';
import { AgentControllerPTY } from '../../agent/AgentControllerPTY.js';
import { generateTaskId } from '../../shared/id.js';
import { adapterRegistry } from '../../adapter/index.js';

export const spawnCommand = new Command('spawn')
  .description('Create a new Agent to execute a task')
  .argument('<prompt>', 'Task description for the Agent')
  .option('-b, --branch <name>', 'Branch name for the worktree')
  .option('--base <branch>', 'Base branch to create from (default: main)')
  .option('-n, --name <name>', 'Friendly name for the Agent')
  .option('-t, --tool <name>', 'Tool adapter to use (default: from config)')
  .action(async (prompt, options) => {
    // Check initialization
    if (!isMaestroInitialized()) {
      console.error(chalk.red('Error: Maestro is not initialized.'));
      console.error(chalk.gray(`Run ${chalk.cyan('maestro init')} first.`));
      process.exit(1);
    }

    const config = loadConfig();
    const worktreeManager = new WorktreeManager();
    const agentController = new AgentControllerPTY();

    // Validate tool if specified
    const toolName = options.tool || config.tools.default;
    const adapter = adapterRegistry.get(toolName);
    if (!adapter) {
      const available = adapterRegistry.list().map(a => a.name).join(', ');
      console.error(chalk.red(`Error: Tool '${toolName}' not found.`));
      console.error(chalk.gray(`Available tools: ${available}`));
      process.exit(1);
    }

    // Generate IDs
    const taskId = generateTaskId();
    const branchName = options.branch || taskId;

    console.log(chalk.gray(`Creating agent for: "${prompt.slice(0, 50)}${prompt.length > 50 ? '...' : ''}"`));
    console.log(chalk.gray(`Using tool: ${adapter.displayName}`));

    try {
      // Create worktree
      console.log(chalk.gray('Creating worktree...'));
      const worktree = await worktreeManager.create({
        branch: branchName,
        base: options.base || config.worktree.defaultBase,
        taskId,
      });

      // Spawn agent
      console.log(chalk.gray('Starting Claude Code...'));
      const agent = await agentController.spawn({
        prompt,
        worktreePath: worktree.path,
        name: options.name,
        tool: toolName,
      });

      // Link agent to worktree
      agentController.setWorktreeInfo(agent.id, worktree.id, worktree.branch);

      console.log();
      console.log(chalk.green('✓ Agent spawned successfully!'));
      console.log();
      console.log(`  ${chalk.bold('ID:')}      ${agent.id}`);
      console.log(`  ${chalk.bold('Branch:')}  ${worktree.branch}`);
      console.log(`  ${chalk.bold('Path:')}    ${worktree.path}`);
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
