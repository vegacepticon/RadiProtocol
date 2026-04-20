---
phase: 51-snippet-picker-overhaul
plan: 01
subsystem: graph
tags: [picker-01, back-compat, snippet-binding, validator, tdd]
requires:
  - SnippetNode (Phase 29+31 existing interface)
  - LOOP-04 D-04..D-08 error-emission style (Phase 50.1 baseline)
  - .planning/notes/snippet-node-binding-and-picker.md (canonical design note)
provides:
  - SnippetNode.radiprotocol_snippetPath?: string (D-01)
  - canvas-parser reads radiprotocol_snippetPath with WR-02 normalisation (D-01/D-02/D-03)
  - GraphValidator D-04 missing-file check (locked Russian error copy)
  - GraphValidatorOptions interface (optional snippetFileProbe + snippetFolderPath)
  - main.ts + runner-view.ts production sites wired to vault.getAbstractFileByPath probe
affects:
  - any future plan consuming node.radiprotocol_snippetPath (Plans 03, 05, 06)
  - Runner error-panel rendering inherits new Russian D-04 text at canvas-open
  - legacy directory-bound canvases: unchanged shape, unchanged behaviour (Pitfall #11)
tech-stack:
  added: []
  patterns:
    - "Optional options-bag constructor (zero-arg back-compat preserved for tests)"
    - "WR-02 string-null-empty normalisation extended to new field"
    - "LOOP-04 Russian error style applied to D-04 (Snippet-узел '…' ссылается на несуществующий файл …)"
key-files:
  created: []
  modified:
    - src/graph/graph-model.ts
    - src/graph/canvas-parser.ts
    - src/graph/graph-validator.ts
    - src/main.ts
    - src/views/runner-view.ts
    - src/__tests__/canvas-parser.test.ts
    - src/__tests__/graph-validator.test.ts
decisions:
  - D-01 file-binding field added below Phase 31 snippetSeparator (append-only; snippetPath mutually exclusive with subfolderPath only on write)
  - D-02 normalisation: empty string / JSON null / non-string → undefined (mirrors existing WR-02 pattern)
  - D-03 extension preserved verbatim in stored path (no extension-stripping anywhere in parser)
  - D-04 locked Russian error text verbatim: "Snippet-узел \"{label}\" ссылается на несуществующий файл \"{relativePath}\" — файл не найден в {snippetFolderPath}. Проверьте путь или восстановите файл."
  - Zero-arg GraphValidator() retained for pure-test sites; D-04 check silently skipped when probe or root is undefined
  - Production probe injected at two call-sites: main.ts start-from-node validation + runner-view.ts openCanvas validation
metrics:
  duration: ~35m
  completed_date: 2026-04-20
---

# Phase 51 Plan 01: SnippetNode file-binding — model + parser + validator Summary

Extend SnippetNode with an optional `radiprotocol_snippetPath` field (D-01), wire the canvas parser to read it with WR-02 normalisation (D-02/D-03), and add a hard D-04 validator check with a vault-backed snippet-file probe that surfaces a Russian error in the existing RunnerView error panel when the bound file is missing.

## Exact field signature added to SnippetNode

Appended below the existing `radiprotocol_snippetSeparator?` field at `src/graph/graph-model.ts`:

```typescript
/** Phase 51 D-01: optional binding to a SPECIFIC snippet file (mutually exclusive with subfolderPath on write).
 *  Path is relative to settings.snippetFolderPath, extension kept (D-02, D-03).
 *  Absence (undefined) = directory binding via subfolderPath (legacy shape, Pitfall #11 back-compat).
 *  See `.planning/notes/snippet-node-binding-and-picker.md` (Shared Pattern H). */
radiprotocol_snippetPath?: string;
```

All existing SnippetNode fields (`subfolderPath`, `snippetLabel`, `radiprotocol_snippetSeparator`) preserved byte-identical (append-only per CLAUDE.md Shared Pattern G).

## Canvas-parser changes

In `src/graph/canvas-parser.ts`, the `case 'snippet':` arm (lines ~251-280 pre-edit) now reads the new property with WR-02 normalisation. Added:

1. New `const rawSnippetPath = props['radiprotocol_snippetPath'];` near existing raw-prop reads, with a Phase 51 D-01/D-02/D-03 comment citing the design note.
2. New field in the SnippetNode literal below the existing `radiprotocol_snippetSeparator` assignment:
   ```typescript
   radiprotocol_snippetPath: (typeof rawSnippetPath === 'string' && rawSnippetPath !== '')
     ? rawSnippetPath
     : undefined,
   ```

Existing reads (`rawPath`, `rawLabel`, `rawSep`) and their normalisations are byte-identical.

## GraphValidator constructor signature change + production wire-up

### New exported interface (`src/graph/graph-validator.ts`)

```typescript
export interface GraphValidatorOptions {
  snippetFileProbe?: (absPath: string) => boolean;
  snippetFolderPath?: string;
}
```

### Constructor

```typescript
export class GraphValidator {
  private readonly snippetFileProbe?: (absPath: string) => boolean;
  private readonly snippetFolderPath?: string;
  constructor(options?: GraphValidatorOptions) {
    this.snippetFileProbe = options?.snippetFileProbe;
    this.snippetFolderPath = options?.snippetFolderPath;
  }
  // ... existing validate() body appended-only ...
}
```

Zero-arg `new GraphValidator()` still compiles — all test sites (~25 calls across `graph-validator.test.ts` + `runner-commands.test.ts`) remain unchanged.

### D-04 check location

Appended at the end of `validate()`, AFTER the LOOP-04 block (Phase 50.1 EDGE-03) and BEFORE the `// Check 6 ...` comment. Skipped silently when either probe or snippetFolderPath is undefined (legacy zero-arg construction in pure tests). Directory-bound snippets never invoke the probe (the check continues when `relPath === undefined`).

### Production wire-up locations

1. **`src/main.ts` line ~354** (`start-from-node` command validation):
   ```typescript
   const validator = new GraphValidator({
     snippetFileProbe: (absPath) => this.app.vault.getAbstractFileByPath(absPath) !== null,
     snippetFolderPath: this.settings.snippetFolderPath,
   });
   ```

2. **`src/views/runner-view.ts`** — class field `private readonly validator = new GraphValidator();` converted to declared-only field, assigned in constructor after `this.plugin` is set:
   ```typescript
   this.validator = new GraphValidator({
     snippetFileProbe: (absPath) => this.plugin.app.vault.getAbstractFileByPath(absPath) !== null,
     snippetFolderPath: this.plugin.settings.snippetFolderPath,
   });
   ```

Both sites use the same probe shape. Pure-test instantiations (`new GraphValidator()` at ~25 call-sites in `src/__tests__/`) are unaffected.

## Test count delta

Pre-Phase-51 baseline (per STATE.md Plan 50-05): 484 passed / 1 skipped.

Phase 51 Plan 01 additions (executed in THIS plan):
- `canvas-parser.test.ts`: +8 tests in new `describe('Phase 51 — radiprotocol_snippetPath parsing (PICKER-01)', ...)` block (17 pre-existing → 25 total)
- `graph-validator.test.ts`: +7 tests in new `describe('Phase 51 — D-04 snippet missing-file check (PICKER-01)', ...)` block (24 pre-existing → 31 total)

**Plan 01 total delta: +15 new tests.**

Full-suite status (excluding out-of-scope `src/__tests__/views/snippet-tree-picker.test.ts` which is Plan 51-02's RED file running in a parallel worktree):

- 35 test files / 521 passed / 1 skipped / 0 failed
- `npx tsc --noEmit --skipLibCheck` exits 0 (all non-`snippet-tree-picker.test.ts` files compile)

No pre-existing tests modified or deleted semantically — Shared Pattern G (append-only) honoured in both test files and all three source files.

## Counted-grep verification (from PLAN verification block)

| Grep | Expected | Actual |
|------|----------|--------|
| `radiprotocol_snippetPath` in `src/graph/` (all three files) | ≥ 3 | 6 (1 + 2 + 3) |
| `Phase 51` in `src/graph/` (all three files) | ≥ 3 | 7 (1 + 1 + 5) |
| `case 'snippet':` in `canvas-parser.ts` | 1 | 1 (no duplication) |
| `GraphValidatorOptions` in `graph-validator.ts` | present | 2 (interface decl + constructor param type) |
| `snippetFileProbe` in `main.ts` + `runner-view.ts` | present in both | 1 + 1 |
| `snippet-node-binding-and-picker.md` citations in all three graph files | present in all | present in all |

## Commits (atomic per TDD gate)

| Hash | Type | Scope |
|------|------|-------|
| `4e9697f` | test | RED — 8 failing canvas-parser tests for radiprotocol_snippetPath |
| `401df12` | feat | GREEN — SnippetNode field + parser arm (Task 1) |
| `5d6b438` | test | RED — 7 failing graph-validator tests (tsc-level: constructor accepts 0 args) |
| `32b4de0` | feat | GREEN — GraphValidatorOptions + D-04 check + production wire-up (Task 2) |

## Deviations from Plan

### Rule 1 — Bug fix (test assertion authored against non-existent label)

**Found during:** Task 2 GREEN verification

**Issue:** Plan `<behavior>` Test 2 required the error to "contain `\"n-snippet-1\"` (the nodeId)", but the plan's locked template for the D-04 error text uses `this.nodeLabel(node)` — and `nodeLabel()` for a plain snippet without `subfolderPath` returns the literal string `'snippet (root)'`, never the nodeId. The two specs conflict; the locked template is authoritative per plan Step 1. Test 2 and Test 7 initially asserted `toContain('n-snippet-1')` / `toContain('n-snippet-2')` which failed at runtime.

**Fix:** Relaxed the two tests to assert only on the relative path (which the error DOES echo verbatim per D-02 stored shape) plus `snippetFolderPath` and the Russian marker `не найден`. Added a comment in Test 2 documenting the `nodeLabel()` → `'snippet (root)'` behaviour and explaining that `snippetLabel` seeding is illustrative. Test 7 now asserts the missing-path is present and the present-path is absent — discrimination is by path, not by node identity. This matches the locked D-04 template and preserves the spirit of the plan's acceptance criteria.

**Files modified:** `src/__tests__/graph-validator.test.ts` (test assertions only; no production code adjusted).

**Commit:** `32b4de0` (test assertions merged with the GREEN implementation commit).

### Out-of-scope (NOT deviations)

- `src/__tests__/views/snippet-tree-picker.test.ts` — 13 test failures + ~15 tsc errors. This file was authored by Plan 51-02 in a parallel worktree (commit `f2413db` landed on branch `main` between my Task 1 and Task 2). It is a RED-phase test file for the next plan and not in Plan 01 scope. Per deviation-rules `SCOPE BOUNDARY`: not fixed, not logged, not my concern.

## Legacy SnippetNode shape: byte-identical parsing confirmed

Test 6 (`back-compat: snippet node with neither radiprotocol_snippetPath nor radiprotocol_subfolderPath yields both undefined (Pitfall #11)`) and Test 7 (`back-compat: legacy directory-bound snippet (only radiprotocol_subfolderPath) is byte-identical to pre-Phase-51 behaviour`) in `canvas-parser.test.ts` prove:

- A canvas with neither new-nor-legacy property parses to SnippetNode with `subfolderPath === undefined` AND `radiprotocol_snippetPath === undefined`.
- A canvas with only the legacy `radiprotocol_subfolderPath: 'abdomen'` parses to `subfolderPath === 'abdomen'` AND `radiprotocol_snippetPath === undefined`.

Both cases produce outputs identical to pre-Phase-51 parser behaviour. Pitfall #11 (back-compat of stored canvas shape) satisfied natively — no migration code introduced or scheduled.

## Auth gates

None encountered.

## Self-Check

### Files claimed created or modified

- `src/graph/graph-model.ts`: FOUND
- `src/graph/canvas-parser.ts`: FOUND
- `src/graph/graph-validator.ts`: FOUND
- `src/main.ts`: FOUND
- `src/views/runner-view.ts`: FOUND
- `src/__tests__/canvas-parser.test.ts`: FOUND
- `src/__tests__/graph-validator.test.ts`: FOUND

### Commits claimed

- `4e9697f`: FOUND
- `401df12`: FOUND
- `5d6b438`: FOUND
- `32b4de0`: FOUND

## Self-Check: PASSED
