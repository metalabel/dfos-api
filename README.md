# @metalabel/dfos-api

A typed TypeScript client for the public DFOS API at `https://api.dfos.com`.
The API itself — endpoints, parameters, response shapes — is documented at
[docs.dfos.com/api](https://docs.dfos.com/api); this package is the typed way
to call it.

It is three things and nothing else:

- `openapi.json` — a committed snapshot of the API's OpenAPI spec (the same
  document served at `https://api.dfos.com/openapi.json`).
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

| Option    | Default                   | What it does                                         |
| --------- | ------------------------- | ---------------------------------------------------- |
| `baseUrl` | `https://api.dfos.com/v1` | Point the client at another deployment.              |
| `fetch`   | the global `fetch`        | Supply your own fetch (see "Signed requests" below). |

Everything else — retries, timeouts, caching — is your fetch's job, not this
package's.

## Signed requests

Most of the API is anonymous `GET`s, and the default fetch is all you need. The
rest describes or acts as one specific person and takes a proof. Which routes
those are, which proof profiles each accepts, and which action tokens it demands
is declared in the spec itself — the machine-readable convention is the
"Advertising in OpenAPI" section of [API-AUTH](https://protocol.dfos.com/api-auth),
and the spec's own `info.description` walks the classes in prose. In outline:

- **Anonymous** — the default and most of the surface. No header; one
  projection for everyone.
- **Gated** — `GET /v1/profile`, the four membership routes,
  `GET /v1/credential`, `GET /v1/feed`, and
  `GET /v1/spaces/{space}/posts/{postId}/comments`. Each answers about the
  person the proof names; route semantics live at
  [profile](https://docs.dfos.com/docs/api/profile),
  [memberships](https://docs.dfos.com/docs/api/memberships), and
  [credential](https://docs.dfos.com/docs/api/credential).
- **Optional-auth** — `GET /v1/spaces/{space}/posts` and
  `GET /v1/spaces/{space}/posts/{postId}`. With no header they serve the
  anonymous projection. With a proof whose grant covers the space under
  `read:posts` they serve the projection the granting user sees: the whole feed
  for that space, full bodies where the user genuinely reads a post, and a
  `viewer` block. A grant only ever adds — a valid proof that does not cover the
  space gets exactly the anonymous bytes — while a malformed, expired, or revoked
  proof is still `401`/`403`, never a quiet downgrade.
- **Writes** — every non-`GET`: posts (`write:posts`), comments
  (`write:comments`), and upvotes on either (`write:upvotes`), as the granting
  user, on their own content only, in the spaces the grant covers. Announcing,
  pinning, broadcasting, and moderating are absent from the request schemas, not
  rejected by them.

An application acts for a user by the access they granted it through
[Sign In With DFOS](https://protocol.dfos.com/siwd): the
[setup recipe](https://docs.dfos.com/docs/developers/sign-in-with-dfos/setup)
takes an application from zero to a credential,
[local apps](https://docs.dfos.com/docs/developers/sign-in-with-dfos/local-apps)
covers CLIs and agents with no domain to stand behind, and
[credentials](https://docs.dfos.com/docs/developers/sign-in-with-dfos/credentials)
explains what the grant carries. A grant names actions and places: the account
tokens live on the API as a whole, while `read:posts` and the `write:*` tokens
are space-level and cover either every space the user belongs to or the spaces
named at consent. Consent may narrow an ask, so read what was actually granted
from the credential's attenuation — `GET /v1/credential` returns it as
`attenuation` — rather than assuming the request was honored whole.

Calling a gated route or a write on a user's behalf takes that credential plus a
fresh request proof signed per call. Both arrive through the `fetch` seam —
`createApiAuthFetch` from `@metalabel/dfos-client` (v0.54.0+) builds a signing
fetch:

```ts
import { createDfosApi } from '@metalabel/dfos-api';
import { createApiAuthFetch } from '@metalabel/dfos-client/api-auth'; // v0.54.0+

const api = createDfosApi({
  fetch: createApiAuthFetch({ credential, kid, sign }),
});

const { data, error } = await api.GET('/profile');

const upvote = await api.PUT('/spaces/{space}/posts/{postId}/upvote', {
  params: { path: { space: 'home', postId: 'post_6encc4akrze2ah9kntzd9t' } },
});
```

The same signing fetch serves every gated route and every write — which route a
call may use is the credential's business, not the client's. The adapter signs
exactly the `Request` the client composes, buffering request bodies in full,
refusing plaintext requests to non-loopback hosts, and never following
redirects. From v0.54.0 it also mints a fresh `jti` for every non-`GET` request
(its `jti` option: `'writes'` by default, `'always'`, or `'never'`), which is
what the write tier requires:

- **Every write's proof carries a `jti`.** A write without one is `401`. A proof
  is accepted for its whole freshness window, so replaying one on a read merely
  re-reads, while replaying one on a write would execute it twice; the `jti` is
  what makes that impossible.
- **`409` means "this already happened".** A `jti` already spent inside the
  window is refused, and the earlier attempt may have succeeded — re-read state
  and reconcile rather than retrying. A genuine retry carries a new `jti`;
  resending identical bytes answers `409` until the window lapses.
- **One body shape, the method you signed.** Request bodies are
  `application/json` (optionally `; charset=utf-8`) and uncompressed — any other
  `Content-Encoding` is `415` — and method-override headers or `?_method=` are
  `400`. The `Request` openapi-fetch composes for a JSON body already satisfies
  this.

The byte contract and the two headers are specified in
[API-AUTH](https://protocol.dfos.com/api-auth); the signing itself lives in
`@metalabel/dfos-client`, not here.

Reading and writing your own data takes no credential. Every route that accepts
a credential except `GET /v1/credential` — the own-data reads, `GET /v1/feed`,
the comments route, the optional-auth post routes, and every write — also
accepts a bare identity proof: `Authorization: DFOS <identity-proof JWS>` with
no `X-Credential`, signed by one of your own identity keys. It authenticates the
signing DID and nothing more, and on those routes that opens exactly that DID's
own data and own actions, with no space restriction, because there is no third
party for a grant to attenuate — so a client holding its own key reads its own
feed and posts as itself with no grant in the picture. Presenting a credential
alongside one is malformed (`401`): the two headers assert different claims and
the API will not pick one. `GET /v1/credential` is not in the set — describing a
credential takes one. The spec marks these operations with the identity
alternative; `signApiIdentityRequest` and `buildApiIdentityHeaders` from
`@metalabel/dfos-client/api-auth` produce the proof and its header, which you
set on your own `fetch`, and a write signed this way carries a `jti` the same
way (`generateJti()` mints one).

## Forward compatibility

The API adds fields and enum members without a version bump, so write clients
that tolerate what they don't recognize. The full contract — what can change
without notice and what never will — is
[docs.dfos.com/docs/api/compatibility](https://docs.dfos.com/docs/api/compatibility).

## Keeping the snapshot current

```sh
pnpm update-spec
```

That regenerates the spec from the platform monorepo's contract (a local
checkout, `DFOS_PLATFORM_REPO`, default `../metalabel-dfos` — maintainers
only), rewrites `openapi.json` (2-space indent, trailing newline, so diffs
stay readable), and regenerates `src/generated/api.ts`. Pass `--live` to
fetch the deployed spec at `https://api.dfos.com/openapi.json` instead.
Refreshes are request-driven from the platform repo rather than polled on a
schedule, and track the merged contract rather than the deployed API — so
pre-1.0, a fresh snapshot may briefly describe an endpoint that has merged
but not yet deployed. CI checks the reverse direction: the committed types
must be exactly what the committed snapshot generates.

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
