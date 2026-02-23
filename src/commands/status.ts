/**
 * Status command.
 * Displays current session usage information.
 */

import { State, loadState, getWeeklyCost, getWeeklySessionCount, getWeeklyNotifiedThresholds } from '../core/state-manager.js';
import { Config } from '../config/defaults.js';
import { loadConfig } from '../config/loader.js';
import { getUsagePercent } from '../core/usage-calculator.js';

/**
 * Print weekly usage section.
 */
function printWeeklyUsage(state: State, config: Config): void {
  const weeklyCost = getWeeklyCost(state, config.budget.weeklyResetDay, config.budget.weeklyResetHour);
  const weeklyPercent = getUsagePercent(weeklyCost, config.budget.weeklyBudget);
  const weeklySessionCount = getWeeklySessionCount(state, config.budget.weeklyResetDay, config.budget.weeklyResetHour);
  const resetDayDisplay = config.budget.weeklyResetDay.charAt(0).toUpperCase() + config.budget.weeklyResetDay.slice(1);

  const weeklyNotified = getWeeklyNotifiedThresholds(state);
  const nextWeeklyThreshold = config.thresholds
    .map((t) => t.percent)
    .sort((a, b) => a - b)
    .find((t) => weeklyPercent < t && !weeklyNotified.includes(t));

  console.log('\n=== Weekly Usage ===\n');
  console.log(`Weekly budget:    $${config.budget.weeklyBudget.toFixed(2)}`);
  console.log(`Used (est.):      $${weeklyCost.toFixed(2)} (${Math.round(weeklyPercent)}%)`);
  console.log(`Reset day:        ${resetDayDisplay}`);
  console.log(`Sessions:         ${weeklySessionCount}`);
  console.log('');
  if (nextWeeklyThreshold) {
    console.log(`Next weekly alert: at ${nextWeeklyThreshold}%`);
  } else {
    console.log('All weekly thresholds have been crossed.');
  }
}

/**
 * Run the status command.
 */
export function runStatus(): void {
  const state = loadState();
  const config = loadConfig();

  if (!state.currentSession) {
    console.log('No active session.');
    console.log(`\nSession budget: $${config.budget.sessionBudget.toFixed(2)}`);
    printWeeklyUsage(state, config);
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

  // Weekly usage section
  printWeeklyUsage(state, config);
}
