import {
  DepthSchema,
  MidPriceSchema,
  OHLCResponseSchema,
  PairsResponseSchema,
  SnapshotSchema,
  SnapshotsResponseSchema,
} from '../schemas/market.js';
import type { HttpClient } from '../transport/http.js';

export type OHLCTimeFrame = 5 | 15 | 60 | 240 | 1440;

function toIso(d: Date | string): string {
  return typeof d === 'string' ? d : d.toISOString();
}

export class MarketAPI {
  constructor(private readonly http: HttpClient) {}

  getPairs() {
    return this.http.request({
      method: 'GET',
      path: '/v1/exchange/pairs',
      schema: PairsResponseSchema,
    });
  }

  getDepth(pairId: string, direction?: 'bid' | 'ask') {
    return this.http.request({
      method: 'GET',
      path: `/v1/exchange/depth/${pairId}`,
      query: direction ? { direction } : undefined,
      schema: DepthSchema,
    });
  }

  getMidPrice(pairId: string) {
    return this.http.request({
      method: 'GET',
      path: `/v1/exchange/mid-price/${pairId}`,
      schema: MidPriceSchema,
    });
  }

  getSnapshot(pairId: string) {
    return this.http.request({
      method: 'GET',
      path: '/v1/exchange/snapshot',
      query: { currencyPairId: pairId },
      schema: SnapshotSchema,
    });
  }

  getSnapshotsForCurrency(currencyCode: string) {
    return this.http.request({
      method: 'GET',
      path: '/v1/exchange/snapshots',
      query: { currencyCode },
      schema: SnapshotsResponseSchema,
    });
  }

  getOHLC(
    pairId: string,
    params: { timeFrame: OHLCTimeFrame; fromDate: Date | string; toDate: Date | string },
  ) {
    return this.http.request({
      method: 'GET',
      path: `/v1/exchange/ohlc/${pairId}`,
      query: {
        timeFrame: params.timeFrame,
        fromDate: toIso(params.fromDate),
        toDate: toIso(params.toDate),
      },
      schema: OHLCResponseSchema,
    });
  }
}
