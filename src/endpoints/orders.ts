import {
  AmendmentSchema,
  AmendmentsListSchema,
  OrderSchema,
  OrdersListSchema,
} from '../schemas/orders.js';
import type { HttpClient } from '../transport/http.js';

export type OrderDirection = 'buy' | 'sell';
export type OrderType = 'limit' | 'market';

export interface PlaceOrderInput {
  currencyPairId: string;
  direction: OrderDirection;
  amount: number;
  orderType: OrderType;
  limitPrice?: number;
  clientOrderId?: string;
}

export interface BuyInput {
  currencyPairId: string;
  receive: number;
  available: number;
  orderType: OrderType;
  limitPrice?: number;
  clientOrderId?: string;
}

export interface SellInput {
  currencyPairId: string;
  spend: number;
  orderType: OrderType;
  limitPrice?: number;
  clientOrderId?: string;
}

function toIso(d: Date | string): string {
  return typeof d === 'string' ? d : d.toISOString();
}

export class OrdersAPI {
  constructor(private readonly http: HttpClient) {}

  place(input: PlaceOrderInput) {
    return this.http.request({
      method: 'POST',
      path: '/v1/exchange/orders',
      body: input,
      schema: OrderSchema,
    });
  }

  buy(input: BuyInput) {
    return this.http.request({
      method: 'POST',
      path: '/v1/exchange/orders/buy',
      body: input,
      schema: OrderSchema,
    });
  }

  sell(input: SellInput) {
    return this.http.request({
      method: 'POST',
      path: '/v1/exchange/orders/sell',
      body: input,
      schema: OrderSchema,
    });
  }

  get(orderId: string) {
    return this.http.request({
      method: 'GET',
      path: `/v1/exchange/orders/${orderId}`,
      schema: OrderSchema,
    });
  }

  getOpen(
    params: {
      currencyPairId?: string;
      fromDate?: Date | string;
      toDate?: Date | string;
    } = {},
  ) {
    return this.http.request({
      method: 'GET',
      path: '/v1/exchange/orders',
      query: {
        currencyPairId: params.currencyPairId,
        fromDate: params.fromDate ? toIso(params.fromDate) : undefined,
        toDate: params.toDate ? toIso(params.toDate) : undefined,
      },
      schema: OrdersListSchema,
    });
  }

  cancel(orderId: string) {
    return this.http.request({
      method: 'DELETE',
      path: `/v1/exchange/orders/${orderId}`,
      schema: OrderSchema,
    });
  }

  getAmendments(orderId: string) {
    return this.http.request({
      method: 'GET',
      path: `/v1/exchange/orders/${orderId}/amendments`,
      schema: AmendmentsListSchema,
    });
  }

  getAmendment(amendmentId: string) {
    return this.http.request({
      method: 'GET',
      path: `/v1/exchange/amendments/${amendmentId}`,
      schema: AmendmentSchema,
    });
  }

  getAmendmentHistory(params: {
    fromDate: Date | string;
    toDate: Date | string;
    currencyPairId?: string;
  }) {
    return this.http.request({
      method: 'GET',
      path: '/v1/exchange/amendments',
      query: {
        fromDate: toIso(params.fromDate),
        toDate: toIso(params.toDate),
        currencyPairId: params.currencyPairId,
      },
      schema: AmendmentsListSchema,
    });
  }
}
