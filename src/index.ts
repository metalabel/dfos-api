import createClient from 'openapi-fetch';

import type { paths } from './generated/api.js';

/** The production DFOS API. Matches the `servers` entry in the OpenAPI spec. */
export const DFOS_API_BASE_URL = 'https://api.dfos.com/v1/';

export interface DfosApiOptions {
  /** API base URL. Defaults to the production DFOS API. */
  baseUrl?: string;
  /**
   * Custom fetch implementation — the seam for signed requests. Called with a
   * single fully-composed `Request`, which is why the signature is narrower
   * than `typeof globalThis.fetch`: the global fetch is assignable to this,
   * and so is a wrapper that only ever handles a `Request`. Typing it as the
   * global instead would reject the wrapper, which is the whole point of the
   * seam.
   */
  fetch?: (request: Request) => Promise<Response>;
}

/**
 * Create a typed client for the public DFOS API.
 *
 * Every operation is an anonymous GET except `GET /v1/profile`, which is
 * credential-gated. To call it, pass a fetch wrapped with `signApiRequest`
 * from `@metalabel/dfos-client/api-auth` via the `fetch` option — nothing
 * else about the client changes. See the README's "Signed requests" section.
 */
export function createDfosApi(options: DfosApiOptions = {}) {
  return createClient<paths>({
    baseUrl: options.baseUrl ?? DFOS_API_BASE_URL,
    // Spread rather than assign: under exactOptionalPropertyTypes an explicit
    // `fetch: undefined` is not the same as an absent key, and openapi-fetch
    // only falls back to the global fetch when the key is absent.
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
}

export type { paths, components, operations } from './generated/api.js';
