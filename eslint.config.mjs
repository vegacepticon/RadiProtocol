import globals from 'globals';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';

export default tseslint.config(
  // Base recommended configs
  js.configs.recommended,
  ...tseslint.configs.recommended,

  // Global language options applying to all files
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Main source files config
  {
    files: ['src/**/*.ts'],
    plugins: {
      obsidianmd,
    },
    rules: {
      // ---- eslint-plugin-obsidianmd: all plugin rules (DEV-02, NFR-04, NFR-05, NFR-06) ----
      'obsidianmd/commands/no-command-in-command-id': 'error',
      'obsidianmd/commands/no-command-in-command-name': 'error',
      'obsidianmd/commands/no-default-hotkeys': 'error',
      'obsidianmd/commands/no-plugin-id-in-command-id': 'error',
      'obsidianmd/commands/no-plugin-name-in-command-name': 'error',
      'obsidianmd/settings-tab/no-manual-html-headings': 'error',
      'obsidianmd/settings-tab/no-problematic-settings-headings': 'error',
      'obsidianmd/vault/iterate': 'error',
      'obsidianmd/detach-leaves': 'error',
      'obsidianmd/hardcoded-config-path': 'error',
      'obsidianmd/no-forbidden-elements': 'error',
      'obsidianmd/no-plugin-as-component': 'error',
      'obsidianmd/no-sample-code': 'error',
      'obsidianmd/no-tfile-tfolder-cast': 'error',
      'obsidianmd/no-view-references-in-plugin': 'error',
      'obsidianmd/no-static-styles-assignment': 'error',
      'obsidianmd/object-assign': 'error',
      'obsidianmd/platform': 'error',
      'obsidianmd/prefer-file-manager-trash-file': 'warn',
      'obsidianmd/prefer-abstract-input-suggest': 'error',
      'obsidianmd/regex-lookbehind': 'error',
      'obsidianmd/sample-names': 'error',
      'obsidianmd/validate-manifest': 'error',
      'obsidianmd/validate-license': 'error',
      'obsidianmd/ui/sentence-case': ['error', { enforceCamelCaseLower: true }],

      // ---- TypeScript rules (DEV-03, NFR-07, NFR-09) ----
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',

      // ---- General rules (DEV-03) ----
      // Allow console.warn, console.error, console.debug; ban console.log
      'no-console': ['error', { allow: ['warn', 'error', 'debug'] }],

      // Ban innerHTML and outerHTML (DEV-03, community review requirement)
      'no-restricted-syntax': [
        'error',
        {
          selector: 'MemberExpression[property.name="innerHTML"]',
          message: 'Use Obsidian createEl() helpers instead of innerHTML. See DEV-03.',
        },
        {
          selector: 'MemberExpression[property.name="outerHTML"]',
          message: 'Use Obsidian createEl() helpers instead of outerHTML. See DEV-03.',
        },
      ],
    },
  },

  // Phase 77 D-02: tests/mocks override —
  //   * @typescript-eslint/no-explicit-any: off — Obsidian API mocks need flexible
  //     shapes (see src/__mocks__/obsidian.ts where every method takes `unknown`);
  //     full typing duplicates production types or breaks tests.
  //   * @typescript-eslint/no-unused-vars: error w/ _underscore-pattern — already
  //     project convention per CONVENTIONS.md §Naming Patterns. Mock callbacks
  //     intentionally accept (_evt, _text, _cb) to match upstream signatures.
  {
    files: ['src/__tests__/**/*.ts', 'src/__mocks__/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unused-vars': ['error', {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      }],
    },
  },

  // Ignore patterns
  {
    ignores: [
      'node_modules/**',
      'main.js',
      'eslint.config.mjs',
      'esbuild.config.mjs',
      'version-bump.mjs',
      'vitest.config.ts',
      'stylelint.config.mjs',
      'scripts/**/*.mjs',
      '.planning/**',
    ],
  }
);
