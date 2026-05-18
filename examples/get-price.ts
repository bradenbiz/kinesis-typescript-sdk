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

const mid = await kms.market.getMidPrice('KAU_C1USD');
console.log('Mid price for KAU_C1USD:', mid);

const depth = await kms.market.getDepth('KAU_C1USD');
console.log('Top of book:', {
  bid: depth.depthItems.bid[0],
  ask: depth.depthItems.ask[0],
});
