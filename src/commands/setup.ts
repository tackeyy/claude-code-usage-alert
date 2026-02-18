/**
 * Setup command.
 * Creates config/state files and registers hooks in Claude Code settings.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { saveConfig, getConfigFile } from '../config/loader.js';
import { DEFAULT_CONFIG } from '../config/defaults.js';
import { saveState, getStateDir } from '../core/state-manager.js';

const CLAUDE_SETTINGS_PATH = path.join(os.homedir(), '.claude', 'settings.json');

interface HookEntry {
  type: string;
  command: string;
  timeout: number;
}

interface HookMatcher {
  hooks: HookEntry[];
}

interface ClaudeSettings {
  hooks?: Record<string, HookMatcher[]>;
  [key: string]: unknown;
}

const HOOK_EVENTS = ['Stop', 'SessionStart', 'SessionEnd'] as const;

function createHookEntry(event: string): HookMatcher {
  return {
    hooks: [
      {
        type: 'command',
        command: `claude-code-usage-alert hook ${event}`,
        timeout: 5,
      },
    ],
  };
}

function isOurHook(matcher: HookMatcher): boolean {
  return matcher.hooks?.some((h) => h.command?.startsWith('claude-code-usage-alert')) ?? false;
}

/**
 * Register hooks in Claude Code settings.json.
 * Merges with existing hooks without overwriting.
 */
function registerHooks(): void {
  let settings: ClaudeSettings = {};

  try {
    const raw = fs.readFileSync(CLAUDE_SETTINGS_PATH, 'utf-8');
    settings = JSON.parse(raw) as ClaudeSettings;
  } catch {
    // Settings file doesn't exist or is invalid - will create fresh
  }

  if (!settings.hooks) {
    settings.hooks = {};
  }

  for (const event of HOOK_EVENTS) {
    if (!settings.hooks[event]) {
      settings.hooks[event] = [];
    }

    // Check if our hook is already registered
    const existing = settings.hooks[event].find(isOurHook);
    if (!existing) {
      settings.hooks[event].push(createHookEntry(event));
    }
  }

  // Ensure the .claude directory exists
  const claudeDir = path.dirname(CLAUDE_SETTINGS_PATH);
  if (!fs.existsSync(claudeDir)) {
    fs.mkdirSync(claudeDir, { recursive: true });
  }

  fs.writeFileSync(
    CLAUDE_SETTINGS_PATH,
    JSON.stringify(settings, null, 2),
    'utf-8',
  );
}

/**
 * Run the setup command.
 */
export function runSetup(): void {
  console.log('Setting up claude-code-usage-alert...\n');

  // 1. Create config file with defaults
  saveConfig(DEFAULT_CONFIG);
  console.log(`  Config file created: ${getConfigFile()}`);

  // 2. Initialize state file
  saveState({ currentSession: null });
  console.log(`  State file created: ${getStateDir()}/state.json`);

  // 3. Register hooks in Claude Code settings
  registerHooks();
  console.log(`  Hooks registered in: ${CLAUDE_SETTINGS_PATH}`);

  console.log('\nSetup complete! claude-code-usage-alert will now track your Claude Code usage.');
  console.log(`\nDefault session budget: $${DEFAULT_CONFIG.budget.sessionBudget.toFixed(2)}`);
  console.log(
    `Thresholds: ${DEFAULT_CONFIG.thresholds.map((t) => `${t.percent}%`).join(', ')}`,
  );
  console.log('\nYou can customize settings with:');
  console.log('  claude-code-usage-alert config --budget 10.00');
  console.log('  claude-code-usage-alert config --thresholds 50,80,95');
}
