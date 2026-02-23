import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// Mock the state directory to use a temp dir
let tmpDir: string;
let stateFile: string;

vi.mock('node:os', async () => {
  const actual = await vi.importActual<typeof import('node:os')>('node:os');
  return {
    ...actual,
    homedir: () => tmpDir,
  };
});

// Import after mocking
const stateManager = await import('../src/core/state-manager.js');

describe('state-manager', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-alert-state-'));
    stateFile = path.join(tmpDir, '.claude-code-usage-alert', 'state.json');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loadState returns empty state when no file exists', () => {
    const state = stateManager.loadState();
    expect(state.currentSession).toBeNull();
  });

  it('saveState and loadState round-trip', () => {
    const state = {
      currentSession: {
        sessionId: 'test-123',
        startedAt: '2026-01-01T00:00:00Z',
        cumulativeCostUsd: 1.5,
        cumulativeTokens: { input: 100, output: 50, cacheRead: 0, cacheCreation: 0 },
        transcriptOffset: 1024,
        notifiedThresholds: [50],
      },
      sessionHistory: [],
      weeklyNotifiedThresholds: [],
    };
    stateManager.saveState(state);
    const loaded = stateManager.loadState();
    expect(loaded.currentSession?.sessionId).toBe('test-123');
    expect(loaded.currentSession?.cumulativeCostUsd).toBe(1.5);
  });

  it('initSession creates new session', () => {
    const state = stateManager.initSession('sess-001');
    expect(state.currentSession).not.toBeNull();
    expect(state.currentSession!.sessionId).toBe('sess-001');
    expect(state.currentSession!.cumulativeCostUsd).toBe(0);
  });

  it('initSession restores existing session with same ID', () => {
    const state1 = stateManager.initSession('sess-001');
    stateManager.updateSession(
      state1,
      { input: 100, output: 50, cacheRead: 0, cacheCreation: 0 },
      0.5,
      512,
    );

    const state2 = stateManager.initSession('sess-001');
    expect(state2.currentSession!.cumulativeCostUsd).toBe(0.5);
  });

  it('initSession creates new session for different ID', () => {
    stateManager.initSession('sess-001');
    const state2 = stateManager.initSession('sess-002');
    expect(state2.currentSession!.sessionId).toBe('sess-002');
    expect(state2.currentSession!.cumulativeCostUsd).toBe(0);
  });

  it('updateSession accumulates tokens and cost', () => {
    const state = stateManager.initSession('sess-001');
    stateManager.updateSession(
      state,
      { input: 100, output: 50, cacheRead: 10, cacheCreation: 5 },
      0.5,
      512,
    );
    expect(state.currentSession!.cumulativeCostUsd).toBe(0.5);
    expect(state.currentSession!.cumulativeTokens.input).toBe(100);
    expect(state.currentSession!.transcriptOffset).toBe(512);

    stateManager.updateSession(
      state,
      { input: 200, output: 100, cacheRead: 20, cacheCreation: 10 },
      1.0,
      1024,
    );
    expect(state.currentSession!.cumulativeCostUsd).toBe(1.5);
    expect(state.currentSession!.cumulativeTokens.input).toBe(300);
    expect(state.currentSession!.transcriptOffset).toBe(1024);
  });

  it('markThresholdNotified adds threshold', () => {
    const state = stateManager.initSession('sess-001');
    stateManager.markThresholdNotified(state, 50);
    expect(stateManager.getNotifiedThresholds(state)).toContain(50);
  });

  it('markThresholdNotified does not duplicate', () => {
    const state = stateManager.initSession('sess-001');
    stateManager.markThresholdNotified(state, 50);
    stateManager.markThresholdNotified(state, 50);
    expect(stateManager.getNotifiedThresholds(state).filter((t) => t === 50).length).toBe(1);
  });

  it('clearSession removes current session but preserves history', () => {
    const state = stateManager.initSession('sess-001');
    stateManager.updateSession(
      state,
      { input: 100, output: 50, cacheRead: 0, cacheCreation: 0 },
      1.0,
      512,
    );
    stateManager.archiveSession(state);
    stateManager.clearSession();

    const loaded = stateManager.loadState();
    expect(loaded.currentSession).toBeNull();
    expect(loaded.sessionHistory.length).toBe(1);
    expect(loaded.sessionHistory[0].costUsd).toBe(1.0);
  });

  it('loadState handles backward-compatible state without sessionHistory', () => {
    // Simulate old state format (no sessionHistory/weeklyNotifiedThresholds)
    const dir = path.join(tmpDir, '.claude-code-usage-alert');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'state.json'),
      JSON.stringify({ currentSession: null }),
      'utf-8',
    );

    const state = stateManager.loadState();
    expect(state.currentSession).toBeNull();
    expect(state.sessionHistory).toEqual([]);
    expect(state.weeklyNotifiedThresholds).toEqual([]);
  });
});

describe('archiveSession', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-alert-state-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('archives current session to history', () => {
    const state = stateManager.initSession('sess-001');
    stateManager.updateSession(
      state,
      { input: 500, output: 200, cacheRead: 100, cacheCreation: 50 },
      2.5,
      1024,
    );

    stateManager.archiveSession(state);

    expect(state.sessionHistory.length).toBe(1);
    expect(state.sessionHistory[0].sessionId).toBe('sess-001');
    expect(state.sessionHistory[0].costUsd).toBe(2.5);
    expect(state.sessionHistory[0].tokens.input).toBe(500);
    expect(state.sessionHistory[0].endedAt).toBeTruthy();
  });

  it('does nothing when no current session', () => {
    const state = stateManager.loadState();
    stateManager.archiveSession(state);
    expect(state.sessionHistory.length).toBe(0);
  });

  it('accumulates multiple archived sessions', () => {
    const state1 = stateManager.initSession('sess-001');
    stateManager.updateSession(
      state1,
      { input: 100, output: 50, cacheRead: 0, cacheCreation: 0 },
      1.0,
      512,
    );
    stateManager.archiveSession(state1);
    stateManager.clearSession();

    const state2 = stateManager.initSession('sess-002');
    stateManager.updateSession(
      state2,
      { input: 200, output: 100, cacheRead: 0, cacheCreation: 0 },
      2.0,
      1024,
    );
    stateManager.archiveSession(state2);

    expect(state2.sessionHistory.length).toBe(2);
    expect(state2.sessionHistory[0].sessionId).toBe('sess-001');
    expect(state2.sessionHistory[1].sessionId).toBe('sess-002');
  });
});

describe('getWeeklyCost', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-alert-state-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns 0 when no history and no current session', () => {
    const state = stateManager.loadState();
    expect(stateManager.getWeeklyCost(state, 'monday')).toBe(0);
  });

  it('includes current session cost', () => {
    const state = stateManager.initSession('sess-001');
    stateManager.updateSession(
      state,
      { input: 100, output: 50, cacheRead: 0, cacheCreation: 0 },
      3.0,
      512,
    );
    expect(stateManager.getWeeklyCost(state, 'monday')).toBe(3.0);
  });

  it('includes recent history entries', () => {
    const now = new Date();
    const state: ReturnType<typeof stateManager.loadState> = {
      currentSession: null,
      sessionHistory: [
        {
          sessionId: 'old-sess',
          endedAt: now.toISOString(),
          costUsd: 5.0,
          tokens: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
        },
      ],
      weeklyNotifiedThresholds: [],
    };
    stateManager.saveState(state);
    const loaded = stateManager.loadState();
    expect(stateManager.getWeeklyCost(loaded, 'monday')).toBe(5.0);
  });

  it('excludes history entries from before the weekly window', () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 10); // 10 days ago

    const state: ReturnType<typeof stateManager.loadState> = {
      currentSession: null,
      sessionHistory: [
        {
          sessionId: 'old-sess',
          endedAt: oldDate.toISOString(),
          costUsd: 5.0,
          tokens: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
        },
      ],
      weeklyNotifiedThresholds: [],
    };
    stateManager.saveState(state);
    const loaded = stateManager.loadState();
    expect(stateManager.getWeeklyCost(loaded, 'monday')).toBe(0);
  });

  it('sums history and current session', () => {
    const now = new Date();
    const state = stateManager.initSession('sess-002');
    stateManager.updateSession(
      state,
      { input: 100, output: 50, cacheRead: 0, cacheCreation: 0 },
      2.0,
      512,
    );
    state.sessionHistory = [
      {
        sessionId: 'sess-001',
        endedAt: now.toISOString(),
        costUsd: 3.0,
        tokens: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
      },
    ];
    expect(stateManager.getWeeklyCost(state, 'monday')).toBe(5.0);
  });
});

describe('pruneOldHistory', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-alert-state-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('removes entries older than the weekly window', () => {
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 10);
    const recentDate = new Date();

    const state: ReturnType<typeof stateManager.loadState> = {
      currentSession: null,
      sessionHistory: [
        {
          sessionId: 'old',
          endedAt: oldDate.toISOString(),
          costUsd: 5.0,
          tokens: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
        },
        {
          sessionId: 'recent',
          endedAt: recentDate.toISOString(),
          costUsd: 3.0,
          tokens: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
        },
      ],
      weeklyNotifiedThresholds: [50],
    };

    stateManager.pruneOldHistory(state, 'monday');

    expect(state.sessionHistory.length).toBe(1);
    expect(state.sessionHistory[0].sessionId).toBe('recent');
    // Weekly thresholds should be reset
    expect(state.weeklyNotifiedThresholds).toEqual([]);
  });

  it('keeps all entries if all within window', () => {
    const now = new Date();
    const state: ReturnType<typeof stateManager.loadState> = {
      currentSession: null,
      sessionHistory: [
        {
          sessionId: 'sess-1',
          endedAt: now.toISOString(),
          costUsd: 2.0,
          tokens: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
        },
      ],
      weeklyNotifiedThresholds: [],
    };

    stateManager.pruneOldHistory(state, 'monday');
    expect(state.sessionHistory.length).toBe(1);
  });
});

describe('getWeeklyWindowStart', () => {
  it('returns correct window start when today is after reset day', () => {
    // Wednesday, resetDay=monday → should return this Monday
    const wednesday = new Date('2026-02-18T15:00:00'); // Wednesday
    const windowStart = stateManager.getWeeklyWindowStart('monday', 0, wednesday);
    expect(windowStart.getDay()).toBe(1); // Monday
    expect(windowStart.getDate()).toBe(16); // Monday Feb 16
    expect(windowStart.getHours()).toBe(0);
  });

  it('returns correct window start when today is before reset day', () => {
    // Tuesday, resetDay=wednesday → should return last Wednesday
    const tuesday = new Date('2026-02-17T15:00:00'); // Tuesday
    const windowStart = stateManager.getWeeklyWindowStart('wednesday', 0, tuesday);
    expect(windowStart.getDay()).toBe(3); // Wednesday
    expect(windowStart.getDate()).toBe(11); // Last Wednesday Feb 11
  });

  it('returns today when today is reset day', () => {
    // Monday, resetDay=monday → should return today (Monday) at 00:00
    const monday = new Date('2026-02-16T15:00:00'); // Monday
    const windowStart = stateManager.getWeeklyWindowStart('monday', 0, monday);
    expect(windowStart.getDay()).toBe(1); // Monday
    expect(windowStart.getDate()).toBe(16); // This Monday
    expect(windowStart.getHours()).toBe(0);
  });

  it('uses resetHour for window start time', () => {
    // Wednesday 18:00, resetDay=wednesday, resetHour=14 → should return Wed 14:00 (today)
    const wednesday = new Date('2026-02-18T18:00:00'); // Wednesday 18:00
    const windowStart = stateManager.getWeeklyWindowStart('wednesday', 14, wednesday);
    expect(windowStart.getDay()).toBe(3); // Wednesday
    expect(windowStart.getDate()).toBe(18); // This Wednesday
    expect(windowStart.getHours()).toBe(14);
  });

  it('returns previous week when on resetDay but before resetHour', () => {
    // Wednesday 10:00, resetDay=wednesday, resetHour=14 → should return last Wed 14:00
    const wednesday = new Date('2026-02-18T10:00:00'); // Wednesday 10:00
    const windowStart = stateManager.getWeeklyWindowStart('wednesday', 14, wednesday);
    expect(windowStart.getDay()).toBe(3); // Wednesday
    expect(windowStart.getDate()).toBe(11); // Last Wednesday Feb 11
    expect(windowStart.getHours()).toBe(14);
  });

  it('returns current week when on resetDay and after resetHour', () => {
    // Wednesday 15:00, resetDay=wednesday, resetHour=14 → should return Wed 14:00 (today)
    const wednesday = new Date('2026-02-18T15:00:00'); // Wednesday 15:00
    const windowStart = stateManager.getWeeklyWindowStart('wednesday', 14, wednesday);
    expect(windowStart.getDay()).toBe(3); // Wednesday
    expect(windowStart.getDate()).toBe(18); // This Wednesday
    expect(windowStart.getHours()).toBe(14);
  });

  it('returns current week when on resetDay and exactly at resetHour', () => {
    // Wednesday 14:00:00, resetDay=wednesday, resetHour=14 → should return Wed 14:00 (today)
    const wednesday = new Date('2026-02-18T14:00:00'); // Wednesday 14:00 exactly
    const windowStart = stateManager.getWeeklyWindowStart('wednesday', 14, wednesday);
    expect(windowStart.getDay()).toBe(3); // Wednesday
    expect(windowStart.getDate()).toBe(18); // This Wednesday
    expect(windowStart.getHours()).toBe(14);
  });
});

describe('getWeeklyTrackingSince', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-alert-state-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns null when no sessions exist', () => {
    const state = stateManager.loadState();
    expect(stateManager.getWeeklyTrackingSince(state, 'monday', 0)).toBeNull();
  });

  it('returns null when tracking covers full window', () => {
    // Window starts at Monday 00:00, session started at Monday 00:30
    const monday = new Date('2026-02-16T00:30:00');
    const state: ReturnType<typeof stateManager.loadState> = {
      currentSession: {
        sessionId: 'sess-001',
        startedAt: monday.toISOString(),
        cumulativeCostUsd: 1.0,
        cumulativeTokens: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
        transcriptOffset: 0,
        notifiedThresholds: [],
      },
      sessionHistory: [],
      weeklyNotifiedThresholds: [],
    };
    // Within 1 hour of window start → full coverage
    expect(stateManager.getWeeklyTrackingSince(state, 'monday', 0, monday)).toBeNull();
  });

  it('returns tracking start date when partial coverage', () => {
    // Window starts Monday 00:00, but first session is Wednesday
    const wednesday = new Date('2026-02-18T10:00:00');
    const state: ReturnType<typeof stateManager.loadState> = {
      currentSession: {
        sessionId: 'sess-001',
        startedAt: wednesday.toISOString(),
        cumulativeCostUsd: 1.0,
        cumulativeTokens: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
        transcriptOffset: 0,
        notifiedThresholds: [],
      },
      sessionHistory: [],
      weeklyNotifiedThresholds: [],
    };
    const result = stateManager.getWeeklyTrackingSince(state, 'monday', 0, wednesday);
    expect(result).not.toBeNull();
    expect(result!.getDay()).toBe(3); // Wednesday
  });

  it('uses earliest session from history', () => {
    const tuesday = new Date('2026-02-17T10:00:00');
    const wednesday = new Date('2026-02-18T10:00:00');
    const state: ReturnType<typeof stateManager.loadState> = {
      currentSession: {
        sessionId: 'sess-002',
        startedAt: wednesday.toISOString(),
        cumulativeCostUsd: 1.0,
        cumulativeTokens: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
        transcriptOffset: 0,
        notifiedThresholds: [],
      },
      sessionHistory: [
        {
          sessionId: 'sess-001',
          endedAt: tuesday.toISOString(),
          costUsd: 2.0,
          tokens: { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 },
        },
      ],
      weeklyNotifiedThresholds: [],
    };
    const result = stateManager.getWeeklyTrackingSince(state, 'monday', 0, wednesday);
    expect(result).not.toBeNull();
    expect(result!.getDay()).toBe(2); // Tuesday (earlier than Wednesday)
  });
});

describe('weekly threshold notifications', () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-alert-state-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('markWeeklyThresholdNotified adds threshold', () => {
    const state = stateManager.loadState();
    stateManager.markWeeklyThresholdNotified(state, 50);
    expect(stateManager.getWeeklyNotifiedThresholds(state)).toContain(50);
  });

  it('markWeeklyThresholdNotified does not duplicate', () => {
    const state = stateManager.loadState();
    stateManager.markWeeklyThresholdNotified(state, 50);
    stateManager.markWeeklyThresholdNotified(state, 50);
    expect(state.weeklyNotifiedThresholds.filter((t) => t === 50).length).toBe(1);
  });
});
