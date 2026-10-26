import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // next-auth imports "next/server" without an extension, which plain Node
    // can't resolve outside a Next build; let Vite resolve it instead.
    server: { deps: { inline: ['next-auth'] } },
  },
});
