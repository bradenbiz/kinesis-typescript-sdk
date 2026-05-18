import type { SocketClient, SocketSubscription } from '../transport/socket.js';

export interface SnapshotUpdate {
  symbolId: string;
  [k: string]: unknown;
}

export interface SnapshotsHandlers {
  onInit?: (snapshots: SnapshotUpdate[]) => void;
  onChange?: (update: SnapshotUpdate) => void;
  onError?: (err: Error) => void;
  onReconnect?: () => void;
}

export function subscribeSnapshots(
  client: SocketClient,
  handlers: SnapshotsHandlers,
): SocketSubscription {
  return client.open<SnapshotUpdate[], SnapshotUpdate>(
    {
      namespace: '/snapshots',
      initEvent: 'init',
      changeEvent: 'change',
    },
    handlers,
  );
}
