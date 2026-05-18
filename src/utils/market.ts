// Numeric normalization for market-data fields.
//
// Schemas are intentionally lenient: numeric fields can come back as `string`
// or `number` (or be absent), because the Kinesis API has been observed to
// switch representation without notice. Rather than every consumer rewriting
// the same `String(v)` + `Number(raw)` + `Number.isFinite()` dance, the SDK
// owns these helpers.

interface PriceFields {
  latestMidPrice?: number | string | null;
  bidPrice?: number | string | null;
  askPrice?: number | string | null;
}

/**
 * Coerce a numeric-or-string value to a finite number.
 * Returns undefined for null, undefined, empty string, NaN, or non-finite values.
 */
export function toNumber(value: number | string | undefined | null): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Resolve the current mid price for a pair from a snapshot. Prefers
 * `latestMidPrice`; falls back to (bidPrice + askPrice) / 2 if mid is absent
 * but both sides of the book are present. Returns undefined when no usable
 * price can be derived.
 *
 * Accepts both REST snapshots (`Snapshot`) and socket snapshot payloads
 * (`SnapshotPayload`) — anything with the price-field subset.
 */
export function pickMidPrice(snapshot: PriceFields | undefined | null): number | undefined {
  if (!snapshot) return undefined;
  const mid = toNumber(snapshot.latestMidPrice);
  if (mid !== undefined) return mid;
  const bid = toNumber(snapshot.bidPrice);
  const ask = toNumber(snapshot.askPrice);
  if (bid !== undefined && ask !== undefined) return (bid + ask) / 2;
  return undefined;
}
