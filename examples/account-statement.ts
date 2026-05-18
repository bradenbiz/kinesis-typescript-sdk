import { KinesisExchangeClient } from 'kinesis-exchange-sdk';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

const kms = new KinesisExchangeClient({
  publicKey: requireEnv('KINESIS_PUBLIC_KEY'),
  privateKey: requireEnv('KINESIS_PRIVATE_KEY'),
});

const holdings = await kms.account.getHoldings();
console.log('Holdings:', holdings);

const statement = await kms.account.getStatement({
  fromDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
  toDate: new Date(),
  currencyCode: 'KAU',
});
console.log('30-day KAU statement:', statement);
