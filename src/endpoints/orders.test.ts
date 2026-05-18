import { describe, expect, it } from 'vitest';
import { callInit, callUrl, jsonResponse, mockFetch } from '../test-utils.js';
import { HttpClient } from '../transport/http.js';
import { OrdersAPI } from './orders.js';

function makeOrders(fetchImpl: ReturnType<typeof mockFetch>) {
  return new OrdersAPI(
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

describe('OrdersAPI', () => {
  it('place POSTs to /v1/exchange/orders with the body', async () => {
    const fetchImpl = mockFetch(async () => jsonResponse(200, { id: 'abc', status: 'open' }));
    const orders = makeOrders(fetchImpl);
    await orders.place({
      currencyPairId: 'KAU_USD',
      direction: 'buy',
      amount: 10,
      orderType: 'limit',
      limitPrice: 90.5,
    });
    expect(callUrl(fetchImpl)).toBe('https://example.test/v1/exchange/orders');
    const init = callInit(fetchImpl);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toMatchObject({
      currencyPairId: 'KAU_USD',
      direction: 'buy',
      amount: 10,
      orderType: 'limit',
      limitPrice: 90.5,
    });
  });

  it('buy hits /v1/exchange/orders/buy', async () => {
    const fetchImpl = mockFetch(async () => jsonResponse(200, { id: 'b1' }));
    const orders = makeOrders(fetchImpl);
    await orders.buy({
      currencyPairId: 'KAU_USD',
      receive: 5,
      available: 1000,
      orderType: 'limit',
      limitPrice: 90.5,
    });
    expect(callUrl(fetchImpl)).toBe('https://example.test/v1/exchange/orders/buy');
  });

  it('cancel issues DELETE', async () => {
    const fetchImpl = mockFetch(async () => jsonResponse(200, { id: 'abc', status: 'cancelled' }));
    const orders = makeOrders(fetchImpl);
    await orders.cancel('abc');
    expect(callInit(fetchImpl).method).toBe('DELETE');
  });
});
