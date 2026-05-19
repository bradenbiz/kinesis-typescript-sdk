import { buildAuthHeaders } from './auth.js';
import { KinesisPayAuthError, mapPayError } from './errors.js';

export interface PayHttpClientOptions {
  publicKey: string;
  privateKey: string;
  baseUrl: string;
  timeout: number;
  retries: number;
  fetch?: typeof fetch;
}

export interface PayRequest {
  method: 'GET' | 'POST';
  path: string;
  body?: unknown;
}

const RETRYABLE_STATUS = new Set([500, 502, 503, 504]);

export class PayHttpClient {
  private readonly opts: PayHttpClientOptions;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: PayHttpClientOptions) {
    this.opts = opts;
    const f = opts.fetch ?? globalThis.fetch;
    if (!f) {
      throw new Error('No fetch implementation available; pass `fetch` in options.');
    }
    // See ../transport/http.ts — V8 isolates throw "Illegal invocation" when
    // fetch is called with a receiver other than globalThis.
    this.fetchImpl = f.bind(globalThis);
  }

  async request<T = unknown>(req: PayRequest): Promise<T> {
    const bodyStr = req.body === undefined ? undefined : JSON.stringify(req.body);
    const url = `${this.opts.baseUrl}${req.path}`;

    let attempt = 0;
    while (true) {
      const auth = await buildAuthHeaders({
        publicKey: this.opts.publicKey,
        privateKey: this.opts.privateKey,
        method: req.method,
        path: req.path,
        body: bodyStr,
      });
      const headers: Record<string, string> = { ...auth };
      if (bodyStr !== undefined) headers['Content-Type'] = 'application/json';

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
        return parsed as T;
      }

      const err = mapPayError(response.status, parsed);
      // Auth errors are terminal — bad keys won't fix themselves on retry.
      if (err instanceof KinesisPayAuthError) throw err;
      if (RETRYABLE_STATUS.has(response.status) && attempt < this.opts.retries) {
        await sleep(backoff(attempt));
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

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function backoff(attempt: number): number {
  const base = 250 * 2 ** attempt;
  const jitter = Math.random() * base * 0.25;
  return Math.min(base + jitter, 5000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
