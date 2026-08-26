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
| `baseUrl` | `https://api.dfos.com/v1/` | Point the client at another deployment.              |
| `fetch`   | the global `fetch`         | Supply your own fetch (see "Signed requests" below). |

Everything else — retries, timeouts, caching — is your fetch's job, not this
package's.

## Forward compatibility

The API adds to its responses without bumping a version. Clients must:

- **Tolerate unknown fields.** New response fields appear without a version
  bump; ignore fields you don't recognize.
- **Tolerate unknown enum values.** Enums such as `joinMode` and `siteMode` can
  grow new members; treat an unrecognized value as an opaque string, not an
  error.
- **Treat cursors as opaque tokens.** Pass `nextCursor` and `previousCursor`
  back verbatim; never parse or construct a cursor.
- **Treat subdomains as mutable aliases.** A space's subdomain can change or be
  reassigned. The space `id` and protocol `did` are the canonical, stable
  identifiers to store.
- **Treat signed media URLs as ephemeral.** Data responses are `no-store`, and
  media in a public post comes back as time-limited signed URLs (see
  `urlExpiresAt`). Never persist one; re-fetch the post for fresh URLs.
- **Expect uninformative 404s.** A non-public or missing space returns a 404
  deliberately indistinguishable from any other; the API never reveals whether
  a space it won't serve actually exists.

The generated types are a snapshot of one moment in a growing spec. Code that
matches exhaustively on an enum, or that assumes a response has no fields beyond
the ones it knows, will break on a spec that was never breaking.

## Signed requests

Two operations are credential-gated: `GET /v1/profile`
(`profile.getOwnProfile`) and `GET /v1/memberships`
(`memberships.listMemberships`). Each requires **both** security schemes —
`dfosRequestProof` and `dfosCredential`, ANDed, so neither artifact works
alone. Every other operation is an anonymous `GET`: no credentials are required
or accepted, and the default fetch is all you need.

Both routes answer about the user who granted you access, and neither takes a
path parameter, because the credential names the subject:

- **`GET /v1/profile`** is assembled from the actions the grant actually
  carries: the profile fields (`username`, `displayName`, `description`,
  `createdAt`) are present only under `read:profile`, and `email` only under
  `read:email` — absent, not null, otherwise. Only `did` is unconditional, so
  the generated types mark every other field optional. A `read:email`-only
  credential receives `{ did, email }`.
- **`GET /v1/memberships`** requires `read:memberships` and lists every space
  the user currently belongs to — private and unlisted spaces included; that is
  what the consent line grants — cursor-paginated, each with the user's role
  and their groups inside that space. Pass `?space=` to check a single space
  instead of walking the list. Route reference:
  [docs.dfos.com/docs/api/memberships](https://docs.dfos.com/docs/api/memberships).

The user issues the credential to your application through
[Sign In With DFOS](https://protocol.dfos.com/siwd) — the
[setup guide](https://docs.dfos.com/docs/developers/sign-in-with-dfos/setup)
walks through registering an app and obtaining one. A consent can span several
scope sets, and the resulting single credential carries the combined action
list. Calling a gated route takes that credential plus a fresh request proof
signed per call. Both arrive through the `fetch` seam:
`createApiAuthFetch` from `@metalabel/dfos-client` (v0.33.0+) builds a signing
fetch from your credential and key:

```ts
import { createDfosApi } from '@metalabel/dfos-api';
import { createApiAuthFetch } from '@metalabel/dfos-client/api-auth'; // v0.33.0+

const api = createDfosApi({
  fetch: createApiAuthFetch({ credential, kid, sign }),
});

const { data, error } = await api.GET('/profile');
const memberships = await api.GET('/memberships');
```

The same signing fetch serves both gated routes — which route a call may use is
the credential's business, not the client's.

The adapter signs exactly the `Request` the client composes — method, target,
and body octets — buffering request bodies in full, refusing plaintext requests
to non-loopback hosts, and never following redirects. Underneath it composes
`signApiRequest` and `buildApiAuthHeaders`, which stay exported for signing
backends that describe a request rather than receive one. The byte contract and
the two headers are specified in
[API-AUTH](https://protocol.dfos.com/api-auth); the signing itself lives in
`@metalabel/dfos-client`, not here — this package stays a typed view of the
spec.

For a runnable end-to-end example — consent, credential, signed call — see the
[SIWD demo](https://github.com/metalabel/dfos/tree/main/examples/siwd-demo).
[`api/profile.ts`](https://github.com/metalabel/dfos/blob/main/examples/siwd-demo/api/profile.ts)
is the live reference consumer: it builds a proof with `signApiRequest` and
calls `GET /v1/profile` through this seam.

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

- API docs: https://docs.dfos.com/api
- Get a credential (SIWD setup guide): https://docs.dfos.com/docs/developers/sign-in-with-dfos/setup
- Memberships route reference: https://docs.dfos.com/docs/api/memberships
- OpenAPI spec: https://api.dfos.com/openapi.json
- DFOS protocol: https://protocol.dfos.com
- SIWD demo, end to end: https://github.com/metalabel/dfos/tree/main/examples/siwd-demo

## License

MIT
