/**
 * Hook command handler.
 * Processes Claude Code hook events: Stop, SessionStart, SessionEnd.
 */

import * as fs from 'node:fs';
import { parseTranscript } from '../core/transcript-parser.js';
import { calculateCost } from '../core/pricing.js';
import {
  initSession,
  updateSession,
  getNotifiedThresholds,
  markThresholdNotified,
  clearSession,
  loadState,
  archiveSession,
  getWeeklyCost,
  pruneOldHistory,
  getWeeklyNotifiedThresholds,
  markWeeklyThresholdNotified,
} from '../core/state-manager.js';
import { getUsagePercent, checkThresholds } from '../core/usage-calculator.js';
import { loadConfig } from '../config/loader.js';
import { notify } from '../notification/dispatcher.js';

interface HookInput {
  session_id?: string;
  transcript_path?: string;
}

/**
 * Read hook input from stdin (non-blocking, with timeout).
 */
function readStdin(): string {
  try {
    return fs.readFileSync(0, 'utf-8');
  } catch {
    return '{}';
  }
}

/**
 * Parse hook input JSON from stdin.
 */
function parseHookInput(raw: string): HookInput {
  try {
    return JSON.parse(raw) as HookInput;
  } catch {
    return {};
  }
}

/**
 * Handle SessionStart event.
 */
function handleSessionStart(input: HookInput): void {
  const config = loadConfig();
  const state = loadState();
  pruneOldHistory(state, config.budget.weeklyResetDay);

  const sessionId = input.session_id ?? `session-${Date.now()}`;
  initSession(sessionId);
}

/**
 * Handle Stop event.
 * This is the main processing hook:
 * 1. Parse transcript for new tokens
 * 2. Calculate cost
 * 3. Check thresholds
 * 4. Send notifications
 * 5. Output systemMessage to stdout
 */
function handleStop(input: HookInput): void {
  const config = loadConfig();
  const sessionId = input.session_id ?? '';
  const transcriptPath = input.transcript_path ?? '';

  // Initialize or restore session
  const state = initSession(sessionId);
  if (!state.currentSession) return;

  // Parse transcript from last offset
  if (!transcriptPath) return;

  const parseResult = parseTranscript(
    transcriptPath,
    state.currentSession.transcriptOffset,
  );

  // If no new data, skip
  if (parseResult.newOffset === state.currentSession.transcriptOffset) return;

  // Calculate cost for new tokens
  const model = parseResult.model || 'claude-sonnet-4-5'; // default model
  const cost = calculateCost(parseResult.totalTokens, model);

  // Update session state
  updateSession(state, parseResult.totalTokens, cost, parseResult.newOffset);

  // Check thresholds
  const percent = getUsagePercent(
    state.currentSession.cumulativeCostUsd,
    config.budget.sessionBudget,
  );

  const configThresholds = config.thresholds.map((t) => t.percent);
  const notified = getNotifiedThresholds(state);

  const result = checkThresholds(percent, notified, configThresholds);

  if (result.shouldNotify) {
    // Find the notification method for this threshold
    const thresholdConfig = config.thresholds.find(
      (t) => t.percent === result.threshold,
    );
    const method = thresholdConfig?.notify ?? 'terminal';

    const systemMessage = notify(
      result.threshold,
      percent,
      state.currentSession.cumulativeCostUsd,
      config.budget.sessionBudget,
      method,
      'session',
    );

    // Mark threshold as notified
    markThresholdNotified(state, result.threshold);

    // Output systemMessage to stdout for Claude Code
    if (systemMessage) {
      process.stdout.write(systemMessage);
    }
  }

  // Weekly budget threshold check
  const weeklyCost = getWeeklyCost(state, config.budget.weeklyResetDay);
  const weeklyPercent = getUsagePercent(weeklyCost, config.budget.weeklyBudget);
  const weeklyNotified = getWeeklyNotifiedThresholds(state);
  const weeklyResult = checkThresholds(weeklyPercent, weeklyNotified, configThresholds);

  if (weeklyResult.shouldNotify) {
    const thresholdConfig = config.thresholds.find(
      (t) => t.percent === weeklyResult.threshold,
    );
    const method = thresholdConfig?.notify ?? 'terminal';

    const weeklySystemMessage = notify(
      weeklyResult.threshold,
      weeklyPercent,
      weeklyCost,
      config.budget.weeklyBudget,
      method,
      'weekly',
    );

    markWeeklyThresholdNotified(state, weeklyResult.threshold);

    if (weeklySystemMessage) {
      process.stdout.write(weeklySystemMessage);
    }
  }
}

/**
 * Handle SessionEnd event.
 */
function handleSessionEnd(_input: HookInput): void {
  const state = loadState();
  archiveSession(state);
  clearSession();
}

/**
 * Main hook command handler.
 */
export function runHook(event: string): void {
  try {
    const raw = readStdin();
    const input = parseHookInput(raw);

    switch (event) {
      case 'SessionStart':
        handleSessionStart(input);
        break;
      case 'Stop':
        handleStop(input);
        break;
      case 'SessionEnd':
        handleSessionEnd(input);
        break;
      default:
        // Unknown event - silently ignore
        break;
    }
  } catch {
    // Never crash - hook failures should not affect Claude Code
  }
}
