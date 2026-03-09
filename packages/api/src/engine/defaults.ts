import type { PricingConfig } from '../types';

export const DEFAULT_MATERIALS: PricingConfig['materials'] = {
  '3-tab': { costLow: 3.50, costHigh: 4.75 },
  'architectural': { costLow: 4.00, costHigh: 5.75 },
  'standing-seam-metal': { costLow: 12.00, costHigh: 18.00 },
};

export const DEFAULT_PITCH_MULTIPLIERS: PricingConfig['pitchMultipliers'] = {
  flat: 1.00,
  low: 1.05,
  medium: 1.12,
  steep: 1.25,
};

// v1: complexity is 1.0 (no user selection). EST-07 complexity selection is v2.
// The formula still multiplies by this value for future-proofing.
export const DEFAULT_COMPLEXITY_MULTIPLIER = 1.0;
