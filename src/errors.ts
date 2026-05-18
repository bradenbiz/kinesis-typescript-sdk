export class KinesisAPIError extends Error {
  readonly code: string;
  readonly statusCode: number;
  readonly raw?: unknown;

  constructor(message: string, opts: { code: string; statusCode: number; raw?: unknown }) {
    super(message);
    this.name = 'KinesisAPIError';
    this.code = opts.code;
    this.statusCode = opts.statusCode;
    this.raw = opts.raw;
  }
}

export class AuthError extends KinesisAPIError {
  constructor(message = 'Authentication failed', opts: { code?: string; raw?: unknown } = {}) {
    super(message, { code: opts.code ?? 'unauthorized', statusCode: 401, raw: opts.raw });
    this.name = 'AuthError';
  }
}

export class RateLimitError extends KinesisAPIError {
  readonly retryAfter?: number;
  constructor(
    message = 'Rate limit exceeded',
    opts: { code?: string; retryAfter?: number; raw?: unknown } = {},
  ) {
    super(message, { code: opts.code ?? 'rate_limited', statusCode: 429, raw: opts.raw });
    this.name = 'RateLimitError';
    this.retryAfter = opts.retryAfter;
  }
}

export class PriceValidationError extends KinesisAPIError {
  constructor(message: string, opts: { statusCode: number; raw?: unknown }) {
    super(message, {
      code: 'price_validation_failure',
      statusCode: opts.statusCode,
      raw: opts.raw,
    });
    this.name = 'PriceValidationError';
  }
}

export class InsufficientFundsError extends KinesisAPIError {
  constructor(message: string, opts: { statusCode: number; code?: string; raw?: unknown }) {
    super(message, {
      code: opts.code ?? 'insufficient_funds',
      statusCode: opts.statusCode,
      raw: opts.raw,
    });
    this.name = 'InsufficientFundsError';
  }
}

export class SchemaMismatchError extends KinesisAPIError {
  constructor(message: string, opts: { statusCode: number; raw?: unknown }) {
    super(message, { code: 'schema_mismatch', statusCode: opts.statusCode, raw: opts.raw });
    this.name = 'SchemaMismatchError';
  }
}

export function mapApiError(
  statusCode: number,
  body: unknown,
  opts?: { retryAfter?: number },
): KinesisAPIError {
  const raw = body;
  const code =
    typeof body === 'object' && body !== null && 'code' in body
      ? String((body as { code: unknown }).code)
      : `http_${statusCode}`;
  const message =
    typeof body === 'object' && body !== null && 'message' in body
      ? String((body as { message: unknown }).message)
      : `HTTP ${statusCode}`;

  if (code === 'price_validation_failure') {
    return new PriceValidationError(message, { statusCode, raw });
  }
  if (code === 'insufficient_funds') {
    return new InsufficientFundsError(message, { statusCode, code, raw });
  }
  if (statusCode === 401) {
    return new AuthError(message, { code, raw });
  }
  if (statusCode === 429) {
    return new RateLimitError(message, { code, raw, retryAfter: opts?.retryAfter });
  }
  return new KinesisAPIError(message, { code, statusCode, raw });
}
