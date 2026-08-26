/**
 * The README's "Signed requests" example, kept compiling. This file is
 * typechecked (`tsconfig.json` includes `tests/`) but never run — no `.spec`
 * suffix, so vitest ignores it, and nothing imports it. If the example in the
 * README changes, change this file to match, and vice versa. The only
 * divergence from the README is importing from `../src/index.js` instead of
 * the package name, so the check runs against the real source.
 */
import { createApiAuthFetch } from '@metalabel/dfos-client/api-auth';

import { createDfosApi } from '../src/index.js';

declare const credential: string;
declare const kid: string;
declare const sign: (message: Uint8Array) => Promise<Uint8Array>;

const api = createDfosApi({
  fetch: createApiAuthFetch({ credential, kid, sign }),
});

const { data, error } = await api.GET('/profile');
const memberships = await api.GET('/memberships');
const membership = await api.GET('/membership/{space}', {
  params: { path: { space: 'metalabel' } },
});

export { data, error, memberships, membership };
