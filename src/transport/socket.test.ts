import { EventEmitter } from 'node:events';
import type { Socket } from 'socket.io-client';
import { describe, expect, it, vi } from 'vitest';
import { callArgs } from '../test-utils.js';
import { SocketClient } from './socket.js';

class FakeSocket extends EventEmitter {
  emitted: Array<{ event: string; payload: unknown }> = [];
  disconnected = false;

  override emit(event: string, ...args: unknown[]): boolean {
    this.emitted.push({ event, payload: args[0] });
    return super.emit(event, ...args);
  }

  disconnect() {
    this.disconnected = true;
    return this;
  }
}

type IoFactory = NonNullable<ConstructorParameters<typeof SocketClient>[0]['ioFactory']>;

function makeClient(factory: IoFactory) {
  return new SocketClient({
    publicKey: 'pub',
    privateKey: 'priv',
    baseUrl: 'wss://example.test',
    ioFactory: factory,
  });
}

describe('SocketClient', () => {
  it('signs the connection handshake with HMAC headers', () => {
    const factory = vi.fn<IoFactory>(() => new FakeSocket() as unknown as Socket);
    const client = makeClient(factory);
    client.open({ namespace: '/depth', initEvent: 'init', changeEvent: 'change' }, {});
    const [url, opts] = callArgs(factory);
    expect(url).toBe('wss://example.test/depth');
    const headers = opts.extraHeaders as Record<string, string>;
    expect(headers['X-API-Key']).toBe('pub');
    expect(headers['X-Signature']).toMatch(/^[0-9A-F]{64}$/);
  });

  it('emits subscribe event after first connect', () => {
    const fake = new FakeSocket();
    const client = makeClient(() => fake as unknown as Socket);
    client.open(
      {
        namespace: '/depth',
        initEvent: 'init',
        changeEvent: 'change',
        subscribe: { event: 'subscribe', payload: { pairs: ['KAU_USD'] } },
      },
      {},
    );
    fake.emit('connect');
    const sub = fake.emitted.find((e) => e.event === 'subscribe');
    expect(sub?.payload).toEqual({ pairs: ['KAU_USD'] });
  });

  it('calls onReconnect only on subsequent connects', () => {
    const fake = new FakeSocket();
    const client = makeClient(() => fake as unknown as Socket);
    const onReconnect = vi.fn();
    client.open({ namespace: '/depth', initEvent: 'init', changeEvent: 'change' }, { onReconnect });
    fake.emit('connect'); // initial
    expect(onReconnect).not.toHaveBeenCalled();
    fake.emit('connect'); // reconnect
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('caches latest payload from init and change events', () => {
    const fake = new FakeSocket();
    const client = makeClient(() => fake as unknown as Socket);
    const sub = client.open({ namespace: '/depth', initEvent: 'init', changeEvent: 'change' }, {});
    fake.emit('init', { snapshot: 'first' });
    expect(sub.latest).toEqual({ snapshot: 'first' });
    fake.emit('change', { delta: 'second' });
    expect(sub.latest).toEqual({ delta: 'second' });
  });

  it('close() disconnects the underlying socket', () => {
    const fake = new FakeSocket();
    const client = makeClient(() => fake as unknown as Socket);
    const sub = client.open({ namespace: '/depth', initEvent: 'init', changeEvent: 'change' }, {});
    sub.close();
    expect(fake.disconnected).toBe(true);
  });
});
