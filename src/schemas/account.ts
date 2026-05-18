import { z } from 'zod';

const numeric = z.union([z.string(), z.number()]);

export const HoldingSchema = z
  .object({
    currencyCode: z.string().optional(),
    balance: numeric.optional(),
    available: numeric.optional(),
    locked: numeric.optional(),
  })
  .passthrough();

export const HoldingsResponseSchema = z.array(HoldingSchema);

export const StatementSchema = z.object({}).passthrough();

export type Holding = z.infer<typeof HoldingSchema>;
export type Statement = z.infer<typeof StatementSchema>;
