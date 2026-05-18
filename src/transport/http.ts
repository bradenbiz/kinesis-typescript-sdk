import type { ZodType } from 'zod';
import { buildAuthHeaders } from '../auth.js';
import {
  AuthError,
  KinesisAPIError,
  RateLimitError,
  SchemaMismatchError,
  mapApiError,
} from '../errors.js';

export interface HttpClientOptions {
  // HMAC keys are optional — omit both for unauthenticated endpoints
  // (e.g. public market-data on fastapi.kinesis.money).
  publicKey?: string;
  privateKey?: string;
  baseUrl: string;
  timeout: number;
  retries: number;
  fetch?: typeof fetch;
}

export interface RequestOptions<T> {
  method: 'GET' | 'POST' | 'DELETE' | 'PATCH' | 'PUT';
  path: string;
  query?: Record<string, string | number | boolean | undefined>;
  body?: unknown;
  schema?: ZodType<T>;
}

const RETRYABLE_STATUS = new Set([500, 502, 503, 504]);

export class HttpClient {
  private readonly opts: HttpClientOptions;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: HttpClientOptions) {
    this.opts = opts;
    const f = opts.fetch ?? globalThis.fetch;
    if (!f) {
      throw new Error('No fetch implementation available; pass `fetch` in options.');
    }
    // Bind to globalThis so calling fetch as a method (`this.fetchImpl(...)`)
    // doesn't fail in V8 isolates that enforce the receiver — notably
    // Cloudflare Workers, which throw "Illegal invocation" otherwise. Native
    // fetch doesn't use `this`; user-supplied fetches that depend on `this`
    // should be pre-bound by the caller.
    this.fetchImpl = f.bind(globalThis);
  }

  async request<T>(req: RequestOptions<T>): Promise<T> {
    const path = buildPath(req.path, req.query);
    const bodyStr = req.body === undefined ? undefined : JSON.stringify(req.body);
    const url = `${this.opts.baseUrl}${path}`;

    let attempt = 0;
    while (true) {
      // Regenerate nonce + signature each attempt (server may reject reused nonces).
      const headers: Record<string, string> = {};
      if (this.opts.publicKey && this.opts.privateKey) {
        Object.assign(
          headers,
          buildAuthHeaders({
            publicKey: this.opts.publicKey,
            privateKey: this.opts.privateKey,
            method: req.method,
            path,
            body: bodyStr,
          }),
        );
      }
      if (req.method !== 'DELETE' && bodyStr !== undefined) {
        headers['Content-Type'] = 'application/json';
      }

      let response: Response;
      try {
        response = await this.fetchWithTimeout(url, {
          method: req.method,
          headers,
          body: bodyStr,
        });
      } catch (err) {
        if (attempt >= this.opts.retries) throw err;
        await sleep(backoff(attempt));
        attempt++;
        continue;
      }

      const parsed = await readJson(response);

      if (response.ok) {
        if (req.schema) {
          const result = req.schema.safeParse(parsed);
          if (!result.success) {
            throw new SchemaMismatchError(
              `Response schema validation failed: ${result.error.message}`,
              { statusCode: response.status, raw: parsed },
            );
          }
          return result.data;
        }
        return parsed as T;
      }

      const retryAfterSec = parseRetryAfter(response.headers.get('retry-after'));
      const err = mapApiError(response.status, parsed, { retryAfter: retryAfterSec });

      if (err instanceof AuthError) throw err;

      const retryable = err instanceof RateLimitError || RETRYABLE_STATUS.has(response.status);
      if (retryable && attempt < this.opts.retries) {
        await sleep(backoff(attempt, retryAfterSec));
        attempt++;
        continue;
      }
      throw err;
    }
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.opts.timeout);
    try {
      return await this.fetchImpl(url, { ...init, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  }
}

function buildPath(
  path: string,
  query?: Record<string, string | number | boolean | undefined>,
): string {
  if (!query) return path;
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined) continue;
    qs.append(k, String(v));
  }
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function backoff(attempt: number, retryAfterSec?: number): number {
  if (retryAfterSec !== undefined) return retryAfterSec * 1000;
  const base = 250 * 2 ** attempt;
  const jitter = Math.random() * base * 0.25;
  return Math.min(base + jitter, 5000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Re-export to keep the error available off this module for advanced callers.
export { KinesisAPIError };
