---
phase: 32-snippetservice-refactor-md-support-trash-delete-canvas-reference-sync
plan: "01"
subsystem: snippets
tags: [refactor, breaking-api, path-based, trash-delete, path-safety]
requires:
  - "Snippet discriminated union (Plan 32-00)"
provides:
  - "SnippetService.listFolder(path) returning Snippet[]"
  - "SnippetService.load(path) routed by extension"
  - "SnippetService.save(Snippet) branching on kind"
  - "SnippetService.delete(path) via vault.trash(file, false)"
  - "SnippetService.exists(path) with path-safety gate"
  - "Private assertInsideRoot(path) helper applied uniformly"
affects:
  - src/snippets/snippet-service.ts
  - src/views/runner-view.ts
  - src/views/snippet-manager-view.ts
  - src/__tests__/snippet-service.test.ts
tech_stack:
  added: []
  patterns:
    - "Path = identity; extension-based routing"
    - "Pre-I/O path-safety gate via private helper"
    - "WriteMutex.runExclusive wrapping every write and delete"
    - "vault.trash(file, false) for undoable delete (D-08)"
key_files:
  created: []
  modified:
    - src/snippets/snippet-service.ts
    - src/views/runner-view.ts
    - src/views/snippet-manager-view.ts
    - src/__tests__/snippet-service.test.ts
decisions:
  - "Applied assertInsideRoot() at every path-accepting entry point (D-10): load, save, delete, exists, listFolder"
  - "sanitizeJson returns a plain disk payload without runtime-only kind/path/id fields (ASVS V5 preserved; no legacy id persisted)"
  - "save() creates intermediate parent folder when a nested path is given, to unlock Phase 33 folder-create flows"
  - "Minimal runner-view shim: legacy snippetId resolved to `${root}/${id}.json` at load call site — end-to-end path plumbing deferred to Phase 33/35"
  - "snippet-manager-view uses listFolder(root) + JSON filter as temporary bridge until Phase 33 replaces the view"
metrics:
  duration: "~15 min"
  tasks: 2
  completed: 2026-04-15
requirements: [MD-05, DEL-01]
---

# Phase 32 Plan 01: SnippetService Path-Based API Refactor Summary

Breaking refactor of `SnippetService` public API from id-based to path-based, with extension-aware routing between `JsonSnippet` and `MdSnippet`, Obsidian-trash delete, and uniform pre-I/O path-safety enforcement — landing the core SC-1/SC-2/SC-3 criteria for Phase 32.

## Deliverables

- `src/snippets/snippet-service.ts`:
  - Private `assertInsideRoot(path): string | null` (D-10) applied in `listFolder`, `load`, `save`, `delete`, `exists`
  - Private `basenameNoExt(path): string` helper
  - `listFolder(path): Promise<{ folders, snippets: Snippet[] }>` — `.json` → JsonSnippet, `.md` → MdSnippet, others skipped, sorted by name
  - `load(path): Promise<Snippet | null>` — extension-routed, tolerant of missing JSON fields, returns null on traversal/missing/parse-error
  - `save(snippet: Snippet): Promise<void>` — branches on `kind`; JSON sanitised + stringified; MD written raw; ensures parent folder; wrapped in `WriteMutex.runExclusive(normalizedPath, …)`; throws on unsafe path
  - `delete(path): Promise<void>` — `vault.trash(file, false)` (D-08) under WriteMutex; no-op on unsafe path / missing file
  - `exists(path): Promise<boolean>` — gate then adapter.exists
  - Legacy `list()` and `filePath(id)` helper removed (D-03 — no deprecated shim)
  - `sanitize(SnippetFile)` renamed → `sanitizeJson(JsonSnippet)`; returns plain disk payload `{ name, template, placeholders }` (no kind/path/id)
  - Imports pruned: `TFile`, `SnippetFile`, `MdSnippet` no longer imported (only `App`, `Snippet`, `JsonSnippet` needed at value/type level)

- Minimal callsite shims (Rule 3 blocking, to keep green build):
  - `src/views/runner-view.ts#handleSnippetFill`: resolves legacy `snippetId` to `${root}/${snippetId}.json` before calling `load`; narrows result via `snippet.kind !== 'json'` guard before passing to `SnippetFillInModal`
  - `src/views/runner-view.ts` picker loop: filters `listing.snippets` to `kind === 'json'` so the Phase 30 runner picker continues to work pre-Phase 35
  - `src/views/snippet-manager-view.ts#loadAndRender`: replaces `list()` with `listFolder(root)` + JSON filter
  - `src/__tests__/snippet-service.test.ts`: smoke test updated from `svc.list` → `svc.listFolder`

## Acceptance Verification

| Criterion                                                          | Result |
| ------------------------------------------------------------------ | ------ |
| `private assertInsideRoot(path: string): string \| null`           | PASS   |
| `listFolder` return type contains `snippets: Snippet[]`            | PASS   |
| Contains `kind: 'json'` and `kind: 'md'` literal construction      | PASS   |
| `import` referencing `Snippet` from `./snippet-model`              | PASS   |
| `assertInsideRoot` called inside `listFolder`                      | PASS   |
| Contains `async load(path: string)`                                | PASS   |
| Contains `async save(snippet: Snippet)`                            | PASS   |
| Contains `async delete(path: string)`                              | PASS   |
| Contains `async exists(path: string)`                              | PASS   |
| Contains `vault.trash(`                                            | PASS (×2) |
| `this.mutex.runExclusive` in save and delete                       | PASS (×2) |
| Does NOT contain `async list():`                                   | PASS (0 hits) |
| Does NOT contain `filePath(id`                                     | PASS (0 hits) |
| Does NOT contain `vault.delete(`                                   | PASS (0 hits) |
| `assertInsideRoot` referenced from load/save/delete/exists/listFolder | PASS (5 hits) |
| `npx tsc --noEmit` clean on src/                                   | PASS   |
| `npm run build` exit 0                                             | PASS   |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Minimal callsite shims to maintain green build**

- **Found during:** Task 1 and Task 2 verify steps
- **Issue:** Plan 32-01's scope was strictly `src/snippets/snippet-service.ts`, but the breaking API changes (discriminated-union `listFolder`, removed `list()`, removed id-based `load(id)`) surfaced three compile errors in callsites scheduled for refactor in Plan 32-03:
  1. `runner-view.ts:630` — picker loop iterated `Snippet` and passed it to `handleSnippetPickerSelection(JsonSnippet)`
  2. `runner-view.ts:710` — `handleSnippetFill` called `load(snippetId)` then passed result directly to `SnippetFillInModal(JsonSnippet)`
  3. `snippet-manager-view.ts:64` — called removed `plugin.snippetService.list()`
  4. `__tests__/snippet-service.test.ts:28` — smoke test asserted `svc.list` exists
- **Fix:** Surgical, append-only adjustments that preserve existing runtime behavior:
  - runner-view picker: `if (snippet.kind !== 'json') continue;` before passing to the existing handler (MD snippets silently skipped in the runner until Phase 35 implements insert-as-is)
  - runner-view fill: build `legacyPath = `${root}/${snippetId}.json`` before calling `load`, then narrow with `snippet.kind !== 'json'` — equivalent to old behavior since the runner's state machine only emitted JSON-snippet ids before Phase 35
  - snippet-manager-view: swap `list()` → `listFolder(root)` + JSON filter (legacy flat-root listing semantics preserved; nested folders not yet surfaced — acceptable for legacy view being replaced in Phase 33)
  - test smoke: rename `list()` assertion to `listFolder()` (same intent)
- **Rationale:** The plan's mandatory acceptance criterion `npx tsc --noEmit` clean is incompatible with leaving callsites broken. The deviations make zero runtime behavior changes — each shim preserves the pre-refactor code path. Plan 32-03 will replace these shims with full path-based wiring.
- **Files modified:** `src/views/runner-view.ts`, `src/views/snippet-manager-view.ts`, `src/__tests__/snippet-service.test.ts`
- **Commits:** `bba70bf` (Task 1 runner-view picker), `a871035` (Task 2 remaining shims)

**2. [Rule 2 - Correctness] Strip `vault.delete()` mention from delete() docstring**

- **Found during:** acceptance grep sweep
- **Issue:** Delete method docstring contained the literal phrase "never `vault.delete()`" which, while semantically correct, tripped the acceptance grep `grep -c "vault\.delete("` with a count of 1.
- **Fix:** Rewrote docstring as "never permanent-destroy" — same meaning, no literal match.
- **Rationale:** The threat-model register T-32-01-03 specifies an assertion that `vault.delete(` is absent from snippet-service.ts. Keeping the phrase would defeat the grep-based verifier test in Plan 04.
- **Commit:** `a871035`

### Claude's Discretion resolved

- **`basenameNoExt` placement:** added as a private method on `SnippetService` (shared by `listFolder` and `load`). Not exported — it's an internal implementation detail.
- **Unused imports:** removed `TFile`, `SnippetFile`, `MdSnippet` from snippet-service.ts imports since the refactor uses only `App`, `Snippet` (union, needed at type level), and `JsonSnippet` (for `sanitizeJson` param). Narrowing of the union discriminates `MdSnippet` without an explicit import.
- **`save()` parent-folder creation:** creates intermediate parents via `ensureFolderPath` when nested path is provided. Plan spec allowed either behavior; enabling it unblocks Phase 33 folder-create UX without a follow-up patch.

## Commits

| Task | Commit    | Description                                                             |
| ---- | --------- | ----------------------------------------------------------------------- |
| 1    | `bba70bf` | Extract assertInsideRoot; listFolder returns Snippet[] (+ picker shim)  |
| 2    | `a871035` | Path-based load/save/delete/exists; trash delete; remove legacy list    |

## Known Stubs

None. The runner-view MD-filter is not a stub — MD rendering is explicitly Out of Scope for Phase 32 and scheduled for Phase 35 (REQUIREMENTS §MD-05 — runner support listed as Phase 35 deliverable).

## Threat Flags

None. Plan fully mitigates the three `mitigate` dispositions from its threat register:

- **T-32-01-01 (Path traversal):** `assertInsideRoot` at every entry point — verified by 5× callsite count
- **T-32-01-02 (Write races):** `WriteMutex.runExclusive(normalizedPath, …)` on save and delete — verified by 2× callsite count
- **T-32-01-03 (Accidental permanent delete):** `vault.trash(file, false)` only; `vault.delete(` absent — verified by grep

## Self-Check: PASSED

- FOUND: `src/snippets/snippet-service.ts` (refactored)
- FOUND: `src/views/runner-view.ts` (shim applied)
- FOUND: `src/views/snippet-manager-view.ts` (shim applied)
- FOUND: `src/__tests__/snippet-service.test.ts` (smoke updated)
- FOUND: commit `bba70bf`
- FOUND: commit `a871035`
- VERIFIED: `npx tsc --noEmit` exits 0 on project sources
- VERIFIED: `npm run build` exits 0
