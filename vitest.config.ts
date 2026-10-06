import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: { alias: {
    '@': fileURLToPath(new URL('./client/src', import.meta.url)),
    '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
  } },
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'node',
    include: ['client/src/features/adminProducts/builder/__tests__/productSelection.test.ts'],
  },
});
