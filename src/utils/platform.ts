/**
 * Platform detection utilities.
 */

import * as os from 'node:os';

export type Platform = 'darwin' | 'linux' | 'unsupported';

/**
 * Get the current platform.
 */
export function getPlatform(): Platform {
  const platform = os.platform();
  if (platform === 'darwin') return 'darwin';
  if (platform === 'linux') return 'linux';
  return 'unsupported';
}
