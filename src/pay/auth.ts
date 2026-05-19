// Web Crypto HMAC for the Kinesis Pay merchant API.
//
// Why Web Crypto (and not node:crypto): this module is designed to run on
// Cloudflare Workers (and any V8-isolate / Edge runtime), which do not expose
// Node's crypto module. crypto.subtle is portable across Node 20+, Bun, Deno,
// browsers, and Workers — strictly more portable than node:crypto.
//
// The signing scheme matches the canonical WooCommerce plugin in
// bullioncapital/kinesis-pay-woocommerce/includes/api.php:
//
//   nonce     = Date.now() (milliseconds, as a string)
//   message   = nonce + METHOD + path + (body || '{}')
//   signature = HEX(HMAC-SHA256(privateKey, message)).toUpperCase()
//
// Notable differences from the exchange API's signing scheme (which lives in
// ../auth.ts and uses node:crypto):
//   - Body placeholder is '{}' (not the empty string) when no body is present.
//   - Header names are lowercase: x-api-key, x-nonce, x-signature.

const ENCODER = new TextEncoder();

// Cache the imported CryptoKey by key material. Re-importing on every request
// is wasteful — Workers reuse the same module instance across requests.
let keyCache: { material: string; promise: Promise<CryptoKey> } | undefined;

async function getKey(privateKey: string): Promise<CryptoKey> {
  if (keyCache && keyCache.material === privateKey) return keyCache.promise;
  const promise = crypto.subtle.importKey(
    'raw',
    ENCODER.encode(privateKey),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  keyCache = { material: privateKey, promise };
  return promise;
}

function bufToHexUpper(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) {
    // biome-ignore lint/style/noNonNullAssertion: bytes[i] is defined within bounds
    s += bytes[i]!.toString(16).padStart(2, '0');
  }
  return s.toUpperCase();
}

export function createNonce(): string {
  return Date.now().toString();
}

export interface SignatureInput {
  nonce: string;
  method: string;
  path: string;
  /** Already-serialized request body. Falsy values are signed as `'{}'`. */
  body?: string;
}

export async function sign(privateKey: string, input: SignatureInput): Promise<string> {
  const bodyPart = input.body && input.body.length > 0 ? input.body : '{}';
  const message = `${input.nonce}${input.method.toUpperCase()}${input.path}${bodyPart}`;
  const key = await getKey(privateKey);
  const sig = await crypto.subtle.sign('HMAC', key, ENCODER.encode(message));
  return bufToHexUpper(sig);
}

export interface SignedHeaders {
  'x-api-key': string;
  'x-nonce': string;
  'x-signature': string;
}

export async function buildAuthHeaders(args: {
  publicKey: string;
  privateKey: string;
  method: string;
  path: string;
  body?: string;
  nonce?: string;
}): Promise<SignedHeaders> {
  const nonce = args.nonce ?? createNonce();
  const signature = await sign(args.privateKey, {
    nonce,
    method: args.method,
    path: args.path,
    body: args.body,
  });
  return {
    'x-api-key': args.publicKey,
    'x-nonce': nonce,
    'x-signature': signature,
  };
}
