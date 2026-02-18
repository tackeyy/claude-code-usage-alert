import { describe, it, expect } from 'vitest';
import { calculateCost, getModelPricing } from '../src/core/pricing.js';
import { TokenCounts } from '../src/core/pricing.js';

describe('pricing', () => {
  describe('getModelPricing', () => {
    it('returns pricing for exact model name', () => {
      const pricing = getModelPricing('claude-sonnet-4-5');
      expect(pricing).not.toBeNull();
      expect(pricing!.input).toBe(3.0);
      expect(pricing!.output).toBe(15.0);
    });

    it('returns pricing for model name with suffix', () => {
      const pricing = getModelPricing('claude-sonnet-4-5-20250514');
      expect(pricing).not.toBeNull();
      expect(pricing!.input).toBe(3.0);
    });

    it('returns pricing for opus keyword match', () => {
      const pricing = getModelPricing('some-opus-model');
      expect(pricing).not.toBeNull();
      expect(pricing!.input).toBe(15.0);
    });

    it('returns null for unknown model', () => {
      const pricing = getModelPricing('gpt-4o');
      expect(pricing).toBeNull();
    });
  });

  describe('calculateCost', () => {
    it('calculates cost for sonnet', () => {
      const tokens: TokenCounts = {
        input: 1_000_000,
        output: 100_000,
        cacheRead: 0,
        cacheCreation: 0,
      };
      // 1M * 3.0/1M + 100K * 15.0/1M = 3.0 + 1.5 = 4.5
      const cost = calculateCost(tokens, 'claude-sonnet-4-5');
      expect(cost).toBeCloseTo(4.5);
    });

    it('calculates cost with cache tokens', () => {
      const tokens: TokenCounts = {
        input: 500_000,
        output: 50_000,
        cacheRead: 2_000_000,
        cacheCreation: 100_000,
      };
      // 500K * 3.0/1M + 50K * 15.0/1M + 2M * 0.3/1M + 100K * 3.75/1M
      // = 1.5 + 0.75 + 0.6 + 0.375 = 3.225
      const cost = calculateCost(tokens, 'claude-sonnet-4-5');
      expect(cost).toBeCloseTo(3.225);
    });

    it('returns 0 for unknown model', () => {
      const tokens: TokenCounts = {
        input: 1_000_000,
        output: 100_000,
        cacheRead: 0,
        cacheCreation: 0,
      };
      const cost = calculateCost(tokens, 'unknown-model');
      expect(cost).toBe(0);
    });

    it('calculates cost for opus', () => {
      const tokens: TokenCounts = {
        input: 100_000,
        output: 10_000,
        cacheRead: 0,
        cacheCreation: 0,
      };
      // 100K * 15.0/1M + 10K * 75.0/1M = 1.5 + 0.75 = 2.25
      const cost = calculateCost(tokens, 'claude-opus-4-6');
      expect(cost).toBeCloseTo(2.25);
    });
  });
});
