# Plan 01-01: Plugin Scaffold Setup

**Phase**: 1 — Project Scaffold and Canvas Parsing Foundation
**Requirements**: DEV-01, DEV-02, DEV-03, NFR-02, NFR-03, NFR-06, NFR-10
**Wave**: 1
**Depends on**: None (first plan — bootstraps the project)

## Goal

Create a working Obsidian plugin scaffold from the official template: `package.json`, `tsconfig.json`, `esbuild.config.mjs` with dev-vault copy, `manifest.json`, `versions.json`, `.gitignore`, `LICENSE`, and `styles.css` — so `npm run dev` builds `main.js` and copies it to the dev vault.

## Context

This plan creates the project skeleton. All other plans depend on having `package.json` and the `src/` directory in place. The official `obsidian-sample-plugin` scaffold is used verbatim with three targeted changes: (1) `.env`-based dev vault path copy in `esbuild.config.mjs` (D-01, D-02), (2) `dotenv` added to devDependencies, (3) `minAppVersion` set to `"1.5.7"` (NFR-03). ESLint is configured in Plan 01-05. Plan 01-00 adds Vitest to `package.json` immediately after this plan.

---

## Tasks

### Task 01-01-01: Create package.json, tsconfig.json, and manifest files

**Requirement**: DEV-01, NFR-02, NFR-03, NFR-06, NFR-10
**Verify**: `npm install` exits with code 0 and `node_modules/obsidian` directory exists.

1. Create `package.json` at the project root:

   ```json
   {
     "name": "radiprotocol",
     "version": "0.1.0",
     "description": "Canvas-based guided protocol runner for Obsidian",
     "main": "main.js",
     "scripts": {
       "dev": "node esbuild.config.mjs",
       "build": "tsc -noEmit -skipLibCheck && node esbuild.config.mjs production",
       "version": "node version-bump.mjs && git add manifest.json versions.json",
       "lint": "eslint ."
     },
     "keywords": [],
     "author": "",
     "license": "MIT",
     "devDependencies": {
       "@eslint/js": "10.0.1",
       "@types/node": "^16.11.6",
       "dotenv": "17.4.0",
       "esbuild": "0.28.0",
       "eslint-plugin-obsidianmd": "0.1.9",
       "globals": "17.4.0",
       "jiti": "2.6.1",
       "tslib": "2.4.0",
       "typescript": "6.0.2",
       "typescript-eslint": "8.58.0"
     },
     "dependencies": {
       "obsidian": "1.12.3"
     }
   }
   ```

2. Create `tsconfig.json` at the project root (verbatim from official scaffold, D-07 — `noUncheckedIndexedAccess` enabled):

   ```json
   {
     "compilerOptions": {
       "baseUrl": "src",
       "inlineSourceMap": true,
       "inlineSources": true,
       "module": "ESNext",
       "target": "ES6",
       "allowJs": true,
       "noImplicitAny": true,
       "noImplicitThis": true,
       "noImplicitReturns": true,
       "moduleResolution": "node",
       "importHelpers": true,
       "noUncheckedIndexedAccess": true,
       "isolatedModules": true,
       "strictNullChecks": true,
       "strictBindCallApply": true,
       "allowSyntheticDefaultImports": true,
       "useUnknownInCatchVariables": true,
       "lib": ["DOM", "ES5", "ES6", "ES7"]
     },
     "include": ["src/**/*.ts"]
   }
   ```

3. Create `manifest.json` at the project root (NFR-03 — `minAppVersion` must be `"1.5.7"`):

   ```json
   {
     "id": "radiprotocol",
     "name": "RadiProtocol",
     "version": "0.1.0",
     "minAppVersion": "1.5.7",
     "description": "Canvas-based guided protocol runner for radiologists.",
     "author": "",
     "authorUrl": "",
     "fundingUrl": "",
     "isDesktopOnly": true
   }
   ```

4. Create `versions.json` at the project root:

   ```json
   {
     "0.1.0": "1.5.7"
   }
   ```

5. Create `styles.css` at the project root (empty placeholder; required by Obsidian plugin convention):

   ```css
   /* RadiProtocol styles — Phase 3 will populate this file */
   ```

6. Run `npm install` from the project root. Confirm it exits with code 0 and `node_modules/obsidian/` directory exists.

---

### Task 01-01-02: Create esbuild.config.mjs with dev vault copy (D-01, D-02)

**Requirement**: DEV-01
**Verify**: `node -e "import('./esbuild.config.mjs').catch(e => { console.error(e.message); process.exit(1); })"` — must exit without error (syntax check). Full build verification is manual (requires `.env`; see Manual Verifications below).

1. Create `.env.example` at the project root (committed to git as documentation; `.env` itself is gitignored):

   ```
   # Copy this file to .env and set your Obsidian dev vault path.
   # The dev script (npm run dev) copies main.js and manifest.json here on each rebuild.
   OBSIDIAN_DEV_VAULT_PATH=/path/to/your/obsidian-dev-vault
   ```

2. Verify `.gitignore` exists and contains `.env`. If `.gitignore` does not exist yet, create it with:

   ```
   # Dependencies
   node_modules/

   # Build output
   main.js
   main.js.map

   # Dev vault config (never commit vault paths)
   .env

   # OS files
   .DS_Store
   Thumbs.db
   ```

   If `.gitignore` exists but does not contain `.env`, add `.env` on its own line.

3. Create `esbuild.config.mjs` at the project root. Use `dotenv` to read `OBSIDIAN_DEV_VAULT_PATH` from `.env`, then copy build output on each rebuild:

   ```javascript
   import esbuild from 'esbuild';
   import process from 'process';
   import builtins from 'builtin-modules';
   import fs from 'fs';
   import path from 'path';

   // Load .env for OBSIDIAN_DEV_VAULT_PATH (dev-only; not bundled into plugin)
   let devVaultPath = null;
   try {
     const { config } = await import('dotenv');
     const result = config();
     if (!result.error) {
       devVaultPath = process.env.OBSIDIAN_DEV_VAULT_PATH ?? null;
     }
   } catch {
     // dotenv not available or .env missing — dev vault copy disabled
   }

   const banner = `/*
   THIS IS A GENERATED/BUNDLED FILE BY ESBUILD
   if you want to view the source, please visit the GitHub repository of this plugin
   */
   `;

   const prod = process.argv[2] === 'production';

   /**
    * Copies main.js and manifest.json to the dev vault plugin directory after each build.
    * Only runs when OBSIDIAN_DEV_VAULT_PATH is set in .env and build succeeds.
    */
   const devVaultCopyPlugin = {
     name: 'dev-vault-copy',
     setup(build) {
       build.onEnd((result) => {
         if (result.errors.length > 0) return;
         if (!devVaultPath) return;

         const pluginDir = path.join(
           devVaultPath,
           '.obsidian',
           'plugins',
           'radiprotocol'
         );

         try {
           fs.mkdirSync(pluginDir, { recursive: true });
           fs.copyFileSync('main.js', path.join(pluginDir, 'main.js'));
           fs.copyFileSync('manifest.json', path.join(pluginDir, 'manifest.json'));
           if (fs.existsSync('styles.css')) {
             fs.copyFileSync('styles.css', path.join(pluginDir, 'styles.css'));
           }
           console.debug(`[radiprotocol] Copied to dev vault: ${pluginDir}`);
         } catch (err) {
           console.error(`[radiprotocol] Dev vault copy failed: ${err.message}`);
         }
       });
     },
   };

   const context = await esbuild.context({
     banner: { js: banner },
     entryPoints: ['src/main.ts'],
     bundle: true,
     external: [
       'obsidian',
       'electron',
       '@codemirror/autocomplete',
       '@codemirror/collab',
       '@codemirror/commands',
       '@codemirror/language',
       '@codemirror/lint',
       '@codemirror/search',
       '@codemirror/state',
       '@codemirror/view',
       '@lezer/common',
       '@lezer/highlight',
       '@lezer/lr',
       ...builtins,
     ],
     format: 'cjs',
     target: 'es2018',
     logLevel: 'info',
     sourcemap: prod ? false : 'inline',
     treeShaking: true,
     outfile: 'main.js',
     minify: prod,
     plugins: [devVaultCopyPlugin],
   });

   if (prod) {
     await context.rebuild();
     process.exit(0);
   } else {
     await context.watch();
   }
   ```

4. Verify syntax: `node -e "import('./esbuild.config.mjs').catch(e => { console.error(e.message); process.exit(1); })"` — this will attempt to start the build (which will fail because `src/main.ts` does not exist yet, but it must not fail on a syntax or import error). If `esbuild` throws "Could not resolve src/main.ts", that is expected and correct — it means the config parsed successfully.

---

### Task 01-01-03: Create version-bump.mjs and LICENSE

**Requirement**: NFR-10
**Verify**: `node version-bump.mjs --help 2>&1 || true` — must not error on module load; `cat LICENSE | head -1` must contain "MIT License".

1. Create `version-bump.mjs` at the project root (standard scaffold script for bumping version in both `manifest.json` and `versions.json` together):

   ```javascript
   import { readFileSync, writeFileSync } from 'fs';

   const targetVersion = process.env.npm_package_version;

   // Read minAppVersion from manifest
   const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
   const { minAppVersion } = manifest;

   // Update manifest version
   manifest.version = targetVersion;
   writeFileSync('manifest.json', JSON.stringify(manifest, null, '\t'));

   // Update versions.json
   const versions = JSON.parse(readFileSync('versions.json', 'utf8'));
   versions[targetVersion] = minAppVersion;
   writeFileSync('versions.json', JSON.stringify(versions, null, '\t'));
   ```

2. Create `LICENSE` at the project root with MIT license text. Use today's year (2026) and leave the author field as a placeholder:

   ```
   MIT License

   Copyright (c) 2026 RadiProtocol Contributors

   Permission is hereby granted, free of charge, to any person obtaining a copy
   of this software and associated documentation files (the "Software"), to deal
   in the Software without restriction, including without limitation the rights
   to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
   copies of the Software, and to permit persons to whom the Software is
   furnished to do so, subject to the following conditions:

   The above copyright notice and this permission notice shall be included in all
   copies or substantial portions of the Software.

   THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
   FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
   AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
   LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
   OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
   SOFTWARE.
   ```

3. Run `cat LICENSE | head -1` and confirm it outputs `MIT License`.

---

## Manual Verification (DEV-01)

After completing Plan 01-02 (which creates `src/main.ts`):

1. Create `.env` at the project root (not committed):
   ```
   OBSIDIAN_DEV_VAULT_PATH=/absolute/path/to/your/dev/vault
   ```
2. Run `npm run dev`.
3. Confirm `main.js` is created at the project root.
4. Confirm `main.js` and `manifest.json` appear in `<OBSIDIAN_DEV_VAULT_PATH>/.obsidian/plugins/radiprotocol/`.
5. In Obsidian, enable Developer Tools → reload the plugin. Confirm the ribbon icon appears and "RadiProtocol" commands appear in the command palette.

---

## Recommended Commit

```
chore(01): add plugin scaffold — package.json, tsconfig, esbuild config, manifest, LICENSE
```
