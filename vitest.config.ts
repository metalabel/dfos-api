import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Only the repo's own suite — without this, vitest scans the whole cwd
    // and picks up stray specs under the git-ignored notes.local/.
    include: ['tests/**/*.spec.ts'],
  },
});
