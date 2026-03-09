import type { PricingConfig, EstimateResult } from '../types';

export function calculateEstimate(
  sqft: number,
  pitch: string,
  material: string,
  config: PricingConfig
): EstimateResult {
  const materialCost = config.materials[material];
  const pitchMult = config.pitchMultipliers[pitch];
  const complexityMult = config.complexityMultiplier;

  const rawLow = sqft * pitchMult * complexityMult * materialCost.costLow;
  const rawHigh = sqft * pitchMult * complexityMult * materialCost.costHigh;

  return {
    estimateLow: Math.round(rawLow / 100) * 100,
    estimateHigh: Math.round(rawHigh / 100) * 100,
    disclaimer: 'This is an estimate only. Final pricing requires an on-site inspection.',
  };
}
