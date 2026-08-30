import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Enforces the README mirror contract: every ```ts block in the README has a
 * compile fixture under tests/, and the two stay line-for-line identical
 * except for the seams a fixture needs to compile — imports (the fixture
 * imports `../src/index.js` instead of the package name), `declare const`
 * stand-ins for values the README leaves implicit, and a trailing `export`
 * that keeps strict unused checks quiet. The contract broke silently once
 * (#17, repaired in #23); this is what keeps it from breaking again.
 */

const root = join(import.meta.dirname, '..');

const pairs = [
  { fixture: 'tests/readme-usage.ts', marker: "'/spaces/{space}'" },
  { fixture: 'tests/readme-signed-fetch.ts', marker: 'createApiAuthFetch' },
];

/** The lines a README example and its fixture must share, in order. */
function body(code: string): string[] {
  return code
    .replace(/^\/\*\*[\s\S]*?\*\/\n/, '') // fixture doc comment
    .split('\n')
    .filter((line) => !line.startsWith('import '))
    .filter((line) => !line.startsWith('declare '))
    .filter((line) => !line.startsWith('export '))
    .filter((line) => line.trim() !== '');
}

/** Import lines, trailing comments stripped, package name mapped to source. */
function imports(code: string): string[] {
  return code
    .split('\n')
    .filter((line) => line.startsWith('import '))
    .map((line) => line.replace(/\s*\/\/.*$/, ''))
    .map((line) => line.replace("'@metalabel/dfos-api'", "'../src/index.js'"))
    .sort();
}

const readme = readFileSync(join(root, 'README.md'), 'utf8');
const blocks = [...readme.matchAll(/```ts\n([\s\S]*?)```/g)].map((m) => m[1]!);

describe('README examples mirror their compile fixtures', () => {
  it('has a fixture pair for every ts block in the README', () => {
    expect(blocks).toHaveLength(pairs.length);
    for (const block of blocks) {
      expect(pairs.filter((pair) => block.includes(pair.marker))).toHaveLength(1);
    }
  });

  for (const pair of pairs) {
    it(`${pair.fixture} mirrors its README block`, () => {
      const block = blocks.find((candidate) => candidate.includes(pair.marker));
      expect(block).toBeDefined();
      const fixture = readFileSync(join(root, pair.fixture), 'utf8');
      expect(body(fixture)).toEqual(body(block!));
      expect(imports(fixture)).toEqual(imports(block!));
    });
  }
});
