---
phase: 46-free-text-input-removal
reviewed: 2026-04-18T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - src/__tests__/free-text-input-migration.test.ts
  - src/__tests__/node-picker-modal.test.ts
  - src/__tests__/runner/protocol-runner.test.ts
  - src/canvas/node-color-map.ts
  - src/graph/canvas-parser.ts
  - src/graph/graph-model.ts
  - src/graph/graph-validator.ts
  - src/runner/protocol-runner.ts
  - src/runner/runner-state.ts
  - src/styles/runner-view.css
  - src/views/editor-panel-view.ts
  - src/views/node-picker-modal.ts
  - src/views/runner-view.ts
findings:
  critical: 0
  warning: 0
  info: 2
  total: 2
status: issues_found
---

# Phase 46: Code Review Report

**Reviewed:** 2026-04-18
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found (2 info-level only — phase is functionally clean)

## Summary

Phase 46 excises the `free-text-input` node kind introduced in v1.2 and restores
the v1.0 decision to keep the node-kind vocabulary small. The removal is
consistent and the rejection branch is correctly localised.

All phase invariants hold:

- `RPNodeKind` union (graph-model.ts:9-17) no longer lists `free-text-input`.
- `NODE_COLOR_MAP` (node-color-map.ts:12-21) is `Record<RPNodeKind, string>`
  with exactly 8 entries, so the TS compiler enforces exhaustiveness — any
  future `free-text-input` regression would fail the build.
- `CanvasParser.parseNode` (canvas-parser.ts:150-283) inner switch covers all 8
  remaining kinds; the rejection branch at 168-170 fires BEFORE the
  `validKinds.includes` fallback, so authors get the phase-specific Russian
  error rather than a generic "unknown radiprotocol_nodeType".
- `ProtocolRunner.advanceThrough` (protocol-runner.ts:527-634) default-never
  exhaustiveness check passes because the `RPNode` union is narrower.
- `EditorPanelView.buildKindForm` (editor-panel-view.ts:396-614) switch is
  exhaustive and offers no `free-text-input` option.
- `RunnerView` render (runner-view.ts:344-412) at-node arm contains no
  `free-text-input` case.
- `buildNodeOptions` (node-picker-modal.ts:56-91) and `KIND_LABELS` are
  exhaustive over `NodeOption['kind']` — no legacy leak.

Grep audit confirms the only remaining `free-text-input` / `FreeTextInputNode`
/ `enterFreeText` / `rp-free-text-input` mentions in `src/` are the three
whitelisted sites:

1. `src/graph/canvas-parser.ts` — the rejection branch and its comment.
2. `src/__tests__/free-text-input-migration.test.ts` — the RED-gate migration test.
3. `src/__tests__/fixtures/free-text.canvas` — the fixture fed to that test.
4. `src/views/editor-panel-view.ts:346` — a single comment inside the dropdown
   declaring the excision (no identifier leak).

The CSS rule `.rp-free-text-input` is absent from `src/styles/runner-view.css`;
grep returns 0 occurrences of `rp-free-text-input` in that file. (Generated
`styles.css` / `src/styles.css` are out of review scope per phase context.)

### Russian rejection error (parser)

The parse-time error at canvas-parser.ts:169 reads:

```
Узел "${raw.id}" использует устаревший тип "free-text-input". Этот тип
был удалён. Замените узел на question или text-block и перестройте ветвь
вручную.
```

All three acceptance tokens verified:

- `устаревший` (D-46-01-B) — present.
- `free-text-input` (literal) — present.
- `${raw.id}` — present (tested against `n-ft1` and `ft-x`).

The migration test (free-text-input-migration.test.ts) covers the two
required positive scenarios plus a negative control, matching D-46-01-A2
and D-46-01-B.

## Info

### IN-01: Dead `|| id` branch in snippet label fallback

**File:** `src/views/node-picker-modal.ts:71`
**Issue:** The label fallback chain `s.subfolderPath || '(корень snippets)' || id`
contains an unreachable `|| id` branch: the middle operand is the literal
`'(корень snippets)'` which is always truthy, so `|| id` can never execute.
The inline comment at line 70 already acknowledges this ("defense-in-depth,
не должен срабатывать"), but leaving the dead operand in a source file flagged
for exhaustive cleanup (CLEAN-04 was scope-adjacent) is confusing. Note: this
expression predates Phase 46 (it was introduced in Phase 45 LOOP-06) — Phase 46
did not change this file, so this is a pre-existing code-smell surfaced by the
review scope rather than a regression.
**Fix:**
```ts
// Drop the unreachable `|| id` operand and adjust the comment:
options.push({
  id,
  label: s.subfolderPath || '(корень snippets)',
  kind: 'snippet',
});
// If defence-in-depth is genuinely desired, prefer an explicit guard:
// const label = s.subfolderPath && s.subfolderPath.length > 0
//   ? s.subfolderPath
//   : '(корень snippets)';
```

### IN-02: Legacy `validKinds` array duplicates the RPNodeKind union

**File:** `src/graph/canvas-parser.ts:159-163`
**Issue:** `validKinds: RPNodeKind[]` is hand-maintained and lists 8 strings.
It must stay in sync with the `RPNodeKind` union in graph-model.ts. If a future
phase adds or removes a kind, the whitelist can silently drift (no TS error:
`RPNodeKind[]` accepts any subset). Phase 46 already demonstrated the risk —
`free-text-input` was removed from the union and a dedicated rejection branch
was added separately at 168-170, but if the author had forgotten to update
`validKinds` and the union simultaneously, the literal-branch check would
still short-circuit correctly. Later additions may not be so lucky.
**Fix:** Derive the whitelist from a single source of truth so new kinds are
opt-in by type, not by duplication:
```ts
// Option A — export a const tuple from graph-model.ts and use it for both
// the union type and the whitelist:
//
// graph-model.ts:
//   export const RP_NODE_KINDS = [
//     'start', 'question', 'answer', 'text-block',
//     'loop-start', 'loop-end', 'snippet', 'loop',
//   ] as const;
//   export type RPNodeKind = typeof RP_NODE_KINDS[number];
//
// canvas-parser.ts:
//   import { RP_NODE_KINDS } from './graph-model';
//   if (!(RP_NODE_KINDS as readonly string[]).includes(kind)) { ... }
```
This is a refactor suggestion, not a correctness issue — current code is safe.

---

_Reviewed: 2026-04-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
