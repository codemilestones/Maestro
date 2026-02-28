import { Command } from 'commander';
import chalk from 'chalk';
import { isMaestroInitialized, loadConfig } from '../../shared/config.js';
import { AgentControllerPTY } from '../../agent/AgentControllerPTY.js';
import { AttachSession } from '../../attach/index.js';
import { formatKeyNotation } from '../../attach/types.js';

export const attachCommand = new Command('attach')
  .description('Enter TUI interface or attach to a specific Agent')
  .argument('[agent-id]', 'Agent ID to attach to')
  .option('-f, --force', 'Force attach (disconnect existing clients)')
  .action(async (agentId: string | undefined, options: { force?: boolean }) => {
    if (!isMaestroInitialized()) {
      console.error(chalk.red('Error: Maestro is not initialized.'));
      console.error(chalk.gray(`Run ${chalk.cyan('maestro init')} first.`));
      process.exit(1);
    }

    if (agentId) {
      // Direct attach to agent
      await attachToAgent(agentId, options.force);
    } else {
      // Launch TUI
      console.log(chalk.yellow('Launching TUI...'));
      try {
        const { runTUI } = await import('../../tui/index.js');
        await runTUI();
      } catch (error) {
        console.log(chalk.gray('TUI not yet fully implemented.'));
        console.log(chalk.gray(`Use ${chalk.cyan('maestro status')} to view agents.`));
      }
    }
  });

async function attachToAgent(agentId: string, force?: boolean): Promise<void> {
  const config = loadConfig();
  const controller = new AgentControllerPTY();

  // Find the agent
  const agentInfo = controller.getInfo(agentId);
  if (!agentInfo) {
    console.error(chalk.red(`Error: Agent '${agentId}' not found.`));
    process.exit(1);
  }

  // Get PTY session
  let ptySession;
  try {
    ptySession = controller.attach(agentId, 'cli', force);
  } catch (error) {
    if ((error as Error).message.includes('already attached')) {
      console.error(chalk.red(`Error: ${(error as Error).message}`));
      console.error(chalk.gray(`Use ${chalk.cyan('--force')} to override.`));
      process.exit(1);
    }
    throw error;
  }

  if (!ptySession) {
    console.error(chalk.red(`Error: Agent '${agentId}' has no active session.`));
    console.error(chalk.gray(`The agent may have finished or failed.`));
    process.exit(1);
  }

  const prefixKey = config.session.prefixKey;
  const prefixDisplay = formatKeyNotation(prefixKey);

  console.log(chalk.gray(`Attaching to agent ${chalk.cyan(agentId)}...`));
  console.log(chalk.gray(`Press ${chalk.yellow(prefixDisplay)} to detach.`));
  console.log(chalk.gray(`Press ${chalk.yellow(prefixDisplay + ' ?')} for help.`));
  console.log('');

  // Create attach session
  const attachSession = new AttachSession(ptySession, {
    prefixKey: config.session.prefixKey,
    prefixTimeout: config.session.prefixTimeout,
    callbacks: {
      onDetach: () => {
        console.log(chalk.gray('\nDetached from session.'));
        controller.detach(agentId, 'cli');
        process.exit(0);
      },
      onKillSession: () => {
        console.log(chalk.yellow('\nKilling session...'));
        controller.kill(agentId).then(() => {
          controller.detach(agentId, 'cli');
          process.exit(0);
        });
      },
    },
  });

  // Handle PTY exit
  ptySession.on('exit', (code) => {
    attachSession.detach();
    console.log(chalk.gray(`\nSession exited with code ${code}.`));
    process.exit(code);
  });

  // Start attach session
  attachSession.attach();
}
