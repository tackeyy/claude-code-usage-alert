import { describe, it, expect } from 'vitest';
import { parseConfigArgs } from '../src/commands/config.js';

describe('config command', () => {
  describe('parseConfigArgs', () => {
    it('parses --budget flag', () => {
      const options = parseConfigArgs(['--budget', '10.00']);
      expect(options.budget).toBe('10.00');
    });

    it('parses --thresholds flag', () => {
      const options = parseConfigArgs(['--thresholds', '50,80,95']);
      expect(options.thresholds).toBe('50,80,95');
    });

    it('parses --show flag', () => {
      const options = parseConfigArgs(['--show']);
      expect(options.show).toBe(true);
    });

    it('parses multiple flags', () => {
      const options = parseConfigArgs([
        '--budget', '7.50',
        '--thresholds', '40,70,90',
      ]);
      expect(options.budget).toBe('7.50');
      expect(options.thresholds).toBe('40,70,90');
    });

    it('handles empty args', () => {
      const options = parseConfigArgs([]);
      expect(options.budget).toBeUndefined();
      expect(options.thresholds).toBeUndefined();
      expect(options.show).toBeUndefined();
    });
  });
});
