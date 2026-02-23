import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import YAML from 'yaml';

// Mock the home directory to use a temp dir
let tmpDir: string;

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os');
  return {
    ...actual,
    homedir: () => tmpDir,
  };
});

// Import after mocking
const loader = await import('../src/config/loader.js');
const { DEFAULT_CONFIG } = await import('../src/config/defaults.js');

describe('config loader validation', () => {
  let configDir: string;
  let configFile: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-config-test-'));
    configDir = path.join(tmpDir, '.claude-code-usage-alert');
    configFile = path.join(configDir, 'config.yml');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns defaults when config file does not exist', () => {
    const config = loader.loadConfig();
    expect(config.budget.sessionBudget).toBe(DEFAULT_CONFIG.budget.sessionBudget);
    expect(config.thresholds).toEqual(DEFAULT_CONFIG.thresholds);
  });

  it('falls back sessionBudget to default when negative', () => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      configFile,
      YAML.stringify({
        budget: { mode: 'cost', sessionBudget: -5 },
        thresholds: DEFAULT_CONFIG.thresholds,
      }),
    );
    const config = loader.loadConfig();
    expect(config.budget.sessionBudget).toBe(DEFAULT_CONFIG.budget.sessionBudget);
  });

  it('falls back sessionBudget to default when zero', () => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      configFile,
      YAML.stringify({
        budget: { mode: 'cost', sessionBudget: 0 },
        thresholds: DEFAULT_CONFIG.thresholds,
      }),
    );
    const config = loader.loadConfig();
    expect(config.budget.sessionBudget).toBe(DEFAULT_CONFIG.budget.sessionBudget);
  });

  it('falls back sessionBudget to default when not a number', () => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      configFile,
      YAML.stringify({
        budget: { mode: 'cost', sessionBudget: 'abc' },
        thresholds: DEFAULT_CONFIG.thresholds,
      }),
    );
    const config = loader.loadConfig();
    expect(config.budget.sessionBudget).toBe(DEFAULT_CONFIG.budget.sessionBudget);
  });

  it('accepts valid sessionBudget', () => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      configFile,
      YAML.stringify({
        budget: { mode: 'cost', sessionBudget: 10 },
        thresholds: DEFAULT_CONFIG.thresholds,
      }),
    );
    const config = loader.loadConfig();
    expect(config.budget.sessionBudget).toBe(10);
  });

  it('falls back thresholds to default when percent is out of range', () => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      configFile,
      YAML.stringify({
        budget: DEFAULT_CONFIG.budget,
        thresholds: [
          { percent: 150, notify: 'terminal' },
        ],
      }),
    );
    const config = loader.loadConfig();
    expect(config.thresholds).toEqual(DEFAULT_CONFIG.thresholds);
  });

  it('falls back thresholds to default when notify is invalid', () => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      configFile,
      YAML.stringify({
        budget: DEFAULT_CONFIG.budget,
        thresholds: [
          { percent: 50, notify: 'invalid' },
        ],
      }),
    );
    const config = loader.loadConfig();
    expect(config.thresholds).toEqual(DEFAULT_CONFIG.thresholds);
  });

  it('falls back thresholds to default when element is not an object', () => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      configFile,
      YAML.stringify({
        budget: DEFAULT_CONFIG.budget,
        thresholds: [50, 80, 90],
      }),
    );
    const config = loader.loadConfig();
    expect(config.thresholds).toEqual(DEFAULT_CONFIG.thresholds);
  });

  it('accepts valid thresholds', () => {
    const validThresholds = [
      { percent: 30, notify: 'terminal' },
      { percent: 60, notify: 'desktop' },
      { percent: 95, notify: 'both' },
    ];
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      configFile,
      YAML.stringify({
        budget: DEFAULT_CONFIG.budget,
        thresholds: validThresholds,
      }),
    );
    const config = loader.loadConfig();
    expect(config.thresholds).toEqual(validThresholds);
  });

  it('returns default weeklyBudget when not specified', () => {
    const config = loader.loadConfig();
    expect(config.budget.weeklyBudget).toBe(DEFAULT_CONFIG.budget.weeklyBudget);
  });

  it('accepts valid weeklyBudget', () => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      configFile,
      YAML.stringify({
        budget: { mode: 'cost', sessionBudget: 5, weeklyBudget: 100, weeklyResetDay: 'monday' },
        thresholds: DEFAULT_CONFIG.thresholds,
      }),
    );
    const config = loader.loadConfig();
    expect(config.budget.weeklyBudget).toBe(100);
  });

  it('falls back weeklyBudget to default when negative', () => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      configFile,
      YAML.stringify({
        budget: { mode: 'cost', sessionBudget: 5, weeklyBudget: -10, weeklyResetDay: 'monday' },
        thresholds: DEFAULT_CONFIG.thresholds,
      }),
    );
    const config = loader.loadConfig();
    expect(config.budget.weeklyBudget).toBe(DEFAULT_CONFIG.budget.weeklyBudget);
  });

  it('falls back weeklyBudget to default when zero', () => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      configFile,
      YAML.stringify({
        budget: { mode: 'cost', sessionBudget: 5, weeklyBudget: 0, weeklyResetDay: 'monday' },
        thresholds: DEFAULT_CONFIG.thresholds,
      }),
    );
    const config = loader.loadConfig();
    expect(config.budget.weeklyBudget).toBe(DEFAULT_CONFIG.budget.weeklyBudget);
  });

  it('falls back weeklyBudget to default when not a number', () => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      configFile,
      YAML.stringify({
        budget: { mode: 'cost', sessionBudget: 5, weeklyBudget: 'abc', weeklyResetDay: 'monday' },
        thresholds: DEFAULT_CONFIG.thresholds,
      }),
    );
    const config = loader.loadConfig();
    expect(config.budget.weeklyBudget).toBe(DEFAULT_CONFIG.budget.weeklyBudget);
  });

  it('accepts valid weeklyResetDay', () => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      configFile,
      YAML.stringify({
        budget: { mode: 'cost', sessionBudget: 5, weeklyBudget: 50, weeklyResetDay: 'wednesday' },
        thresholds: DEFAULT_CONFIG.thresholds,
      }),
    );
    const config = loader.loadConfig();
    expect(config.budget.weeklyResetDay).toBe('wednesday');
  });

  it('falls back weeklyResetDay to default when invalid', () => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      configFile,
      YAML.stringify({
        budget: { mode: 'cost', sessionBudget: 5, weeklyBudget: 50, weeklyResetDay: 'funday' },
        thresholds: DEFAULT_CONFIG.thresholds,
      }),
    );
    const config = loader.loadConfig();
    expect(config.budget.weeklyResetDay).toBe(DEFAULT_CONFIG.budget.weeklyResetDay);
  });

  it('falls back weeklyResetDay to default when not a string', () => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      configFile,
      YAML.stringify({
        budget: { mode: 'cost', sessionBudget: 5, weeklyBudget: 50, weeklyResetDay: 123 },
        thresholds: DEFAULT_CONFIG.thresholds,
      }),
    );
    const config = loader.loadConfig();
    expect(config.budget.weeklyResetDay).toBe(DEFAULT_CONFIG.budget.weeklyResetDay);
  });

  it('returns default weeklyResetHour when not specified', () => {
    const config = loader.loadConfig();
    expect(config.budget.weeklyResetHour).toBe(DEFAULT_CONFIG.budget.weeklyResetHour);
  });

  it('accepts valid weeklyResetHour', () => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      configFile,
      YAML.stringify({
        budget: { mode: 'cost', sessionBudget: 5, weeklyBudget: 50, weeklyResetDay: 'wednesday', weeklyResetHour: 14 },
        thresholds: DEFAULT_CONFIG.thresholds,
      }),
    );
    const config = loader.loadConfig();
    expect(config.budget.weeklyResetHour).toBe(14);
  });

  it('accepts weeklyResetHour 0', () => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      configFile,
      YAML.stringify({
        budget: { mode: 'cost', sessionBudget: 5, weeklyBudget: 50, weeklyResetDay: 'monday', weeklyResetHour: 0 },
        thresholds: DEFAULT_CONFIG.thresholds,
      }),
    );
    const config = loader.loadConfig();
    expect(config.budget.weeklyResetHour).toBe(0);
  });

  it('accepts weeklyResetHour 23', () => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      configFile,
      YAML.stringify({
        budget: { mode: 'cost', sessionBudget: 5, weeklyBudget: 50, weeklyResetDay: 'monday', weeklyResetHour: 23 },
        thresholds: DEFAULT_CONFIG.thresholds,
      }),
    );
    const config = loader.loadConfig();
    expect(config.budget.weeklyResetHour).toBe(23);
  });

  it('falls back weeklyResetHour to default when negative', () => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      configFile,
      YAML.stringify({
        budget: { mode: 'cost', sessionBudget: 5, weeklyBudget: 50, weeklyResetDay: 'monday', weeklyResetHour: -1 },
        thresholds: DEFAULT_CONFIG.thresholds,
      }),
    );
    const config = loader.loadConfig();
    expect(config.budget.weeklyResetHour).toBe(DEFAULT_CONFIG.budget.weeklyResetHour);
  });

  it('falls back weeklyResetHour to default when over 23', () => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      configFile,
      YAML.stringify({
        budget: { mode: 'cost', sessionBudget: 5, weeklyBudget: 50, weeklyResetDay: 'monday', weeklyResetHour: 24 },
        thresholds: DEFAULT_CONFIG.thresholds,
      }),
    );
    const config = loader.loadConfig();
    expect(config.budget.weeklyResetHour).toBe(DEFAULT_CONFIG.budget.weeklyResetHour);
  });

  it('falls back weeklyResetHour to default when not an integer', () => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      configFile,
      YAML.stringify({
        budget: { mode: 'cost', sessionBudget: 5, weeklyBudget: 50, weeklyResetDay: 'monday', weeklyResetHour: 14.5 },
        thresholds: DEFAULT_CONFIG.thresholds,
      }),
    );
    const config = loader.loadConfig();
    expect(config.budget.weeklyResetHour).toBe(DEFAULT_CONFIG.budget.weeklyResetHour);
  });

  it('falls back weeklyResetHour to default when not a number', () => {
    fs.mkdirSync(configDir, { recursive: true });
    fs.writeFileSync(
      configFile,
      YAML.stringify({
        budget: { mode: 'cost', sessionBudget: 5, weeklyBudget: 50, weeklyResetDay: 'monday', weeklyResetHour: 'noon' },
        thresholds: DEFAULT_CONFIG.thresholds,
      }),
    );
    const config = loader.loadConfig();
    expect(config.budget.weeklyResetHour).toBe(DEFAULT_CONFIG.budget.weeklyResetHour);
  });
});
