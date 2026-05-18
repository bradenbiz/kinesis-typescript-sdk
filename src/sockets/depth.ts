import type { SocketClient, SocketSubscription } from '../transport/socket.js';

export interface DepthLevel {
  price: number;
  amount: number;
  /** Amount of this level owned by the authenticated user. 0 for unauthenticated. */
  ownedAmount?: number;
}

export interface DepthSnapshot {
  symbolId: string;
  bid: DepthLevel[];
  ask: DepthLevel[];
}

export interface DepthUpdate {
  symbolId: string;
  direction: 'bid' | 'ask';
  /** Full ladder for this side after the change. */
  depth: DepthLevel[];
}

export interface DepthHandlers {
  /** Fired once after connect with the current full state for the subscribed pair. */
  onInit?: (snapshots: DepthSnapshot[]) => void;
  /** Fired on each subsequent change to one side of the book. */
  onChange?: (update: DepthUpdate) => void;
  onError?: (err: Error) => void;
  onReconnect?: () => void;
}

/**
 * Subscribe to live order-book updates for a single pair.
 *
 * Subscription is via query param — the server returns updates only for the
 * requested symbolId. Reconnect automatically resubscribes (the URL is the
 * same on reconnect).
 */
export function subscribeDepth(
  client: SocketClient,
  symbolId: string,
  handlers: DepthHandlers,
): SocketSubscription {
  return client.open<DepthSnapshot[], DepthUpdate>(
    {
      path: '/notifications/market-data/v2/depth/',
      query: { symbolId },
    },
    handlers,
  );
}
