import { describe, it, expect, vi } from 'vitest';
import { formatSystemMessage } from '../src/notification/terminal.js';
import { notify } from '../src/notification/dispatcher.js';

// Mock desktop notification to avoid actual OS calls
vi.mock('../src/notification/desktop.js', () => ({
  sendDesktopNotification: vi.fn(),
}));

describe('notification', () => {
  describe('formatSystemMessage', () => {
    it('formats message as JSON with systemMessage field', () => {
      const result = formatSystemMessage('test message');
      const parsed = JSON.parse(result);
      expect(parsed.systemMessage).toBe('test message');
    });

    it('handles special characters', () => {
      const result = formatSystemMessage('Usage: 80% ($4.00 / $5.00)');
      const parsed = JSON.parse(result);
      expect(parsed.systemMessage).toBe('Usage: 80% ($4.00 / $5.00)');
    });
  });

  describe('notify', () => {
    it('includes tracking since date for weekly partial coverage', () => {
      const trackingSince = new Date('2026-02-18T10:00:00');
      const result = notify(50, 50, 25.0, 50.0, 'terminal', 'weekly', trackingSince);
      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);
      expect(parsed.systemMessage).toContain('[Weekly]');
      expect(parsed.systemMessage).toContain('tracking since');
      expect(parsed.systemMessage).toContain('Wed Feb 18');
    });

    it('does not include tracking since for full weekly coverage', () => {
      const result = notify(50, 50, 25.0, 50.0, 'terminal', 'weekly');
      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);
      expect(parsed.systemMessage).toContain('[Weekly]');
      expect(parsed.systemMessage).not.toContain('tracking since');
    });

    it('does not include tracking since for session scope', () => {
      const result = notify(50, 50, 2.5, 5.0, 'terminal', 'session');
      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);
      expect(parsed.systemMessage).not.toContain('tracking since');
      expect(parsed.systemMessage).not.toContain('[Weekly]');
    });

    it('includes est. in dollar amounts', () => {
      const result = notify(80, 80, 4.0, 5.0, 'terminal', 'session');
      expect(result).not.toBeNull();
      const parsed = JSON.parse(result!);
      expect(parsed.systemMessage).toContain('$4.00 est.');
    });
  });
});
