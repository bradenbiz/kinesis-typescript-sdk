import {
  DepthSchema,
  MidPriceSchema,
  OHLCResponseSchema,
  PairsResponseSchema,
  type Snapshot,
  SnapshotsResponseSchema,
} from '../schemas/market.js';
import type { HttpClient } from '../transport/http.js';

export type OHLCTimeFrame = 5 | 15 | 60 | 240 | 1440;

function toIso(d: Date | string): string {
  return typeof d === 'string' ? d : d.toISOString();
}

export class MarketAPI {
  // Two transports: `auth` is HMAC-signed and points at the trading host;
  // `marketData` is unauthenticated and points at the public market-data host.
  constructor(
    private readonly auth: HttpClient,
    private readonly marketData: HttpClient,
  ) {}

  // --- HMAC-authenticated (client-api.kinesis.money) ---

  getPairs() {
    return this.auth.request({
      method: 'GET',
      path: '/v1/exchange/pairs',
      schema: PairsResponseSchema,
    });
  }

  getDepth(pairId: string, direction?: 'bid' | 'ask') {
    return this.auth.request({
      method: 'GET',
      path: `/v1/exchange/depth/${pairId}`,
      query: direction ? { direction } : undefined,
      schema: DepthSchema,
    });
  }

  getMidPrice(pairId: string) {
    return this.auth.request({
      method: 'GET',
      path: `/v1/exchange/mid-price/${pairId}`,
      schema: MidPriceSchema,
    });
  }

  // --- Public market-data (fastapi.kinesis.money), no auth ---

  /** Fetch snapshots for every pair on the exchange. */
  getAllSnapshots() {
    return this.marketData.request({
      method: 'GET',
      path: '/api/market-data/snapshots/all/public',
      schema: SnapshotsResponseSchema,
    });
  }

  /** Snapshot for a single pair. Returns undefined if the pair isn't in the response. */
  async getSnapshot(pairId: string): Promise<Snapshot | undefined> {
    const all = await this.getAllSnapshots();
    return all.find((s) => s.symbolId === pairId);
  }

  /** Snapshots whose pair has the given currency on either side (e.g. 'KAU' → KAU_C1USD, USDC_KAU). */
  async getSnapshotsForCurrency(currencyCode: string): Promise<Snapshot[]> {
    const all = await this.getAllSnapshots();
    return all.filter((s) => {
      const [base, quote] = s.symbolId.split('_');
      return base === currencyCode || quote === currencyCode;
    });
  }

  getOHLC(
    pairId: string,
    params: { timeFrame: OHLCTimeFrame; fromDate: Date | string; toDate: Date | string },
  ) {
    return this.marketData.request({
      method: 'GET',
      path: '/api/market-data/ohlc',
      query: {
        symbolId: pairId,
        fromDate: toIso(params.fromDate),
        to: toIso(params.toDate),
        timeFrame: params.timeFrame,
        includeOlderDataPresentFlag: true,
      },
      schema: OHLCResponseSchema,
    });
  }
}
