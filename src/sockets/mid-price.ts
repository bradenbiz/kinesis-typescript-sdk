import type { SocketClient, SocketSubscription } from '../transport/socket.js';

export interface MidPriceSnapshot {
  symbolId: string;
  latestMidPrice: number | string;
}

export interface MidPriceUpdate {
  symbolId: string;
  latestMidPrice: number | string;
}

export interface MidPriceHandlers {
  onInit?: (snapshots: MidPriceSnapshot[]) => void;
  onChange?: (update: MidPriceUpdate) => void;
  onError?: (err: Error) => void;
  onReconnect?: () => void;
}

export function subscribeMidPrice(
  client: SocketClient,
  pairIds: string[],
  handlers: MidPriceHandlers,
): SocketSubscription {
  return client.open<MidPriceSnapshot[], MidPriceUpdate>(
    {
      namespace: '/mid-price',
      initEvent: 'init',
      changeEvent: 'change',
      subscribe: { event: 'subscribe', payload: { pairs: pairIds } },
    },
    handlers,
  );
}
