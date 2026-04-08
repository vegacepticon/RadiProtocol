import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      // Resolve the Obsidian package (no main field) to our manual mock.
      // This lets vi.mock('obsidian') and direct imports work in tests.
      obsidian: path.resolve(__dirname, 'src/__mocks__/obsidian.ts'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    globals: false,
  },
});
