/**
 * Default configuration values.
 */

export type NotifyMethod = 'terminal' | 'desktop' | 'both';
export type PlanType = 'max' | 'api';

export interface ThresholdConfig {
  percent: number;
  notify: NotifyMethod;
}

export interface Config {
  budget: {
    mode: 'cost';
    plan: PlanType;
    sessionBudget: number;
  };
  thresholds: ThresholdConfig[];
  notifications: {
    desktop: boolean;
    terminal: boolean;
    sound: boolean;
  };
}

export const DEFAULT_CONFIG: Config = {
  budget: {
    mode: 'cost',
    plan: 'max',
    sessionBudget: 5.0,
  },
  thresholds: [
    { percent: 50, notify: 'terminal' },
    { percent: 80, notify: 'both' },
    { percent: 90, notify: 'both' },
  ],
  notifications: {
    desktop: true,
    terminal: true,
    sound: false,
  },
};
