import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { eq } from 'drizzle-orm';
import { estimateRequestSchema } from '../validation/schemas';
import { calculateEstimate } from '../engine/calculate';
import {
  DEFAULT_MATERIALS,
  DEFAULT_PITCH_MULTIPLIERS,
  DEFAULT_COMPLEXITY_MULTIPLIER,
} from '../engine/defaults';
import { createDb } from '../db';
import { pricingOverrides } from '../db/schema';
import type { Bindings, PricingConfig } from '../types';

const estimates = new Hono<{ Bindings: Bindings }>();

estimates.post(
  '/',
  zValidator('json', estimateRequestSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          error: 'Invalid input',
          details: result.error.issues.map((i) => ({
            field: i.path.join('.'),
            message: i.message,
          })),
        },
        400
      );
    }
  }),
  async (c) => {
    const { sqft, pitch, material, companyId } = c.req.valid('json');

    // Build pricing config starting from defaults
    const config: PricingConfig = {
      materials: { ...DEFAULT_MATERIALS },
      pitchMultipliers: { ...DEFAULT_PITCH_MULTIPLIERS },
      complexityMultiplier: DEFAULT_COMPLEXITY_MULTIPLIER,
    };

    // Look up company overrides from D1
    const db = createDb(c.env.DB);
    const overrides = await db
      .select()
      .from(pricingOverrides)
      .where(eq(pricingOverrides.companyId, companyId));

    // Apply overrides: replace matching material costs and pitch multipliers
    for (const override of overrides) {
      if (override.materialKey && config.materials[override.materialKey]) {
        if (override.costLow != null) {
          config.materials[override.materialKey] = {
            ...config.materials[override.materialKey],
            costLow: override.costLow,
          };
        }
        if (override.costHigh != null) {
          config.materials[override.materialKey] = {
            ...config.materials[override.materialKey],
            costHigh: override.costHigh,
          };
        }
      }
      if (override.pitchFlat != null) config.pitchMultipliers.flat = override.pitchFlat;
      if (override.pitchLow != null) config.pitchMultipliers.low = override.pitchLow;
      if (override.pitchMedium != null) config.pitchMultipliers.medium = override.pitchMedium;
      if (override.pitchSteep != null) config.pitchMultipliers.steep = override.pitchSteep;
    }

    const result = calculateEstimate(sqft, pitch, material, config);

    return c.json({
      ...result,
      configSource: overrides.length > 0 ? 'company' : 'default',
    });
  }
);

export { estimates };
