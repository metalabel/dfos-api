/**
 * The README's "Usage" example, kept compiling — pinning that the fields the
 * README dereferences (`displayName`, `did`) actually exist on the space
 * object, so a spec refresh that drops one fails typecheck here instead of
 * silently breaking the docs. Typechecked but never run: no `.spec` suffix,
 * nothing imports it. The mirror contract with the README is enforced by
 * `readme-mirror.spec.ts`; the only allowed divergence is importing from
 * `../src/index.js` instead of the package name.
 */
import { createDfosApi } from '../src/index.js';

const api = createDfosApi();

const { data, error } = await api.GET('/spaces/{space}', {
  params: { path: { space: 'home' } },
});

if (error) {
  console.error(error);
} else {
  console.log(data.displayName, data.did);
}

export { api };
