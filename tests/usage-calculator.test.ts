import { describe, it, expect } from 'vitest';
import {
  getUsagePercent,
  checkThresholds,
} from '../src/core/usage-calculator.js';

describe('usage-calculator', () => {
  describe('getUsagePercent', () => {
    it('calculates percentage correctly', () => {
      expect(getUsagePercent(2.5, 5.0)).toBe(50);
    });

    it('returns 0 for zero budget', () => {
      expect(getUsagePercent(2.5, 0)).toBe(0);
    });

    it('handles over-budget', () => {
      expect(getUsagePercent(6.0, 5.0)).toBe(120);
    });

    it('returns 0 for negative budget', () => {
      expect(getUsagePercent(2.5, -1)).toBe(0);
    });
  });

  describe('checkThresholds', () => {
    const thresholds = [50, 80, 90];

    it('returns shouldNotify when threshold is crossed', () => {
      const result = checkThresholds(55, [], thresholds);
      expect(result.shouldNotify).toBe(true);
      expect(result.threshold).toBe(50);
    });

    it('returns highest un-notified crossed threshold', () => {
      const result = checkThresholds(85, [], thresholds);
      expect(result.shouldNotify).toBe(true);
      expect(result.threshold).toBe(80);
    });

    it('skips already notified thresholds', () => {
      const result = checkThresholds(85, [50, 80], thresholds);
      expect(result.shouldNotify).toBe(false);
    });

    it('notifies next threshold even if lower ones are notified', () => {
      const result = checkThresholds(95, [50, 80], thresholds);
      expect(result.shouldNotify).toBe(true);
      expect(result.threshold).toBe(90);
    });

    it('returns shouldNotify false when below all thresholds', () => {
      const result = checkThresholds(30, [], thresholds);
      expect(result.shouldNotify).toBe(false);
    });

    it('handles all thresholds crossed and notified', () => {
      const result = checkThresholds(100, [50, 80, 90], thresholds);
      expect(result.shouldNotify).toBe(false);
    });

    it('includes message with appropriate emoji', () => {
      const result50 = checkThresholds(55, [], thresholds);
      expect(result50.message).toContain('55%');

      const result90 = checkThresholds(95, [50, 80], thresholds);
      expect(result90.message).toContain('95%');
    });
  });
});
