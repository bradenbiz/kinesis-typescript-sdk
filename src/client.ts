import { KinesisRestClient, type KinesisRestClientOptions } from './rest.js';
import { type DepthHandlers, subscribeDepth } from './sockets/depth.js';
import { type SnapshotsHandlers, subscribeSnapshots } from './sockets/snapshots.js';
import { SocketClient, type SocketSubscription } from './transport/socket.js';

export type KinesisExchangeClientOptions = KinesisRestClientOptions;

/**
 * Full SDK client: REST + socket.io subscriptions. If you don't need sockets,
 * import `KinesisRestClient` from `kinesis-exchange-sdk/rest` to avoid pulling
 * socket.io-client into your bundle.
 */
export class KinesisExchangeClient extends KinesisRestClient {
  readonly sockets: {
    subscribeDepth(symbolId: string, handlers: DepthHandlers): SocketSubscription;
    subscribeSnapshots(handlers: SnapshotsHandlers): SocketSubscription;
  };

  constructor(opts: KinesisExchangeClientOptions) {
    super(opts);
    // Sockets live on the public market-data host with no auth.
    const sockets = new SocketClient({ baseUrl: this.marketDataBaseUrl });
    this.sockets = {
      subscribeDepth: (symbolId, handlers) => subscribeDepth(sockets, symbolId, handlers),
      subscribeSnapshots: (handlers) => subscribeSnapshots(sockets, handlers),
    };
  }
}
