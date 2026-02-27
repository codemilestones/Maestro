import { Command } from 'commander';
import chalk from 'chalk';
import Table from 'cli-table3';
import { isMaestroInitialized } from '../../shared/config.js';
import { AgentController } from '../../agent/AgentController.js';
import { getStatusIcon, getStatusColor, getStatusText } from '../../agent/state/state.js';
import { AgentInfo, AgentStatus } from '../../shared/types.js';

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  }
  return `${seconds}s`;
}

function getRunningDuration(agent: AgentInfo): string {
  const startTime = agent.startedAt || agent.createdAt;
  const endTime = agent.finishedAt || new Date();
  return formatDuration(endTime.getTime() - startTime.getTime());
}

function colorStatus(status: AgentStatus): string {
  const color = getStatusColor(status);
  const icon = getStatusIcon(status);
  const text = getStatusText(status);

  switch (color) {
    case 'gray':
      return chalk.gray(`${icon} ${text}`);
    case 'yellow':
      return chalk.yellow(`${icon} ${text}`);
    case 'green':
      return chalk.green(`${icon} ${text}`);
    case 'cyan':
      return chalk.cyan(`${icon} ${text}`);
    case 'blue':
      return chalk.blue(`${icon} ${text}`);
    case 'red':
      return chalk.red(`${icon} ${text}`);
    default:
      return `${icon} ${text}`;
  }
}

export const statusCommand = new Command('status')
  .description('View status of all Agents')
  .option('-j, --json', 'Output in JSON format')
  .option('-w, --watch', 'Watch mode - continuously update')
  .action(async (options) => {
    if (!isMaestroInitialized()) {
      console.error(chalk.red('Error: Maestro is not initialized.'));
      console.error(chalk.gray(`Run ${chalk.cyan('maestro init')} first.`));
      process.exit(1);
    }

    const agentController = new AgentController();

    const displayStatus = () => {
      const agents = agentController.listAll();

      if (options.json) {
        console.log(JSON.stringify(agents, null, 2));
        return;
      }

      if (agents.length === 0) {
        console.log(chalk.gray('No agents found.'));
        console.log(chalk.gray(`Create one with: ${chalk.cyan('maestro spawn "task description"')}`));
        return;
      }

      // Summary
      const running = agents.filter((a) => a.status === 'running').length;
      const waiting = agents.filter((a) => a.status === 'waiting_input').length;
      const finished = agents.filter((a) => a.status === 'finished').length;
      const failed = agents.filter((a) => a.status === 'failed').length;

      console.log();
      console.log(
        chalk.bold('Agents: ') +
        `${agents.length} total, ` +
        chalk.green(`${running} running`) + ', ' +
        chalk.cyan(`${waiting} waiting`) + ', ' +
        chalk.blue(`${finished} finished`) + ', ' +
        chalk.red(`${failed} failed`)
      );
      console.log();

      // Table
      const table = new Table({
        head: [
          chalk.bold('#'),
          chalk.bold('ID'),
          chalk.bold('Name'),
          chalk.bold('Status'),
          chalk.bold('Branch'),
          chalk.bold('Duration'),
          chalk.bold('Prompt'),
        ],
        colWidths: [4, 15, 15, 12, 25, 10, 30],
        wordWrap: true,
      });

      agents.forEach((agent, index) => {
        table.push([
          chalk.gray(`${index + 1}`),
          agent.id.slice(0, 13),
          agent.name || chalk.gray('-'),
          colorStatus(agent.status),
          agent.branch.slice(0, 23),
          getRunningDuration(agent),
          agent.prompt.slice(0, 28) + (agent.prompt.length > 28 ? '...' : ''),
        ]);
      });

      console.log(table.toString());
    };

    if (options.watch) {
      // Watch mode
      console.clear();
      displayStatus();

      const interval = setInterval(() => {
        console.clear();
        displayStatus();
      }, 2000);

      // Handle exit
      process.on('SIGINT', () => {
        clearInterval(interval);
        process.exit(0);
      });
    } else {
      displayStatus();
    }
  });
