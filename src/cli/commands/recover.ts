import { Command } from 'commander';
import chalk from 'chalk';
import { recoverState, cleanupStaleState, validateState } from '../../state/recovery.js';
import { LogRotation } from '../../state/logRotation.js';

export const recoverCommand = new Command('recover')
  .description('Recover and validate agent states')
  .option('--cleanup', 'Clean up stale state entries')
  .option('--validate', 'Validate state consistency')
  .option('--logs', 'Perform log maintenance')
  .option('-v, --verbose', 'Show detailed output')
  .action(async (options) => {
    console.log(chalk.blue('🔄 Recovering agent states...\n'));

    // Recover state
    const result = await recoverState();

    console.log(chalk.green(`✓ ${result.recovered.length} agents still running`));
    console.log(chalk.yellow(`! ${result.failed.length} agents marked as failed`));
    console.log(chalk.gray(`- ${result.unchanged.length} agents unchanged`));

    if (options.verbose && result.failed.length > 0) {
      console.log(chalk.yellow('\nFailed agents:'));
      for (const agent of result.failed) {
        console.log(`  - ${agent.id}: ${agent.error || 'Unknown error'}`);
      }
    }

    // Cleanup if requested
    if (options.cleanup) {
      console.log(chalk.blue('\n🧹 Cleaning up stale state...'));
      await cleanupStaleState();
      console.log(chalk.green('✓ Stale state cleaned up'));
    }

    // Validate if requested
    if (options.validate) {
      console.log(chalk.blue('\n🔍 Validating state consistency...'));
      const validation = await validateState();

      if (validation.valid) {
        console.log(chalk.green('✓ State is consistent'));
      } else {
        console.log(chalk.red(`✗ Found ${validation.issues.length} issues:`));
        for (const issue of validation.issues) {
          console.log(chalk.red(`  - ${issue}`));
        }
      }
    }

    // Log maintenance if requested
    if (options.logs) {
      console.log(chalk.blue('\n📋 Performing log maintenance...'));
      const logRotation = new LogRotation();
      const stats = logRotation.maintain();
      console.log(chalk.green(`✓ Deleted ${stats.deleted} old log files`));
      console.log(chalk.gray(`  Total logs size: ${(stats.totalSize / 1024 / 1024).toFixed(2)} MB`));
    }

    console.log(chalk.green('\n✓ Recovery complete'));
  });
