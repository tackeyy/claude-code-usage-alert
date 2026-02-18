/**
 * State file management for session tracking.
 * State file: ~/.claude-code-usage-alert/state.json
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { TokenCounts } from './pricing.js';

export interface SessionState {
  sessionId: string;
  startedAt: string;
  cumulativeCostUsd: number;
  cumulativeTokens: TokenCounts;
  transcriptOffset: number;
  notifiedThresholds: number[];
}

export interface State {
  currentSession: SessionState | null;
}

function getStateDirPath(): string {
  return path.join(os.homedir(), '.claude-code-usage-alert');
}

function getStateFilePath(): string {
  return path.join(getStateDirPath(), 'state.json');
}

function ensureDir(): void {
  const dir = getStateDirPath();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Load state from disk. Returns empty state if file doesn't exist.
 */
export function loadState(): State {
  try {
    const raw = fs.readFileSync(getStateFilePath(), 'utf-8');
    return JSON.parse(raw) as State;
  } catch {
    return { currentSession: null };
  }
}

/**
 * Save state to disk.
 */
export function saveState(state: State): void {
  ensureDir();
  fs.writeFileSync(getStateFilePath(), JSON.stringify(state, null, 2), 'utf-8');
}

/**
 * Initialize or restore a session.
 */
export function initSession(sessionId: string): State {
  const state = loadState();

  // If same session, restore
  if (state.currentSession?.sessionId === sessionId) {
    return state;
  }

  // New session
  state.currentSession = {
    sessionId,
    startedAt: new Date().toISOString(),
    cumulativeCostUsd: 0,
    cumulativeTokens: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
    transcriptOffset: 0,
    notifiedThresholds: [],
  };

  saveState(state);
  return state;
}

/**
 * Update session with new token counts, cost, and offset.
 */
export function updateSession(
  state: State,
  tokens: TokenCounts,
  cost: number,
  offset: number,
): void {
  if (!state.currentSession) return;

  const s = state.currentSession;
  s.cumulativeCostUsd += cost;
  s.cumulativeTokens.input += tokens.input;
  s.cumulativeTokens.output += tokens.output;
  s.cumulativeTokens.cacheRead += tokens.cacheRead;
  s.cumulativeTokens.cacheCreation += tokens.cacheCreation;
  s.transcriptOffset = offset;

  saveState(state);
}

/**
 * Get the list of already-notified thresholds for the current session.
 */
export function getNotifiedThresholds(state: State): number[] {
  return state.currentSession?.notifiedThresholds ?? [];
}

/**
 * Mark a threshold as notified.
 */
export function markThresholdNotified(state: State, threshold: number): void {
  if (!state.currentSession) return;
  if (!state.currentSession.notifiedThresholds.includes(threshold)) {
    state.currentSession.notifiedThresholds.push(threshold);
    saveState(state);
  }
}

/**
 * Clear session state (for SessionEnd).
 */
export function clearSession(): void {
  const state: State = { currentSession: null };
  saveState(state);
}

/**
 * Get the state directory path (for setup).
 */
export function getStateDir(): string {
  return getStateDirPath();
}

/**
 * Get the state file path (for status display).
 */
export function getStateFile(): string {
  return getStateFilePath();
}
