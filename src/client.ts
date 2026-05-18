import { AccountAPI } from './endpoints/account.js';
import { MarketAPI } from './endpoints/market.js';
import { OrdersAPI } from './endpoints/orders.js';
import { type DepthHandlers, subscribeDepth } from './sockets/depth.js';
import { type MidPriceHandlers, subscribeMidPrice } from './sockets/mid-price.js';
import { type SnapshotsHandlers, subscribeSnapshots } from './sockets/snapshots.js';
import { HttpClient } from './transport/http.js';
import { SocketClient, type SocketSubscription } from './transport/socket.js';

const DEFAULT_BASE_URL = 'https://client-api.kinesis.money';

export interface KinesisExchangeClientOptions {
  publicKey: string;
  privateKey: string;
  baseUrl?: string;
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
    subscribeDepth(pairIds: string[], handlers: DepthHandlers): SocketSubscription;
    subscribeMidPrice(pairIds: string[], handlers: MidPriceHandlers): SocketSubscription;
    subscribeSnapshots(handlers: SnapshotsHandlers): SocketSubscription;
  };

  constructor(opts: KinesisExchangeClientOptions) {
    const baseUrl = opts.baseUrl ?? DEFAULT_BASE_URL;
    const http = new HttpClient({
      publicKey: opts.publicKey,
      privateKey: opts.privateKey,
      baseUrl,
      timeout: opts.timeout ?? 10_000,
      retries: opts.retries ?? 3,
      fetch: opts.fetch,
    });
    const sockets = new SocketClient({
      publicKey: opts.publicKey,
      privateKey: opts.privateKey,
      baseUrl,
    });

    this.market = new MarketAPI(http);
    this.account = new AccountAPI(http);
    this.orders = new OrdersAPI(http);
    this.sockets = {
      subscribeDepth: (pairIds, handlers) => subscribeDepth(sockets, pairIds, handlers),
      subscribeMidPrice: (pairIds, handlers) => subscribeMidPrice(sockets, pairIds, handlers),
      subscribeSnapshots: (handlers) => subscribeSnapshots(sockets, handlers),
    };
  }
}
