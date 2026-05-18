import { type ManagerOptions, type Socket, type SocketOptions, io } from 'socket.io-client';
import { buildAuthHeaders } from '../auth.js';

export interface SocketClientOptions {
  publicKey: string;
  privateKey: string;
  baseUrl: string;
  /** Override the io() factory for testing. */
  ioFactory?: (url: string, opts: Partial<ManagerOptions & SocketOptions>) => Socket;
}

export interface SocketHandlers<TInit, TChange> {
  onInit?: (data: TInit) => void;
  onChange?: (data: TChange) => void;
  onError?: (err: Error) => void;
  onReconnect?: () => void;
}

export interface SocketSubscription {
  close(): void;
  /** Last init or change payload received — useful for "what is the latest depth for X" queries. */
  readonly latest: unknown;
}

export interface OpenSocketArgs {
  /** socket.io namespace, e.g. '/depth'. */
  namespace: string;
  /** Event name emitted by server with initial snapshot. */
  initEvent: string;
  /** Event name emitted by server with delta updates. */
  changeEvent: string;
  /** Optional event to emit on connect to subscribe to specific pairs. */
  subscribe?: { event: string; payload: unknown };
}

export class SocketClient {
  constructor(private readonly opts: SocketClientOptions) {}

  open<TInit, TChange>(
    args: OpenSocketArgs,
    handlers: SocketHandlers<TInit, TChange>,
  ): SocketSubscription {
    const headers = buildAuthHeaders({
      publicKey: this.opts.publicKey,
      privateKey: this.opts.privateKey,
      method: 'GET',
      path: args.namespace,
    });

    const headerRecord = headers as unknown as Record<string, string>;
    const ioOpts: Partial<ManagerOptions & SocketOptions> = {
      transports: ['websocket'],
      extraHeaders: headerRecord,
      auth: headerRecord,
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5_000,
    };

    const factory = this.opts.ioFactory ?? io;
    const socket: Socket = factory(`${this.opts.baseUrl}${args.namespace}`, ioOpts);

    let latest: unknown = undefined;
    let everConnected = false;

    socket.on('connect', () => {
      if (everConnected) handlers.onReconnect?.();
      everConnected = true;
      if (args.subscribe) {
        socket.emit(args.subscribe.event, args.subscribe.payload);
      }
    });

    socket.on(args.initEvent, (data: TInit) => {
      latest = data;
      handlers.onInit?.(data);
    });

    socket.on(args.changeEvent, (data: TChange) => {
      latest = data;
      handlers.onChange?.(data);
    });

    socket.on('connect_error', (err: Error) => handlers.onError?.(err));
    socket.on('error', (err: Error) => handlers.onError?.(err));

    return {
      close: () => {
        socket.disconnect();
      },
      get latest() {
        return latest;
      },
    };
  }
}
