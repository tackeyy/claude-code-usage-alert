/**
 * Model pricing tables and cost calculation.
 * Prices are USD per 1M tokens.
 */

export interface ModelPricing {
  input: number;
  output: number;
  cacheRead: number;
  cacheCreation: number;
}

export interface TokenCounts {
  input: number;
  output: number;
  cacheRead: number;
  cacheCreation: number;
}

const PRICING_TABLE: Record<string, ModelPricing> = {
  'claude-opus-4-6': {
    input: 15.0,
    output: 75.0,
    cacheRead: 1.5,
    cacheCreation: 18.75,
  },
  'claude-sonnet-4-5': {
    input: 3.0,
    output: 15.0,
    cacheRead: 0.3,
    cacheCreation: 3.75,
  },
  'claude-haiku-4-5': {
    input: 0.8,
    output: 4.0,
    cacheRead: 0.08,
    cacheCreation: 1.0,
  },
};

/**
 * Resolve model name to a known pricing key.
 * Handles partial matches like "claude-sonnet-4-5-20250514".
 */
function resolveModelKey(model: string): string | null {
  if (PRICING_TABLE[model]) return model;
  for (const key of Object.keys(PRICING_TABLE)) {
    if (model.startsWith(key)) return key;
  }
  // Fallback: check for keyword matches
  if (model.includes('opus')) return 'claude-opus-4-6';
  if (model.includes('sonnet')) return 'claude-sonnet-4-5';
  if (model.includes('haiku')) return 'claude-haiku-4-5';
  return null;
}

/**
 * Calculate cost in USD for given token counts and model.
 * Returns 0 if model is unknown.
 */
export function calculateCost(tokens: TokenCounts, model: string): number {
  const key = resolveModelKey(model);
  if (!key) return 0;
  const pricing = PRICING_TABLE[key];
  const cost =
    (tokens.input * pricing.input) / 1_000_000 +
    (tokens.output * pricing.output) / 1_000_000 +
    (tokens.cacheRead * pricing.cacheRead) / 1_000_000 +
    (tokens.cacheCreation * pricing.cacheCreation) / 1_000_000;
  return cost;
}

/**
 * Get pricing for a model. Returns null if unknown.
 */
export function getModelPricing(model: string): ModelPricing | null {
  const key = resolveModelKey(model);
  if (!key) return null;
  return PRICING_TABLE[key];
}
