import { vi } from 'vitest';

export type FetchFn = (url: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export function mockFetch(impl: FetchFn) {
  return vi.fn<FetchFn>(impl);
}

export function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
}

/** Pull the args of a recorded mock call, throwing if the index is out of range. */
export function callArgs<T extends unknown[]>(mock: { mock: { calls: T[] } }, index = 0): T {
  const call = mock.mock.calls[index];
  if (!call) throw new Error(`Expected mock call at index ${index}, got none`);
  return call;
}

/** Get the second (RequestInit) argument from a recorded fetch call, throwing if missing. */
export function callInit(mock: { mock: { calls: Parameters<FetchFn>[] } }, index = 0): RequestInit {
  const args = callArgs(mock, index);
  const init = args[1];
  if (!init) throw new Error('Expected RequestInit on call');
  return init;
}

/** Get the URL string of a recorded fetch call. */
export function callUrl(mock: { mock: { calls: Parameters<FetchFn>[] } }, index = 0): string {
  const args = callArgs(mock, index);
  const url = args[0];
  return typeof url === 'string' ? url : url.toString();
}
