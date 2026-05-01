---
phase: 77
plan: 12
status: complete
requirements: [LINT-01]
key-files:
  modified:
    - src/main.ts
    - src/settings.ts
    - src/views/canvas-selector-widget.ts
    - src/views/editor-panel-view.ts
    - src/views/snippet-chip-editor.ts
    - src/__tests__/editor-panel.test.ts
    - src/__tests__/editor-panel-create.test.ts
    - src/__tests__/views/snippet-chip-editor.test.ts
commands:
  - npx eslint src/main.ts src/settings.ts src/views/editor-panel-view.ts src/views/snippet-chip-editor.ts src/views/canvas-selector-widget.ts src/__tests__/editor-panel-create.test.ts src/__tests__/views/snippet-chip-editor.test.ts src/__tests__/editor-panel.test.ts --format json
  - npm run build
  - npm test -- src/__tests__/settings-tab.test.ts src/__tests__/editor-panel.test.ts src/__tests__/editor-panel-create.test.ts src/__tests__/views/snippet-chip-editor.test.ts src/__tests__/main-inline-command.test.ts
---

# 77-12 Summary

Applied sentence-case lint fixes across the remaining production UI strings and lock-step tests.

## Mapping

- `src/main.ts`
  - `Edit RadiProtocol properties` → `Edit protocol properties`.
  - `Open a markdown note first, then run this command.` → `Open a Markdown note first, then run this command.`.
  - `Set a protocol folder in Settings to get started.` → `Set a protocol folder in settings to get started.`.
- `src/views/canvas-selector-widget.ts`
  - Same `Settings` → `settings` string changed in both matching hints found by `git grep`.
- `src/settings.ts`
  - `"Newline" ... "Space"` desc → `"newline" ... "space"`.
  - `e.g. Protocols` kept at plugin-rule suggestion `E.g. Protocols`.
  - `Save to note` / `Both` references in output destination desc → lowercase inside the sentence.
  - `setPlaceholder('RadiProtocol Output')` → `setPlaceholder(DEFAULT_SETTINGS.outputFolderPath)` to preserve the configured default path while avoiding a duplicated UI literal.
- `src/views/editor-panel-view.ts`
  - `RadiProtocol node editor` → `Protocol node editor`.
  - Idle hint now references `edit protocol properties`.
  - Node-type description now uses `protocol role`.
  - Separator descriptions use lowercase quoted `use global`, `settings > runner`, and `text separator`.
  - Duplicate-node Notice now says `Select a protocol node to duplicate.`.
- `src/views/snippet-chip-editor.ts`
  - `+ Add placeholder` → `+ add placeholder`.
  - `e.g. Patient age` kept at plugin-rule suggestion `E.g. Patient age`.
  - `+ Add option` → `+ add option`.

## Tests updated in lock-step

- `src/__tests__/editor-panel.test.ts`
- `src/__tests__/editor-panel-create.test.ts`
- `src/__tests__/views/snippet-chip-editor.test.ts`

## Verification

- Focused ESLint over changed production/test files: 0 errors, 0 warnings.
- `npm run build`: passed.
- Focused tests: 5 files passed, 50 tests passed.
