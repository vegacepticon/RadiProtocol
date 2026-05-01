# Phase 77-09 Summary — test residual fixes

## Changes applied

- `src/__tests__/views/inline-runner-modal.test.ts`
  - Replaced `const self = this` wrapper-object capture with `instances.push(this as unknown as (typeof instances)[number])`.
  - Added `__resolve(v): void { this.resolveFn(v); }` as an instance method.
  - Replaced `// @ts-ignore` with `// @ts-expect-error: mock factory export is only provided by the vi.mock replacement, not the real module type`.
- `src/__tests__/views/inline-runner-modal-loop-body-file-bound.test.ts`
  - Replaced `const self = this` wrapper-object capture with direct instance push.
  - Added `__resolve` as an instance method.
- `src/__tests__/views/inline-runner-modal-output-toolbar.test.ts`
  - Replaced `const self = this` wrapper-object capture with direct instance push.
  - Added `__resolve` as an instance method.
- `src/__tests__/views/snippet-editor-modal-banner.test.ts`
  - Changed `modal.onOpen();` to `void modal.onOpen();` for intentional fire-and-forget async setup.
- `src/__tests__/views/snippet-tree-picker.test.ts`
  - Updated all four sentence-case lock-step sites:
    - fixture write: `'pre-existing'` → `'Pre-existing'`
    - matching assertion: `'pre-existing'` → `'Pre-existing'`
    - fixture write: `'stale'` → `'Stale'`
    - matching assertion: `'stale'` → `'Stale'`
- `src/__tests__/runner/protocol-runner-snippet-autoinsert.test.ts`
  - Changed unreassigned `let s0` to `const s0`.
- `src/__tests__/snippet-tree-dnd.test.ts`
  - Renamed write-only `lastMenuItems` to `_lastMenuItems` at declaration and all assignment sites.

## Consumer-read-property audit for inline-runner modal mocks

All three mock `SnippetFillInModal` classes now push the modal instance directly. The consumer-visible shape maps as follows:

- `snippet`: `readonly snippet` class field set in the constructor.
- `result`: `result: Promise<string | null>` class field set in the constructor.
- `__resolve`: added instance method delegating to `this.resolveFn(v)`.
- `open`: existing class method setting `this.opened = true`.
- `close`: existing class method setting `this.closed = true`.
- `opened`: existing class field; direct reads on the pushed instance observe `open()` mutations.

Per-file audit notes:

- `inline-runner-modal.test.ts`: outer tests read `snippet`, call `__resolve(...)`, and read `opened`; all are now present on the modal instance.
- `inline-runner-modal-loop-body-file-bound.test.ts`: no outer reads of `__fillModalInstances[...]` beyond capture export in this file; full declared shape is still present on the instance.
- `inline-runner-modal-output-toolbar.test.ts`: no outer reads of `__fillModalInstances[...]` beyond capture export in this file; full declared shape is still present on the instance.

## Verification

- Baseline before 77-09: `npx eslint . --format json` reported 56 errors.
- After 77-09: `npx eslint . --format json` reported 47 errors.
- Lint count drop: 9 errors total.
- Focused test command passed:
  - `npm test -- src/__tests__/views/inline-runner-modal.test.ts src/__tests__/views/inline-runner-modal-loop-body-file-bound.test.ts src/__tests__/views/inline-runner-modal-output-toolbar.test.ts src/__tests__/views/snippet-editor-modal-banner.test.ts src/__tests__/views/snippet-tree-picker.test.ts src/__tests__/runner/protocol-runner-snippet-autoinsert.test.ts src/__tests__/snippet-tree-dnd.test.ts`
  - Result: 7 test files passed, 92 tests passed.

## Notes

Focused ESLint on the changed files still reports three pre-existing `@typescript-eslint/no-unused-vars` errors outside this plan's scoped residual list:

- `src/__tests__/views/inline-runner-modal-output-toolbar.test.ts`: unused `beforeEach`, `findByClass`.
- `src/__tests__/views/snippet-tree-picker.test.ts`: unused `SnippetTreePickerMode`.

These were not modified because 77-09's scope was limited to the explicit residual fixes listed in the plan.
