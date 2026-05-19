import { describe, expect, it, vi } from 'vitest';
import { callInit, callUrl, jsonResponse, mockFetch } from '../test-utils.js';
import {
  KINESIS_PAY_QA_BASE_URL,
  KINESIS_PAY_QA_KMS_BASE_URL,
  KinesisPayClient,
} from './client.js';
import { KinesisPayAuthError, KinesisPayTimeoutError } from './errors.js';

function makeClient(
  fetchImpl: ReturnType<typeof mockFetch>,
  overrides: Partial<ConstructorParameters<typeof KinesisPayClient>[0]> = {},
) {
  return new KinesisPayClient({
    publicKey: 'pub',
    privateKey: 'priv',
    merchantId: 'merchant-1',
    baseUrl: 'https://pay.example.test',
    kmsBaseUrl: 'https://kms.example.test',
    timeout: 1000,
    retries: 0,
    fetch: fetchImpl as unknown as typeof fetch,
    ...overrides,
  });
}

describe('KinesisPayClient.createPayment', () => {
  it('POSTs to /api/merchants/payment with the canonical body shape', async () => {
    const fetchImpl = mockFetch(async () =>
      jsonResponse(200, { status: 'created', globalPaymentId: 'gpid-1' }),
    );
    const client = makeClient(fetchImpl);
    const result = await client.createPayment({ amount: 10, currency: 'USD' });
    expect(result.globalPaymentId).toBe('gpid-1');

    expect(callUrl(fetchImpl)).toBe('https://pay.example.test/api/merchants/payment');
    const init = callInit(fetchImpl);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      globalMerchantId: 'merchant-1',
      amount: '10.00',
      amountCurrency: 'USD',
    });
  });

  it('serializes numeric amounts to fixed-2-decimal strings (plugin parity)', async () => {
    const fetchImpl = mockFetch(async () => jsonResponse(200, { status: 'created' }));
    const client = makeClient(fetchImpl);
    await client.createPayment({ amount: 146.123456, currency: 'EUR' });
    const body = JSON.parse(callInit(fetchImpl).body as string);
    expect(body.amount).toBe('146.12');
  });

  it('passes string amounts through verbatim', async () => {
    const fetchImpl = mockFetch(async () => jsonResponse(200, { status: 'created' }));
    const client = makeClient(fetchImpl);
    await client.createPayment({ amount: '146.1234567', currency: 'EUR' });
    const body = JSON.parse(callInit(fetchImpl).body as string);
    expect(body.amount).toBe('146.1234567');
  });

  it('attaches lowercase HMAC headers + Content-Type', async () => {
    const fetchImpl = mockFetch(async () => jsonResponse(200, { status: 'created' }));
    const client = makeClient(fetchImpl);
    await client.createPayment({ amount: 1, currency: 'USD' });
    const headers = callInit(fetchImpl).headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('pub');
    expect(headers['x-nonce']).toMatch(/^\d{13}$/);
    expect(headers['x-signature']).toMatch(/^[0-9A-F]{64}$/);
    expect(headers['Content-Type']).toBe('application/json');
  });
});

describe('KinesisPayClient.getPaymentStatus', () => {
  it('GETs /api/merchants/payment/id/sdk/:id', async () => {
    const fetchImpl = mockFetch(async () => jsonResponse(200, { status: 'accepted' }));
    const client = makeClient(fetchImpl);
    const p = await client.getPaymentStatus('gpid-1');
    expect(p.status).toBe('accepted');
    expect(callUrl(fetchImpl)).toBe('https://pay.example.test/api/merchants/payment/id/sdk/gpid-1');
    expect(callInit(fetchImpl).method).toBe('GET');
  });

  it('does NOT attach Content-Type on GET', async () => {
    const fetchImpl = mockFetch(async () => jsonResponse(200, { status: 'created' }));
    const client = makeClient(fetchImpl);
    await client.getPaymentStatus('gpid-1');
    const headers = callInit(fetchImpl).headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();
  });
});

describe('KinesisPayClient.confirmPayment', () => {
  it('POSTs /api/merchants/payment/confirm with { globalPaymentId, orderId } verbatim', async () => {
    const fetchImpl = mockFetch(async () => jsonResponse(200, { status: 'processed' }));
    const client = makeClient(fetchImpl);
    await client.confirmPayment({ paymentId: 'gpid-1', orderId: 'wc-123' });
    expect(callUrl(fetchImpl)).toBe('https://pay.example.test/api/merchants/payment/confirm');
    const init = callInit(fetchImpl);
    expect(init.method).toBe('POST');
    // SDK does NOT prefix 'confirmed_' — that's a plugin choice, not API spec.
    expect(JSON.parse(init.body as string)).toEqual({
      globalPaymentId: 'gpid-1',
      orderId: 'wc-123',
    });
  });
});

describe('KinesisPayClient.handshake', () => {
  it('GETs /api/merchants/merchant/sdk/handshake/:merchantId', async () => {
    const fetchImpl = mockFetch(async () => jsonResponse(200, { ok: true }));
    const client = makeClient(fetchImpl);
    await client.handshake();
    expect(callUrl(fetchImpl)).toBe(
      'https://pay.example.test/api/merchants/merchant/sdk/handshake/merchant-1',
    );
  });

  it('throws KinesisPayAuthError on 403 and does not retry', async () => {
    const fetchImpl = mockFetch(async () => jsonResponse(403, { message: 'Invalid credentials' }));
    const client = makeClient(fetchImpl, { retries: 3 });
    await expect(client.handshake()).rejects.toBeInstanceOf(KinesisPayAuthError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('KinesisPayClient.getRedirectUrl', () => {
  it('returns `${kmsBaseUrl}?paymentId=<encoded>`', () => {
    const fetchImpl = mockFetch(async () => jsonResponse(200, {}));
    const client = makeClient(fetchImpl);
    expect(client.getRedirectUrl('gpid-1')).toBe('https://kms.example.test?paymentId=gpid-1');
  });

  it('url-encodes the payment id', () => {
    const fetchImpl = mockFetch(async () => jsonResponse(200, {}));
    const client = makeClient(fetchImpl);
    expect(client.getRedirectUrl('foo/bar baz')).toBe(
      'https://kms.example.test?paymentId=foo%2Fbar%20baz',
    );
  });
});

describe('KinesisPayClient defaults', () => {
  it('uses prod base URLs by default', () => {
    const fetchImpl = mockFetch(async () => jsonResponse(200, {}));
    const client = new KinesisPayClient({
      publicKey: 'p',
      privateKey: 's',
      merchantId: 'm',
      fetch: fetchImpl as unknown as typeof fetch,
    });
    expect(client.getRedirectUrl('x')).toBe('https://kms.kinesis.money?paymentId=x');
  });

  it('honors QA base URLs when provided', async () => {
    const fetchImpl = mockFetch(async () => jsonResponse(200, { status: 'created' }));
    const client = new KinesisPayClient({
      publicKey: 'p',
      privateKey: 's',
      merchantId: 'm',
      baseUrl: KINESIS_PAY_QA_BASE_URL,
      kmsBaseUrl: KINESIS_PAY_QA_KMS_BASE_URL,
      retries: 0,
      fetch: fetchImpl as unknown as typeof fetch,
    });
    await client.createPayment({ amount: 1, currency: 'USD' });
    expect(callUrl(fetchImpl)).toBe('https://qa4-api.kinesis.money/api/merchants/payment');
    expect(client.getRedirectUrl('x')).toBe('https://qa4-kms.kinesis.money?paymentId=x');
  });
});

describe('KinesisPayClient.pollUntilTerminal', () => {
  it('resolves when status transitions into a terminal state', async () => {
    const statuses = ['created', 'created', 'accepted', 'processed'];
    const fetchImpl = mockFetch(async () => jsonResponse(200, { status: statuses.shift() }));
    const client = makeClient(fetchImpl);
    const result = await client.pollUntilTerminal('gpid-1', { intervalMs: 1, timeoutMs: 1000 });
    expect(result.status).toBe('processed');
  });

  it('treats accepted as non-terminal by default', async () => {
    const statuses = ['accepted', 'accepted', 'processed'];
    const fetchImpl = mockFetch(async () => jsonResponse(200, { status: statuses.shift() }));
    const client = makeClient(fetchImpl);
    const result = await client.pollUntilTerminal('gpid-1', { intervalMs: 1, timeoutMs: 1000 });
    expect(result.status).toBe('processed');
    expect(fetchImpl.mock.calls.length).toBeGreaterThanOrEqual(3);
  });

  it('respects custom terminalStatuses (accepted as terminal)', async () => {
    const fetchImpl = mockFetch(async () => jsonResponse(200, { status: 'accepted' }));
    const client = makeClient(fetchImpl);
    const result = await client.pollUntilTerminal('gpid-1', {
      intervalMs: 1,
      timeoutMs: 1000,
      terminalStatuses: ['accepted', 'processed', 'rejected', 'expired'],
    });
    expect(result.status).toBe('accepted');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('throws KinesisPayTimeoutError when no terminal status arrives before deadline', async () => {
    const fetchImpl = mockFetch(async () => jsonResponse(200, { status: 'created' }));
    const client = makeClient(fetchImpl);
    await expect(
      client.pollUntilTerminal('gpid-1', { intervalMs: 5, timeoutMs: 30 }),
    ).rejects.toBeInstanceOf(KinesisPayTimeoutError);
  });

  it('calls onUpdate for every poll including the final terminal one', async () => {
    const statuses = ['created', 'accepted', 'processed'];
    const fetchImpl = mockFetch(async () => jsonResponse(200, { status: statuses.shift() }));
    const client = makeClient(fetchImpl);
    const onUpdate = vi.fn();
    await client.pollUntilTerminal('gpid-1', { intervalMs: 1, onUpdate });
    expect(onUpdate).toHaveBeenCalledTimes(3);
    expect(onUpdate.mock.calls.map((c) => (c[0] as { status: string }).status)).toEqual([
      'created',
      'accepted',
      'processed',
    ]);
  });

  it('aborts when the signal fires', async () => {
    const fetchImpl = mockFetch(async () => jsonResponse(200, { status: 'created' }));
    const client = makeClient(fetchImpl);
    const controller = new AbortController();
    const promise = client.pollUntilTerminal('gpid-1', {
      intervalMs: 1000,
      timeoutMs: 10_000,
      signal: controller.signal,
    });
    // Let the first poll resolve, then abort while sleeping.
    setTimeout(() => controller.abort(), 20);
    await expect(promise).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('refuses to start if the signal is already aborted', async () => {
    const fetchImpl = mockFetch(async () => jsonResponse(200, { status: 'created' }));
    const client = makeClient(fetchImpl);
    const controller = new AbortController();
    controller.abort();
    await expect(
      client.pollUntilTerminal('gpid-1', { signal: controller.signal }),
    ).rejects.toMatchObject({ name: 'AbortError' });
    // The pre-flight abort short-circuits before any HTTP call.
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
