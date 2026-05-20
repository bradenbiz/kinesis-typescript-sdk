export { KinesisExchangeClient, type KinesisExchangeClientOptions } from './client.js';
export { KinesisRestClient, type KinesisRestClientOptions } from './rest.js';

export * as marketUtils from './utils/market.js';
export { pickMidPrice, toNumber } from './utils/market.js';

export {
  AuthError,
  InsufficientFundsError,
  KinesisAPIError,
  PriceValidationError,
  RateLimitError,
  SchemaMismatchError,
} from './errors.js';

export type {
  BuyInput,
  OrderDirection,
  OrderType,
  PlaceOrderInput,
  SellInput,
} from './endpoints/orders.js';
export type { OHLCTimeFrame } from './endpoints/market.js';

// REST response types. Note that DepthLevel here means the REST-shape variant
// (carries `createdAt`). The socket variant — with `ownedAmount` — is named
// `DepthLevel` inside `sockets/depth.ts` and is re-exported below alongside
// the other socket types; to avoid collision, the schema DepthLevel is NOT
// re-exported from this entry. If you need it, deep-import from
// `kinesis-exchange-sdk/rest`.
export type {
  Depth,
  MidPrice,
  OHLCEntry,
  OHLCResponse,
  Pair,
  Snapshot,
} from './schemas/market.js';
export type { Holding, Holdings, Statement } from './schemas/account.js';
export type { Amendment, Order } from './schemas/orders.js';

export type { DepthHandlers, DepthLevel, DepthSnapshot, DepthUpdate } from './sockets/depth.js';
export type {
  SnapshotPayload,
  SnapshotsByPair,
  SnapshotsHandlers,
} from './sockets/snapshots.js';

// Intentionally not exported: KinesisWithdrawalClient.
// Available only at './withdrawal' as a structural safety boundary.
