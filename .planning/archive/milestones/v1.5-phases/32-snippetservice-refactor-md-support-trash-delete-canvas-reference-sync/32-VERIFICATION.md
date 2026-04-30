---
phase: 32-snippetservice-refactor-md-support-trash-delete-canvas-reference-sync
verified: 2026-04-15T11:45:00Z
status: gaps_found
score: 4/5 must-haves verified
overrides_applied: 0
gaps:
  - truth: "npm run build exits 0 (TypeScript + esbuild production build)"
    status: failed
    reason: "Новые тесты, добавленные в Plan 32-04 (snippet-service.test.ts, canvas-ref-sync.test.ts), нарушают strict-опции tsconfig — `noUncheckedIndexedAccess` и `strictNullChecks`. Tsconfig включает `src/**/*.ts`, поэтому `tsc -noEmit` проверяет тесты наравне с прод-кодом. 17 TS2345/TS2532/TS2488 ошибок валят билд."
    artifacts:
      - path: "src/__tests__/canvas-ref-sync.test.ts"
        issue: "Строки 82, 101, 117, 173, 174, 194, 203 — разыменование возможно-undefined результатов `.find()` и `.mock.calls[0]`"
      - path: "src/__tests__/snippet-service.test.ts"
        issue: "Строки 229, 249, 292, 384, 455-458, 479 — то же самое; строка 517 — destructuring `vault.trash.mock.calls[0]` без non-null assert"
    missing:
      - "Non-null assertions (`!`) или явные guards на результаты `.find()`, `snippets[0]`, `vault.trash.mock.calls[0]` во всех 17 местах"
      - "Повторный запуск `npm run build` до exit 0 перед закрытием фазы"
---

# Phase 32: SnippetService Refactor — MD Support, Trash Delete, Canvas Reference Sync — Verification Report

**Phase Goal:** SnippetService exposes folder-tree data model, recognises `.md` snippets as first-class, deletes via `vault.trash()`, and ships vault-wide utility that rewrites Canvas `SnippetNode` references when a snippet folder is renamed/moved.
**Verified:** 2026-04-15
**Status:** gaps_found (4/5)
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (Success Criteria)

| #   | Truth                                                                       | Status     | Evidence |
| --- | --------------------------------------------------------------------------- | ---------- | -------- |
| SC-1 | `listFolder` возвращает discriminated Snippet entries (JSON + MD)          | VERIFIED | `snippet-service.ts:95-126` — union ветка `.json`/`.md`, корректный `kind`, `path`, `content` для MD; тесты `listFolder extension routing` в `snippet-service.test.ts` проходят (58/58) |
| SC-2 | `load` возвращает JsonSnippet или MdSnippet по расширению                  | VERIFIED | `snippet-service.ts:137-162` — extension routing через `.endsWith('.json')` / `.endsWith('.md')`; тесты `load(path) routing` покрывают оба + missing + corrupt + unsafe |
| SC-3 | Delete использует `vault.trash(file, false)`                                | VERIFIED | `snippet-service.ts:213` — `await this.app.vault.trash(file, false)`; `grep 'vault\.delete('` пуст; тест `delete(path)` ассертит `system === false` |
| SC-4 | `canvas-ref-sync` переписывает `SnippetNode.subfolderPath` (exact + `/`-prefix + best-effort) | VERIFIED | `canvas-ref-sync.ts:39-107` + `applyMapping():114-132` — exact + longest-prefix с границей `/`; try/catch на read/parse/write → `skipped`; no-op если `!mutated`; WriteMutex на canvas-modify. Тесты покрывают exact, prefix, WR-02 пустой subfolder, multi-canvas, broken JSON, empty mapping, non-.canvas filter |
| SC-5 | Unit тесты на extension routing, trash delete, canvas rewrite               | FAILED — см. гэп ниже | Тесты **написаны и проходят** (58/58 при прямом запуске `vitest run`), но **нарушают strict TypeScript** и валят `npm run build` |

**Score:** 4/5 truths verified.

### Required Artifacts

| Artifact                                  | Expected                                   | Status    | Details |
| ----------------------------------------- | ------------------------------------------ | --------- | ------- |
| `src/snippets/snippet-model.ts`           | `Snippet = JsonSnippet \| MdSnippet` union | VERIFIED  | Строки 26-60: union с `kind: 'json' \| 'md'`, оба варианта имеют `path` + `name` |
| `src/snippets/snippet-service.ts`         | `listFolder/load/save/delete/exists/assertInsideRoot/vault.trash/WriteMutex`, без `vault.delete(` | VERIFIED  | Все 7 методов/вызовов найдены; `vault.delete(` отсутствует |
| `src/snippets/canvas-ref-sync.ts`         | `export` `rewriteCanvasRefs`               | VERIFIED  | Строка 39 |
| `src/__tests__/canvas-ref-sync.test.ts`   | Существует                                 | VERIFIED  | 245 строк, 10 тестов |
| `src/__tests__/fixtures/snippet-node-multi-a.canvas`     | Exists | VERIFIED | |
| `src/__tests__/fixtures/snippet-node-multi-b.canvas`     | Exists | VERIFIED | |
| `src/__tests__/fixtures/snippet-node-broken.canvas`      | Exists | VERIFIED | |

### Key Link Verification

| From | To | Via | Status |
| ---- | -- | --- | ------ |
| `snippet-service.ts` | `Snippet` union | `import type { Snippet, JsonSnippet }` | WIRED |
| `snippet-service.ts` | `WriteMutex` | constructed в instance, используется в save/delete | WIRED |
| `canvas-ref-sync.ts` | `WriteMutex` | module-level `canvasMutex`, `runExclusive(file.path, ...)` | WIRED |
| `canvas-ref-sync.ts` | Canvas write-back | `app.vault.modify(file, next)` | WIRED |

### Behavioural Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Phase 32 tests pass | `npx vitest run src/__tests__/snippet-service.test.ts src/__tests__/canvas-ref-sync.test.ts` | 58/58 passed in 271ms | PASS |
| `vault.delete(` отсутствует в snippet-service | grep | 0 совпадений | PASS |
| Production build green | `npm run build` (= `tsc -noEmit -skipLibCheck && esbuild`) | 17 TS ошибок в новых тестах, tsc fails перед esbuild | **FAIL** |

### Anti-Patterns / Compliance

- CLAUDE.md append-only compliance: spot-check — не найдено признаков удаления чужого кода в `snippet-service.ts` / `snippet-model.ts` / canvas-ref-sync.ts.
- Pre-existing `runner-extensions.test.ts` RED-state failures документированы в `deferred-items.md` — из scope Phase 32 исключены, не считаются регрессией фазы.

### Gaps Summary

**1 реальный гэп: билд падает из-за strict-ошибок в новых тестах.**

Phase 32-04 написал 58 правильных по логике тестов, но не прогонял `npm run build` — только `npm test`. `tsconfig.json:15` имеет `noUncheckedIndexedAccess: true` и `strictNullChecks: true`, а `include: ["src/**/*.ts"]` захватывает тесты → `tsc -noEmit` в build-пайплайне видит 17 нарушений:

- Разыменования `parsed.nodes.find(...)!` без non-null assert (7 мест в обоих файлах)
- Destructuring `const [file, system] = vault.trash.mock.calls[0]` — массив `mock.calls[0]` имеет тип `T | undefined`
- Прямой индекс `snippets[0].kind` без проверки длины
- `JSON.parse(files[p])` — `files[p]` возможно `undefined`

**Интент корректный, реализация корректная, фаза-функционально всё работает — но build gate ломается, что заблокирует любую последующую фазу через `/gsd-next`.**

**Как закрыть:**
1. Пройтись по 17 позициям из списка artifacts выше и добавить `!` / явные проверки
2. Прогнать `npm run build` → ожидать exit 0
3. Перезапустить `/gsd-verify-work`

Альтернатива: исключить `src/__tests__/**` из `tsconfig.json` `include` (отдельный tsconfig для тестов). Это архитектурное решение, которое должен принимать не верификатор, а планировщик следующего фикса — поэтому текущая рекомендация минимально-инвазивная.

---

*Verified: 2026-04-15T11:45:00Z*
*Verifier: Claude (gsd-verifier)*
