# RadiProtocol — Obsidian Plugin for Interactive Protocols

## Project Map

- `src/main.ts` — Plugin entry (`onload`/`onunload`), wires all services and views
- `src/settings.ts` — Settings tab singleton
- `src/protocol/` — Protocol document model, parser, vault store, remote library
- `src/runner/` — Pure traversal state machine + render sub-modules
- `src/graph/` — Directed-graph types, validator, label utilities
- `src/snippets/` — Snippet data model, vault CRUD, external library
- `src/views/` — Obsidian ItemViews, Modals, and reusable DOM widgets
- `src/i18n/` — Translator service (en/ru)
- `src/utils/` — DOM helpers, vault utils, write mutex
- `src/constants/` — CSS classes, runner status enums
- `src/__tests__/` — Test suites mirroring source structure

## Architecture

Feature-grouped modular Obsidian plugin (TypeScript 6.0, Obsidian API 1.12.3, esbuild bundler, Vitest). Domain logic in `protocol/`, `runner/`, `graph/`, `snippets/` — UI in `views/`. Dependency direction: `views/` → all lower layers; lower layers never import from `views/` (one documented exception: `runner/render/render-snippet-picker.ts` imports `SnippetTreePicker`).

```
views/  → [protocol/ runner/ graph/ snippets/ utils/ i18n/ constants/]
              ↑ (no reverse dependency)
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Type-check + esbuild dev bundle |
| `npm run build` | Type-check + esbuild production bundle |
| `npm test` | Run all tests via Vitest |
| `npm run lint` | ESLint + Stylelint |
| `npm run knip` | Dead file detection |
| `npm run version` | Bump version in manifest/package.json |

<important if="you are writing or modifying tests">
## Testing Conventions
- Vitest test runner — no Jest config needed
- Pure modules (graph, runner core, snippet-model): construct directly, no mocking
- Obsidian-dependent services (stores, snippet service): use `makeVault()` + `makeApp()` mock factory (see `__tests__/protocol-document-store.test.ts` for pattern)
- Mock vault uses in-memory `Record<string, string>`, `vi.fn()` on every method
- Store tests verify both return values AND side effects on mock files
- Fixture files go in `__tests__/fixtures/` (`.canvas` files for graph scenarios)
- Test naming: `describe('Module — feature')`, `it('describes specific behavior')`
</important>

<important if="you are adding or modifying environment configuration or settings">
## Settings & Configuration
- Settings defined in `src/settings.ts` via `RadiProtocolSettings` interface
- Plugin settings tab uses Obsidian `PluginSettingTab`
- Library URL, snippet folder path, and locale are user-configurable
- Secrets not applicable (desktop-only plugin, no auth tokens)
</important>

<important if="you are adding a new feature that touches multiple layers">
## Adding a Cross-Layer Feature
1. **Define domain types** in `graph/graph-model.ts` (new node kind) or `snippets/snippet-model.ts` (new snippet kind) — see `.rpiv/guidance/src/graph/architecture.md`
2. **Add parser support** in `protocol/protocol-document-parser.ts` — see `.rpiv/guidance/src/protocol/architecture.md`
3. **Add validation** in `graph/graph-validator.ts` — see `.rpiv/guidance/src/graph/architecture.md`
4. **Wire runner state** in `runner/protocol-runner.ts` and `runner/runner-state.ts` — see `.rpiv/guidance/src/runner/architecture.md`
5. **Render the new state** in `runner/render/` — see `.rpiv/guidance/src/runner/architecture.md`
6. **Add UI components** in `views/` — see `.rpiv/guidance/src/views/architecture.md`
</important>
