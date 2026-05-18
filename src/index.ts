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

export type { DepthHandlers, DepthLevel, DepthSnapshot, DepthUpdate } from './sockets/depth.js';
export type {
  SnapshotPayload,
  SnapshotsByPair,
  SnapshotsHandlers,
} from './sockets/snapshots.js';

// Intentionally not exported: KinesisWithdrawalClient.
// Available only at './withdrawal' as a structural safety boundary.
