# kinesis-exchange-sdk

TypeScript SDK for the **Kinesis Money KMS Exchange** REST + WebSocket API.

## Not to be confused with `js-kinesis-sdk`

Kinesis has two API surfaces. This SDK covers the exchange/platform API, **not** the blockchain layer.

| Layer | What it's for | Library |
|---|---|---|
| **Blockchain (Horizon)** | Sending KAU between blockchain addresses, ledger history | [`@bullioncapital/js-kinesis-sdk`](https://github.com/bullioncapital/js-kinesis-sdk) |
| **KMS Exchange / Platform** | Trading, holdings, real-time market data, withdrawals | **this SDK** |
| **Kinesis Pay** | Merchant payments | (separate; not covered here) |

If what you want is "send KAU from address A to address B," you want `js-kinesis-sdk`. If what you want is "place a buy order on the Kinesis exchange" or "stream live depth," you're in the right place.

## Install

```bash
npm install kinesis-exchange-sdk
```

## Quickstart — REST

```ts
import { KinesisExchangeClient } from 'kinesis-exchange-sdk';

const kms = new KinesisExchangeClient({
  publicKey: process.env.KINESIS_PUBLIC_KEY!,
  privateKey: process.env.KINESIS_PRIVATE_KEY!,
});

const mid = await kms.market.getMidPrice('KAU_C1USD');
const depth = await kms.market.getDepth('KAU_C1USD');
const holdings = await kms.account.getHoldings();
```

The client signs every request with HMAC-SHA256 per Kinesis's documented scheme — you pass your keys, signing is invisible.

### Public-only usage (no keys)

Market-data endpoints (`getAllSnapshots`, `getSnapshot`, `getSnapshotsForCurrency`, `getOHLC`) and the socket channels (`subscribeSnapshots`, `subscribeDepth`) live on a separate unauthenticated host and don't need keys. Omit them entirely:

```ts
const kms = new KinesisExchangeClient({});
const snapshots = await kms.market.getAllSnapshots();
```

Calls to authenticated endpoints (orders, holdings, pairs, mid-price REST, depth REST) without keys will be rejected by the server. The TypeScript surface lets you construct the client without keys; per-call enforcement is on the server.

### Cloudflare Workers / non-Node runtimes

If you're running in a V8-isolate environment (Workers, some edge runtimes), the SDK binds `globalThis.fetch` internally so you don't have to. You can still pass a custom fetch via the `fetch` option if you need a proxied client.

## Quickstart — Orders

```ts
// Generic form (matches docs exactly)
await kms.orders.place({
  currencyPairId: 'KAU_C1USD',
  direction: 'buy',
  amount: 10,
  orderType: 'limit',
  limitPrice: 90.5,
});

// receive/available semantics for buys (Kinesis handles fee math)
await kms.orders.buy({
  currencyPairId: 'KAU_C1USD',
  receive: 5,         // KAU to end up with
  available: 1000,    // max USD to spend
  orderType: 'limit',
  limitPrice: 90.5,
});

// spend semantics for sells
await kms.orders.sell({
  currencyPairId: 'KAU_C1USD',
  spend: 5,
  orderType: 'limit',
  limitPrice: 90.5,
});

await kms.orders.cancel(orderId);
```

## Quickstart — WebSocket

```ts
const sub = kms.sockets.subscribeDepth(['KAU_C1USD', 'KAG_C1USD'], {
  onInit: (snapshots) => { /* full state for each subscribed pair */ },
  onChange: (update) => { /* one side of one pair changed */ },
  onReconnect: () => console.log('Resubscribed after disconnect'),
  onError: (err) => console.error(err),
});

// Snapshot-on-demand without waiting for next change:
sub.latest;

sub.close();
```

The three socket channels (`subscribeDepth`, `subscribeMidPrice`, `subscribeSnapshots`) handle auth, reconnect with exponential backoff, and automatic resubscribe on reconnect.

## Error handling

```ts
import {
  KinesisAPIError,
  AuthError,
  RateLimitError,
  PriceValidationError,
  InsufficientFundsError,
  SchemaMismatchError,
} from 'kinesis-exchange-sdk';

try {
  await kms.orders.buy({ /* ... */ });
} catch (err) {
  if (err instanceof PriceValidationError) {
    // Order rejected for being outside allowed price range (e.g. below floor)
  } else if (err instanceof AuthError) {
    // Key revoked or signature bad — stop and alert, don't retry
  } else if (err instanceof RateLimitError) {
    // err.retryAfter (seconds) if the server gave a Retry-After header
  } else if (err instanceof SchemaMismatchError) {
    // Response shape diverged from the SDK's schemas. Inspect err.raw.
  }
}
```

`AuthError` (401) is **not** retried — the SDK assumes a bad/revoked key is terminal. 5xx and 429 responses retry with exponential backoff up to `retries` (default 3).

## Kinesis Pay (merchant API) — separate entry point

`kinesis-exchange-sdk/pay` is a client for the Kinesis Pay merchant API — accept KAU/KAG payments from customers via QR scan. It's an entirely different API surface from the exchange client above (different base URL, different keys, no shared response shapes), so it lives at its own subpath. Built on Web Crypto + global `fetch`, so it runs on Cloudflare Workers and any V8-isolate edge runtime without modification.

```ts
import { KinesisPayClient, KINESIS_PAY_QA_BASE_URL, KINESIS_PAY_QA_KMS_BASE_URL }
  from 'kinesis-exchange-sdk/pay';

const pay = new KinesisPayClient({
  publicKey: process.env.KINESIS_PAY_ACCESS_TOKEN!,
  privateKey: process.env.KINESIS_PAY_SECRET_TOKEN!,
  merchantId: process.env.KINESIS_PAY_MERCHANT_ID!,
  // For QA: pass these explicitly. Defaults to production.
  // baseUrl: KINESIS_PAY_QA_BASE_URL,
  // kmsBaseUrl: KINESIS_PAY_QA_KMS_BASE_URL,
});

// 1. Create a payment for $10 USD.
const payment = await pay.createPayment({ amount: 10, currency: 'USD' });

// 2. Encode getRedirectUrl(paymentId) as a QR code in your UI.
//    When the customer scans, they go to the Kinesis app to approve.
const qrUrl = pay.getRedirectUrl(payment.globalPaymentId!);

// 3. Poll until the payment is terminal. Defaults are correct out of the box
//    — 10s interval, 10min total, terminal = ['processed', 'rejected',
//    'expired']. Funds move automatically when the customer approves; the
//    SDK does not have to do anything to make that happen.
const observed = await pay.pollUntilTerminal(payment.globalPaymentId!);

// 4. On success, attach your merchant-internal order identifier to the
//    payment for reconciliation. confirmPayment does NOT move funds —
//    the customer's approval did that. This call is optional but
//    recommended; the orderId persists server-side and shows up on
//    subsequent getPaymentStatus calls.
if (observed.status === 'processed') {
  await pay.confirmPayment({
    paymentId: payment.globalPaymentId!,
    orderId: 'your-internal-order-123',
  });
}
```

### Two things to know

- **There are no webhooks.** You must poll. The SDK ships `pollUntilTerminal(paymentId, opts)` with sensible defaults (10s interval, 10min timeout, AbortSignal support).
- **`confirmPayment` does NOT move funds.** Funds move automatically when the customer approves in their Kinesis app — the status transitions `created → processed` directly. `confirmPayment` attaches your merchant-internal `orderId` to the payment record for reconciliation; it can be called any time after `processed`. Calling with a different `orderId` overwrites.

### Local development with `npm link`

If you're consuming this SDK from a project that's part of an npm workspace, `npm link` only takes when run from the workspace root with `--workspace`:

```sh
# Wrong — silently no-ops from inside a workspace child:
cd apps/adapter && npm link kinesis-exchange-sdk

# Right — run from the workspace root:
npm link kinesis-exchange-sdk --workspace=apps/adapter
```

The symlink lands in the root `node_modules/` (hoisted), which is what Node's resolver expects.

### Auth divergence from the exchange client

The merchant API uses the same HMAC-SHA256 scheme as the exchange API but with two differences the SDK handles for you:

- Body placeholder when no body is sent is the literal string `'{}'`, not the empty string the exchange API uses.
- Headers are lowercase: `x-api-key`, `x-nonce`, `x-signature`.

The exchange client at `src/auth.ts` uses `node:crypto`, while the Pay client uses Web Crypto. A future refactor could unify them — neither is broken; they grew independently.

## Withdrawal — separate entry point

Withdrawal is deliberately separated from the main client. Consumers that should never have withdrawal capability simply never import `./withdrawal`. The default `KinesisExchangeClient` cannot withdraw funds.

```ts
import { KinesisWithdrawalClient } from 'kinesis-exchange-sdk/withdrawal';

const withdraw = new KinesisWithdrawalClient({
  publicKey: process.env.KINESIS_PUBLIC_KEY!,
  privateKey: process.env.KINESIS_PRIVATE_KEY!,
});

await withdraw.toAddress({
  amount: 1.5,
  currencyCode: 'KAU',
  address: 'G...',
  memo: 'optional',
});
```

## Configuration

```ts
new KinesisExchangeClient({
  publicKey: '...',
  privateKey: '...',
  baseUrl: 'https://client-api.kinesis.money',  // default
  timeout: 10_000,                              // ms, default 10s
  retries: 3,                                   // default
  fetch: customFetch,                           // optional override
});
```

## License Compliance

This SDK is open source under Apache 2.0. **Use of the Kinesis API is governed by Kinesis's [API License Agreement](https://kinesis.money/about-us/documents/api-license-agreement/)** — your application is subject to it regardless of which client library you use. In particular, note:

- **§2.1** API access is limited to internal business purposes.
- **§2.3** No sharing of API keys — affects multi-tenant SaaS designs.
- **§3.8** No replacement of Kinesis's user experience — don't build a competing exchange interface.
- **§5** Kinesis may change the API at any time; adaptation is your responsibility.

This README is not legal advice. Read the agreement before choosing a deployment model.

## Status

v0.1 work in progress. Schemas are intentionally lenient — unknown response fields pass through and surface as `SchemaMismatchError` only when type expectations are clearly violated. As the SDK is exercised against the live API, schemas will tighten and edge cases will be covered.
