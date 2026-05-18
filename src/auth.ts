import { createHmac } from 'node:crypto';

export interface SignatureInput {
  nonce: string;
  method: string;
  path: string;
  body?: string;
}

export interface SignedHeaders {
  'X-API-Key': string;
  'X-Nonce': string;
  'X-Signature': string;
}

export function createNonce(): string {
  return Date.now().toString();
}

// Kinesis HMAC-SHA256 scheme:
//   message   = nonce + METHOD + path + (body || '')
//   signature = HEX(HMAC-SHA256(privateKey, message)).toUpperCase()
// The body string must match the bytes sent on the wire exactly.
export function sign(privateKey: string, input: SignatureInput): string {
  const message = `${input.nonce}${input.method.toUpperCase()}${input.path}${input.body ?? ''}`;
  return createHmac('sha256', privateKey).update(message).digest('hex').toUpperCase();
}

export function buildAuthHeaders(args: {
  publicKey: string;
  privateKey: string;
  method: string;
  path: string;
  body?: string;
  nonce?: string;
}): SignedHeaders {
  const nonce = args.nonce ?? createNonce();
  const signature = sign(args.privateKey, {
    nonce,
    method: args.method,
    path: args.path,
    body: args.body,
  });
  return {
    'X-API-Key': args.publicKey,
    'X-Nonce': nonce,
    'X-Signature': signature,
  };
}
