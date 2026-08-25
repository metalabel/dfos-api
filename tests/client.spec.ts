import { describe, expect, it } from 'vitest';

import { createDfosApi } from '../src/index.js';

/**
 * A fetch stub that records every request and replies with a fixed JSON body.
 * These tests never touch the network — the real API is exercised by hand, not
 * in the suite.
 */
function stubFetch(body: unknown = {}, init: ResponseInit = { status: 200 }) {
  const calls: Request[] = [];
  const fetch = async (request: Request): Promise<Response> => {
    calls.push(request);
    return new Response(JSON.stringify(body), {
      ...init,
      headers: { 'content-type': 'application/json', ...init.headers },
    });
  };
  return { calls, fetch };
}

describe('createDfosApi', () => {
  it('composes a path parameter onto the production base URL', async () => {
    const { calls, fetch } = stubFetch();
    const api = createDfosApi({ fetch });

    await api.GET('/spaces/{space}', { params: { path: { space: 'metalabel' } } });

    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe('https://api.dfos.com/v1/spaces/metalabel');
    expect(calls[0]!.method).toBe('GET');
  });

  it('respects a baseUrl override', async () => {
    const { calls, fetch } = stubFetch();
    const api = createDfosApi({ baseUrl: 'http://localhost:8787/v1/', fetch });

    await api.GET('/protocol');

    expect(calls[0]!.url).toBe('http://localhost:8787/v1/protocol');
  });

  it('serializes query parameters', async () => {
    const { calls, fetch } = stubFetch();
    const api = createDfosApi({ fetch });

    await api.GET('/spaces', {
      params: { query: { joinMode: 'open', limit: 20, after: 'eyJpZCI6InNwYWNlIn0' } },
    });

    const url = new URL(calls[0]!.url);
    expect(url.origin + url.pathname).toBe('https://api.dfos.com/v1/spaces');
    expect(url.searchParams.get('joinMode')).toBe('open');
    expect(url.searchParams.get('limit')).toBe('20');
    expect(url.searchParams.get('after')).toBe('eyJpZCI6InNwYWNlIn0');
  });

  it('round-trips a typed 200 body as data', async () => {
    const { fetch } = stubFetch({
      relayUrl: 'https://relay.dfos.com',
      didMethod: 'did:dfos',
      specUrl: 'https://protocol.dfos.com/spec',
      endpoints: {
        wellKnown: 'https://relay.dfos.com/.well-known/dfos-relay',
        identity: 'https://relay.dfos.com/proof/v1/identities/{did}',
        identityLog: 'https://relay.dfos.com/proof/v1/identities/{did}/log',
        content: 'https://relay.dfos.com/proof/v1/content/{did}',
        contentLog: 'https://relay.dfos.com/proof/v1/content/{did}/log',
        operation: 'https://relay.dfos.com/proof/v1/operations/{cid}',
        blob: 'https://relay.dfos.com/proof/v1/blobs/{cid}',
        indexContent: 'https://relay.dfos.com/proof/v1/index/content',
        indexIdentities: 'https://relay.dfos.com/proof/v1/index/identities',
      },
    });
    const api = createDfosApi({ fetch });

    const { data, error } = await api.GET('/protocol');

    expect(error).toBeUndefined();
    expect(data?.didMethod).toBe('did:dfos');
    expect(data?.endpoints.identity).toContain('{did}');
  });

  // The seam the signed-request path depends on. `tsc` over this file is what
  // pins it: a wrapper that only ever handles a `Request` must be assignable
  // to the `fetch` option, and the global fetch must be too.
  it('passes the composed Request to a wrapping fetch', async () => {
    const seen: Record<string, string> = {};
    const api = createDfosApi({
      fetch: async (request) => {
        const headers = new Headers(request.headers);
        headers.set('authorization', 'DFOS test-proof');
        const signed = new Request(request, { headers });
        seen.authorization = signed.headers.get('authorization') ?? '';
        seen.url = signed.url;
        return new Response('{}', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    });

    await api.GET('/spaces/{space}', { params: { path: { space: 'home' } } });

    expect(seen.authorization).toBe('DFOS test-proof');
    expect(seen.url).toBe('https://api.dfos.com/v1/spaces/home');
  });

  it('accepts the global fetch as the fetch option', () => {
    expect(() => createDfosApi({ fetch: globalThis.fetch })).not.toThrow();
  });

  it('surfaces a non-2xx body as error, not data', async () => {
    const { fetch } = stubFetch(
      { defined: true, code: 'E_RATE_LIMITED', status: 429, message: 'Rate limit exceeded' },
      { status: 429 },
    );
    const api = createDfosApi({ fetch });

    const { data, error } = await api.GET('/spaces/{space}', {
      params: { path: { space: 'metalabel' } },
    });

    expect(data).toBeUndefined();
    expect(error).toBeDefined();
  });
});
