export { KinesisExchangeClient, type KinesisExchangeClientOptions } from './client.js';

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
  MidPriceHandlers,
  MidPriceSnapshot,
  MidPriceUpdate,
} from './sockets/mid-price.js';
export type { SnapshotUpdate, SnapshotsHandlers } from './sockets/snapshots.js';

// Intentionally not exported: KinesisWithdrawalClient.
// Available only at './withdrawal' as a structural safety boundary.
