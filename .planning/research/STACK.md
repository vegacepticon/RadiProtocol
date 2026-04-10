# Stack Research: RadiProtocol

**Domain:** Obsidian community plugin (TypeScript + esbuild toolchain)
**Researched:** 2026-04-05
**Overall confidence:** HIGH for toolchain, ESLint, Canvas format, hot-reload. MEDIUM for UI framework recommendation, testing strategy.

---

## Summary

RadiProtocol is an Obsidian community plugin targeting public release. The standard toolchain is non-negotiable: TypeScript + esbuild + the official `obsidian-sample-plugin` scaffold. The Canvas `.canvas` format is fully documented JSON (open-sourced as JSON Canvas) and requires no external parsing library — `JSON.parse` + TypeScript interfaces is the correct approach.

The most consequential stack decision is the UI framework. The recommendation is **plain DOM + Obsidian helpers (`createEl`)** for a first release, with Svelte as a viable upgrade path if component complexity warrants it. React carries significant bundle overhead (~44 KB gzipped) that is unnecessary given the plugin's surface area.

For testing, the practical approach for a plugin of this type is **Vitest for pure business logic** (graph traversal, protocol state machine, snippet parsing) kept fully isolated from Obsidian API dependencies, with the Obsidian-touching glue code treated as integration surface that is manually verified. No complete Obsidian API mock exists in an actively maintained state.

**Primary recommendation:** Use the official `obsidian-sample-plugin` scaffold verbatim, add `eslint-plugin-obsidianmd` (already in the template as of early 2026), keep the UI in plain DOM for v1, and test business logic in isolation with Vitest.

---

## 1. Build Toolchain

### Official Scaffold

The canonical starting point is `obsidianmd/obsidian-sample-plugin` on GitHub. As of the January 2026 commit (dc2fa2), it includes:

**`package.json` (verified):**

```json
{
  "scripts": {
    "dev": "node esbuild.config.mjs",
    "build": "tsc -noEmit -skipLibCheck && node esbuild.config.mjs production",
    "version": "node version-bump.mjs && git add manifest.json versions.json",
    "lint": "eslint ."
  },
  "devDependencies": {
    "@types/node": "^16.11.6",
    "esbuild": "0.25.5",
    "eslint-plugin-obsidianmd": "0.1.9",
    "globals": "14.0.0",
    "tslib": "2.4.0",
    "typescript": "^5.8.3",
    "typescript-eslint": "8.35.1",
    "@eslint/js": "9.30.1",
    "jiti": "2.6.1"
  },
  "dependencies": {
    "obsidian": "latest"
  }
}
```

[VERIFIED: npm registry 2026-04-05] Current versions:
- `obsidian`: 1.12.3 (updated 2026-02-23)
- `esbuild`: 0.28.0 (updated 2026-04-02)
- `typescript-eslint`: 8.58.0
- `eslint-plugin-obsidianmd`: 0.1.9 (updated 2025-11-14)

**`esbuild.config.mjs` (verified from raw GitHub):**

```javascript
// Entry point:    src/main.ts
// Output:         main.js (CommonJS, ES2018 target)
// Externals:      "obsidian", "electron", "@codemirror/*", "@lezer/*", all Node built-ins
// Dev mode:       watch + inline sourcemaps
// Production:     single build, minified, no sourcemaps
// Banner:         generated-file notice pointing to GitHub repo
```

Key externals to never bundle: `obsidian`, `electron`, all `@codemirror/*`, all `@lezer/*`. These are provided by the Obsidian runtime.

**`tsconfig.json` (verified from raw GitHub):**

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

**Note:** The template does NOT set `"strict": true` globally. It enables individual strict checks manually. This is intentional — some strict checks (like `strictPropertyInitialization`) conflict with the Obsidian plugin class pattern where properties are initialized in `onload()`, not in the constructor.

### Build Flow

```
npm run dev         → esbuild watch mode → main.js (inline sourcemaps, no minification)
npm run build       → tsc -noEmit (type check) → esbuild production → main.js (minified)
```

Build output is a single `main.js` at the repo root. No `dist/` folder. `styles.css` and `manifest.json` also live at the root and are shipped as-is.

### TypeScript Strict Mode Gotchas [ASSUMED]

The Obsidian plugin class pattern conflicts with `strictPropertyInitialization` because plugin fields like `settings` are assigned in `onload()`, not the constructor. The template avoids this by not enabling the full `"strict": true` umbrella flag. If you add it manually, you will need either `!` non-null assertions on plugin properties or a refactor.

`noUncheckedIndexedAccess` (enabled in the template) means `array[0]` returns `T | undefined`, not `T`. This is correct but requires null checks that new developers may not expect.

### Sources
- [CITED: github.com/obsidianmd/obsidian-sample-plugin] — raw package.json, tsconfig.json, esbuild.config.mjs
- [VERIFIED: npm registry] — all package versions confirmed 2026-04-05

---

## 2. UI Framework

### Options Evaluated

| Framework | Bundle addition | DX | Obsidian idiom fit | Used by |
|-----------|----------------|----|--------------------|---------|
| Plain DOM + `createEl` | 0 KB | Verbose, explicit | Perfect | Most plugins |
| Svelte | ~2–5 KB | Component model, stores, reactive | Good — officially documented | Some plugins |
| React + ReactDOM | ~44 KB gzipped | Familiar, large ecosystem | Acceptable | Dataview, Kanban, etc. |

[VERIFIED: npm registry / community search] Bundle size estimates are approximations; exact size depends on what is imported.

### Recommendation: Plain DOM for v1

**Use plain DOM manipulation with Obsidian's `createEl` / `createDiv` / `createSpan` helpers.**

Reasons:
1. **Zero bundle cost.** No additional dependency to explain or update.
2. **Directly idiomatic.** The official sample plugin and all official Obsidian documentation use this pattern. Review friction is lowest.
3. **No build complexity.** Svelte requires an additional esbuild preprocessor plugin (`esbuild-svelte`) and tsconfig changes. React requires adding `@types/react` and `react-dom`.
4. **Plugin surface area is manageable.** The RadiProtocol UI consists of: a side panel (ItemView), a runner modal or panel, and a settings tab. This is well within what DOM helpers handle cleanly.
5. **Security compliance.** `createEl` builds the DOM safely. No risk of accidentally introducing `innerHTML` (a community review rejection cause — see PITFALLS.md).

### Upgrade Path to Svelte

If component complexity grows — particularly for the snippet manager UI with live preview and the runner's per-step dynamic form — Svelte is the preferred upgrade. It is officially documented for Obsidian plugins and has smaller bundle overhead than React.

**Svelte integration pattern (if chosen):**
```typescript
// In ItemView.onOpen():
import MyComponent from './MyComponent.svelte';
this.component = new MyComponent({
  target: this.contentEl,
  props: { plugin: this.plugin }
});

// In ItemView.onClose():
this.component.$destroy();
```

Additional packages needed:
```bash
npm install --save-dev svelte esbuild-svelte svelte-preprocess @tsconfig/svelte
```

[VERIFIED: npm registry] Current versions: `svelte` 5.55.1, `esbuild-svelte` 0.9.4, `svelte-preprocess` 6.0.3, `@tsconfig/svelte` 5.0.8

The esbuild config requires adding `esbuildSvelte` to the plugins array with `sveltePreprocess()` and `compilerOptions: { css: 'injected' }`. Remove `inlineSourceMap: true` from tsconfig (it conflicts with Svelte's setup).

### React: When to Use

Only add React if you have direct experience shipping React-based Obsidian plugins and the DX advantage outweighs the 44 KB bundle cost. Existing large plugins (Dataview, Kanban) made this tradeoff when there was no better option. For a new plugin in 2026, Svelte is a better choice if you want a component model.

### Plain DOM Code Pattern

```typescript
// Building UI elements — the idiomatic Obsidian way
// Source: [CITED: docs.obsidian.md/Plugins/User+interface/HTML+elements]
const container = this.containerEl.createDiv({ cls: 'rp-runner' });
const question = container.createEl('h3', { text: node.questionText });
const buttonRow = container.createDiv({ cls: 'rp-answers' });

for (const answer of node.answers) {
  const btn = buttonRow.createEl('button', {
    text: answer.label,
    cls: 'rp-answer-btn'
  });
  this.registerDomEvent(btn, 'click', () => this.handleAnswer(answer));
}
```

### Sources
- [CITED: docs.obsidian.md/Plugins/Getting+started/Use+Svelte+in+your+plugin]
- [CITED: marcusolsson.github.io/obsidian-plugin-docs/getting-started/svelte]
- [CITED: forum.obsidian.md/t/seeking-some-suggestions-react-vs-svelte/93451]
- [VERIFIED: npm registry] — bundle sizes inferred from package metadata

---

## 3. State Management

### The Session State Problem

The protocol runner needs to track, at minimum:
- Current node ID (where in the graph we are)
- Accumulated protocol text (what has been assembled)
- Answer history stack (for step-back / undo)
- Loop stack (which loop we're in, which iteration, accumulated text per iteration)

This is a **pure TypeScript data structure problem**, not a reactive state management problem. No external library is needed or appropriate.

### Recommendation: Plain TypeScript Classes / Interfaces

```typescript
// No library needed — the state machine is the value
interface LoopContext {
  loopNodeId: string;
  iteration: number;
  textBefore: string; // accumulated text at loop entry, for undo
}

interface SessionState {
  canvasPath: string;
  currentNodeId: string;
  accumulatedText: string;
  answerHistory: AnswerRecord[]; // stack for step-back
  loopStack: LoopContext[];      // stack for nested loops
  startedAt: number;
  lastStepAt: number;
}
```

Managed inside a `ProtocolSession` class that the runner view holds a reference to. No Svelte stores, no Redux, no Zustand.

**Why not a reactive state library?**
- The state is intrinsically sequential (one question at a time). There is no concurrent update problem.
- The state is serialized to vault JSON for mid-session save. Custom classes serialize cleanly; reactive wrappers add friction.
- Svelte stores would be appropriate *only* if using Svelte for the UI layer — the store would hold the session and drive reactive re-renders. In plain DOM, you update the DOM imperatively after each state transition.

### Settings State

Use the standard Obsidian pattern:
```typescript
// Load with defaults (covers first-install null case)
// Source: [CITED: PITFALLS.md — Settings Persistence gotcha]
this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

// Save
await this.saveData(this.settings);
```

### ItemView State (workspace persistence)

```typescript
// Minimal state — just identifiers, not full session data
// Source: [CITED: forum.obsidian.md/t/confused-about-the-setviewstate-and-state-management]
getState(): Record<string, unknown> {
  return { sessionId: this.session?.id ?? null };
}

setState(state: Record<string, unknown>): Promise<void> {
  // Restore session from vault JSON if sessionId is present
  const id = state.sessionId as string | null;
  if (id) return this.loadSession(id);
  return Promise.resolve();
}
```

### Sources
- [CITED: forum.obsidian.md/t/confused-about-the-setviewstate-and-state-management-of-the-itemview-class/66798]
- [ASSUMED] — "no external state library needed" is reasoned from project requirements, not verified against community surveys

---

## 4. Testing

### The Core Problem

Obsidian plugins are difficult to unit-test because:
1. `import 'obsidian'` fails outside the Obsidian runtime — the module does not exist in Node.js.
2. The entire plugin is compiled to a single `main.js` — standard test runners that load modules dynamically have friction with this.
3. `jest-environment-obsidian` (the only community Obsidian mock environment) is effectively unmaintained since May 2023 (v0.0.1). [VERIFIED: github.com/obsidian-community/jest-environment-obsidian]

### Recommendation: Vitest + Dependency Isolation

**Pattern: Separate pure logic from Obsidian-touching code.**

```
src/
├── engine/               # Pure TypeScript — no Obsidian imports
│   ├── graph.ts          # Canvas JSON → graph model
│   ├── traversal.ts      # Graph traversal, loop detection
│   ├── session.ts        # Session state machine
│   └── snippet.ts        # Snippet parsing and placeholder resolution
├── obsidian/             # Thin adapters — Obsidian API calls live here only
│   ├── vault-adapter.ts  # vault.read(), vault.modify() wrappers
│   └── view-adapter.ts   # DOM construction, ItemView lifecycle
└── main.ts               # Plugin entry point
```

`src/engine/` has zero Obsidian imports. It receives plain objects (parsed JSON, strings) and returns plain objects. Fully testable with Vitest, no mocks needed.

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/engine/**/*.test.ts'],
    environment: 'node',
  },
});
```

**Test commands:**
```bash
# Run engine tests
npx vitest run src/engine

# Watch mode during development
npx vitest src/engine
```

[VERIFIED: npm registry] `vitest` current version: 4.1.2

### What to Test

| Module | Test type | Notes |
|--------|-----------|-------|
| `graph.ts` — canvas JSON parsing | Unit | Pure function, no mocks |
| `traversal.ts` — BFS/DFS, loop detection | Unit | Pure function; test cycles, dead ends, start node |
| `session.ts` — state transitions | Unit | Test step-forward, step-back, loop enter/exit |
| `snippet.ts` — placeholder parsing | Unit | Test all placeholder types, edge cases |
| `vault-adapter.ts` | Manual / integration | Requires running Obsidian |
| `view-adapter.ts` / DOM construction | Manual | JSDOM coverage is low-value for Obsidian DOM helpers |

### Why Not Jest

Jest works, but:
- Configuration with ESM (the template uses `"type": "module"`) requires additional setup (`--experimental-vm-modules` or Babel transform).
- Vitest is natively ESM-compatible and shares Vite's config patterns. Given the project targets TypeScript with ESNext modules, Vitest is the lower-friction choice.
- [ASSUMED] — preference for Vitest over Jest is reasoned, not sourced from a community survey

### Integration / E2E Testing

No mature automated E2E framework for Obsidian plugins exists in 2026. `obsimian` (github.com/motif-software/obsimian) exists but has limited coverage. For RadiProtocol, the practical approach is:
1. A test vault (`test-vault/`) with sample `.canvas` files covering protocol cases.
2. Manual test runs against the test vault during development.
3. The `.canvas` files in the test vault serve as living specifications.

### Sources
- [VERIFIED: github.com/obsidian-community/jest-environment-obsidian] — last commit May 2023, v0.0.1
- [CITED: dev.to/stroiman/writing-an-obsidian-plugin-driven-by-tests-1b35]
- [CITED: moritzjung.dev/obsidian-collection/plugin-dev/testing/challengeswhentestingplugins]
- [VERIFIED: npm registry] — vitest 4.1.2

---

## 5. Hot-Reload Dev Workflow

### Standard Approach: pjeby/hot-reload

[VERIFIED: github.com/pjeby/hot-reload] The plugin is **actively maintained** — latest release 0.3.0 dated August 2025. 863 stars.

**How it works:**
- Watches for changes to `main.js`, `styles.css`, or `manifest.json` in any plugin directory that contains a `.git` subdirectory OR a file named `.hotreload`.
- After ~750 ms of inactivity, disables and re-enables the plugin.
- Install as a manual Obsidian plugin in your dev vault (not available on community plugin list by design).

**Setup:**
1. Install `pjeby/hot-reload` in your dev vault.
2. Create a `.hotreload` file in your plugin's plugin directory.
3. Run `npm run dev` — esbuild watches `src/**/*.ts` and rebuilds `main.js`.
4. Plugin reloads automatically in Obsidian.

### Dev Vault Copy Pattern

The official sample plugin builds `main.js` to the repo root. For hot-reload to work, your repo must live inside the vault at `.obsidian/plugins/your-plugin-id/`. 

Two common setups:
1. **Repo inside vault** (simplest): Clone or init the plugin repo directly at `.obsidian/plugins/radiprotocol/`. The built `main.js` is already in the right place.
2. **Repo outside vault** (cleaner separation): Extend `esbuild.config.mjs` to copy `main.js`, `styles.css`, and `manifest.json` to the vault plugin folder on each build. Use a `VAULT_PATH` environment variable.

```javascript
// esbuild.config.mjs extension for external repo pattern
// Source: [CITED: dev.to/lukasbach/a-more-streamlined-development-workflow]
const vaultPath = process.env.VAULT_PATH;
if (!isDev && vaultPath) {
  const pluginDir = path.join(vaultPath, '.obsidian', 'plugins', 'radiprotocol');
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.copyFileSync('main.js', path.join(pluginDir, 'main.js'));
  fs.copyFileSync('manifest.json', path.join(pluginDir, 'manifest.json'));
  // Write .hotreload marker
  fs.writeFileSync(path.join(pluginDir, '.hotreload'), '');
}
```

### Timing Gotcha

If a build takes more than ~750 ms, hot-reload may fire before `main.js` is fully written, causing a corrupted load. [CITED: PITFALLS.md — esbuild watch mode + hot reload timing] This is unlikely for a TypeScript plugin without Svelte preprocessing but worth monitoring.

### Alternative: `obsidian-plugin-cli`

`npm install -g obsidian-plugin-cli` — wraps esbuild and includes a built-in hot-reload watcher with `--vault-path` argument. Suitable if you prefer not to hand-edit `esbuild.config.mjs`. [ASSUMED — not verified in depth for 2026 maintenance status]

### Sources
- [VERIFIED: github.com/pjeby/hot-reload] — v0.3.0, August 2025
- [CITED: dev.to/lukasbach/a-more-streamlined-development-workflow-for-obsidian-plugins-5hm5]
- [CITED: PITFALLS.md — esbuild watch mode + hot reload timing]

---

## 6. Canvas JSON Parsing

### Format Overview

The `.canvas` format is the **JSON Canvas open spec v1.0**, published by Obsidian in March 2024. Full spec at `jsoncanvas.org/spec/1.0/`. No external library is needed — `JSON.parse` + TypeScript interfaces is the correct approach. [VERIFIED: jsoncanvas.org/spec/1.0/]

### Complete Data Model

```typescript
// Source: [CITED: jsoncanvas.org/spec/1.0/]

type CanvasColor = string; // "#FF0000" or preset "1"-"6"

interface CanvasData {
  nodes?: CanvasNode[];
  edges?: CanvasEdge[];
}

// Node types
type CanvasNode = TextNode | FileNode | LinkNode | GroupNode;

interface BaseNode {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color?: CanvasColor;
}

interface TextNode extends BaseNode {
  type: 'text';
  text: string; // Markdown
}

interface FileNode extends BaseNode {
  type: 'file';
  file: string; // vault path
  subpath?: string; // starts with "#"
}

interface LinkNode extends BaseNode {
  type: 'link';
  url: string;
}

interface GroupNode extends BaseNode {
  type: 'group';
  label?: string;
  background?: string; // image path
  backgroundStyle?: 'cover' | 'ratio' | 'repeat';
}

interface CanvasEdge {
  id: string;
  fromNode: string;
  toNode: string;
  fromSide?: 'top' | 'right' | 'bottom' | 'left';
  toSide?: 'top' | 'right' | 'bottom' | 'left';
  fromEnd?: 'none' | 'arrow';
  toEnd?: 'none' | 'arrow'; // default: "arrow"
  color?: CanvasColor;
  label?: string;
}
```

### RadiProtocol Extension Pattern

Store RadiProtocol-specific metadata directly on nodes/edges using namespaced custom keys. The spec explicitly supports arbitrary additional keys. [CITED: PITFALLS.md — JSON Canvas Format Extensibility]

```typescript
// Extended node for RadiProtocol
interface RPTextNode extends TextNode {
  radiprotocol_nodeType?: 'question' | 'answer' | 'text-block' | 'loop-start' | 'loop-end' | 'start';
  radiprotocol_snippetId?: string;
  radiprotocol_appendText?: string; // text to append when this answer is chosen
}
```

### Reading a Canvas File

```typescript
// Source: pattern inferred from vault API docs + community examples
// Never use require('fs') — always use vault API
async function readCanvas(app: App, filePath: string): Promise<CanvasData> {
  const file = app.vault.getAbstractFileByPath(filePath);
  if (!(file instanceof TFile)) throw new Error(`Not a file: ${filePath}`);
  const raw = await app.vault.read(file);
  return JSON.parse(raw) as CanvasData;
}
```

**CRITICAL constraint:** Do not call `vault.modify()` on a `.canvas` file that is currently open in a Canvas view. The Canvas view will overwrite your changes. [CITED: PITFALLS.md — Canvas File Overwrites Plugin Changes]

For the protocol runner: parse the canvas file once at session start, build a graph model in memory, and never write back during the session.

### No Library Needed

There is no TypeScript/JavaScript library for JSON Canvas that adds value over raw JSON parsing. `PyJSONCanvas` exists for Python. The format is intentionally simple — a flat list of nodes and a flat list of edges. Build your own graph model (adjacency list, etc.) from the parsed data.

### Sources
- [CITED: jsoncanvas.org/spec/1.0/] — complete data model verified
- [CITED: obsidian.md/blog/json-canvas/] — format history
- [CITED: PITFALLS.md] — canvas-specific gotchas

---

## 7. Linting and Formatting

### Recommended ESLint Configuration

The official sample plugin as of early 2026 includes `eslint-plugin-obsidianmd` in its devDependencies. Use this as the foundation.

**Install:**
```bash
npm install --save-dev \
  eslint-plugin-obsidianmd \
  typescript-eslint \
  @eslint/js \
  globals \
  jiti
```

[VERIFIED: npm registry] These are already present in the current sample plugin template.

### `eslint.config.mjs` (recommended config)

```javascript
// Source: [CITED: github.com/mProjectsCode/eslint-plugin-obsidianmd]
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  obsidianmd.configs.recommended,
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        project: true,
      },
    },
    rules: {
      // Community review requirements
      'no-console': ['error', { allow: ['warn', 'error', 'debug'] }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // Obsidian idioms
      'no-restricted-syntax': [
        'error',
        {
          selector: 'AssignmentExpression[left.property.name="innerHTML"]',
          message: 'Use createEl() or sanitizeHTMLToDom() instead of innerHTML',
        },
        {
          selector: 'AssignmentExpression[left.property.name="outerHTML"]',
          message: 'Do not use outerHTML — use DOM API',
        },
      ],
    },
  },
);
```

### `eslint-plugin-obsidianmd` — All Enforced Rules

[VERIFIED: github.com/mProjectsCode/eslint-plugin-obsidianmd] The `recommended` config includes:

**Command rules:**
- `no-command-in-command-id` — command IDs must not contain "command"
- `no-command-in-command-name` — command names must not contain "command"
- `no-default-hotkeys` — do not assign default hotkeys (users set their own)
- `no-plugin-id-in-command-id` — Obsidian prepends plugin ID automatically; don't duplicate it
- `no-plugin-name-in-command-name` — Obsidian shows plugin name in palette; don't duplicate it

**Memory and performance:**
- `detach-leaves` (auto-fix) — do not detach leaves in `onunload`
- `no-plugin-as-component` — prevents memory leaks with `MarkdownRenderer.render`
- `no-view-references-in-plugin` — don't store view references in the plugin class
- `vault/iterate` (auto-fix) — don't iterate all files to find one by path

**Code quality:**
- `no-sample-code` (auto-fix) — removes template boilerplate
- `no-tfile-tfolder-cast` — use `instanceof` instead of type casting
- `no-static-styles-assignment` — use CSS classes, not inline style assignments
- `no-forbidden-elements` — prevents attaching certain forbidden DOM elements
- `object-assign` — two-argument `Object.assign` usage
- `platform` — don't use `navigator` API for OS detection
- `regex-lookbehind` — lookbehinds are unsupported on some iOS versions
- `prefer-abstract-input-suggest` — use built-in `AbstractInputSuggest`
- `prefer-file-manager-trash-file` — use `FileManager.trashFile()` to respect user preferences

**Settings and UI:**
- `settings-tab/no-manual-html-headings` (auto-fix) — use proper heading API
- `settings-tab/no-problematic-settings-headings` (auto-fix) — heading anti-patterns
- `ui/sentence-case` (auto-fix, warn level) — all UI strings must be sentence case

**Manifest:**
- `validate-manifest` — validates `manifest.json` structure
- `hardcoded-config-path` — catches hardcoded `.obsidian` paths

### Additional Rules for RadiProtocol

Beyond `eslint-plugin-obsidianmd`, add these rules manually (they are not covered by the plugin):

| Rule | Why | Config |
|------|-----|--------|
| `no-console` | `console.log` is a review rejection. Allow `warn/error/debug`. | `['error', { allow: ['warn','error','debug'] }]` |
| `@typescript-eslint/no-explicit-any` | Review rejection. Any type in medical protocol logic is dangerous anyway. | `'error'` |
| `@typescript-eslint/no-floating-promises` | Unhandled promises flagged in review. Requires `parserOptions: { project: true }`. | `'error'` |
| innerHTML via `no-restricted-syntax` | `no-forbidden-elements` covers element creation but a selector-based rule catches direct assignment too. | See config above |

### Formatting

No formatter is included in the official sample plugin. Add Prettier if desired:
```bash
npm install --save-dev prettier
```
Minimal `.prettierrc`: `{ "singleQuote": true, "semi": true, "tabWidth": 2 }`

Prettier and ESLint coexist cleanly as long as `eslint-config-prettier` is added to disable ESLint formatting rules. [ASSUMED — standard Prettier/ESLint setup]

### Sources
- [VERIFIED: github.com/mProjectsCode/eslint-plugin-obsidianmd] — 27 rules, full list confirmed
- [VERIFIED: github.com/obsidianmd/obsidian-sample-plugin] — package.json shows plugin is already in template
- [CITED: eslint.org/docs/latest/rules/no-console]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `strictPropertyInitialization` conflicts with Obsidian plugin class pattern — reason for not using `"strict": true` umbrella | Toolchain | Low — easy to verify by adding `strict: true` and seeing compiler errors |
| A2 | Plain DOM is sufficient for v1 UI complexity; Svelte upgrade is straightforward if needed | UI Framework | Low — the upgrade path is well-documented |
| A3 | No external state management library is needed for session state | State Management | Low — the state model is intrinsically sequential |
| A4 | Vitest is preferable to Jest for this project due to ESM compatibility | Testing | Low — Jest also works; this is a DX preference |
| A5 | `obsidian-plugin-cli` is maintained in 2026 | Hot-reload alternatives | Medium — not verified; pjeby/hot-reload is the safer default |
| A6 | Prettier + eslint-config-prettier is the right formatting setup | Linting | Low — standard practice |

---

## Open Questions

1. **Obsidian version target for `minAppVersion`**
   - What we know: The plugin uses `ItemView`, `Modal`, `PluginSettingTab`, and `vault.read/modify` — all stable since early Obsidian versions.
   - What's unclear: Whether any desired API (e.g., `onExternalSettingsChange`, added in 1.5.7) requires raising the minimum version.
   - Recommendation: Set `minAppVersion` to `"1.5.7"` to get `onExternalSettingsChange` support, then raise as needed when consuming newer APIs.

2. **Svelte 5 vs Svelte 4 for Obsidian**
   - What we know: `svelte` 5.55.1 is current (Svelte 5 released October 2024). `esbuild-svelte` 0.9.4 supports Svelte 5.
   - What's unclear: Whether Svelte 5's rune-based reactivity system (`$state`, `$derived`) causes any friction with Obsidian's component lifecycle pattern (mount on `onOpen`, destroy on `onClose`).
   - Recommendation: If Svelte is chosen, research a Svelte 5 + Obsidian integration example before committing. The lifecycle pattern documented in official Obsidian docs was written for Svelte 4.

3. **Canvas file format version stability**
   - What we know: JSON Canvas spec v1.0 is published and stable. Obsidian has shipped it since 2024.
   - What's unclear: Whether Obsidian will add proprietary extensions to the canvas format that the plugin needs to round-trip safely.
   - Recommendation: Namespace all custom properties with `radiprotocol_` prefix and validate after every write.

---

## Environment Availability

This section is N/A for the stack research phase — no runtime environment audit is required before the build toolchain is established. The project has not been scaffolded yet; environment availability should be confirmed at project initialization.

Minimum requirements for development:
- Node.js (LTS, >= 18)
- npm >= 8
- Obsidian desktop (>= 1.5.7 recommended)
- Git (for `.git` directory hot-reload trigger)

---

## Sources

### Primary (HIGH confidence)
- `github.com/obsidianmd/obsidian-sample-plugin` — official template, verified raw files
- `npm registry` — all package versions verified 2026-04-05
- `jsoncanvas.org/spec/1.0/` — complete canvas data model verified
- `github.com/pjeby/hot-reload` — maintenance status verified (v0.3.0, Aug 2025)
- `github.com/mProjectsCode/eslint-plugin-obsidianmd` — all 27 rules verified
- `github.com/obsidian-community/jest-environment-obsidian` — last commit May 2023 verified

### Secondary (MEDIUM confidence)
- `docs.obsidian.md/Plugins/Getting+started/Use+Svelte+in+your+plugin` — Svelte integration pattern
- `marcusolsson.github.io/obsidian-plugin-docs/getting-started/svelte` — Svelte mount/unmount lifecycle
- `dev.to/lukasbach/a-more-streamlined-development-workflow-for-obsidian-plugins` — dev vault copy pattern
- `forum.obsidian.md/t/seeking-some-suggestions-react-vs-svelte/93451` — community framework discussion
- `forum.obsidian.md/t/plugin-tech-stack/20867` — community tech stack survey
- `dev.to/stroiman/writing-an-obsidian-plugin-driven-by-tests` — test isolation pattern

### Tertiary (LOW confidence — not independently verified)
- `obsidian-plugin-cli` npm package — alternative dev workflow tool
- `obsimian` (github.com/motif-software/obsimian) — integration testing framework

### Cross-References to Other Research Files
- `PITFALLS.md` — Canvas API limitations, vault.modify race conditions, community review requirements
- `FEATURES.md` — UX requirements that influence UI framework choice and state model design
