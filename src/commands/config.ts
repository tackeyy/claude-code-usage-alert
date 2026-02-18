/**
 * Config command.
 * View and modify configuration.
 */

import { loadConfig, saveConfig, getConfigFile } from '../config/loader.js';
import { NotifyMethod } from '../config/defaults.js';

interface ConfigOptions {
  budget?: string;
  thresholds?: string;
  show?: boolean;
}

/**
 * Parse command line args for config command.
 */
export function parseConfigArgs(args: string[]): ConfigOptions {
  const options: ConfigOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--budget' && i + 1 < args.length) {
      options.budget = args[++i];
    } else if (arg === '--thresholds' && i + 1 < args.length) {
      options.thresholds = args[++i];
    } else if (arg === '--show') {
      options.show = true;
    }
  }

  return options;
}

/**
 * Run the config command.
 */
export function runConfig(args: string[]): void {
  const options = parseConfigArgs(args);
  const config = loadConfig();

  let modified = false;

  if (options.budget) {
    const budget = parseFloat(options.budget);
    if (isNaN(budget) || budget <= 0) {
      console.error('Error: Budget must be a positive number.');
      process.exitCode = 1;
      return;
    }
    config.budget.sessionBudget = budget;
    modified = true;
    console.log(`Budget set to: $${budget.toFixed(2)}`);
  }

  if (options.thresholds) {
    const thresholds = options.thresholds
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0 && n <= 100);

    if (thresholds.length === 0) {
      console.error('Error: Provide comma-separated percentages (1-100).');
      process.exitCode = 1;
      return;
    }

    config.thresholds = thresholds.sort((a, b) => a - b).map((percent) => {
      let notify: NotifyMethod = 'terminal';
      if (percent >= 80) notify = 'both';
      return { percent, notify };
    });
    modified = true;
    console.log(`Thresholds set to: ${thresholds.join('%, ')}%`);
  }

  if (modified) {
    saveConfig(config);
    console.log(`\nConfig saved to: ${getConfigFile()}`);
  }

  // Always show current config
  if (!modified || options.show) {
    console.log('\n=== Current Configuration ===\n');
    console.log(`Config file: ${getConfigFile()}`);
    console.log(`Budget:      $${config.budget.sessionBudget.toFixed(2)}`);
    console.log('Thresholds:');
    for (const t of config.thresholds) {
      console.log(`  ${t.percent}% → ${t.notify}`);
    }
    console.log('Notifications:');
    console.log(`  Desktop:  ${config.notifications.desktop ? 'enabled' : 'disabled'}`);
    console.log(`  Terminal: ${config.notifications.terminal ? 'enabled' : 'disabled'}`);
    console.log(`  Sound:    ${config.notifications.sound ? 'enabled' : 'disabled'}`);
  }
}
