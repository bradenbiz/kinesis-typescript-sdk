import { KinesisPayTimeoutError } from './errors.js';
import { PayHttpClient } from './http.js';
import type { ConfirmPaymentInput, CreatePaymentInput, Payment, PaymentStatus } from './types.js';

export const KINESIS_PAY_PROD_BASE_URL = 'https://apip.kinesis.money';
export const KINESIS_PAY_PROD_KMS_BASE_URL = 'https://kms.kinesis.money';
export const KINESIS_PAY_QA_BASE_URL = 'https://qa4-api.kinesis.money';
export const KINESIS_PAY_QA_KMS_BASE_URL = 'https://qa4-kms.kinesis.money';

const DEFAULT_TERMINAL_STATUSES: ReadonlyArray<PaymentStatus> = [
  'processed',
  'rejected',
  'expired',
];

export interface KinesisPayClientOptions {
  publicKey: string;
  privateKey: string;
  /** `globalMerchantId` used in createPayment bodies and handshake URLs. */
  merchantId: string;
  /** Defaults to KINESIS_PAY_PROD_BASE_URL. For QA pass KINESIS_PAY_QA_BASE_URL. */
  baseUrl?: string;
  /** Defaults to KINESIS_PAY_PROD_KMS_BASE_URL. Customer-facing host used in getRedirectUrl. */
  kmsBaseUrl?: string;
  timeout?: number;
  retries?: number;
  /** Override fetch (testing, custom proxy, etc.). */
  fetch?: typeof fetch;
}

export interface PollOptions {
  /** Default 10000ms — matches the WC plugin's `checking_int * 1000`. */
  intervalMs?: number;
  /** Default 600000ms — matches the WC plugin's `timeout_period`. */
  timeoutMs?: number;
  /** Cancel polling externally. The promise rejects with an AbortError. */
  signal?: AbortSignal;
  /** Called after every poll, including the final one. */
  onUpdate?: (payment: Payment) => void;
  /**
   * Statuses that complete polling. Defaults to ['processed', 'rejected', 'expired'].
   *
   * Note: 'accepted' is intentionally NOT terminal by default — at `accepted`,
   * the customer has approved but the merchant has not yet captured. The
   * typical flow is to poll-until-terminal, see `accepted`, call
   * confirmPayment(), then optionally poll again to wait for `processed`.
   *
   * Pass `['accepted', 'processed', 'rejected', 'expired']` if you want the
   * single-poll-then-confirm flow.
   */
  terminalStatuses?: ReadonlyArray<PaymentStatus>;
}

/**
 * Client for the Kinesis Pay merchant API.
 *
 * Auth, base URLs, and the four endpoints are derived from the canonical
 * bullioncapital/kinesis-pay-woocommerce plugin — there is no public REST
 * documentation. See the README for the recommended polling pattern.
 *
 * **There are no webhooks.** Status changes are observed by polling. Defaults
 * (10s interval, 10min total) match the WC plugin.
 *
 * **`accepted` does not mean money has moved.** Two-phase capture: the
 * customer approval transitions `created → accepted`; the merchant must call
 * `confirmPayment` to move `accepted → processed`. Funds are not captured
 * until `processed`.
 */
export class KinesisPayClient {
  private readonly http: PayHttpClient;
  private readonly merchantId: string;
  private readonly kmsBaseUrl: string;

  constructor(opts: KinesisPayClientOptions) {
    this.http = new PayHttpClient({
      publicKey: opts.publicKey,
      privateKey: opts.privateKey,
      baseUrl: opts.baseUrl ?? KINESIS_PAY_PROD_BASE_URL,
      timeout: opts.timeout ?? 10_000,
      retries: opts.retries ?? 3,
      fetch: opts.fetch,
    });
    this.merchantId = opts.merchantId;
    this.kmsBaseUrl = opts.kmsBaseUrl ?? KINESIS_PAY_PROD_KMS_BASE_URL;
  }

  /**
   * Create a new payment. Returns the payment object with `globalPaymentId`
   * — pass that to {@link confirmPayment}, {@link getPaymentStatus},
   * {@link pollUntilTerminal}, and {@link getRedirectUrl}.
   *
   * Numeric `amount` is serialized as a fixed-2-decimal string (matching the
   * canonical plugin's `number_format($total, 2, '.', '')`). Pass a string
   * yourself for different precision.
   */
  createPayment(input: CreatePaymentInput): Promise<Payment> {
    const amount = typeof input.amount === 'number' ? input.amount.toFixed(2) : input.amount;
    return this.http.request<Payment>({
      method: 'POST',
      path: '/api/merchants/payment',
      body: {
        globalMerchantId: this.merchantId,
        amount,
        amountCurrency: input.currency,
      },
    });
  }

  /** Fetch a payment's current state. */
  getPaymentStatus(paymentId: string): Promise<Payment> {
    return this.http.request<Payment>({
      method: 'GET',
      path: `/api/merchants/payment/id/sdk/${encodeURIComponent(paymentId)}`,
    });
  }

  /**
   * Merchant-side capture. Transitions `accepted → processed`. Call only
   * after observing `accepted` via polling (or via your own out-of-band
   * signal). Funds are not captured until this returns successfully.
   */
  confirmPayment(input: ConfirmPaymentInput): Promise<Payment> {
    return this.http.request<Payment>({
      method: 'POST',
      path: '/api/merchants/payment/confirm',
      body: {
        globalPaymentId: input.paymentId,
        orderId: input.orderId,
      },
    });
  }

  /**
   * Validate the configured credentials and merchantId. Throws
   * KinesisPayAuthError on 403. Useful as a startup health check.
   */
  handshake(): Promise<unknown> {
    return this.http.request({
      method: 'GET',
      path: `/api/merchants/merchant/sdk/handshake/${encodeURIComponent(this.merchantId)}`,
    });
  }

  /**
   * Build the customer-facing URL for a payment — encode this as a QR code
   * in your UI. When the customer scans it, they're taken to the Kinesis app
   * (or web KMS) to approve.
   *
   * The SDK does NOT encode the QR — pick any QR library for that.
   */
  getRedirectUrl(paymentId: string): string {
    return `${this.kmsBaseUrl}?paymentId=${encodeURIComponent(paymentId)}`;
  }

  /**
   * Poll `getPaymentStatus` until the payment reaches a terminal state.
   * Defaults: 10s interval, 10min total timeout, terminal = ['processed',
   * 'rejected', 'expired']. See {@link PollOptions} for the full flow.
   */
  async pollUntilTerminal(paymentId: string, opts: PollOptions = {}): Promise<Payment> {
    const intervalMs = opts.intervalMs ?? 10_000;
    const timeoutMs = opts.timeoutMs ?? 600_000;
    const terminal = new Set<PaymentStatus>(opts.terminalStatuses ?? DEFAULT_TERMINAL_STATUSES);
    const deadline = Date.now() + timeoutMs;

    while (true) {
      throwIfAborted(opts.signal);
      const payment = await this.getPaymentStatus(paymentId);
      opts.onUpdate?.(payment);
      if (terminal.has(payment.status)) return payment;
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw new KinesisPayTimeoutError();
      await sleepWithSignal(Math.min(intervalMs, remaining), opts.signal);
    }
  }
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException('Polling aborted', 'AbortError');
  }
}

function sleepWithSignal(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Polling aborted', 'AbortError'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new DOMException('Polling aborted', 'AbortError'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
