import { describe, expect, it } from 'vitest';
import { callUrl, jsonResponse, mockFetch } from '../test-utils.js';
import { HttpClient } from '../transport/http.js';
import { MarketAPI } from './market.js';

function makeMarket(fetchImpl: ReturnType<typeof mockFetch>) {
  return new MarketAPI(
    new HttpClient({
      publicKey: 'pub',
      privateKey: 'priv',
      baseUrl: 'https://example.test',
      timeout: 1000,
      retries: 0,
      fetch: fetchImpl as unknown as typeof fetch,
    }),
  );
}

describe('MarketAPI', () => {
  it('getPairs hits /v1/exchange/pairs and returns parsed array', async () => {
    const fetchImpl = mockFetch(async () =>
      jsonResponse(200, [{ currencyPairId: 'KAU_C1USD' }, { currencyPairId: 'KAG_C1USD' }]),
    );
    const market = makeMarket(fetchImpl);
    const pairs = await market.getPairs();
    expect(pairs).toHaveLength(2);
    expect(callUrl(fetchImpl)).toBe('https://example.test/v1/exchange/pairs');
  });

  it('getDepth includes direction in query when provided', async () => {
    const fetchImpl = mockFetch(async () =>
      jsonResponse(200, { symbolId: 'KAU_USD', depthItems: { bid: [], ask: [] } }),
    );
    const market = makeMarket(fetchImpl);
    await market.getDepth('KAU_USD', 'bid');
    expect(callUrl(fetchImpl)).toBe('https://example.test/v1/exchange/depth/KAU_USD?direction=bid');
  });

  it('getDepth omits query when direction not provided', async () => {
    const fetchImpl = mockFetch(async () =>
      jsonResponse(200, { symbolId: 'KAU_USD', depthItems: { bid: [], ask: [] } }),
    );
    const market = makeMarket(fetchImpl);
    await market.getDepth('KAU_USD');
    expect(callUrl(fetchImpl)).toBe('https://example.test/v1/exchange/depth/KAU_USD');
  });

  it('getSnapshot passes currencyPairId as query param', async () => {
    const fetchImpl = mockFetch(async () => jsonResponse(200, { symbolId: 'KAU_USD' }));
    const market = makeMarket(fetchImpl);
    await market.getSnapshot('KAU_USD');
    expect(callUrl(fetchImpl)).toBe(
      'https://example.test/v1/exchange/snapshot?currencyPairId=KAU_USD',
    );
  });

  it('getOHLC serializes Date params to ISO strings', async () => {
    const fetchImpl = mockFetch(async () => jsonResponse(200, []));
    const market = makeMarket(fetchImpl);
    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-01-02T00:00:00.000Z');
    await market.getOHLC('KAU_USD', { timeFrame: 60, fromDate: from, toDate: to });
    const url = callUrl(fetchImpl);
    expect(url).toContain('fromDate=2026-01-01T00%3A00%3A00.000Z');
    expect(url).toContain('toDate=2026-01-02T00%3A00%3A00.000Z');
    expect(url).toContain('timeFrame=60');
  });
});
