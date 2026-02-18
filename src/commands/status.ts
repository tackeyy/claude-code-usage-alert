/**
 * Status command.
 * Displays current session usage information.
 */

import { loadState } from '../core/state-manager.js';
import { loadConfig } from '../config/loader.js';
import { getUsagePercent } from '../core/usage-calculator.js';

/**
 * Run the status command.
 */
export function runStatus(): void {
  const state = loadState();
  const config = loadConfig();

  if (!state.currentSession) {
    console.log('No active session.');
    console.log(`\nSession budget: $${config.budget.sessionBudget.toFixed(2)}`);
    return;
  }

  const session = state.currentSession;
  const percent = getUsagePercent(
    session.cumulativeCostUsd,
    config.budget.sessionBudget,
  );

  const remaining = Math.max(
    0,
    config.budget.sessionBudget - session.cumulativeCostUsd,
  );

  // Find next threshold
  const nextThreshold = config.thresholds
    .map((t) => t.percent)
    .sort((a, b) => a - b)
    .find((t) => percent < t);

  console.log('=== claude-code-usage-alert Status ===\n');
  console.log(`Session ID:  ${session.sessionId}`);
  console.log(`Started at:  ${session.startedAt}`);
  console.log('');
  console.log(`Budget:          $${config.budget.sessionBudget.toFixed(2)}`);
  console.log(`Used (est.):     $${session.cumulativeCostUsd.toFixed(4)} (${Math.round(percent)}%)`);
  console.log(`Remaining (est.):$${remaining.toFixed(4)}`);
  console.log('');
  console.log('Tokens:');
  console.log(`  Input:          ${session.cumulativeTokens.input.toLocaleString()}`);
  console.log(`  Output:         ${session.cumulativeTokens.output.toLocaleString()}`);
  console.log(`  Cache Read:     ${session.cumulativeTokens.cacheRead.toLocaleString()}`);
  console.log(`  Cache Creation: ${session.cumulativeTokens.cacheCreation.toLocaleString()}`);
  console.log('');

  if (nextThreshold) {
    console.log(`Next alert:  at ${nextThreshold}%`);
  } else {
    console.log('All thresholds have been crossed.');
  }

  if (session.notifiedThresholds.length > 0) {
    console.log(
      `Notified:    ${session.notifiedThresholds.sort((a, b) => a - b).join('%, ')}%`,
    );
  }
}
