import createClient from 'openapi-fetch';

import type { paths } from './generated/api.js';

/** The production DFOS API. Matches the `servers` entry in the OpenAPI spec. */
export const DFOS_API_BASE_URL = 'https://api.dfos.com/v1';

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
 * Every operation is anonymous except the credential-gated family — all GETs:
 * `GET /v1/profile`, `GET /v1/credential`, and the membership routes
 * (`GET /v1/memberships`, `GET /v1/membership/{space}`,
 * `GET /v1/group-memberships`, `GET /v1/group-membership/{group}`). The one
 * write, `POST /v1/key-proof/present`, is anonymous by design — its envelope
 * is self-authenticating. To call the gated routes, pass
 * `createApiAuthFetch({ credential, kid, sign })` from
 * `@metalabel/dfos-client/api-auth` (v0.33.0+) via the `fetch` option —
 * nothing else about the client changes. See the README's "Signed requests"
 * section.
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
