import { Command } from 'commander';
import chalk from 'chalk';
import { isMaestroInitialized } from '../../shared/config.js';

export const attachCommand = new Command('attach')
  .description('Enter TUI interface or attach to a specific Agent')
  .option('-a, --agent <id>', 'Attach directly to a specific Agent')
  .action(async (options) => {
    if (!isMaestroInitialized()) {
      console.error(chalk.red('Error: Maestro is not initialized.'));
      console.error(chalk.gray(`Run ${chalk.cyan('maestro init')} first.`));
      process.exit(1);
    }

    if (options.agent) {
      console.log(chalk.yellow(`Attaching to agent ${options.agent}...`));
      // TUI implementation will handle this
      console.log(chalk.gray('TUI not yet implemented. Use `maestro logs` to view output.'));
    } else {
      console.log(chalk.yellow('Launching TUI...'));
      // Import and run TUI
      try {
        const { runTUI } = await import('../../tui/index.js');
        await runTUI();
      } catch (error) {
        console.log(chalk.gray('TUI not yet fully implemented.'));
        console.log(chalk.gray(`Use ${chalk.cyan('maestro status')} to view agents.`));
      }
    }
  });
