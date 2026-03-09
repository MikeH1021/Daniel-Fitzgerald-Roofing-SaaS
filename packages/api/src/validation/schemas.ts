import { z } from 'zod';

export const estimateRequestSchema = z.object({
  sqft: z.number().min(100).max(10000),
  pitch: z.enum(['flat', 'low', 'medium', 'steep']),
  material: z.enum(['3-tab', 'architectural', 'standing-seam-metal']),
  companyId: z.string().min(1),
});

export type EstimateRequest = z.infer<typeof estimateRequestSchema>;
