# @metalabel/dfos-api

A typed TypeScript client for the public DFOS API at `https://api.dfos.com`.

The package is three things and nothing else:

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

The generated types are a snapshot of one moment in a growing spec. Code that
matches exhaustively on an enum, or that assumes a response has no fields beyond
the ones it knows, will break on a spec that was never breaking.

Two more things worth knowing: data responses are `no-store`, so media in a
public post comes back as time-limited signed URLs (see `urlExpiresAt`) — never
persist those, re-fetch the post for fresh ones. And a non-public or missing
space returns a 404 that is deliberately indistinguishable from any other; the
API never reveals whether a space it won't serve actually exists.

## Signed requests

Every endpoint today is an anonymous `GET`. No credentials are required or
accepted, and the default fetch is all you need.

Credential-gated endpoints are coming. When they land, you will sign each
request with a DFOS key and pass a signing fetch through the `fetch` option.
The client calls your fetch with a single `Request`, which is everything the
proof needs to cover:

```ts
import { createDfosApi } from '@metalabel/dfos-api';
import { signApiRequest } from '@metalabel/dfos-client/api-auth'; // v0.32.0+

const api = createDfosApi({
  fetch: async (request) => {
    const url = new URL(request.url);
    const { proof } = await signApiRequest({
      method: request.method,
      host: url.host,
      path: url.pathname + url.search,
      body: new Uint8Array(await request.clone().arrayBuffer()),
      credentialCID,
      kid,
      sign,
    });

    const headers = new Headers(request.headers);
    headers.set('authorization', `DFOS ${proof}`);
    headers.set('x-credential', credential);
    return fetch(new Request(request, { headers }));
  },
});
```

The signing lives in `@metalabel/dfos-client`, not here — this package stays a
typed view of the spec. Nothing about the client surface changes when
authenticated endpoints arrive; you pass a different fetch. The byte contract
and the two headers are specified in
[API-AUTH](https://protocol.dfos.com/api-auth).

## Keeping the snapshot current

```sh
pnpm update-spec
```

That fetches `https://api.dfos.com/openapi.json`, writes it to `openapi.json`
(2-space indent, trailing newline, so diffs stay readable), and regenerates
`src/generated/api.ts`. It prints whether anything changed.

A nightly workflow runs the same command and opens a pull request when the
spec has moved, onto a fixed `spec-update` branch so repeated drift updates one
PR instead of stacking them. CI checks the reverse direction: the committed
types must be exactly what the committed snapshot generates.

## Links

- API docs: https://docs.dfos.com/api
- OpenAPI spec: https://api.dfos.com/openapi.json
- DFOS protocol: https://protocol.dfos.com

## License

MIT
