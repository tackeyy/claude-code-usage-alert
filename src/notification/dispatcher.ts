/**
 * Notification dispatcher.
 * Routes notifications to terminal and/or desktop based on method.
 */

import { NotifyMethod, PlanType } from '../config/defaults.js';
import { sendDesktopNotification } from './desktop.js';
import { formatSystemMessage } from './terminal.js';

/**
 * Send notification via the specified method.
 * Returns the systemMessage JSON if terminal notification was sent, or null.
 */
export function notify(
  threshold: number,
  percent: number,
  cost: number,
  budget: number,
  method: NotifyMethod,
  plan: PlanType = 'max',
): string | null {
  const emoji =
    threshold >= 90 ? '\u{1F6A8}' : threshold >= 80 ? '\u26A0\uFE0F' : '\u2139\uFE0F';
  const base = `${emoji} Usage Alert: ${Math.round(percent)}% of session budget used`;
  const message =
    plan === 'api'
      ? `${base} ($${cost.toFixed(2)} / $${budget.toFixed(2)})`
      : base;

  let systemMessageJson: string | null = null;

  if (method === 'terminal' || method === 'both') {
    systemMessageJson = formatSystemMessage(message);
  }

  if (method === 'desktop' || method === 'both') {
    sendDesktopNotification('claude-code-usage-alert', message);
  }

  return systemMessageJson;
}
