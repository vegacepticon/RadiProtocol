---
phase: 32
plan: 02
subsystem: snippets/canvas-ref-sync
tags: [canvas, refactor, foundation, phase-34-dep]
dependency_graph:
  requires:
    - src/utils/write-mutex.ts (WriteMutex)
    - obsidian (App, TFile, Vault)
  provides:
    - src/snippets/canvas-ref-sync.ts::rewriteCanvasRefs
    - src/snippets/canvas-ref-sync.ts::CanvasSyncResult
  affects: []
tech_stack:
  added: []
  patterns:
    - per-file WriteMutex for vault.modify race protection
    - best-effort try/catch per canvas with skipped-reason collection
    - longest-prefix match with `/` boundary for folder-move rewrites
key_files:
  created:
    - src/snippets/canvas-ref-sync.ts
  modified: []
decisions:
  - "Module-level canvasMutex (not passed in) — keeps API minimal; Plan 04 tests can import directly"
  - "Exact match wins over prefix; longest prefix wins on ties — deterministic for nested folder moves"
  - "Early-return on canvases with no matching snippet nodes — avoids mtime churn (D-06 hygiene)"
metrics:
  duration_min: 2
  completed_date: "2026-04-15"
  tasks_completed: 1
  files_changed: 1
---

# Phase 32 Plan 02: canvas-ref-sync Foundation Summary

Создан новый модуль `src/snippets/canvas-ref-sync.ts`, экспортирующий `rewriteCanvasRefs(app, mapping)` — vault-wide переписывание `radiprotocol_subfolderPath` на snippet-узлах всех `.canvas` файлов при переименовании/перемещении папок сниппетов (foundation для Phase 34).

## What Was Built

- **`src/snippets/canvas-ref-sync.ts`** (132 строки)
  - `export interface CanvasSyncResult { updated: string[]; skipped: Array<{ path; reason }> }`
  - `export async function rewriteCanvasRefs(app, mapping)`
  - Private helper `applyMapping(current, mapping)` — exact + longest-prefix match с `/` границей
  - Module-level `canvasMutex = new WriteMutex()`

## Design Highlights

- **D-04**: операция — один проход по `app.vault.getFiles().filter(f => f.extension === 'canvas')`.
- **D-05**: матчинг — exact первый, затем longest-prefix с `startsWith(key + '/')` (boundary гарантирует что `foo` не матчит `foobar`).
- **D-06**: best-effort — три уровня try/catch (read / JSON.parse / modify), каждый пишет в `skipped` с причиной и продолжает цикл. `rewriteCanvasRefs` никогда не бросает.
- **D-07**: изменяются только узлы с `radiprotocol_nodeType === 'snippet'`; другие поля не трогаются.
- **D-11**: `canvasMutex.runExclusive(file.path, ...)` оборачивает каждый `vault.modify`.
- **WR-02 compatibility**: пустая строка / `null` / missing интерпретируются как "root" и пропускаются (нечего переписывать).
- **No-op early return**: если в canvas нет ни одного изменённого snippet-узла — `vault.modify` не вызывается, mtime не трогается.

## Verification

- `npx tsc --noEmit` — нет ошибок в `canvas-ref-sync.ts` (pre-existing vitest/vite module-resolution ошибки — out-of-scope, не трогались).
- Acceptance grep conditions:
  - [x] `export async function rewriteCanvasRefs(app: App, mapping: Map<string, string>)`
  - [x] `export interface CanvasSyncResult`
  - [x] `canvasMutex.runExclusive`
  - [x] `radiprotocol_nodeType` / `radiprotocol_subfolderPath` string literals
  - [x] `console.error('[RadiProtocol] canvas-ref-sync:'`
  - [x] `startsWith(key + '/')` prefix-match logic
  - [x] нет `throw` внутри `rewriteCanvasRefs`
  - [x] нет импорта `../snippets/snippet-model`
- Runtime coverage запланирован в Plan 04 (unit-тесты на applyMapping + e2e на fake vault).

## Deviations from Plan

None — план выполнен ровно как написано. Pre-existing vitest errors в type-check output не относятся к этому плану и не были тронуты (scope boundary).

## Commits

- `937c695` — feat(32-02): add canvas-ref-sync module for vault-wide SnippetNode path rewrites

## Self-Check: PASSED

- FOUND: src/snippets/canvas-ref-sync.ts
- FOUND: commit 937c695
