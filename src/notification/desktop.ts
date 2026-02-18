/**
 * Desktop notification via OS-native tools.
 * macOS: osascript
 * Linux: notify-send
 */

import { execFileSync } from 'node:child_process';
import { getPlatform } from '../utils/platform.js';

/**
 * Send a desktop notification. Silently fails on error.
 */
export function sendDesktopNotification(
  title: string,
  message: string,
): void {
  try {
    const platform = getPlatform();

    if (platform === 'darwin') {
      const script = `display notification "${message.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}" with title "${title.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
      execFileSync('osascript', ['-e', script], {
        stdio: 'ignore',
        timeout: 3000,
      });
    } else if (platform === 'linux') {
      execFileSync('notify-send', [title, message], {
        stdio: 'ignore',
        timeout: 3000,
      });
    }
  } catch {
    // Silently ignore - notification failure should not affect Claude Code
  }
}
