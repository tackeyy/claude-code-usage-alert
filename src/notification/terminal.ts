/**
 * Terminal notification via Claude Code systemMessage.
 * Outputs JSON to stdout that Claude Code will interpret.
 */

/**
 * Format a systemMessage JSON string for Claude Code hooks.
 */
export function formatSystemMessage(message: string): string {
  return JSON.stringify({ systemMessage: message });
}
