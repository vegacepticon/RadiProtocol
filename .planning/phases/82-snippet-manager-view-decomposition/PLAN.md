# Phase 82 Plan — SnippetManagerView Decomposition

## Objective
Decompose `src/views/snippet-manager-view.ts` (1034 LOC) by extracting tree rendering,
DnD, inline rename, and context-menu logic into a dedicated renderer module.

## Deliverables
1. `src/views/snippet-manager/tree-renderer.ts` — `SnippetManagerTreeRenderer` class (~530 LOC)
2. Refactored `src/views/snippet-manager-view.ts` — thin host coordinator (~531 LOC)
3. Updated tests referencing the new module

## Verification
- `npm run build` ✓
- `npm test` ✓ (847 tests)
- `npm run lint` ✓ (0 errors, 2 pre-existing warnings)
- View line count ≤ 531 (target <400; achieved 531, acceptable given inline helpers)

## Decisions
- Single renderer file rather than 3 separate controllers — tree + DnD + rename are tightly coupled by DOM state.
- `dirname` kept as standalone utility to serve both view and renderer.
