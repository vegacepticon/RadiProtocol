import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/__tests__/**/*.test.ts'],
    globals: false,
    alias: {
      obsidian: path.resolve(__dirname, 'src/__mocks__/obsidian.ts'),
    },
  },
});
