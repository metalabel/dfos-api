/**
 * The README's "Signed requests" example, kept compiling. This file is
 * typechecked (`tsconfig.json` includes `tests/`) but never run — no `.spec`
 * suffix, so vitest ignores it, and nothing imports it. The mirror contract
 * with the README is enforced by `readme-mirror.spec.ts`; the allowed
 * divergences are importing from `../src/index.js` instead of the package
 * name (so the check runs against the real source), the `declare const`
 * stand-ins, and the trailing export.
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

export { data, error };
