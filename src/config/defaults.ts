/**
 * Default configuration values.
 */

export type NotifyMethod = 'terminal' | 'desktop' | 'both';
export type WeekDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

export const VALID_WEEK_DAYS: WeekDay[] = [
  'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday',
];

export interface ThresholdConfig {
  percent: number;
  notify: NotifyMethod;
}

export interface Config {
  budget: {
    mode: 'cost';
    sessionBudget: number;
    weeklyBudget: number;
    weeklyResetDay: WeekDay;
    weeklyResetHour: number;
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
    sessionBudget: 5.0,
    weeklyBudget: 50.0,
    weeklyResetDay: 'monday',
    weeklyResetHour: 0,
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
