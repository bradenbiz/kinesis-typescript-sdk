import { z } from 'zod';
import { HttpClient } from './transport/http.js';

const DEFAULT_BASE_URL = 'https://client-api.kinesis.money';

export interface KinesisWithdrawalClientOptions {
  publicKey: string;
  privateKey: string;
  baseUrl?: string;
  timeout?: number;
  retries?: number;
  fetch?: typeof fetch;
}

export interface WithdrawalInput {
  amount: number;
  currencyCode: string;
  address: string;
  memo?: string;
}

const WithdrawalResultSchema = z.object({}).passthrough();

// Withdrawal lives behind its own entry point on purpose: consumers that should
// never have withdrawal capability simply don't import it.
export class KinesisWithdrawalClient {
  private readonly http: HttpClient;

  constructor(opts: KinesisWithdrawalClientOptions) {
    this.http = new HttpClient({
      publicKey: opts.publicKey,
      privateKey: opts.privateKey,
      baseUrl: opts.baseUrl ?? DEFAULT_BASE_URL,
      timeout: opts.timeout ?? 10_000,
      retries: opts.retries ?? 3,
      fetch: opts.fetch,
    });
  }

  toAddress(input: WithdrawalInput) {
    return this.http.request({
      method: 'POST',
      path: '/v1/exchange/withdrawals',
      body: input,
      schema: WithdrawalResultSchema,
    });
  }
}
