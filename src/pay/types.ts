/**
 * Lifecycle of a Kinesis Pay payment. From the canonical WC plugin
 * (class-kinesis-pay-gateway.php STATUS_* constants):
 *
 *   created ──▶ accepted ──▶ processed
 *     │           │
 *     ▼           ▼
 *   expired     rejected
 *
 * - created:   payment created, awaiting customer scan + approval
 * - accepted:  customer approved in their Kinesis app (funds reserved) —
 *              NOT terminal; merchant must call confirmPayment() to capture
 * - processed: merchant has confirmed and funds are captured
 * - rejected:  customer declined in their Kinesis app
 * - expired:   10-minute timeout (plugin default `timeout_period` = 600000ms)
 */
export type PaymentStatus = 'created' | 'accepted' | 'processed' | 'rejected' | 'expired';

/**
 * Payment object returned by the Pay API. Fields are derived from the WC
 * plugin's `insert_or_update_payment` storage block — every column there is
 * read from the response. Most are optional because not every endpoint
 * returns every field on every status.
 *
 * Numeric fields can be returned as `number` or `string` (the API has
 * switched representation without notice — see plugin changelog v1.0.1).
 * Use the SDK's numeric helpers if you need a strict number.
 */
export interface Payment {
  status: PaymentStatus;
  /** Returned by createPayment as the canonical identifier; pass into subsequent calls. */
  globalPaymentId?: string;
  /** Some endpoints return paymentId alongside or instead of globalPaymentId. */
  paymentId?: string;
  /** Merchant-side order identifier passed to confirmPayment. */
  orderId?: string;
  paymentCurrency?: string;
  paymentCurrencyAmount?: number | string;
  paymentCurrencyFee?: number | string;
  paymentCurrencyNetAmount?: number | string;
  usdConvertedAmount?: number | string;
  preferredCurrency?: string;
  preferredCurrencyAmount?: number | string;
  createdAt?: string;
  updatedAt?: string;
  /** ISO timestamp at which `created` transitions to `expired`. */
  expiryAt?: string;
  fromAddress?: string;
  toAddress?: string;
  transactionHash?: string;
  // TODO: verify against live API — fields above are derived from the WC
  // plugin's SQL columns, not from public docs. Some fields may be present
  // only on certain endpoints / statuses.
  [k: string]: unknown;
}

export interface CreatePaymentInput {
  /**
   * Payment amount. Numbers are serialized to a fixed-2-decimal string
   * (matching the plugin's `number_format($total, 2, '.', '')`). Pass a
   * string yourself if you need different precision.
   */
  amount: number | string;
  /** ISO 4217 currency code or any Kinesis-supported currency. */
  currency: string;
}

export interface ConfirmPaymentInput {
  /** The `globalPaymentId` returned by createPayment. */
  paymentId: string;
  /**
   * Merchant-side order identifier sent to Kinesis as `orderId`. Passed
   * through verbatim — the SDK does NOT add prefixes (the WC plugin's
   * `'confirmed_'` prefix is a plugin choice, not an API requirement).
   */
  orderId: string;
}
