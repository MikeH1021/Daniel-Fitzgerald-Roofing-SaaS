export type Bindings = {
  DB: D1Database;
  RESEND_API_KEY: string;
  RESEND_FROM_EMAIL: string;
  ESTIMATE_RATE_LIMITER?: RateLimit;
  LOGIN_RATE_LIMITER?: RateLimit;
  LOGOS_BUCKET: R2Bucket;
  API_BASE_URL?: string;
  GOOGLE_MAPS_API_KEY?: string;
  CLI_SECRET?: string;
  __STATIC_CONTENT: KVNamespace;
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
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  consent?: boolean;
}
