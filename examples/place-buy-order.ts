import { KinesisExchangeClient, PriceValidationError } from 'kinesis-exchange-sdk';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

const kms = new KinesisExchangeClient({
  publicKey: requireEnv('KINESIS_PUBLIC_KEY'),
  privateKey: requireEnv('KINESIS_PRIVATE_KEY'),
});

try {
  const order = await kms.orders.buy({
    currencyPairId: 'KAU_USD',
    receive: 0.5,
    available: 50,
    orderType: 'limit',
    limitPrice: 85.0,
  });
  console.log('Order placed:', order.id);

  if (order.id !== undefined) {
    const cancelled = await kms.orders.cancel(String(order.id));
    console.log('Cancelled:', cancelled.status);
  }
} catch (err) {
  if (err instanceof PriceValidationError) {
    // E.g. price below the Kinesis floor — react according to your strategy.
    console.warn('Price validation failed:', err.message);
  } else {
    throw err;
  }
}
