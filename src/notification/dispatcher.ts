/**
 * Notification dispatcher.
 * Routes notifications to terminal and/or desktop based on method.
 */

import { NotifyMethod } from '../config/defaults.js';
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
): string | null {
  const costStr = `$${cost.toFixed(2)}`;
  const budgetStr = `$${budget.toFixed(2)}`;
  const emoji =
    threshold >= 90 ? '\u{1F6A8}' : threshold >= 80 ? '\u26A0\uFE0F' : '\u2139\uFE0F';
  const message = `${emoji} Usage Alert: ${Math.round(percent)}% of session budget used (${costStr} / ${budgetStr})`;

  let systemMessageJson: string | null = null;

  if (method === 'terminal' || method === 'both') {
    systemMessageJson = formatSystemMessage(message);
  }

  if (method === 'desktop' || method === 'both') {
    sendDesktopNotification('claude-code-usage-alert', message);
  }

  return systemMessageJson;
}
