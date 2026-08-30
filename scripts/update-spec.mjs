// Refresh the committed openapi.json snapshot from the platform contract.
//
// The snapshot is sourced from the platform monorepo's generated spec — the
// `@metalabel/dfos-external-openapi` package in `metalabel/metalabel-dfos` —
// so a re-sync is merge-timed and deploy-independent: the moment a contract
// change merges there, this repo can pick it up without waiting for a deploy.
// Point `DFOS_PLATFORM_REPO` at a checkout (default: a `metalabel-dfos`
// sibling of this repo) and run `pnpm update-spec` to also regenerate types.
//
// Pass `--live` to instead fetch the deployed spec at api.dfos.com — useful
// as a parity check, and the only path that works without a platform checkout.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_PATH = join(ROOT, 'openapi.json');
const LIVE_URL = 'https://api.dfos.com/openapi.json';

// The exact server URL the gateway passes the generator (trailing slash and
// all), so the generated document matches what the API serves byte for byte.
const SERVER_URL = 'https://api.dfos.com/v1/';

/**
 * @param {string} message
 * @returns {never}
 */
function fail(message) {
  console.error(`update-spec: ${message}`);
  process.exit(1);
}

/** Fetch the deployed spec — deploy truth, for parity checks. */
async function fromLive() {
  const response = await fetch(LIVE_URL, {
    headers: { accept: 'application/json' },
  }).catch((error) => fail(`request to ${LIVE_URL} failed: ${error.message}`));
  if (!response.ok) {
    fail(`${LIVE_URL} returned HTTP ${response.status} ${response.statusText}`);
  }
  return { body: await response.text(), source: LIVE_URL };
}

/** Generate the spec from a platform monorepo checkout — merge truth. */
function fromPlatformRepo() {
  const repo = process.env.DFOS_PLATFORM_REPO ?? join(ROOT, '..', 'metalabel-dfos');
  // Any workspace package that depends on dfos-external-openapi and carries
  // tsx works as the host; platform-gateways is the stable choice.
  const host = join(repo, 'packages', 'platform-gateways');
  if (!existsSync(host)) {
    fail(
      `no platform checkout at ${repo} (set DFOS_PLATFORM_REPO, or pass --live to fetch the deployed spec)`,
    );
  }
  const script = `
    import('@metalabel/dfos-external-openapi/generate-spec')
      .then(async (m) => {
        const spec = await m.generateExternalOpenApiSpecMemoized(${JSON.stringify(SERVER_URL)});
        process.stdout.write(JSON.stringify(spec));
      })
      .catch((error) => { console.error(error); process.exit(1); });
  `;
  let body;
  try {
    body = execFileSync('pnpm', ['--silent', 'exec', 'tsx', '-e', script], {
      cwd: host,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  } catch (/** @type {any} */ error) {
    fail(`generating from ${repo} failed: ${error.message}`);
  }
  return { body, source: repo };
}

const { body, source } = process.argv.includes('--live')
  ? await fromLive()
  : fromPlatformRepo();

let spec;
try {
  spec = JSON.parse(body);
} catch (/** @type {any} */ error) {
  fail(`${source} did not produce valid JSON: ${error.message}`);
}

if (!spec || typeof spec !== 'object' || typeof spec.openapi !== 'string' || !spec.paths) {
  fail(`${source} produced JSON that is not an OpenAPI document`);
}

// 2-space indent + trailing newline keeps diffs stable across refreshes.
const next = `${JSON.stringify(spec, null, 2)}\n`;

let previous = null;
try {
  previous = readFileSync(OUT_PATH, 'utf8');
} catch {
  // first run — no snapshot yet
}

writeFileSync(OUT_PATH, next);

if (previous === null) {
  console.log(`update-spec: wrote openapi.json (${spec.info?.version ?? 'unknown version'})`);
} else if (previous === next) {
  console.log('update-spec: no change');
} else {
  console.log(`update-spec: openapi.json CHANGED (${spec.info?.version ?? 'unknown version'})`);
}
