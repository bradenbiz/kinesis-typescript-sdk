import { HoldingsResponseSchema, StatementSchema } from '../schemas/account.js';
import type { HttpClient } from '../transport/http.js';

function toIso(d: Date | string): string {
  return typeof d === 'string' ? d : d.toISOString();
}

export class AccountAPI {
  constructor(private readonly http: HttpClient) {}

  getHoldings() {
    return this.http.request({
      method: 'GET',
      path: '/v1/exchange/holdings',
      schema: HoldingsResponseSchema,
    });
  }

  getStatement(params: {
    fromDate: Date | string;
    toDate: Date | string;
    currencyCode: string;
  }) {
    return this.http.request({
      method: 'GET',
      path: '/v1/exchange/reporting/account-balance-statement',
      query: {
        fromDate: toIso(params.fromDate),
        toDate: toIso(params.toDate),
        currencyCode: params.currencyCode,
      },
      schema: StatementSchema,
    });
  }
}
