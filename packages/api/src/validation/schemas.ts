import { z } from 'zod';

export const estimateRequestSchema = z
  .object({
    sqft: z.number().min(100).max(10000),
    pitch: z.enum(['flat', 'low', 'medium', 'steep']),
    material: z.enum(['3-tab', 'architectural', 'standing-seam-metal']),
    companyId: z.string().min(1),
    firstName: z.string().min(1).max(100).optional(),
    lastName: z.string().min(1).max(100).optional(),
    email: z.string().email().optional(),
    phone: z.string().min(7).max(20).optional(),
    consent: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    const contactFields = [data.firstName, data.lastName, data.email, data.phone];
    const hasAny = contactFields.some((f) => f !== undefined);
    if (hasAny) {
      const allPresent = contactFields.every((f) => f !== undefined);
      if (!allPresent || data.consent !== true) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'All contact fields (firstName, lastName, email, phone) and consent=true are required when submitting lead information.',
        });
      }
    }
  });

export type EstimateRequest = z.infer<typeof estimateRequestSchema>;
