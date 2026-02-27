#!/usr/bin/env node

import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { spawnCommand } from './commands/spawn.js';
import { statusCommand } from './commands/status.js';
import { attachCommand } from './commands/attach.js';
import { logsCommand } from './commands/logs.js';
import { killCommand } from './commands/kill.js';
import { cleanupCommand } from './commands/cleanup.js';
import { configCommand } from './commands/config.js';
import { recoverCommand } from './commands/recover.js';
import { prCommand } from './commands/pr.js';
import { recoverState } from '../state/recovery.js';
import { LogRotation } from '../state/logRotation.js';
import { getLogger } from '../shared/logger.js';
import { isMaestroInitialized } from '../shared/config.js';

const program = new Command();
const logger = getLogger();

program
  .name('maestro')
  .description('Multi-Agent orchestration CLI for Claude Code')
  .version('1.0.0');

// Register commands
program.addCommand(initCommand);
program.addCommand(spawnCommand);
program.addCommand(statusCommand);
program.addCommand(attachCommand);
program.addCommand(logsCommand);
program.addCommand(killCommand);
program.addCommand(cleanupCommand);
program.addCommand(configCommand);
program.addCommand(recoverCommand);
program.addCommand(prCommand);

// Startup tasks (only if maestro is initialized)
async function runStartupTasks(): Promise<void> {
  if (!isMaestroInitialized()) {
    return;
  }

  try {
    // Recover state on startup
    const result = await recoverState();
    if (result.failed.length > 0) {
      logger.info(`Recovered state: ${result.failed.length} agents marked as failed`);
    }

    // Perform log maintenance
    const logRotation = new LogRotation();
    logRotation.maintain();
  } catch (error) {
    logger.debug('Startup tasks failed', { error });
  }
}

// Global error handling
program.exitOverride((err) => {
  if (err.code === 'commander.help') {
    process.exit(0);
  }
  console.error(`Error: ${err.message}`);
  process.exit(1);
});

// Run startup tasks then parse commands
runStartupTasks().then(() => {
  program.parse();
}).catch((error) => {
  logger.error('Fatal error', { error });
  process.exit(1);
});
