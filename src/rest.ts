// REST-only entry point. Importing from `kinesis-exchange-sdk/rest` skips the
// socket.io-client dependency entirely (~50–100 KiB gzipped on Workers and
// other bundled environments). Use this when you only need polling/REST.
//
// Sockets are at the default entry: import { KinesisExchangeClient } from 'kinesis-exchange-sdk'.

import { AccountAPI } from './endpoints/account.js';
import { MarketAPI } from './endpoints/market.js';
import { OrdersAPI } from './endpoints/orders.js';
import { HttpClient } from './transport/http.js';

export const DEFAULT_BASE_URL = 'https://client-api.kinesis.money';
export const DEFAULT_MARKET_DATA_BASE_URL = 'https://fastapi.kinesis.money';

export interface KinesisRestClientOptions {
  /**
   * HMAC keys for authenticated endpoints (trading, orders, account, depth,
   * mid-price, pairs). Omit both for a public-only client (market-data only).
   */
  publicKey?: string;
  privateKey?: string;
  baseUrl?: string;
  marketDataBaseUrl?: string;
  timeout?: number;
  retries?: number;
  /** Override fetch (for testing or non-Node environments). */
  fetch?: typeof fetch;
}

export class KinesisRestClient {
  readonly market: MarketAPI;
  readonly account: AccountAPI;
  readonly orders: OrdersAPI;

  /** Resolved market-data host. Exposed so subclasses (e.g. KinesisExchangeClient) can attach sockets to it. */
  protected readonly marketDataBaseUrl: string;

  constructor(opts: KinesisRestClientOptions) {
    const baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
    this.marketDataBaseUrl = opts.marketDataBaseUrl ?? DEFAULT_MARKET_DATA_BASE_URL;
    const timeout = opts.timeout ?? 10_000;
    const retries = opts.retries ?? 3;

    const http = new HttpClient({
      publicKey: opts.publicKey,
      privateKey: opts.privateKey,
      baseUrl,
      timeout,
      retries,
      fetch: opts.fetch,
    });
    const marketDataHttp = new HttpClient({
      baseUrl: this.marketDataBaseUrl,
      timeout,
      retries,
      fetch: opts.fetch,
    });

    this.market = new MarketAPI(http, marketDataHttp);
    this.account = new AccountAPI(http);
    this.orders = new OrdersAPI(http);
  }
}

// Re-export the most commonly needed types alongside the class so users of the
// REST entry don't have to dig into deep subpaths.
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
export * as marketUtils from './utils/market.js';
export { pickMidPrice, toNumber } from './utils/market.js';
