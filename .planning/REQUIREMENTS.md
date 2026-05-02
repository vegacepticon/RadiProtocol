# RadiProtocol — v1.14 Requirements

**Milestone:** v1.14 Internationalization, Documentation & Infrastructure
**Defined:** 2026-05-03
**Source:** User request for English/Russian UI, README for GitHub, parallel inline runner sessions, and template library research. Builds on v1.13 codebase-health foundation.

This milestone has **user-facing and infrastructure surface**. Unlike v1.12/v1.13 (internal-only), v1.14 delivers visible improvements: language selection, documentation, and parallel session support. No GitHub Release is required for `1.14.0` if internal-only; a release is optional if user-facing changes are polished.

---

## Active Requirements

### Internationalization (i18n)

- [ ] **I18N-01**: A type-safe i18n service (`src/i18n/i18n-service.ts`) with:
  - Locale files: `en.json` (default) and `ru.json` — flat or nested key structure, exact schema decided in Phase 84 planning.
  - `t(key, fallback?)` function exported and consumed by all user-facing UI strings in `src/views/`, `src/settings.ts`, and `src/snippets/`.
  - Runtime locale switch via plugin settings (dropdown: English / Русский); default is English for new installs, Russian preserved for existing installs (backward compatibility).
  - All current Russian strings extracted into `ru.json`; English strings extracted into `en.json`.
  - `git grep -nP "[\u0400-\u04FF]" src/views/ src/settings.ts src/snippets/` returns zero matches outside of `ru.json` and test files.
  - `npm test` exits 0; `npm run lint` exits 0; `npm run build` exits 0.

- [ ] **I18N-02**: Graph validator error messages, parser migration errors, and runner error messages are internationalized.
  - `canvas-parser.ts` legacy error (`free-text-input` rejection) uses `t()`.
  - `graph-validator.ts` loop/snippet validation errors use `t()` with interpolation.
  - `protocol-runner.ts` legacy runtime error uses `t()`.
  - Test assertions may check for key presence or use a test-locale helper; assertion semantics are preserved.

### Documentation

- [ ] **DOC-01**: `README.md` at repo root with:
  - Project description and core value (one paragraph).
  - Feature list (bullet points): canvas-based protocol authoring, interactive runner with step-back, dynamic snippets with placeholders, loops for multi-lesion workflows, inline/sidebar/tab runner modes.
  - Installation: BRAT instructions + manual `main.js` + `manifest.json` copy.
  - Quick-start: create a canvas → add question/answer nodes → run protocol.
  - Screenshot placeholders (commented `<!-- screenshot: ... -->`) for future images.
  - License reference (repo LICENSE file).
  - No Obsidian community plugin store submission info (still deferred).

- [ ] **DOC-02**: `docs/` folder created with:
  - `docs/PROTOCOL-AUTHORING.md` — how to build a protocol canvas (node kinds, edge semantics, loop construction with «+» prefix, snippet binding).
  - `docs/CONTRIBUTING.md` — dev setup (`npm install`, `npm run dev`), test command (`npm test`), lint gate (`npm run lint`), pre-commit hook, branch naming, PR process.
  - Both documents in English (primary) with Russian as future translation.

### Multiple Inline Runners

- [ ] **INLINE-MULTI-01**: `RadiProtocolPlugin` maintains a registry (`Set<InlineRunnerModal>`) of open inline runners.
  - `openInlineRunner()` checks if a runner for the same `(canvasPath, notePath)` pair is already open — if yes, focuses it; if no, creates a new instance.
  - Each instance has independent `ProtocolRunner` state (already true — `ProtocolRunner` is pure).
  - `isFillModalOpen` converted from implicit global to per-instance flag.
  - `onunload()` iterates the registry and calls `.close()` on each instance to prevent DOM leaks.
  - `npm test` exits 0; existing inline-runner tests pass without assertion changes.

- [ ] **INLINE-MULTI-02**: Cascade positioning for new inline runner instances.
  - First instance uses saved position from `plugin.settings.inlineRunnerPosition`.
  - Second+ instance offsets by (+24px, +24px) from the last opened instance's position (capped at viewport bounds – 32px).
  - Position is NOT persisted per-instance; only the global default is saved. Per-instance persistence is deferred.

### Template Library (Research + MVP)

- [ ] **TEMPLATE-LIB-01**: Research and scaffold a template library system.
  - `LibraryService` (`src/snippets/library-service.ts`) fetches an index JSON from a configurable URL (default: GitHub raw).
  - `LibraryIndex` type: `{ version: string; snippets: Array<{ id, name, category, path, description }> }`.
  - `installSnippet(entry)` downloads raw file via `requestUrl()` and saves it into `.radiprotocol/snippets/Library/<category>/` via existing `SnippetService`.
  - `library-manifest.json` tracks installed library snippets with version for future update detection.
  - Settings field `libraryUrl` added (default: trusted repo URL; custom URL allowed with warning).
  - SnippetManagerView renders installed library snippets as normal folders/files (no separate view needed).

- [ ] **TEMPLATE-LIB-02**: UI integration in SnippetManagerView.
  - Button «🌐 Library» / «🌐 Библиотека» above the tree (i18n-ready) opens a modal with category list.
  - Install action shows progress; on completion, tree refreshes via existing vault watcher.
  - Error handling: network failure → Notice with `t('library.networkError')`; name collision → confirm overwrite or skip.
  - Out of scope for v1.14: auto-updates, versioning UI, community contribution flow, offline mode.

---

## Future Requirements (deferred from v1.14)

- **Per-instance inline runner session recovery** — `SessionService` key collision when two inline runners use the same canvas. Deferred; requires `canvasPath + '#' + notePath` key schema change.
- **Per-instance inline runner position persistence** — `Map<notePath, Position>` in settings. Deferred to avoid settings schema churn.
- **Full library auto-update** — diff detection, update badges, batch update. Deferred.
- **Exhaustive i18n** — long-tail strings in error messages, comments, console logs. Deferred; Phase 84 covers all user-visible strings.
- **GitHub Release for 1.14.0** — optional; only if user-facing polish warrants a BRAT update.

---

## Out of Scope (explicit exclusions)

- **No changes to canvas parser, graph validator logic, runner state machine, or snippet CRUD.** All refactors are additive (i18n layer, registry layer, library service).
- **No Obsidian community plugin store submission.** README prepared but submission checklist remains deferred.
- **No mobile support.** Still desktop-only.
- **No AI/LLM integration.** Still manual algorithm authoring.
- **No engine decomposition.** `protocol-runner.ts` remains out of scope (carry-over from v1.13).
- **No exhaustive CSS/stylelint sweeps.** v1.13 pattern demonstrated; full migration deferred.

---

## Traceability

| REQ-ID | Phase | Status |
|---|---|---|
| I18N-01 | 84 | Active |
| I18N-02 | 84 | Active |
| DOC-01 | 84 | Active |
| DOC-02 | 84 | Active |
| INLINE-MULTI-01 | 85 | Active |
| INLINE-MULTI-02 | 85 | Active |
| TEMPLATE-LIB-01 | 86 | Active |
| TEMPLATE-LIB-02 | 86 | Active |

**Phase ordering constraint:** Phase 84 (i18n + docs) is a foundation — English strings must exist before Phase 85/86 UI work can reference them. Phase 85 and 86 are independent and may run in parallel after Phase 84 lands.

**Hard dependency:** Phase 84 → 85, 86. Soft dependency: none.
