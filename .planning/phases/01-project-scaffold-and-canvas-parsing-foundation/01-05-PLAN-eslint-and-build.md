# Plan 01-05: ESLint Configuration and Zero-Error Pass

**Phase**: 1 — Project Scaffold and Canvas Parsing Foundation
**Requirements**: DEV-02, DEV-03, NFR-04, NFR-05, NFR-06, NFR-07, NFR-08, NFR-09
**Wave**: 3
**Depends on**: 01-02 (all source files exist), 01-03 (CanvasParser), 01-04 (GraphValidator)

## Goal

Configure ESLint with `eslint-plugin-obsidianmd` (all 27 rules), `@typescript-eslint/no-explicit-any`, `no-console` (allow warn/error/debug), `no-floating-promises`, and `no-restricted-syntax` for innerHTML/outerHTML — then bring the entire codebase to zero lint errors.

## Context

DEV-02 requires `eslint-plugin-obsidianmd` from the first commit. DEV-03 requires the additional TypeScript-specific rules. This plan creates `eslint.config.mjs`, runs `npm run lint`, and fixes any violations. The ESLint config uses the flat config format (ESLint v9+) per the official scaffold. All rules run against all `src/**/*.ts` files — the same files that are compiled. Zero warnings is the policy (NFR-04).

The stub files created in Plan 01-02 are valid TypeScript but may need minor adjustments to satisfy ESLint (e.g., unused parameters prefixed with `_`, explicit return types on public methods).

---

## Tasks

### Task 01-05-01: Create eslint.config.mjs with all required rules

**Requirement**: DEV-02, DEV-03, NFR-04, NFR-05, NFR-06, NFR-07, NFR-09
**Verify**: `npm run lint 2>&1 | tail -5` — must output `0 errors, 0 warnings` (or equivalent ESLint zero-error output).

1. Create `eslint.config.mjs` at the project root:

   ```javascript
   import { createRequire } from 'module';
   import globals from 'globals';
   import js from '@eslint/js';
   import tseslint from 'typescript-eslint';
   import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';

   // eslint-plugin-obsidianmd must be loaded via createRequire (CJS module in ESM context)
   const require = createRequire(import.meta.url);
   const obsidianmd = require('eslint-plugin-obsidianmd');

   export default tseslint.config(
     // Base recommended configs
     js.configs.recommended,
     ...tseslint.configs.recommended,

     // Global config applying to all files
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
         // ---- eslint-plugin-obsidianmd: all 27 rules (DEV-02, NFR-04, NFR-05, NFR-06) ----
         ...obsidianmd.configs.recommended.rules,

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

     // Ignore patterns
     {
       ignores: [
         'node_modules/**',
         'main.js',
         'esbuild.config.mjs',
         'version-bump.mjs',
         'vitest.config.ts',
       ],
     }
   );
   ```

2. Run `npm run lint 2>&1` and inspect the output. Do NOT ignore lint errors — fix each one in the next task.

3. If ESLint reports that `eslint-plugin-obsidianmd` cannot be loaded via `createRequire`, try the alternative import:
   ```javascript
   import obsidianmd from 'eslint-plugin-obsidianmd';
   ```
   Use whichever import style works. The plugin's exact export format (CJS vs. ESM) determines which approach is correct for version 0.1.9.

---

### Task 01-05-02: Fix all lint violations in src/

**Requirement**: DEV-02, DEV-03, NFR-04, NFR-05, NFR-06, NFR-07, NFR-08, NFR-09
**Verify**: `npm run lint 2>&1 | grep -E "error|warning" | grep -v "^$" | wc -l` — must output `0`.

Address each lint violation reported by `npm run lint`. Common violations to anticipate from the scaffold stubs:

**`@typescript-eslint/no-explicit-any` violations in canvas-parser.ts:**
- The parser uses `raw as Record<string, unknown>` pattern — ensure no `any` types remain.
- If `(raw as any)['radiprotocol_nodeType']` was used during development, replace with `(raw as Record<string, unknown>)['radiprotocol_nodeType']`.

**`@typescript-eslint/no-floating-promises` violations in main.ts:**
- If any `async` method calls are not awaited or marked `void`, add `void` prefix.
- Example: in event handlers, `void this.someAsyncMethod()`.

**`obsidianmd/no-plugin-id-in-command-id` (NFR-06):**
- Confirm command IDs in `main.ts` do NOT start with `radiprotocol-`. They are already correct in Plan 01-02 (`'run-protocol'`, `'validate-protocol'`), but verify.

**`obsidianmd/prefer-modal` or similar rules:**
- If the plugin registers any `Notice` calls that violate plugin UI conventions, adjust per the rule's guidance.

**Unused parameter warnings (`_jsonString`, `_canvasFilePath` in stubs):**
- Stub parameters are prefixed with `_` which TypeScript and ESLint accept as intentional.

For each violation:
1. Read the ESLint error message fully — it includes the rule ID and the specific selector or issue.
2. Fix the violation in the source file.
3. Re-run `npm run lint` to confirm the specific violation is resolved before moving on.

Continue until `npm run lint` produces zero errors and zero warnings.

---

### Task 01-05-03: Final integrated verification — lint + tests + build

**Requirement**: DEV-01, DEV-02, DEV-03, DEV-04, NFR-04
**Verify**: All three commands must exit with code 0 and zero errors:
1. `npm run lint`
2. `npx vitest run`
3. `node esbuild.config.mjs production && echo "BUILD OK"`

1. Run `npm run lint`. Must output zero errors, zero warnings.

2. Run `npx vitest run`. All tests must pass. Zero failures.

3. Run `node esbuild.config.mjs production`. Must produce `main.js` at the project root with zero esbuild errors.

4. Run `npx tsc -noEmit -skipLibCheck`. Must output zero TypeScript errors.

5. Confirm `main.js` exists at the project root: `ls -la main.js`.

6. Confirm Phase 1 success criteria (checklist):
   - [ ] `npm run lint` exits with 0 errors
   - [ ] `npx vitest run` exits with 0 failures
   - [ ] `node esbuild.config.mjs production` produces `main.js`
   - [ ] `grep -r "from 'obsidian'" src/graph/ src/runner/ src/snippets/ src/sessions/ src/utils/` produces zero output
   - [ ] All six `GraphValidator` error classes have passing tests

---

## Manual Verification (Success Criterion 1 — DEV-01)

After configuring `.env` with a real dev vault path:

1. Run `npm run dev`.
2. Open the configured dev vault in Obsidian.
3. In Obsidian Settings → Community Plugins, find "RadiProtocol" and enable it.
4. Confirm the ribbon icon (activity icon) appears in the left sidebar.
5. Open the command palette (Cmd/Ctrl+P) and type "RadiProtocol" — confirm "Run protocol" and "Validate protocol" commands appear.
6. Click the ribbon icon — confirm a Notice popup appears with "RadiProtocol loaded."

This is the only manual verification in Phase 1. All other success criteria are verified by automated commands above.

---

## Recommended Commit

```
chore(01): configure eslint with obsidianmd plugin and all DEV-02/DEV-03 rules — zero errors
```

---

## Phase 1 Complete

After this plan, Phase 1 success criteria are met:

| Criterion | Verified by |
|-----------|-------------|
| `npm run dev` builds and copies to dev vault | Manual — ribbon icon and commands appear |
| `CanvasParser.parse()` produces correct `ProtocolGraph` | `npx vitest run src/__tests__/canvas-parser.test.ts` |
| `GraphValidator` catches all six error classes | `npx vitest run src/__tests__/graph-validator.test.ts` |
| `eslint` runs with zero errors | `npm run lint` |
| Mixed canvas (RP + plain nodes) parses without error | `canvas-parser.test.ts` — "silently skips plain nodes" test |
