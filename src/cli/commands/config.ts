import { Command } from 'commander';
import chalk from 'chalk';
import { isMaestroInitialized, getConfigValue, setConfigValue, loadConfig } from '../../shared/config.js';
import { adapterRegistry } from '../../adapter/index.js';

export const configCommand = new Command('config')
  .description('Manage Maestro configuration')
  .option('-g, --get <key>', 'Get a configuration value')
  .option('-s, --set <key=value>', 'Set a configuration value')
  .option('-l, --list', 'List all configuration values')
  .option('--list-tools', 'List all available tool adapters')
  .action(async (options) => {
    if (!isMaestroInitialized()) {
      console.error(chalk.red('Error: Maestro is not initialized.'));
      console.error(chalk.gray(`Run ${chalk.cyan('maestro init')} first.`));
      process.exit(1);
    }

    // List available tools
    if (options.listTools) {
      const config = loadConfig();
      const defaultTool = config.tools.default;
      const adapters = adapterRegistry.list();

      console.log(chalk.bold('Available Tool Adapters:'));
      console.log();

      for (const adapter of adapters) {
        const isDefault = adapter.name === defaultTool;
        const marker = isDefault ? chalk.green(' (default)') : '';
        console.log(`  ${chalk.cyan(adapter.name)}${marker}`);
        console.log(`    Display: ${adapter.displayName}`);
        console.log(`    Command: ${adapter.getCommand()}`);
        console.log();
      }

      console.log(chalk.gray('Use --tool <name> with spawn to use a specific tool.'));
      console.log(chalk.gray('Example: maestro spawn --tool claude-code "Fix the bug"'));
      return;
    }

    if (options.get) {
      const value = getConfigValue(options.get);
      if (value === undefined) {
        console.error(chalk.red(`Configuration key '${options.get}' not found.`));
        process.exit(1);
      }
      console.log(typeof value === 'object' ? JSON.stringify(value, null, 2) : value);
      return;
    }

    if (options.set) {
      const [key, ...valueParts] = options.set.split('=');
      const valueStr = valueParts.join('=');

      if (!key || valueStr === undefined) {
        console.error(chalk.red('Error: Invalid format. Use --set key=value'));
        process.exit(1);
      }

      // Parse value
      let value: unknown;
      if (valueStr === 'true') {
        value = true;
      } else if (valueStr === 'false') {
        value = false;
      } else if (/^\d+$/.test(valueStr)) {
        value = parseInt(valueStr, 10);
      } else if (/^\d+\.\d+$/.test(valueStr)) {
        value = parseFloat(valueStr);
      } else {
        value = valueStr;
      }

      setConfigValue(key, value);
      console.log(chalk.green(`✓ Set ${key} = ${JSON.stringify(value)}`));
      return;
    }

    // Default: list all
    const config = loadConfig();

    console.log(chalk.bold('Current Configuration:'));
    console.log();

    const printSection = (name: string, obj: Record<string, unknown>, prefix: string = '') => {
      console.log(chalk.cyan(`[${name}]`));
      for (const [key, value] of Object.entries(obj)) {
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          for (const [subKey, subValue] of Object.entries(value)) {
            console.log(`  ${prefix}${key}.${subKey} = ${chalk.yellow(JSON.stringify(subValue))}`);
          }
        } else {
          console.log(`  ${prefix}${key} = ${chalk.yellow(JSON.stringify(value))}`);
        }
      }
      console.log();
    };

    printSection('worktree', config.worktree as unknown as Record<string, unknown>);
    printSection('agent', config.agent as unknown as Record<string, unknown>);
    printSection('pr', config.pr as unknown as Record<string, unknown>);
    printSection('tools', config.tools as unknown as Record<string, unknown>);
    printSection('session', config.session as unknown as Record<string, unknown>);

    console.log(chalk.gray('Use --set key=value to change a setting.'));
    console.log(chalk.gray('Use --list-tools to see available tool adapters.'));
    console.log(chalk.gray('Example: maestro config --set agent.maxConcurrent=10'));
  });
