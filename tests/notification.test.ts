import { describe, it, expect } from 'vitest';
import { formatSystemMessage } from '../src/notification/terminal.js';

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
});
