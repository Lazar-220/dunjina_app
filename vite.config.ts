import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Date logic must be independent of the machine's time zone and DST; pin a zone with DST for all tests.
process.env.TZ = 'Europe/Belgrade';

export default defineConfig({
  plugins: [react()],
  base: './',
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    // UI flow tests click through several screens; they are slow when the whole suite runs in parallel.
    testTimeout: 20_000,
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
  },
});
