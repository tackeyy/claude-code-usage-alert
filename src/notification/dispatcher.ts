/**
 * Notification dispatcher.
 * Routes notifications to terminal and/or desktop based on method.
 */

import { NotifyMethod } from '../config/defaults.js';
import { sendDesktopNotification } from './desktop.js';
import { formatSystemMessage } from './terminal.js';

/**
 * Format a date as a short string like "Mon Feb 17".
 */
function formatShortDate(date: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[date.getDay()]} ${months[date.getMonth()]} ${date.getDate()}`;
}

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
  scope: 'session' | 'weekly' = 'session',
  trackingSince?: Date,
): string | null {
  const costStr = `$${cost.toFixed(2)}`;
  const budgetStr = `$${budget.toFixed(2)}`;
  const emoji =
    threshold >= 90 ? '\u{1F6A8}' : threshold >= 80 ? '\u26A0\uFE0F' : '\u2139\uFE0F';
  const prefix = scope === 'weekly' ? '[Weekly] ' : '';
  const budgetLabel = scope === 'weekly' ? 'weekly budget' : 'session budget';
  const trackingSuffix = trackingSince
    ? ` (tracking since ${formatShortDate(trackingSince)})`
    : '';
  const message = `${emoji} ${prefix}Usage Alert: ${Math.round(percent)}% of ${budgetLabel} used (${costStr} est. / ${budgetStr})${trackingSuffix}`;

  let systemMessageJson: string | null = null;

  if (method === 'terminal' || method === 'both') {
    systemMessageJson = formatSystemMessage(message);
  }

  if (method === 'desktop' || method === 'both') {
    sendDesktopNotification('claude-code-usage-alert', message);
  }

  return systemMessageJson;
}
