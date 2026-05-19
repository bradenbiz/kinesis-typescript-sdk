import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildAuthHeaders, createNonce, sign } from './auth.js';

// node:crypto serves as the oracle for these tests. Our Web Crypto signer
// must produce byte-identical output to a hand-rolled createHmac path —
// that's the cross-check that catches algorithm bugs.

describe('pay/sign', () => {
  it('matches HEX(HMAC-SHA256(privateKey, nonce + METHOD + path + body)).toUpperCase() with explicit body', async () => {
    const inputs = {
      nonce: '1700000000000',
      method: 'POST',
      path: '/api/merchants/payment',
      body: '{"globalMerchantId":"m","amount":"10.00","amountCurrency":"USD"}',
    };
    const expected = createHmac('sha256', 'priv')
      .update(`${inputs.nonce}${inputs.method}${inputs.path}${inputs.body}`)
      .digest('hex')
      .toUpperCase();
    expect(await sign('priv', inputs)).toBe(expected);
  });

  it('signs missing body as the literal "{}" (plugin convention)', async () => {
    const a = await sign('k', { nonce: '1', method: 'GET', path: '/x' });
    const b = await sign('k', { nonce: '1', method: 'GET', path: '/x', body: '{}' });
    expect(a).toBe(b);
  });

  it('signs empty-string body the same as missing body', async () => {
    const a = await sign('k', { nonce: '1', method: 'GET', path: '/x' });
    const b = await sign('k', { nonce: '1', method: 'GET', path: '/x', body: '' });
    expect(a).toBe(b);
  });

  it('produces uppercase 64-char hex', async () => {
    const sig = await sign('private', { nonce: '1', method: 'GET', path: '/x' });
    expect(sig).toMatch(/^[0-9A-F]{64}$/);
  });

  it('uppercases the HTTP method before signing', async () => {
    const a = await sign('k', { nonce: '1', method: 'get', path: '/x' });
    const b = await sign('k', { nonce: '1', method: 'GET', path: '/x' });
    expect(a).toBe(b);
  });

  it('produces different signatures for different bodies', async () => {
    const a = await sign('k', { nonce: '1', method: 'POST', path: '/x', body: '{"a":1}' });
    const b = await sign('k', { nonce: '1', method: 'POST', path: '/x', body: '{"a":2}' });
    expect(a).not.toBe(b);
  });

  it('locks in a known fixture so downstream regressions are obvious', async () => {
    // If this hash ever changes, someone broke the signing scheme.
    const fixed = createHmac('sha256', 'fixture-secret')
      .update(`1700000000000POST/api/merchants/payment{"a":1}`)
      .digest('hex')
      .toUpperCase();
    const sig = await sign('fixture-secret', {
      nonce: '1700000000000',
      method: 'POST',
      path: '/api/merchants/payment',
      body: '{"a":1}',
    });
    expect(sig).toBe(fixed);
  });
});

describe('pay/buildAuthHeaders', () => {
  it('emits lowercase header names per the plugin', async () => {
    const h = await buildAuthHeaders({
      publicKey: 'pub',
      privateKey: 'priv',
      method: 'GET',
      path: '/api/merchants/merchant/sdk/handshake/m1',
      nonce: '1700000000000',
    });
    expect(h['x-api-key']).toBe('pub');
    expect(h['x-nonce']).toBe('1700000000000');
    expect(h['x-signature']).toMatch(/^[0-9A-F]{64}$/);
  });
});

describe('pay/createNonce', () => {
  it('returns a millisecond timestamp string', () => {
    const n = createNonce();
    expect(n).toMatch(/^\d{13}$/);
  });
});
