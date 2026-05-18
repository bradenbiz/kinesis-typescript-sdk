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

function makeClient(factory: IoFactory, withAuth = false) {
  return new SocketClient({
    ...(withAuth ? { publicKey: 'pub', privateKey: 'priv' } : {}),
    baseUrl: 'wss://example.test',
    ioFactory: factory,
  });
}

describe('SocketClient', () => {
  it('connects to the base URL and passes path + query to socket.io', () => {
    const factory = vi.fn<IoFactory>(() => new FakeSocket() as unknown as Socket);
    const client = makeClient(factory);
    client.open(
      { path: '/notifications/market-data/v2/depth/', query: { symbolId: 'KAU_C1USD' } },
      {},
    );
    const [url, opts] = callArgs(factory);
    expect(url).toBe('wss://example.test');
    expect(opts.path).toBe('/notifications/market-data/v2/depth/');
    expect(opts.query).toEqual({ symbolId: 'KAU_C1USD' });
  });

  it('does NOT attach HMAC headers when no keys are configured', () => {
    const factory = vi.fn<IoFactory>(() => new FakeSocket() as unknown as Socket);
    const client = makeClient(factory);
    client.open({ path: '/notifications/market-data/v2/snapshots/' }, {});
    const [, opts] = callArgs(factory);
    expect(opts.extraHeaders).toBeUndefined();
    expect(opts.auth).toBeUndefined();
  });

  it('DOES attach HMAC headers when keys are configured', () => {
    const factory = vi.fn<IoFactory>(() => new FakeSocket() as unknown as Socket);
    const client = makeClient(factory, true);
    client.open({ path: '/auth-required/' }, {});
    const [, opts] = callArgs(factory);
    const headers = opts.extraHeaders as Record<string, string>;
    expect(headers['X-API-Key']).toBe('pub');
    expect(headers['X-Signature']).toMatch(/^[0-9A-F]{64}$/);
  });

  it('calls onReconnect only on subsequent connects, not the first', () => {
    const fake = new FakeSocket();
    const client = makeClient(() => fake as unknown as Socket);
    const onReconnect = vi.fn();
    client.open({ path: '/x' }, { onReconnect });
    fake.emit('connect');
    expect(onReconnect).not.toHaveBeenCalled();
    fake.emit('connect');
    expect(onReconnect).toHaveBeenCalledTimes(1);
  });

  it('routes onInit/onChange events to the corresponding handlers', () => {
    const fake = new FakeSocket();
    const client = makeClient(() => fake as unknown as Socket);
    const onInit = vi.fn();
    const onChange = vi.fn();
    client.open({ path: '/x' }, { onInit, onChange });
    fake.emit('onInit', { snapshot: 'first' });
    expect(onInit).toHaveBeenCalledWith({ snapshot: 'first' });
    fake.emit('onChange', { delta: 'second' });
    expect(onChange).toHaveBeenCalledWith({ delta: 'second' });
  });

  it('caches the latest payload received from either event', () => {
    const fake = new FakeSocket();
    const client = makeClient(() => fake as unknown as Socket);
    const sub = client.open({ path: '/x' }, {});
    fake.emit('onInit', { snapshot: 'first' });
    expect(sub.latest).toEqual({ snapshot: 'first' });
    fake.emit('onChange', { delta: 'second' });
    expect(sub.latest).toEqual({ delta: 'second' });
  });

  it('close() disconnects the underlying socket', () => {
    const fake = new FakeSocket();
    const client = makeClient(() => fake as unknown as Socket);
    const sub = client.open({ path: '/x' }, {});
    sub.close();
    expect(fake.disconnected).toBe(true);
  });
});
