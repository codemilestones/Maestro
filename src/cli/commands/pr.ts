import { Command } from 'commander';
import chalk from 'chalk';
import { isMaestroInitialized } from '../../shared/config.js';
import { AgentControllerPTY } from '../../agent/AgentControllerPTY.js';
import { WorktreeManager } from '../../worktree/WorktreeManager.js';
import { PRGenerator } from '../../pr/PRGenerator.js';

export const prCommand = new Command('pr')
  .description('Create a Pull Request for an Agent')
  .argument('<id>', 'Agent ID')
  .option('-t, --title <title>', 'PR title')
  .option('-d, --draft', 'Create as draft PR')
  .option('-r, --reviewers <users>', 'Comma-separated list of reviewers')
  .option('-l, --labels <labels>', 'Comma-separated list of labels')
  .action(async (id, options) => {
    if (!isMaestroInitialized()) {
      console.error(chalk.red('Error: Maestro is not initialized.'));
      console.error(chalk.gray(`Run ${chalk.cyan('maestro init')} first.`));
      process.exit(1);
    }

    const agentController = new AgentControllerPTY();
    const worktreeManager = new WorktreeManager();
    const prGenerator = new PRGenerator();

    // Find agent
    let agent = agentController.getInfo(id);

    if (!agent) {
      // Try partial match
      const agents = agentController.listAll();
      const matches = agents.filter((a) => a.id.startsWith(id));

      if (matches.length === 0) {
        console.error(chalk.red(`Error: Agent '${id}' not found.`));
        process.exit(1);
      }

      if (matches.length > 1) {
        console.error(chalk.red(`Error: Multiple agents match '${id}':`));
        matches.forEach((a) => console.error(chalk.gray(`  - ${a.id}`)));
        process.exit(1);
      }

      agent = matches[0];
    }

    // Check agent status
    if (agent.status !== 'finished') {
      console.error(chalk.yellow(`Warning: Agent '${agent.id}' is not finished (status: ${agent.status}).`));
      console.error(chalk.gray('Creating PR for unfinished agent may include incomplete changes.'));
    }

    // Get worktree path
    if (!agent.worktreeId) {
      console.error(chalk.red(`Error: Agent '${agent.id}' has no associated worktree.`));
      process.exit(1);
    }

    const worktree = await worktreeManager.get(agent.worktreeId);
    if (!worktree) {
      console.error(chalk.red(`Error: Worktree '${agent.worktreeId}' not found.`));
      process.exit(1);
    }

    console.log(chalk.gray(`Creating PR for agent: ${agent.id}`));
    console.log(chalk.gray(`Branch: ${agent.branch}`));
    console.log();

    try {
      const prInfo = await prGenerator.create(agent, worktree.path, {
        agentId: agent.id,
        title: options.title,
        draft: options.draft,
        reviewers: options.reviewers?.split(',').map((r: string) => r.trim()),
        labels: options.labels?.split(',').map((l: string) => l.trim()),
      });

      console.log(chalk.green('✓ Pull Request created successfully!'));
      console.log();
      console.log(`  ${chalk.bold('URL:')}    ${prInfo.url}`);
      console.log(`  ${chalk.bold('Number:')} #${prInfo.number}`);
      console.log(`  ${chalk.bold('Title:')}  ${prInfo.title}`);
      console.log(`  ${chalk.bold('Branch:')} ${prInfo.branch} → ${prInfo.baseBranch}`);

    } catch (error) {
      console.error(chalk.red(`Error creating PR: ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  });
