// Refresh the committed openapi.json snapshot from wire truth.
//
// The live spec at api.dfos.com is the only source of truth for this package;
// everything else here (generated types, the client) is derived from the
// snapshot this script writes. Run `pnpm update-spec` to also regenerate types.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SPEC_URL = 'https://api.dfos.com/openapi.json';
const OUT_PATH = join(dirname(fileURLToPath(import.meta.url)), '..', 'openapi.json');

function fail(message) {
  console.error(`update-spec: ${message}`);
  process.exit(1);
}

const response = await fetch(SPEC_URL, {
  headers: { accept: 'application/json' },
}).catch((error) => fail(`request to ${SPEC_URL} failed: ${error.message}`));

if (!response.ok) {
  fail(`${SPEC_URL} returned HTTP ${response.status} ${response.statusText}`);
}

const body = await response.text();

let spec;
try {
  spec = JSON.parse(body);
} catch (error) {
  fail(`${SPEC_URL} did not return valid JSON: ${error.message}`);
}

if (!spec || typeof spec !== 'object' || typeof spec.openapi !== 'string' || !spec.paths) {
  fail(`${SPEC_URL} returned JSON that is not an OpenAPI document`);
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
