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

// Depth subscribes one symbol per socket. Open multiple for multiple pairs.
const sub = kms.sockets.subscribeDepth('KAU_C1USD', {
  onInit: (snapshots) => {
    for (const s of snapshots) {
      console.log(`Initial depth ${s.symbolId}: bid=${s.bid[0]?.price} ask=${s.ask[0]?.price}`);
    }
  },
  onChange: (update) => {
    console.log(
      `Δ ${update.symbolId} (${update.direction}): top=${update.depth[0]?.price} @ ${update.depth[0]?.amount}`,
    );
  },
  onReconnect: () => console.log('Resubscribed after reconnect'),
  onError: (err) => console.error('Socket error:', err.message),
});

setTimeout(() => sub.close(), 60 * 60 * 1000);
