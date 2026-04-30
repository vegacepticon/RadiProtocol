---
phase: 32-snippetservice-refactor-md-support-trash-delete-canvas-reference-sync
plan: "00"
subsystem: snippets
tags: [types, refactor, discriminated-union, md-support]
requires: []
provides:
  - "Snippet discriminated union (JsonSnippet | MdSnippet)"
  - "JsonSnippet / MdSnippet interfaces"
  - "SnippetFile = JsonSnippet legacy alias"
affects:
  - src/snippets/snippet-service.ts
  - src/views/runner-view.ts
  - src/views/snippet-manager-view.ts
  - src/__tests__/snippet-model.test.ts
tech_stack:
  added: []
  patterns:
    - "Discriminated union on `kind` (matches RPNode pattern)"
key_files:
  created: []
  modified:
    - src/snippets/snippet-model.ts
    - src/snippets/snippet-service.ts
    - src/views/runner-view.ts
    - src/views/snippet-manager-view.ts
    - src/__tests__/snippet-model.test.ts
decisions:
  - "Kept SnippetFile as type alias for JsonSnippet (D-01 Claude's Discretion) — minimizes callsite churn"
  - "Kept legacy `id?: string` on JsonSnippet as non-readonly to preserve snippet-manager-view write path until Phase 33 replaces the view"
  - "Made `kind` / `path` required on JsonSnippet (true discriminated union); existing callsites updated minimally to construct literals correctly"
metrics:
  duration: "~10 min"
  tasks: 1
  completed: 2026-04-15
requirements: [MD-05]
---

# Phase 32 Plan 00: SnippetService Refactor — Discriminated Union Types

Introduce `Snippet = JsonSnippet | MdSnippet` discriminated union in the pure `snippet-model.ts` engine module, establishing the typed foundation for `.md` snippet routing throughout Phase 32.

## Deliverables

- `src/snippets/snippet-model.ts`:
  - New `JsonSnippet` interface with `kind: 'json'`, `path`, `name`, `template`, `placeholders`, deprecated `id?`
  - New `MdSnippet` interface with `kind: 'md'`, `path`, `name`, `content`
  - `export type Snippet = JsonSnippet | MdSnippet`
  - `export type SnippetFile = JsonSnippet` (backwards-compat alias)
  - `renderSnippet` signature now `(snippet: JsonSnippet, values) => string` — body unchanged
  - `slugifyLabel` untouched
  - Zero Obsidian imports preserved (NFR-01)

## Acceptance Verification

| Criterion | Result |
|-----------|--------|
| Contains `export type Snippet = JsonSnippet \| MdSnippet` | PASS (line 60) |
| Contains `export interface JsonSnippet` | PASS (line 26) |
| Contains `export interface MdSnippet` | PASS (line 45) |
| Contains `kind: 'json'` | PASS (line 27) |
| Contains `kind: 'md'` | PASS (line 46) |
| Contains `export type SnippetFile = JsonSnippet` | PASS (line 68) |
| `renderSnippet` parameter typed as `JsonSnippet` | PASS (line 82) |
| No `from 'obsidian'` import | PASS |
| `npm run build` exits 0 | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Minimal callsite updates to restore green build**

- **Found during:** Task 1, after initial `snippet-model.ts` rewrite
- **Issue:** Making `kind` and `path` required fields on `JsonSnippet` (as the plan's acceptance criteria mandate — true discriminated union) broke existing callsites that still construct `SnippetFile` literals and read `.id` as a `string` source of truth. Build failed with 8 TypeScript errors across `snippet-model.test.ts`, `snippet-service.ts`, `runner-view.ts`, `snippet-manager-view.ts`. The plan's acceptance criterion "`npm run build` exits 0" conflicted with its stated scope boundary of "types only".
- **Fix:** Applied the smallest possible non-functional edits to unblock the build:
  - `snippet-model.test.ts`: added `kind: 'json'` and `path: '.radiprotocol/snippets/<slug>.json'` to two literal fixtures.
  - `snippet-service.ts#save`: `clean.id` → `clean.id ?? clean.name` (tolerates deprecated optional id).
  - `runner-view.ts#handleSnippetPickerSelection`: `snippet.id` → `snippet.id ?? snippet.name`.
  - `snippet-manager-view.ts#handleNewSnippet`: added `kind: 'json'` and `path` fields to draft literal.
  - `snippet-manager-view.ts`: remaining `draft.id` reads → `(draft.id ?? draft.name)`. `draft.id = slugifyLabel(...)` write path preserved by making `JsonSnippet.id` non-readonly (documented in-file that this is a temporary concession until Phase 33 replaces the view).
- **Rationale:** No runtime behavior changes — each read/write path still operates on the same `id` string it did before. Rule 3 applies: these were the minimum edits needed to restore `npm run build` exit 0, which is a mandatory acceptance criterion of this plan.
- **Files modified:** `src/snippets/snippet-service.ts`, `src/views/runner-view.ts`, `src/views/snippet-manager-view.ts`, `src/__tests__/snippet-model.test.ts`
- **Commit:** `ab9f7ec`

### Claude's Discretion resolved

- **`SnippetFile` alias:** retained as `type SnippetFile = JsonSnippet` (plan option A).
- **Deprecated `id`:** kept on `JsonSnippet` as `id?: string` (not `readonly`) to preserve the legacy snippet-manager-view write path without functional refactor in this plan. Will be tightened in Phase 33 when that view is replaced.

## Known Stubs

None. This is a pure type-level refactor with no UI data-source wiring.

## Threat Flags

None. Pure engine module; no new trust boundaries introduced.

## Self-Check: PASSED

- FOUND: `src/snippets/snippet-model.ts` (modified, contains all required exports)
- FOUND: commit `ab9f7ec`
- FOUND: `npm run build` exit 0 (verified in execution log)
