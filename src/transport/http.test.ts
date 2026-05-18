import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { AuthError, RateLimitError, SchemaMismatchError } from '../errors.js';
import { callInit, callUrl, jsonResponse, mockFetch } from '../test-utils.js';
import { HttpClient } from './http.js';

function makeClient(
  fetchImpl: ReturnType<typeof mockFetch>,
  overrides: Partial<ConstructorParameters<typeof HttpClient>[0]> = {},
) {
  return new HttpClient({
    publicKey: 'pub',
    privateKey: 'priv',
    baseUrl: 'https://example.test',
    timeout: 1000,
    retries: 3,
    fetch: fetchImpl as unknown as typeof fetch,
    ...overrides,
  });
}

describe('HttpClient', () => {
  it('attaches X-API-Key, X-Nonce, X-Signature on every request', async () => {
    const fetchImpl = mockFetch(async () => jsonResponse(200, { ok: true }));
    const client = makeClient(fetchImpl);
    await client.request({ method: 'GET', path: '/v1/exchange/pairs' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const headers = callInit(fetchImpl).headers as Record<string, string>;
    expect(headers['X-API-Key']).toBe('pub');
    expect(headers['X-Nonce']).toMatch(/^\d{13}$/);
    expect(headers['X-Signature']).toMatch(/^[0-9A-F]{64}$/);
  });

  it('attaches Content-Type: application/json on POST bodies', async () => {
    const fetchImpl = mockFetch(async () => jsonResponse(200, { ok: true }));
    const client = makeClient(fetchImpl);
    await client.request({ method: 'POST', path: '/v1/exchange/orders', body: { a: 1 } });
    const init = callInit(fetchImpl);
    const headers = init.headers as Record<string, string>;
    expect(headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe('{"a":1}');
  });

  it('does not set Content-Type on DELETE', async () => {
    const fetchImpl = mockFetch(async () => jsonResponse(200, { ok: true }));
    const client = makeClient(fetchImpl);
    await client.request({ method: 'DELETE', path: '/v1/exchange/orders/abc' });
    const headers = callInit(fetchImpl).headers as Record<string, string>;
    expect(headers['Content-Type']).toBeUndefined();
  });

  it('appends query string when query params provided', async () => {
    const fetchImpl = mockFetch(async () => jsonResponse(200, { ok: true }));
    const client = makeClient(fetchImpl);
    await client.request({
      method: 'GET',
      path: '/v1/exchange/depth/KAU_USD',
      query: { direction: 'bid', limit: 10, skip: undefined },
    });
    expect(callUrl(fetchImpl)).toBe(
      'https://example.test/v1/exchange/depth/KAU_USD?direction=bid&limit=10',
    );
  });

  it('retries 5xx then succeeds', async () => {
    let calls = 0;
    const fetchImpl = mockFetch(async () => {
      calls++;
      if (calls < 3) return jsonResponse(503, { message: 'down' });
      return jsonResponse(200, { ok: true });
    });
    const client = makeClient(fetchImpl);
    const out = await client.request<{ ok: boolean }>({ method: 'GET', path: '/x' });
    expect(out).toEqual({ ok: true });
    expect(calls).toBe(3);
  });

  it('does NOT retry 401 (AuthError is terminal)', async () => {
    const fetchImpl = mockFetch(async () => jsonResponse(401, { code: 'unauthorized' }));
    const client = makeClient(fetchImpl);
    await expect(client.request({ method: 'GET', path: '/x' })).rejects.toBeInstanceOf(AuthError);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('retries 429 honoring Retry-After header', async () => {
    let calls = 0;
    const fetchImpl = mockFetch(async () => {
      calls++;
      if (calls < 2) return jsonResponse(429, { code: 'rate_limited' }, { 'retry-after': '0' });
      return jsonResponse(200, { ok: true });
    });
    const client = makeClient(fetchImpl);
    const out = await client.request<{ ok: boolean }>({ method: 'GET', path: '/x' });
    expect(out).toEqual({ ok: true });
    expect(calls).toBe(2);
  });

  it('gives up after retries exhausted and throws the last typed error', async () => {
    const fetchImpl = mockFetch(async () => jsonResponse(503, { message: 'down' }));
    const client = makeClient(fetchImpl, { retries: 1 });
    await expect(client.request({ method: 'GET', path: '/x' })).rejects.toMatchObject({
      statusCode: 503,
    });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('regenerates nonce on each retry', async () => {
    let calls = 0;
    const nonces: string[] = [];
    const fetchImpl = mockFetch(async (_url, init) => {
      const h = (init?.headers ?? {}) as Record<string, string>;
      const nonce = h['X-Nonce'];
      if (nonce) nonces.push(nonce);
      calls++;
      if (calls < 3) return jsonResponse(503, {});
      return jsonResponse(200, { ok: true });
    });
    const client = makeClient(fetchImpl);
    await client.request({ method: 'GET', path: '/x' });
    expect(nonces).toHaveLength(3);
  });

  it('validates response against schema and returns parsed data', async () => {
    const fetchImpl = mockFetch(async () => jsonResponse(200, { id: 'abc', extra: 1 }));
    const client = makeClient(fetchImpl);
    const schema = z.object({ id: z.string() }).passthrough();
    const out = await client.request({ method: 'GET', path: '/x', schema });
    expect(out).toMatchObject({ id: 'abc' });
  });

  it('throws SchemaMismatchError when response shape diverges', async () => {
    const fetchImpl = mockFetch(async () => jsonResponse(200, { id: 123 }));
    const client = makeClient(fetchImpl);
    const schema = z.object({ id: z.string() });
    await expect(client.request({ method: 'GET', path: '/x', schema })).rejects.toBeInstanceOf(
      SchemaMismatchError,
    );
  });

  it('surfaces RateLimitError when retries are exhausted', async () => {
    const fetchImpl = mockFetch(async () =>
      jsonResponse(429, { code: 'rate_limited' }, { 'retry-after': '0' }),
    );
    const client = makeClient(fetchImpl, { retries: 1 });
    await expect(client.request({ method: 'GET', path: '/x' })).rejects.toBeInstanceOf(
      RateLimitError,
    );
  });
});
