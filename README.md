# @metalabel/dfos-api

A typed TypeScript client for the public DFOS API at `https://api.dfos.com`.
The API itself — endpoints, parameters, response shapes — is documented at
[docs.dfos.com/api](https://docs.dfos.com/api); this package is the typed way
to call it.

It is three things and nothing else:

- `openapi.json` — a committed snapshot of the live spec at
  `https://api.dfos.com/openapi.json`.
- `src/generated/api.ts` — types generated from that snapshot by
  [openapi-typescript](https://openapi-ts.dev). Committed, so the diff in a spec
  refresh shows what actually changed at the type level.
- `src/index.ts` — a thin wrapper around
  [openapi-fetch](https://openapi-ts.dev/openapi-fetch/) that sets the base URL
  and leaves a seam for a custom `fetch`.

The API is the source of truth. This package is derived from it.

## Install

```sh
npm install @metalabel/dfos-api
```

Requires Node 22 or newer, or any runtime with a global `fetch`.

## Usage

```ts
import { createDfosApi } from '@metalabel/dfos-api';

const api = createDfosApi();

const { data, error } = await api.GET('/spaces/{space}', {
  params: { path: { space: 'home' } },
});

if (error) {
  console.error(error);
} else {
  console.log(data.displayName, data.did);
}
```

Paths, path parameters, query parameters, and response bodies are all typed
from the spec. `data` is present on a 2xx response and `error` on everything
else — one of the two is always set.

Options:

| Option    | Default                    | What it does                                         |
| --------- | -------------------------- | ---------------------------------------------------- |
| `baseUrl` | `https://api.dfos.com/v1`  | Point the client at another deployment.              |
| `fetch`   | the global `fetch`         | Supply your own fetch (see "Signed requests" below). |

Everything else — retries, timeouts, caching — is your fetch's job, not this
package's.

## Signed requests

Most of the API is anonymous `GET`s, and the default fetch is all you need. A
small credential-gated family — `GET /v1/profile`, `GET /v1/credential`, and
the four membership routes — answers about the user who granted your
application access; route semantics live at
[profile](https://docs.dfos.com/docs/api/profile),
[memberships](https://docs.dfos.com/docs/api/memberships), and
[credential](https://docs.dfos.com/docs/api/credential). Users grant that
access through [Sign In With DFOS](https://protocol.dfos.com/siwd): the
[setup recipe](https://docs.dfos.com/docs/developers/sign-in-with-dfos/setup)
takes an application from zero to a credential,
[local apps](https://docs.dfos.com/docs/developers/sign-in-with-dfos/local-apps)
covers CLIs and agents with no domain to stand behind, and
[credentials](https://docs.dfos.com/docs/developers/sign-in-with-dfos/credentials)
explains what the grant carries.

Which routes are gated, and which actions they require, is declared in the spec
itself — the machine-readable convention is the "Advertising in OpenAPI"
section of [API-AUTH](https://protocol.dfos.com/api-auth).

Calling a gated route takes that credential plus a fresh request proof signed
per call. Both arrive through the `fetch` seam — `createApiAuthFetch` from
`@metalabel/dfos-client` (v0.33.0+) builds a signing fetch:

```ts
import { createDfosApi } from '@metalabel/dfos-api';
import { createApiAuthFetch } from '@metalabel/dfos-client/api-auth'; // v0.33.0+

const api = createDfosApi({
  fetch: createApiAuthFetch({ credential, kid, sign }),
});

const { data, error } = await api.GET('/profile');
```

The same signing fetch serves every gated route — which route a call may use is
the credential's business, not the client's. The adapter signs exactly the
`Request` the client composes, buffering request bodies in full, refusing
plaintext requests to non-loopback hosts, and never following redirects. The
byte contract and the two headers are specified in
[API-AUTH](https://protocol.dfos.com/api-auth); the signing itself lives in
`@metalabel/dfos-client`, not here.

## Forward compatibility

The API adds fields and enum members without a version bump, so write clients
that tolerate what they don't recognize. The full contract — what can change
without notice and what never will — is
[docs.dfos.com/docs/api/compatibility](https://docs.dfos.com/docs/api/compatibility).

## Keeping the snapshot current

```sh
pnpm update-spec
```

That fetches `https://api.dfos.com/openapi.json`, rewrites `openapi.json`
(2-space indent, trailing newline, so diffs stay readable), and regenerates
`src/generated/api.ts`. A nightly workflow runs the same command and opens a
pull request onto a fixed `spec-update` branch when the spec has moved, so
repeated drift updates one PR instead of stacking new ones. CI checks the
reverse direction: the committed types must be exactly what the committed
snapshot generates.

## Links

- API reference: https://docs.dfos.com/api
- Route guides: [profile](https://docs.dfos.com/docs/api/profile), [memberships](https://docs.dfos.com/docs/api/memberships), [credential](https://docs.dfos.com/docs/api/credential), [compatibility](https://docs.dfos.com/docs/api/compatibility)
- Sign In With DFOS: [setup](https://docs.dfos.com/docs/developers/sign-in-with-dfos/setup), [credentials](https://docs.dfos.com/docs/developers/sign-in-with-dfos/credentials), [local apps](https://docs.dfos.com/docs/developers/sign-in-with-dfos/local-apps)
- Protocol specs: [SIWD](https://protocol.dfos.com/siwd), [API-AUTH](https://protocol.dfos.com/api-auth)
- DFOS CLI (`dfos login`, credentials for local tools): https://github.com/metalabel/dfos/tree/main/packages/dfos-cli
- SIWD demo, end to end: https://github.com/metalabel/dfos/tree/main/examples/siwd-demo
- OpenAPI spec: https://api.dfos.com/openapi.json

## License

MIT
