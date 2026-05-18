import type { SocketClient, SocketSubscription } from '../transport/socket.js';

export interface DepthLevel {
  price: number | string;
  volume: number | string;
}

export interface DepthSnapshot {
  symbolId: string;
  depth: { bid: DepthLevel[]; ask: DepthLevel[] };
}

export interface DepthUpdate {
  symbolId: string;
  direction: 'bid' | 'ask';
  depth: { bid: DepthLevel[]; ask: DepthLevel[] };
}

export interface DepthHandlers {
  onInit?: (snapshots: DepthSnapshot[]) => void;
  onChange?: (update: DepthUpdate) => void;
  onError?: (err: Error) => void;
  onReconnect?: () => void;
}

export function subscribeDepth(
  client: SocketClient,
  pairIds: string[],
  handlers: DepthHandlers,
): SocketSubscription {
  return client.open<DepthSnapshot[], DepthUpdate>(
    {
      namespace: '/depth',
      initEvent: 'init',
      changeEvent: 'change',
      subscribe: { event: 'subscribe', payload: { pairs: pairIds } },
    },
    handlers,
  );
}
