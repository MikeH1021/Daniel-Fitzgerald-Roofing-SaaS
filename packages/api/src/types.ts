export type Bindings = {
  DB: D1Database;
};

export interface PricingConfig {
  materials: Record<string, { costLow: number; costHigh: number }>;
  pitchMultipliers: Record<string, number>;
  complexityMultiplier: number;
}

export interface EstimateResult {
  estimateLow: number;
  estimateHigh: number;
  disclaimer: string;
}

export interface EstimateRequest {
  sqft: number;
  pitch: 'flat' | 'low' | 'medium' | 'steep';
  material: '3-tab' | 'architectural' | 'standing-seam-metal';
  companyId: string;
}
