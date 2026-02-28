import { Command } from 'commander';
import chalk from 'chalk';
import { isMaestroInitialized } from '../../shared/config.js';
import { AgentControllerPTY } from '../../agent/AgentControllerPTY.js';

export const killCommand = new Command('kill')
  .description('Terminate a running Agent')
  .argument('<id>', 'Agent ID')
  .option('-f, --force', 'Force kill (SIGKILL instead of SIGTERM)')
  .action(async (id, options) => {
    if (!isMaestroInitialized()) {
      console.error(chalk.red('Error: Maestro is not initialized.'));
      process.exit(1);
    }

    const agentController = new AgentControllerPTY();

    // Find agent (support partial ID)
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

    const agent = matches[0];

    if (agent.status === 'finished' || agent.status === 'failed') {
      console.log(chalk.yellow(`Agent '${agent.id}' is already in terminal state (${agent.status}).`));
      process.exit(0);
    }

    try {
      console.log(chalk.gray(`Killing agent ${agent.id}${options.force ? ' (force)' : ''}...`));
      await agentController.kill(agent.id, options.force);
      console.log(chalk.green(`✓ Agent ${agent.id} terminated.`));
    } catch (error) {
      console.error(chalk.red(`Error: ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  });
