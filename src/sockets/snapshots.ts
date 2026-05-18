import type { SocketClient, SocketSubscription } from '../transport/socket.js';

export interface SnapshotPayload {
  symbolId: string;
  latestMidPrice?: number;
  bidPrice?: number;
  askPrice?: number;
  dailyChange?: number;
  dailyVolume?: number;
  dailyVolumeUsd?: number;
  highestPrice?: number;
  lowestPrice?: number;
  marketCap?: number;
  coinsInCirculation?: number | string;
  [k: string]: unknown;
}

/** Snapshots come keyed by symbolId: { 'KAU_C1USD': {...}, 'KAG_C1USD': {...}, ... }. */
export type SnapshotsByPair = Record<string, SnapshotPayload>;

export interface SnapshotsHandlers {
  /** Fired once on connect with all snapshots. */
  onInit?: (all: SnapshotsByPair) => void;
  /** Fired on each subsequent update — typically a partial map with one pair. */
  onChange?: (delta: SnapshotsByPair) => void;
  onError?: (err: Error) => void;
  onReconnect?: () => void;
}

/**
 * Subscribe to live snapshot updates for all pairs at once. Includes mid price,
 * daily change/volume, high/low, and market cap. No per-pair subscription —
 * server pushes deltas for any pair that changes.
 *
 * If you want only mid-price updates for one pair, subscribe here and filter
 * in onChange — there is no separate mid-price socket on the live API.
 */
export function subscribeSnapshots(
  client: SocketClient,
  handlers: SnapshotsHandlers,
): SocketSubscription {
  return client.open<SnapshotsByPair, SnapshotsByPair>(
    { path: '/notifications/market-data/v2/snapshots/' },
    handlers,
  );
}
