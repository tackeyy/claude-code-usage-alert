/**
 * Usage percentage calculation and threshold checking.
 */

export interface ThresholdResult {
  shouldNotify: boolean;
  threshold: number;
  message: string;
}

/**
 * Calculate usage percentage against session budget.
 * Returns 0 if budget is 0 or negative.
 */
export function getUsagePercent(
  cumulativeCost: number,
  sessionBudget: number,
): number {
  if (sessionBudget <= 0) return 0;
  return (cumulativeCost / sessionBudget) * 100;
}

/**
 * Check if any threshold has been crossed that hasn't been notified yet.
 * Returns the highest un-notified threshold that has been crossed.
 */
export function checkThresholds(
  percent: number,
  notifiedThresholds: number[],
  configThresholds: number[],
): ThresholdResult {
  const notifiedSet = new Set(notifiedThresholds);

  // Find the highest un-notified threshold that has been crossed
  const crossed = configThresholds
    .filter((t) => percent >= t && !notifiedSet.has(t))
    .sort((a, b) => b - a);

  if (crossed.length === 0) {
    return { shouldNotify: false, threshold: 0, message: '' };
  }

  const threshold = crossed[0];
  const emoji =
    threshold >= 90 ? '\u{1F6A8}' : threshold >= 80 ? '\u26A0\uFE0F' : '\u2139\uFE0F';
  const message = `${emoji} Usage Alert: ${Math.round(percent)}% of session budget used`;

  return { shouldNotify: true, threshold, message };
}
