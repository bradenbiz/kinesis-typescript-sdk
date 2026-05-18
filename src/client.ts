import { AccountAPI } from './endpoints/account.js';
import { MarketAPI } from './endpoints/market.js';
import { OrdersAPI } from './endpoints/orders.js';
import { type DepthHandlers, subscribeDepth } from './sockets/depth.js';
import { type SnapshotsHandlers, subscribeSnapshots } from './sockets/snapshots.js';
import { HttpClient } from './transport/http.js';
import { SocketClient, type SocketSubscription } from './transport/socket.js';

const DEFAULT_BASE_URL = 'https://client-api.kinesis.money';
const DEFAULT_MARKET_DATA_BASE_URL = 'https://fastapi.kinesis.money';

export interface KinesisExchangeClientOptions {
  publicKey: string;
  privateKey: string;
  /** Base URL for HMAC-authenticated trading/account endpoints. */
  baseUrl?: string;
  /** Base URL for unauthenticated public market-data endpoints (snapshots, OHLC). */
  marketDataBaseUrl?: string;
  timeout?: number;
  retries?: number;
  /** Override fetch (for testing or non-Node environments). */
  fetch?: typeof fetch;
}

export class KinesisExchangeClient {
  readonly market: MarketAPI;
  readonly account: AccountAPI;
  readonly orders: OrdersAPI;
  readonly sockets: {
    subscribeDepth(symbolId: string, handlers: DepthHandlers): SocketSubscription;
    subscribeSnapshots(handlers: SnapshotsHandlers): SocketSubscription;
  };

  constructor(opts: KinesisExchangeClientOptions) {
    const baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
    const marketDataBaseUrl = opts.marketDataBaseUrl ?? DEFAULT_MARKET_DATA_BASE_URL;
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
      // No keys — market-data endpoints are public.
      baseUrl: marketDataBaseUrl,
      timeout,
      retries,
      fetch: opts.fetch,
    });
    // Sockets live on the same public market-data host as the unauthenticated
    // REST endpoints — no HMAC keys passed here.
    const sockets = new SocketClient({ baseUrl: marketDataBaseUrl });

    this.market = new MarketAPI(http, marketDataHttp);
    this.account = new AccountAPI(http);
    this.orders = new OrdersAPI(http);
    this.sockets = {
      subscribeDepth: (symbolId, handlers) => subscribeDepth(sockets, symbolId, handlers),
      subscribeSnapshots: (handlers) => subscribeSnapshots(sockets, handlers),
    };
  }
}
