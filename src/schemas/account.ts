import { z } from 'zod';

const numeric = z.union([z.string(), z.number()]);

// Holdings on the live API are a map keyed by currency code, not an array.
// Each value carries available + on-exchange (locked-in-orders) balance.
export const HoldingSchema = z
  .object({
    available: numeric,
    allocatedOnExchange: numeric,
  })
  .passthrough();

export const HoldingsResponseSchema = z.record(z.string(), HoldingSchema);

export const StatementSchema = z.object({}).passthrough();

export type Holding = z.infer<typeof HoldingSchema>;
export type Holdings = z.infer<typeof HoldingsResponseSchema>;
export type Statement = z.infer<typeof StatementSchema>;
