import { describe, expect, it } from 'vitest';
import { callUrl, jsonResponse, mockFetch } from '../test-utils.js';
import { HttpClient } from '../transport/http.js';
import { MarketAPI } from './market.js';

function makeMarket(fetchImpl: ReturnType<typeof mockFetch>) {
  const opts = {
    baseUrl: 'https://example.test',
    timeout: 1000,
    retries: 0,
    fetch: fetchImpl as unknown as typeof fetch,
  };
  return new MarketAPI(
    new HttpClient({ ...opts, publicKey: 'pub', privateKey: 'priv' }),
    new HttpClient({ ...opts, baseUrl: 'https://market.example.test' }),
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

  it('getSnapshot fetches all snapshots and filters by symbolId', async () => {
    const fetchImpl = mockFetch(async () =>
      jsonResponse(200, [
        { symbolId: 'KAU_C1USD', bidPrice: 146 },
        { symbolId: 'KAG_C1USD', bidPrice: 1.8 },
      ]),
    );
    const market = makeMarket(fetchImpl);
    const snap = await market.getSnapshot('KAU_C1USD');
    expect(snap?.symbolId).toBe('KAU_C1USD');
    expect(callUrl(fetchImpl)).toBe(
      'https://market.example.test/api/market-data/snapshots/all/public',
    );
  });

  it('getSnapshot returns undefined when symbol is not in the response', async () => {
    const fetchImpl = mockFetch(async () =>
      jsonResponse(200, [{ symbolId: 'KAU_C1USD', bidPrice: 146 }]),
    );
    const market = makeMarket(fetchImpl);
    const snap = await market.getSnapshot('SOMETHING_ELSE');
    expect(snap).toBeUndefined();
  });

  it('getSnapshotsForCurrency filters by base or quote currency', async () => {
    const fetchImpl = mockFetch(async () =>
      jsonResponse(200, [
        { symbolId: 'KAU_C1USD' },
        { symbolId: 'KAG_C1USD' },
        { symbolId: 'SOL_KAU' },
        { symbolId: 'USDC_C1USD' },
      ]),
    );
    const market = makeMarket(fetchImpl);
    const kau = await market.getSnapshotsForCurrency('KAU');
    expect(kau.map((s) => s.symbolId)).toEqual(['KAU_C1USD', 'SOL_KAU']);
  });

  it('getOHLC hits the market-data host with renamed params', async () => {
    const fetchImpl = mockFetch(async () =>
      jsonResponse(200, { ohlcData: [], olderDataPresent: false }),
    );
    const market = makeMarket(fetchImpl);
    const from = new Date('2026-01-01T00:00:00.000Z');
    const to = new Date('2026-01-02T00:00:00.000Z');
    await market.getOHLC('KAU_C1USD', { timeFrame: 60, fromDate: from, toDate: to });
    const url = callUrl(fetchImpl);
    expect(url).toContain('https://market.example.test/api/market-data/ohlc');
    expect(url).toContain('symbolId=KAU_C1USD');
    expect(url).toContain('fromDate=2026-01-01T00%3A00%3A00.000Z');
    // toDate -> to on the wire
    expect(url).toContain('to=2026-01-02T00%3A00%3A00.000Z');
    expect(url).toContain('timeFrame=60');
    expect(url).toContain('includeOlderDataPresentFlag=true');
  });
});
