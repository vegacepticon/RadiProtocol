# RadiProtocol — Obsidian Plugin for Interactive Protocols

## Project Map
- `src/main.ts` — Plugin entry (`onload`/`onunload`), wires all services and views
- `src/settings.ts` — Settings tab singleton
- `src/protocol/` — `.rp.json` document model, pure parser, vault CRUD store, file resolver
- `src/runner/` — Pure traversal state machine + render sub-modules
- `src/graph/` — Directed-graph types, never-throw validator, label utilities
- `src/snippets/` — Snippet data model (md + md-template), vault CRUD, cross-protocol ref-sync
- `src/views/` — Obsidian ItemViews, Modals, reusable DOM widgets
- `src/i18n/` — Translator service (en/ru)
- `src/utils/` — DOM helpers, vault utils, write mutex
- `src/constants/` — CSS classes, runner status enums
- `src/styles/` — Feature CSS files (stylelint-governed)
- `src/donate/` — Donation wallet address data
- `src/__tests__/` — Test suites mirroring source structure

## Architecture
Feature-grouped modular Obsidian plugin. TypeScript + esbuild + Vitest. Domain logic in `protocol/`, `runner/`, `graph/`, `snippets/`; UI in `views/`. Dependency direction: `views/` → all lower layers; lower layers never import from `views/` (one documented exception: `runner/render/render-snippet-picker.ts` imports `SnippetTreePicker`).

```
views/  → [protocol/ runner/ graph/ snippets/ utils/ i18n/ constants/]
              ↑ (no reverse dependency)
```

Pure-vs-Obsidian split per layer (NFR-01): `graph/` (all pure), `protocol/` document+parser (pure), `protocol/` store+resolver (Obsidian), `runner/` core (pure), `runner/render/` (Obsidian DOM), `snippets/` model+template-parser (pure), `snippets/` service+ref-sync (Obsidian). Pure modules receive Obsidian capabilities via constructor injection (`GraphValidator` probe, `Translator` default).

## Commands
| Command | What it does |
|---|---|
| `npm run dev` | Type-check + esbuild dev bundle |
| `npm run build` | Type-check + esbuild production bundle |
| `npm test` | Run all tests via Vitest |
| `npm run lint` | ESLint + Stylelint |
| `npm run check` | build + lint + tests + planning + consistency + agent-docs |
| `npm run knip` | Dead file detection |

## Business Context
Radiology documentation aid — the radiologist remains responsible for clinical judgment. No backend/auth/cloud; plugin-local only. Inline-only runner (no sidebar/RunnerView — ADR-0001). Git tags numeric (no v-prefix); releases via `npm version X.Y.Z`. Snippets use Markdown templates with YAML front-matter (JSON snippets removed — commit `b895736`; legacy `.json` files left on disk but never listed/inserted).

<important if="you are adding a new feature that touches multiple layers">
## Adding a Cross-Layer Feature
1. **Define domain types** in `graph/graph-model.ts` — see `.rpiv/guidance/src/graph/architecture.md`
2. **Add parser support** in `protocol/protocol-document-parser.ts` — see `.rpiv/guidance/src/protocol/architecture.md`
3. **Add validation** in `graph/graph-validator.ts` — see `.rpiv/guidance/src/graph/architecture.md`
4. **Wire runner state** in `runner/protocol-runner.ts` + `runner/runner-state.ts` — see `.rpiv/guidance/src/runner/architecture.md`
5. **Render the new state** in `runner/render/` — see `.rpiv/guidance/src/runner/render/architecture.md`
6. **Add UI components** in `views/` — see `.rpiv/guidance/src/views/architecture.md`
</important>

<important if="you are writing or modifying tests">
- Vitest runner — no Jest config. Pure modules constructed directly, no mocking
- Obsidian-dependent services: `makeVault()` + `makeApp()` mock factory (see `__tests__/protocol-document-store.test.ts`)
- Render layer: `MockEl` class + `vi.fn()` host spies (see `__tests__/runner/render-question.test.ts`)
- Runner tests: `new ProtocolRunner()` (no args), inline graphs with `new Map<string, RPNode>()`
- Fixtures in `__tests__/fixtures/` (`.canvas` for graph scenarios)
- Naming: `describe('Module — feature')`, `it('describes specific behavior')`
</important>

<important if="you are adding or modifying i18n strings">
- Keys follow `componentName.stringName` (e.g., `snippetEditor.name`, `protocolRunner.stepBack`)
- Add to BOTH `src/i18n/locales/en.json` and `src/i18n/locales/ru.json`
- User-authored content (snippet names, template text) is NEVER wrapped in `t()`
- Pure modules receive `Translator` via constructor defaulting to `defaultT`
- Plugin views inject `this.plugin.i18n.t.bind(this.plugin.i18n)`
</important>

<important if="you are modifying build output or releasing">
- `main.js` and `styles.css` change only through the build pipeline (`npm run build`)
- Release: `npm version X.Y.Z` updates `manifest.json` + `versions.json` (numeric tags, no v-prefix)
- `.githooks/` optional: `git config core.hooksPath .githooks` enables pre-commit lint + pre-push `check`
</important>