export class KinesisPayError extends Error {
  readonly statusCode: number;
  readonly raw?: unknown;

  constructor(message: string, opts: { statusCode: number; raw?: unknown }) {
    super(message);
    this.name = 'KinesisPayError';
    this.statusCode = opts.statusCode;
    this.raw = opts.raw;
  }
}

/** 401 / 403 from the Pay API — bad keys, revoked key, or wrong merchantId. */
export class KinesisPayAuthError extends KinesisPayError {
  constructor(
    message = 'Kinesis Pay authentication failed',
    opts: { raw?: unknown; statusCode?: number } = {},
  ) {
    super(message, { statusCode: opts.statusCode ?? 403, raw: opts.raw });
    this.name = 'KinesisPayAuthError';
  }
}

/** Thrown by pollUntilTerminal when the deadline passes without a terminal status. */
export class KinesisPayTimeoutError extends Error {
  constructor(message = 'Polling timed out before payment reached a terminal state') {
    super(message);
    this.name = 'KinesisPayTimeoutError';
  }
}

export function mapPayError(statusCode: number, body: unknown): KinesisPayError {
  const message =
    typeof body === 'object' && body !== null && 'message' in body
      ? String((body as { message: unknown }).message)
      : `HTTP ${statusCode}`;
  if (statusCode === 401 || statusCode === 403) {
    return new KinesisPayAuthError(message, { statusCode, raw: body });
  }
  return new KinesisPayError(message, { statusCode, raw: body });
}
