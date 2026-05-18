import { describe, expect, it } from 'vitest';
import {
  AuthError,
  InsufficientFundsError,
  KinesisAPIError,
  PriceValidationError,
  RateLimitError,
  mapApiError,
} from './errors.js';

describe('mapApiError', () => {
  it('maps price_validation_failure code to PriceValidationError regardless of status', () => {
    const err = mapApiError(400, { code: 'price_validation_failure', message: 'too low' });
    expect(err).toBeInstanceOf(PriceValidationError);
    expect(err.code).toBe('price_validation_failure');
    expect(err.message).toBe('too low');
  });

  it('maps 401 to AuthError', () => {
    const err = mapApiError(401, { code: 'unauthorized', message: 'bad key' });
    expect(err).toBeInstanceOf(AuthError);
    expect(err.statusCode).toBe(401);
  });

  it('maps 429 to RateLimitError and carries retryAfter', () => {
    const err = mapApiError(429, { code: 'rate_limited' }, { retryAfter: 7 });
    expect(err).toBeInstanceOf(RateLimitError);
    expect((err as RateLimitError).retryAfter).toBe(7);
  });

  it('maps insufficient_funds code to InsufficientFundsError', () => {
    const err = mapApiError(400, { code: 'insufficient_funds', message: 'broke' });
    expect(err).toBeInstanceOf(InsufficientFundsError);
  });

  it('falls back to generic KinesisAPIError for unmapped 5xx', () => {
    const err = mapApiError(503, { message: 'down' });
    expect(err).toBeInstanceOf(KinesisAPIError);
    expect(err).not.toBeInstanceOf(AuthError);
    expect(err.statusCode).toBe(503);
  });

  it('preserves the raw body', () => {
    const body = { code: 'something', extra: 'info' };
    const err = mapApiError(400, body);
    expect(err.raw).toBe(body);
  });
});
