# Phase 1: Project Scaffold and Canvas Parsing Foundation - Context

**Gathered:** 2026-04-05
**Status:** Ready for planning

<domain>
## Phase Boundary

The plugin compiles, installs, and can parse any canvas file into a validated typed graph model. All pure engine code (`CanvasParser`, `GraphValidator`) is under Vitest test before any UI work begins. Dev toolchain is fully operational: `npm run dev` hot-reloads into a dev vault, ESLint runs clean, Vitest passes. No UI is built in this phase.

</domain>

<decisions>
## Implementation Decisions

### Dev Toolchain Setup
- **D-01:** Dev vault path configured via a `.env` file (`.gitignored`) with `OBSIDIAN_DEV_VAULT_PATH=...`. `esbuild.config.mjs` reads this at build time using `dotenv` or manual `fs.readFileSync`. Each developer sets their own path; no vault path is committed to the repo.
- **D-02:** `npm run dev` script builds with esbuild in watch mode and automatically copies `main.js` and `manifest.json` to `${OBSIDIAN_DEV_VAULT_PATH}/.obsidian/plugins/radiprotocol/` on each rebuild.

### Test Fixture Strategy
- **D-03:** Canvas fixtures are committed as real `.canvas` JSON files in `src/__tests__/fixtures/` (e.g., `linear.canvas`, `branching.canvas`, `dead-end.canvas`, `cycle.canvas`). Vitest reads them with `fs.readFileSync`. This covers all six `GraphValidator` error classes plus valid protocol shapes.
- **D-04:** Fixtures are minimal — 3–5 nodes each, with synthetic labels (`Q1`, `A1`, `Start`, etc.). No realistic radiology content in fixtures; that complexity belongs in the manual dev vault.

### Scaffold Structure
- **D-05:** Scaffold the full `src/` directory structure upfront, matching ARCHITECTURE.md, with placeholder stub files for all 7-phase modules. Stub files export empty classes/interfaces so TypeScript compiles without errors from day one. Phases 2–7 fill in the stubs; Phase 1 implements only `src/graph/`.
- **D-06:** Full structure: `src/main.ts`, `src/settings.ts`, `src/graph/` (canvas-parser, graph-model, graph-validator), `src/runner/` (stubs), `src/snippets/` (stubs), `src/sessions/` (stubs), `src/views/` (stubs), `src/utils/` (write-mutex, vault-utils).

### TypeScript Configuration
- **D-07:** `noUncheckedIndexedAccess` remains enabled (official scaffold default). Array index access and Map lookups return `T | undefined` — all callers must null-check. This is the correct approach for graph lookups where a node ID might be missing.

### Claude's Discretion
- Exact `dotenv` vs. manual `.env` parsing in `esbuild.config.mjs`
- Stub file content (empty class vs. `// TODO: Phase N` comment)
- ESLint flat config structure (the scaffold already provides a template)
- `manifest.json` and `versions.json` initial content (follow official scaffold defaults)
- `minAppVersion` value: use `"1.5.7"` per NFR-03

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §PARSE-01 through PARSE-08 — all canvas parser requirements for Phase 1
- `.planning/REQUIREMENTS.md` §DEV-01 through DEV-05 — dev toolchain requirements
- `.planning/REQUIREMENTS.md` §NFR-01 through NFR-11 — non-functional requirements (all apply from Phase 1)

### Architecture and Stack
- `.planning/research/ARCHITECTURE.md` §1 — Plugin component architecture, module directory structure, `CanvasParser` pure-module pattern
- `.planning/research/ARCHITECTURE.md` §2 — Graph model design: `ProtocolGraph` type, 7 node kinds, `radiprotocol_*` property namespace
- `.planning/research/STACK.md` §1 — Build toolchain: official scaffold `package.json`, `esbuild.config.mjs`, `tsconfig.json` (verified versions as of 2026-04-05)
- `.planning/research/STACK.md` §2 — ESLint: `eslint-plugin-obsidianmd` (27 rules), additional rules required by DEV-02/DEV-03
- `.planning/research/STACK.md` §3 — Testing strategy: Vitest for pure engine modules; no Obsidian API mock needed for `src/graph/`

### Pitfalls
- `.planning/research/PITFALLS.md` — Critical pitfalls applicable from Phase 1: never `require('fs')`, no `innerHTML`, `loadData()` null guard, no `console.log` in production

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None yet — this is the initial scaffold phase. No existing source files.

### Established Patterns
- Canvas `.canvas` format: JSON Canvas v1.0 spec. RadiProtocol metadata stored as `radiprotocol_*` custom properties on canvas node objects. Never modify native canvas fields.
- `CanvasParser` receives a JSON string (from `vault.read()`), returns `ProtocolGraph`. Zero Obsidian API imports in this module — fully unit-testable.
- Graph model uses a discriminated union on `kind` field for 7 node types: `start`, `question`, `answer`, `free-text-input`, `text-block`, `loop-start`, `loop-end`.

### Integration Points
- `main.ts` `onload()` instantiates `CanvasParser` (pure, no app dep) and registers commands/views. Views and services are wired in later phases.
- `esbuild.config.mjs` copies output to dev vault — reads `OBSIDIAN_DEV_VAULT_PATH` from `.env`.

</code_context>

<specifics>
## Specific Ideas

- No specific UI or UX references — Phase 1 is pure engine and toolchain, no visible UI.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-project-scaffold-and-canvas-parsing-foundation*
*Context gathered: 2026-04-05*
