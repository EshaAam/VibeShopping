import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    environment: 'node',
    // next-auth imports "next/server" without an extension, which plain Node
    // can't resolve outside a Next build; let Vite resolve it instead.
    server: { deps: { inline: ['next-auth'] } },
    // One project per test layer, so each can run on its own
    // (`vitest run --project unit`). See tests/README.md.
    projects: [
      { extends: true, test: { name: 'unit', include: ['tests/unit/**/*.test.ts'] } },
      { extends: true, test: { name: 'contract', include: ['tests/contract/**/*.test.ts'] } },
    ],
  },
});
