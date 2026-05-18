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

const sub = kms.sockets.subscribeDepth(['KAU_C1USD', 'KAG_C1USD'], {
  onInit: (snapshots) => {
    for (const s of snapshots) {
      console.log(
        `Initial depth ${s.symbolId}: bid=${s.depth.bid[0]?.price} ask=${s.depth.ask[0]?.price}`,
      );
    }
  },
  onChange: (update) => {
    console.log(
      `Δ ${update.symbolId} (${update.direction}): top=${update.depth[update.direction][0]?.price}`,
    );
  },
  onReconnect: () => console.log('Resubscribed after reconnect'),
  onError: (err) => console.error('Socket error:', err.message),
});

// Keep the process alive for an hour, then close.
setTimeout(() => sub.close(), 60 * 60 * 1000);
