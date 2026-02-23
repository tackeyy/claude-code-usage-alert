/**
 * Configuration file loader.
 * Config file: ~/.claude-code-usage-alert/config.yml
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import YAML from 'yaml';
import { Config, ThresholdConfig, NotifyMethod, WeekDay, VALID_WEEK_DAYS, DEFAULT_CONFIG } from './defaults.js';

const VALID_NOTIFY_METHODS: NotifyMethod[] = ['terminal', 'desktop', 'both'];

function getConfigDirPath(): string {
  return path.join(os.homedir(), '.claude-code-usage-alert');
}

function getConfigFilePath(): string {
  return path.join(getConfigDirPath(), 'config.yml');
}

function ensureDir(): void {
  const dir = getConfigDirPath();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function isValidThreshold(t: unknown): t is ThresholdConfig {
  if (typeof t !== 'object' || t === null) return false;
  const obj = t as Record<string, unknown>;
  return (
    typeof obj.percent === 'number' &&
    obj.percent >= 0 &&
    obj.percent <= 100 &&
    typeof obj.notify === 'string' &&
    VALID_NOTIFY_METHODS.includes(obj.notify as NotifyMethod)
  );
}

/**
 * Load config from disk. Returns default config if file doesn't exist.
 * Invalid values fall back to defaults.
 */
export function loadConfig(): Config {
  try {
    const raw = fs.readFileSync(getConfigFilePath(), 'utf-8');
    const parsed = YAML.parse(raw);

    // Validate and merge budget
    const mergedBudget = { ...DEFAULT_CONFIG.budget, ...parsed?.budget };
    if (typeof mergedBudget.sessionBudget !== 'number' || mergedBudget.sessionBudget <= 0) {
      mergedBudget.sessionBudget = DEFAULT_CONFIG.budget.sessionBudget;
    }
    if (typeof mergedBudget.weeklyBudget !== 'number' || mergedBudget.weeklyBudget <= 0) {
      mergedBudget.weeklyBudget = DEFAULT_CONFIG.budget.weeklyBudget;
    }
    if (
      typeof mergedBudget.weeklyResetDay !== 'string' ||
      !VALID_WEEK_DAYS.includes(mergedBudget.weeklyResetDay as WeekDay)
    ) {
      mergedBudget.weeklyResetDay = DEFAULT_CONFIG.budget.weeklyResetDay;
    }
    if (
      typeof mergedBudget.weeklyResetHour !== 'number' ||
      !Number.isInteger(mergedBudget.weeklyResetHour) ||
      mergedBudget.weeklyResetHour < 0 ||
      mergedBudget.weeklyResetHour > 23
    ) {
      mergedBudget.weeklyResetHour = DEFAULT_CONFIG.budget.weeklyResetHour;
    }

    // Validate thresholds
    let thresholds: ThresholdConfig[];
    if (Array.isArray(parsed?.thresholds) && parsed.thresholds.every(isValidThreshold)) {
      thresholds = parsed.thresholds;
    } else {
      thresholds = DEFAULT_CONFIG.thresholds;
    }

    return {
      budget: mergedBudget,
      thresholds,
      notifications: {
        ...DEFAULT_CONFIG.notifications,
        ...parsed?.notifications,
      },
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

/**
 * Save config to disk as YAML.
 */
export function saveConfig(config: Config): void {
  ensureDir();
  const yamlStr = YAML.stringify(config);
  fs.writeFileSync(getConfigFilePath(), yamlStr, 'utf-8');
}

/**
 * Get the config file path.
 */
export function getConfigFile(): string {
  return getConfigFilePath();
}

/**
 * Get the config directory path.
 */
export function getConfigDir(): string {
  return getConfigDirPath();
}
