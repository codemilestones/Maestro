import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync, existsSync, watchFile } from 'node:fs';
import { join } from 'node:path';
import { isMaestroInitialized, getMaestroDir, LOGS_DIR } from '../../shared/config.js';
import { AgentControllerPTY } from '../../agent/AgentControllerPTY.js';

export const logsCommand = new Command('logs')
  .description('View Agent output logs')
  .argument('<id>', 'Agent ID')
  .option('-f, --follow', 'Follow log output in real-time')
  .option('-t, --tail <lines>', 'Show last N lines', '50')
  .action(async (id, options) => {
    if (!isMaestroInitialized()) {
      console.error(chalk.red('Error: Maestro is not initialized.'));
      process.exit(1);
    }

    const agentController = new AgentControllerPTY();
    const agent = agentController.getInfo(id);

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

      id = matches[0].id;
    }

    const logFile = join(getMaestroDir(), LOGS_DIR, `${id}.log`);

    if (!existsSync(logFile)) {
      // Try showing in-memory output
      const output = agentController.getOutput(id);
      if (output.length > 0) {
        console.log(chalk.gray(`=== Output for ${id} ===`));
        output.forEach((line) => console.log(line));
        return;
      }

      console.log(chalk.gray(`No logs found for agent '${id}'.`));
      return;
    }

    const showLogs = () => {
      const content = readFileSync(logFile, 'utf-8');
      const lines = content.split('\n').filter((l) => l.trim());

      const tailCount = parseInt(options.tail, 10) || 50;
      const displayLines = lines.slice(-tailCount);

      console.clear();
      console.log(chalk.gray(`=== Logs for ${id} (last ${displayLines.length} lines) ===`));
      console.log();
      displayLines.forEach((line) => console.log(line));
    };

    if (options.follow) {
      showLogs();

      let lastSize = 0;
      watchFile(logFile, { interval: 500 }, (curr) => {
        if (curr.size > lastSize) {
          const content = readFileSync(logFile, 'utf-8');
          const lines = content.split('\n').filter((l) => l.trim());
          const newLines = lines.slice(-Math.ceil((curr.size - lastSize) / 100));
          newLines.forEach((line) => console.log(line));
          lastSize = curr.size;
        }
      });

      console.log(chalk.gray('\nPress Ctrl+C to exit...'));

      process.on('SIGINT', () => {
        process.exit(0);
      });
    } else {
      showLogs();
    }
  });
