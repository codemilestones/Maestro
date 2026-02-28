import { Command } from 'commander';
import chalk from 'chalk';
import { initMaestroDir, isMaestroInitialized, getMaestroDir, detectDefaultBranch } from '../../shared/config.js';
import { isGitRepository } from '../../worktree/git.js';

export const initCommand = new Command('init')
  .description('Initialize Maestro in the current directory')
  .option('-f, --force', 'Overwrite existing configuration')
  .action(async (options) => {
    const cwd = process.cwd();

    // Check if it's a git repository
    if (!(await isGitRepository(cwd))) {
      console.error(chalk.red('Error: Not a git repository. Please run this command from a git repository root.'));
      process.exit(1);
    }

    // Check if already initialized
    if (isMaestroInitialized() && !options.force) {
      console.log(chalk.yellow('Maestro is already initialized in this directory.'));
      console.log(chalk.gray(`Use ${chalk.cyan('--force')} to reinitialize.`));
      process.exit(0);
    }

    try {
      // Detect default branch
      const detectedBranch = await detectDefaultBranch(cwd);

      // Initialize with detected branch
      initMaestroDir(cwd, detectedBranch);

      console.log(chalk.green('✓ Maestro initialized successfully!'));
      console.log();
      console.log('Created:');
      console.log(chalk.gray(`  ${getMaestroDir()}/`));
      console.log(chalk.gray('  ├── config.yaml'));
      console.log(chalk.gray('  ├── state/'));
      console.log(chalk.gray('  ├── logs/'));
      console.log(chalk.gray('  └── templates/'));
      console.log();
      console.log(`Detected default branch: ${chalk.cyan(detectedBranch)}`);
      console.log();
      console.log(`Next steps:`);
      console.log(chalk.cyan(`  maestro spawn "Your task description"`));
    } catch (error) {
      console.error(chalk.red(`Error initializing Maestro: ${error instanceof Error ? error.message : error}`));
      process.exit(1);
    }
  });
