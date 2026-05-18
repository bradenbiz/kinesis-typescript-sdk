import { type ManagerOptions, type Socket, type SocketOptions, io } from 'socket.io-client';
import { buildAuthHeaders } from '../auth.js';

export interface SocketClientOptions {
  /** HMAC keys are optional. Public market-data sockets need no auth. */
  publicKey?: string;
  privateKey?: string;
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
  /** Last init or change payload received — for "what is the latest X" queries. */
  readonly latest: unknown;
}

export interface OpenSocketArgs {
  /** socket.io `path` option, e.g. '/notifications/market-data/v2/depth/'. */
  path: string;
  /** Query parameters appended to the handshake URL (e.g. { symbolId: 'KAU_C1USD' }). */
  query?: Record<string, string>;
  /** Server-emitted event name carrying the initial snapshot. Defaults to 'onInit'. */
  initEvent?: string;
  /** Server-emitted event name carrying delta updates. Defaults to 'onChange'. */
  changeEvent?: string;
}

export class SocketClient {
  constructor(private readonly opts: SocketClientOptions) {}

  open<TInit, TChange>(
    args: OpenSocketArgs,
    handlers: SocketHandlers<TInit, TChange>,
  ): SocketSubscription {
    const initEvent = args.initEvent ?? 'onInit';
    const changeEvent = args.changeEvent ?? 'onChange';

    const ioOpts: Partial<ManagerOptions & SocketOptions> = {
      path: args.path,
      query: args.query,
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 500,
      reconnectionDelayMax: 5_000,
    };

    // Only attach auth headers when keys are configured. Public market-data
    // sockets are unauthenticated; attaching dummy headers can cause some
    // servers to reject the handshake.
    if (this.opts.publicKey && this.opts.privateKey) {
      const headers = buildAuthHeaders({
        publicKey: this.opts.publicKey,
        privateKey: this.opts.privateKey,
        method: 'GET',
        path: args.path,
      }) as unknown as Record<string, string>;
      ioOpts.extraHeaders = headers;
      ioOpts.auth = headers;
    }

    const factory = this.opts.ioFactory ?? io;
    const socket: Socket = factory(this.opts.baseUrl, ioOpts);

    let latest: unknown = undefined;
    let everConnected = false;

    socket.on('connect', () => {
      if (everConnected) handlers.onReconnect?.();
      everConnected = true;
    });

    socket.on(initEvent, (data: TInit) => {
      latest = data;
      handlers.onInit?.(data);
    });

    socket.on(changeEvent, (data: TChange) => {
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
