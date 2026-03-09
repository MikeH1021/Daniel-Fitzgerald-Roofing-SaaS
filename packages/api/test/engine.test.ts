import { describe, it, expect } from 'vitest';
import { calculateEstimate } from '../src/engine/calculate';
import {
  DEFAULT_MATERIALS,
  DEFAULT_PITCH_MULTIPLIERS,
  DEFAULT_COMPLEXITY_MULTIPLIER,
} from '../src/engine/defaults';
import type { PricingConfig } from '../src/types';

const defaultConfig: PricingConfig = {
  materials: { ...DEFAULT_MATERIALS },
  pitchMultipliers: { ...DEFAULT_PITCH_MULTIPLIERS },
  complexityMultiplier: DEFAULT_COMPLEXITY_MULTIPLIER,
};

describe('calculateEstimate', () => {
  it('calculates correct range for 1800 sqft, medium pitch, architectural shingles', () => {
    // 1800 * 1.12 * 1.0 * 4.00 = 8064 -> 8100
    // 1800 * 1.12 * 1.0 * 5.75 = 11592 -> 11600
    const result = calculateEstimate(1800, 'medium', 'architectural', defaultConfig);
    expect(result.estimateLow).toBe(8100);
    expect(result.estimateHigh).toBe(11600);
  });

  it('calculates correct range for 1000 sqft, flat pitch, architectural shingles', () => {
    // 1000 * 1.00 * 1.0 * 4.00 = 4000 -> 4000
    // 1000 * 1.00 * 1.0 * 5.75 = 5750 -> 5800
    const result = calculateEstimate(1000, 'flat', 'architectural', defaultConfig);
    expect(result.estimateLow).toBe(4000);
    expect(result.estimateHigh).toBe(5800);
  });

  it('rounds values ending in exactly X50 up to next $100', () => {
    // Need a config that produces exactly X50
    // 1000 * 1.00 * 1.0 * 5.75 = 5750 -> Math.round(57.5) * 100 = 5800
    const result = calculateEstimate(1000, 'flat', 'architectural', defaultConfig);
    expect(result.estimateHigh).toBe(5800);
  });

  it('produces different ranges for each material type (3-tab cheapest, metal most expensive)', () => {
    const threeTab = calculateEstimate(2000, 'medium', '3-tab', defaultConfig);
    const architectural = calculateEstimate(2000, 'medium', 'architectural', defaultConfig);
    const metal = calculateEstimate(2000, 'medium', 'standing-seam-metal', defaultConfig);

    // 3-tab should be cheapest
    expect(threeTab.estimateLow).toBeLessThan(architectural.estimateLow);
    expect(architectural.estimateLow).toBeLessThan(metal.estimateLow);

    // Same for high end
    expect(threeTab.estimateHigh).toBeLessThan(architectural.estimateHigh);
    expect(architectural.estimateHigh).toBeLessThan(metal.estimateHigh);
  });

  it('steep pitch produces higher estimate than flat pitch', () => {
    const flat = calculateEstimate(2000, 'flat', 'architectural', defaultConfig);
    const steep = calculateEstimate(2000, 'steep', 'architectural', defaultConfig);

    expect(steep.estimateLow).toBeGreaterThan(flat.estimateLow);
    expect(steep.estimateHigh).toBeGreaterThan(flat.estimateHigh);
  });

  it('disclaimer contains "estimate only"', () => {
    const result = calculateEstimate(1000, 'flat', 'architectural', defaultConfig);
    expect(result.disclaimer.toLowerCase()).toContain('estimate only');
  });

  it('uses custom PricingConfig overrides instead of defaults', () => {
    const customConfig: PricingConfig = {
      materials: {
        'architectural': { costLow: 6.00, costHigh: 8.00 },
      },
      pitchMultipliers: { flat: 1.00, low: 1.05, medium: 1.20, steep: 1.30 },
      complexityMultiplier: 1.0,
    };

    const defaultResult = calculateEstimate(1000, 'medium', 'architectural', defaultConfig);
    const customResult = calculateEstimate(1000, 'medium', 'architectural', customConfig);

    // Custom has higher costs so result should be higher
    expect(customResult.estimateLow).toBeGreaterThan(defaultResult.estimateLow);
    expect(customResult.estimateHigh).toBeGreaterThan(defaultResult.estimateHigh);

    // Verify exact values: 1000 * 1.20 * 1.0 * 6.00 = 7200
    // 1000 * 1.20 * 1.0 * 8.00 = 9600
    expect(customResult.estimateLow).toBe(7200);
    expect(customResult.estimateHigh).toBe(9600);
  });
});
