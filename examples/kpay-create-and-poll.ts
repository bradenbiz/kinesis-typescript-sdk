// Minimal Kinesis Pay flow: create a payment, get the redirect URL the
// merchant would QR-encode, and poll until it leaves `created`.
//
// No-ops cleanly if env vars are missing rather than crashing — so this
// script is safe to run unattended in CI.

import {
  KINESIS_PAY_QA_BASE_URL,
  KINESIS_PAY_QA_KMS_BASE_URL,
  KinesisPayClient,
} from 'kinesis-exchange-sdk/pay';

const access = process.env.KINESIS_PAY_ACCESS_TOKEN;
const secret = process.env.KINESIS_PAY_SECRET_TOKEN;
const merchant = process.env.KINESIS_PAY_MERCHANT_ID;
const useQa = process.env.KINESIS_PAY_ENV === 'qa';

if (!access || !secret || !merchant) {
  console.log(
    'Skipping: set KINESIS_PAY_ACCESS_TOKEN, KINESIS_PAY_SECRET_TOKEN, and KINESIS_PAY_MERCHANT_ID to run.',
  );
  console.log('Optionally set KINESIS_PAY_ENV=qa to run against the QA environment.');
  process.exit(0);
}

const pay = new KinesisPayClient({
  publicKey: access,
  privateKey: secret,
  merchantId: merchant,
  ...(useQa ? { baseUrl: KINESIS_PAY_QA_BASE_URL, kmsBaseUrl: KINESIS_PAY_QA_KMS_BASE_URL } : {}),
});

// Validate creds first — saves time if they're bad.
await pay.handshake();
console.log('Handshake OK');

const payment = await pay.createPayment({ amount: 1.0, currency: 'USD' });
const paymentId = payment.globalPaymentId ?? payment.paymentId;
if (!paymentId) {
  throw new Error('Create-payment response had no paymentId / globalPaymentId');
}
console.log('Created payment:', paymentId, 'status:', payment.status);
console.log('Customer redirect URL (encode as QR):', pay.getRedirectUrl(paymentId));

// Wait briefly for the customer to act. In a real merchant flow you'd push
// the QR to the customer and poll longer. Use a shorter timeout here so
// the example doesn't block CI for 10 minutes.
console.log('Polling for up to 90s...');
try {
  // Defaults are correct (['processed', 'rejected', 'expired']); we just
  // shorten the interval/timeout here so the demo doesn't block for 10 min.
  const observed = await pay.pollUntilTerminal(paymentId, {
    intervalMs: 5_000,
    timeoutMs: 90_000,
    onUpdate: (p) => console.log('  →', p.status),
  });
  console.log('Final status:', observed.status);

  if (observed.status === 'processed') {
    // Funds have already moved (the customer approved in their Kinesis app).
    // Attach our internal order identifier for reconciliation. This does NOT
    // move funds — it persists the orderId server-side.
    const reconciled = await pay.confirmPayment({ paymentId, orderId: 'example-order' });
    console.log('Attached orderId. Server-stored orderId:', reconciled.orderId);
  }
} catch (err) {
  if (err instanceof Error && err.name === 'KinesisPayTimeoutError') {
    console.log('Payment was not acted on in the polling window — that is fine for a demo.');
  } else {
    throw err;
  }
}
