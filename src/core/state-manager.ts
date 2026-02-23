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

export interface SessionHistoryEntry {
  sessionId: string;
  endedAt: string;  // ISO 8601
  costUsd: number;
  tokens: TokenCounts;
}

export interface State {
  currentSession: SessionState | null;
  sessionHistory: SessionHistoryEntry[];
  weeklyNotifiedThresholds: number[];
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
 * Handles backward compatibility for missing sessionHistory / weeklyNotifiedThresholds.
 */
export function loadState(): State {
  try {
    const raw = fs.readFileSync(getStateFilePath(), 'utf-8');
    const parsed = JSON.parse(raw) as Partial<State>;
    return {
      currentSession: parsed.currentSession ?? null,
      sessionHistory: parsed.sessionHistory ?? [],
      weeklyNotifiedThresholds: parsed.weeklyNotifiedThresholds ?? [],
    };
  } catch {
    return { currentSession: null, sessionHistory: [], weeklyNotifiedThresholds: [] };
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
 * Preserves sessionHistory and weeklyNotifiedThresholds.
 */
export function clearSession(): void {
  const state = loadState();
  state.currentSession = null;
  saveState(state);
}

/**
 * Archive the current session into sessionHistory.
 * Should be called before clearSession() on SessionEnd.
 */
export function archiveSession(state: State): void {
  if (!state.currentSession) return;

  const entry: SessionHistoryEntry = {
    sessionId: state.currentSession.sessionId,
    endedAt: new Date().toISOString(),
    costUsd: state.currentSession.cumulativeCostUsd,
    tokens: { ...state.currentSession.cumulativeTokens },
  };

  state.sessionHistory.push(entry);
  saveState(state);
}

/**
 * Calculate the start of the current weekly window based on resetDay and resetHour.
 * Returns the most recent past occurrence of resetDay at resetHour:00 local time.
 *
 * When now is on resetDay but before resetHour, the previous week's window is used.
 */
export function getWeeklyWindowStart(resetDay: string, resetHour = 0, now?: Date): Date {
  const DAYS: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6,
  };

  const current = now ?? new Date();
  const targetDay = DAYS[resetDay] ?? 1; // default to monday
  const currentDay = current.getDay();

  let daysBack = currentDay - targetDay;
  if (daysBack < 0) daysBack += 7;

  const windowStart = new Date(current);
  windowStart.setDate(windowStart.getDate() - daysBack);
  windowStart.setHours(resetHour, 0, 0, 0);

  // If on resetDay but before resetHour, use previous week's window
  if (daysBack === 0 && current < windowStart) {
    windowStart.setDate(windowStart.getDate() - 7);
  }

  return windowStart;
}

/**
 * Get the total cost within the current weekly window.
 * Includes history entries + current session cost.
 */
export function getWeeklyCost(state: State, resetDay: string, resetHour = 0): number {
  const windowStart = getWeeklyWindowStart(resetDay, resetHour);
  const windowStartTime = windowStart.getTime();

  let total = 0;

  for (const entry of state.sessionHistory) {
    const entryTime = new Date(entry.endedAt).getTime();
    if (entryTime >= windowStartTime) {
      total += entry.costUsd;
    }
  }

  if (state.currentSession) {
    total += state.currentSession.cumulativeCostUsd;
  }

  return total;
}

/**
 * Get the number of sessions in the current weekly window (history + current if active).
 */
export function getWeeklySessionCount(state: State, resetDay: string, resetHour = 0): number {
  const windowStart = getWeeklyWindowStart(resetDay, resetHour);
  const windowStartTime = windowStart.getTime();

  let count = 0;

  for (const entry of state.sessionHistory) {
    const entryTime = new Date(entry.endedAt).getTime();
    if (entryTime >= windowStartTime) {
      count++;
    }
  }

  if (state.currentSession) {
    count++;
  }

  return count;
}

/**
 * Remove history entries older than the current weekly window.
 */
export function pruneOldHistory(state: State, resetDay: string, resetHour = 0): void {
  const windowStart = getWeeklyWindowStart(resetDay, resetHour);
  const windowStartTime = windowStart.getTime();

  state.sessionHistory = state.sessionHistory.filter(
    (entry) => new Date(entry.endedAt).getTime() >= windowStartTime,
  );

  // Reset weekly thresholds when window changes
  // (any previously notified thresholds are for a past window)
  state.weeklyNotifiedThresholds = [];

  saveState(state);
}

/**
 * Mark a weekly threshold as notified.
 */
export function markWeeklyThresholdNotified(state: State, threshold: number): void {
  if (!state.weeklyNotifiedThresholds.includes(threshold)) {
    state.weeklyNotifiedThresholds.push(threshold);
    saveState(state);
  }
}

/**
 * Get the list of already-notified weekly thresholds.
 */
export function getWeeklyNotifiedThresholds(state: State): number[] {
  return state.weeklyNotifiedThresholds;
}

/**
 * Check if weekly tracking covers the full window.
 * Returns the tracking start date if partial, or null if full coverage.
 */
export function getWeeklyTrackingSince(state: State, resetDay: string, resetHour = 0, now?: Date): Date | null {
  const windowStart = getWeeklyWindowStart(resetDay, resetHour, now);

  // Find the earliest data point in this window
  let earliest: Date | null = null;

  for (const entry of state.sessionHistory) {
    const entryDate = new Date(entry.endedAt);
    if (entryDate.getTime() >= windowStart.getTime()) {
      if (!earliest || entryDate < earliest) {
        earliest = entryDate;
      }
    }
  }

  if (state.currentSession) {
    const sessionStart = new Date(state.currentSession.startedAt);
    if (!earliest || sessionStart < earliest) {
      earliest = sessionStart;
    }
  }

  if (!earliest) return null;

  // If earliest data point is more than 1 hour after window start,
  // consider tracking as partial
  const oneHour = 60 * 60 * 1000;
  if (earliest.getTime() - windowStart.getTime() > oneHour) {
    return earliest;
  }

  return null;
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
