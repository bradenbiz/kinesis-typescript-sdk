import { z } from 'zod';

// Schemas are intentionally lenient (.passthrough()) — Kinesis can extend response
// shapes at any time per the API License Agreement §5. We type the documented core
// fields and pass unknown fields through to the caller.

const numeric = z.union([z.string(), z.number()]);

export const PairSchema = z
  .object({
    id: z.string(),
    baseCurrency: z.string().optional(),
    quoteCurrency: z.string().optional(),
  })
  .passthrough();

export const DepthLevelSchema = z
  .object({
    price: numeric,
    volume: numeric,
  })
  .passthrough();

export const DepthSchema = z
  .object({
    bid: z.array(DepthLevelSchema).optional(),
    ask: z.array(DepthLevelSchema).optional(),
  })
  .passthrough();

export const MidPriceSchema = z
  .object({
    symbolId: z.string().optional(),
    latestMidPrice: numeric.optional(),
  })
  .passthrough();

export const SnapshotSchema = z
  .object({
    symbolId: z.string().optional(),
  })
  .passthrough();

export const OHLCEntrySchema = z
  .object({
    time: numeric.optional(),
    open: numeric.optional(),
    high: numeric.optional(),
    low: numeric.optional(),
    close: numeric.optional(),
    volume: numeric.optional(),
  })
  .passthrough();

export const PairsResponseSchema = z.array(PairSchema);
export const SnapshotsResponseSchema = z.array(SnapshotSchema);
export const OHLCResponseSchema = z.array(OHLCEntrySchema);

export type Pair = z.infer<typeof PairSchema>;
export type DepthLevel = z.infer<typeof DepthLevelSchema>;
export type Depth = z.infer<typeof DepthSchema>;
export type MidPrice = z.infer<typeof MidPriceSchema>;
export type Snapshot = z.infer<typeof SnapshotSchema>;
export type OHLCEntry = z.infer<typeof OHLCEntrySchema>;
