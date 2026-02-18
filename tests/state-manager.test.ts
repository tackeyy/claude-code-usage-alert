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

  it('clearSession removes current session', () => {
    stateManager.initSession('sess-001');
    stateManager.clearSession();
    const state = stateManager.loadState();
    expect(state.currentSession).toBeNull();
  });
});
