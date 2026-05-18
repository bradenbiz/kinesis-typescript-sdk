import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { buildAuthHeaders, createNonce, sign } from './auth.js';

describe('sign', () => {
  it('computes HEX(HMAC-SHA256(privateKey, nonce + METHOD + path + body)).toUpperCase()', () => {
    const inputs = {
      nonce: '1700000000000',
      method: 'POST',
      path: '/v1/exchange/orders',
      body: '{"x":1}',
    };
    const expected = createHmac('sha256', 'priv')
      .update(`${inputs.nonce}${inputs.method}${inputs.path}${inputs.body}`)
      .digest('hex')
      .toUpperCase();
    expect(sign('priv', inputs)).toBe(expected);
  });

  it('returns 64 hex chars, uppercase', () => {
    const sig = sign('private', { nonce: '1', method: 'GET', path: '/x' });
    expect(sig).toMatch(/^[0-9A-F]{64}$/);
  });

  it('treats missing body as empty string', () => {
    const a = sign('k', { nonce: '1', method: 'GET', path: '/x' });
    const b = sign('k', { nonce: '1', method: 'GET', path: '/x', body: '' });
    expect(a).toBe(b);
  });

  it('uppercases HTTP method before signing', () => {
    const a = sign('k', { nonce: '1', method: 'get', path: '/x' });
    const b = sign('k', { nonce: '1', method: 'GET', path: '/x' });
    expect(a).toBe(b);
  });

  it('produces different signatures for different bodies', () => {
    const a = sign('k', { nonce: '1', method: 'POST', path: '/x', body: '{"a":1}' });
    const b = sign('k', { nonce: '1', method: 'POST', path: '/x', body: '{"a":2}' });
    expect(a).not.toBe(b);
  });

  it('produces different signatures for different nonces', () => {
    const a = sign('k', { nonce: '1', method: 'GET', path: '/x' });
    const b = sign('k', { nonce: '2', method: 'GET', path: '/x' });
    expect(a).not.toBe(b);
  });
});

describe('buildAuthHeaders', () => {
  it('returns the three required header fields', () => {
    const h = buildAuthHeaders({
      publicKey: 'pub',
      privateKey: 'priv',
      method: 'GET',
      path: '/v1/exchange/pairs',
      nonce: '1700000000000',
    });
    expect(h['X-API-Key']).toBe('pub');
    expect(h['X-Nonce']).toBe('1700000000000');
    expect(h['X-Signature']).toMatch(/^[0-9A-F]{64}$/);
  });

  it('generates a fresh nonce when not provided', () => {
    const before = Date.now();
    const h = buildAuthHeaders({
      publicKey: 'pub',
      privateKey: 'priv',
      method: 'GET',
      path: '/x',
    });
    const after = Date.now();
    const n = Number(h['X-Nonce']);
    expect(n).toBeGreaterThanOrEqual(before);
    expect(n).toBeLessThanOrEqual(after);
  });
});

describe('createNonce', () => {
  it('returns a millisecond timestamp string', () => {
    const n = createNonce();
    expect(n).toMatch(/^\d{13}$/);
  });
});
