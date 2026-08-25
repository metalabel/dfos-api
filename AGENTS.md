# Working on this repo

Invariants for anyone — human or agent — changing this package. The README
covers what the package is; this covers what must stay true while touching it.

## Derived files are never hand-edited

`openapi.json` is a snapshot of `https://api.dfos.com/openapi.json`, and
`src/generated/api.ts` is what openapi-typescript generates from that snapshot.
`pnpm update-spec` is the only writer of both. Never edit either by hand — not
to fix a typo, not to patch a type. If the spec looks wrong, the fix belongs in
the API; this repo picks it up on the next refresh. CI regenerates from the
committed snapshot and fails on any divergence, so a hand edit cannot merge.

## Scope is fixed

The package is three things and nothing else: the snapshot, the generated
types, and a thin openapi-fetch wrapper. Retries, timeouts, caching, and
convenience helpers belong to the caller's fetch; request signing belongs to
`@metalabel/dfos-client`. Decline additions that grow the surface — the value
of this package is that it has nothing to maintain.

## Spec drift flows through one branch

A nightly workflow refreshes the snapshot and force-pushes a fixed
`spec-update` branch, so repeated drift updates one PR instead of stacking
them. CI does not run on that PR (GitHub blocks workflow recursion for PRs
opened with `GITHUB_TOKEN`) — the typecheck/test/build gate ran in the job
that opened it. Review the type diff for what a consumer would notice:
removed fields and narrowed types are breaking, added ones are not.

## Releases are deliberate

Merging a spec refresh does not release. To release: bump `package.json`,
tag `v<version>` matching it exactly, push the tag. Publishing is npm trusted
publishing (OIDC) — no token exists anywhere, and the trust binding is to
`.github/workflows/release.yml` by name, so renaming that file breaks
publishing until the npmjs.com config is updated. Version rule: doc-only or
tooling changes are a patch, additive type surface (new operations, fields,
enum members) is a minor, anything that could break a consumer's compile is a
major once past 1.0.

## Docs carry the forward-compat doctrine

The README's forward-compatibility rules bind prose as much as code: never
document an enum as closed, a response shape as complete, a subdomain as
stable, or a cursor as parseable. Signed media URLs expire and must not be
persisted; 404s are deliberately uninformative and should stay described that
way.

## Checks

`pnpm typecheck && pnpm test && pnpm build`, plus `pnpm generate` leaving a
clean `git diff` — the same four gates CI runs.
