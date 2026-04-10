---
phase: 03-runner-ui-itemview
plan: "02"
subsystem: runner-engine + runner-view
tags: [runner, output, clipboard, vault, inline-edit, tdd]
dependency_graph:
  requires: ["03-01"]
  provides: ["setAccumulatedText", "handleCopy", "handleSave", "startNodeId-override"]
  affects: ["src/runner/protocol-runner.ts", "src/views/runner-view.ts"]
tech_stack:
  added: []
  patterns:
    - "navigator.clipboard.writeText for copy-to-clipboard"
    - "vault.createFolder + vault.create for save-to-note"
    - "window.setTimeout (one-shot) for button label revert"
    - "optional chaining runner?.setAccumulatedText for safe input wiring"
key_files:
  created: []
  modified:
    - src/runner/protocol-runner.ts
    - src/views/runner-view.ts
decisions:
  - "setAccumulatedText is a no-op when status is idle or error — only active states (at-node, awaiting-snippet-fill, complete) allow text replacement"
  - "Button disabled state uses trim().length > 0 (plan spec) not raw length — avoids enabling buttons on whitespace-only text"
  - "mod-cta class added to both copyBtn and saveBtn per UI-SPEC (accent for primary CTAs)"
metrics:
  duration_minutes: 12
  completed_date: "2026-04-06"
  tasks_completed: 2
  files_modified: 2
---

# Phase 3 Plan 02: ProtocolRunner Extensions + Output Handler Wiring Summary

**One-liner:** ProtocolRunner extended with `setAccumulatedText()` + optional `startNodeId` on `start()`; RunnerView copy/save buttons fully wired with clipboard API, vault.create, and 1500ms feedback.

## What Was Built

### Task 1 — ProtocolRunner engine extensions (TDD)

Modified `src/runner/protocol-runner.ts`:

- **`start(graph, startNodeId?)`** — changed signature to accept an optional second argument. When provided, uses it as the entry point instead of `graph.startNodeId` (D-07). Minimal change: one line replaced in method body.
- **`setAccumulatedText(text)`** — new public method. Replaces the accumulator with a fresh `TextAccumulator` loaded with `text`, then clears `this.undoStack = []` (D-04, D-05). No-op when status is `idle` or `error` — guards against spurious calls during session setup or error states.

All 3 runner-extensions tests went GREEN. All 18 pre-existing protocol-runner tests still pass.

### Task 2 — RunnerView output handler wiring

Modified `src/views/runner-view.ts`:

- **`handleCopy(): Promise<void>`** — calls `navigator.clipboard.writeText(textarea.value)`, sets button label to "Copied!" for 1500ms via `window.setTimeout`, then reverts. (UI-05)
- **`handleSave(): Promise<void>`** — builds a timestamped filename `YYYY-MM-DDTHH-MM-SS-protocol.md`, checks/creates the output folder via `vault.getAbstractFileByPath` + `vault.createFolder`, then calls `vault.create`. Success shows `new Notice(path)`, failure shows error Notice and logs `console.error`. (UI-06, T-03-02-02)
- **Input handler** — replaced the optional-chain stub with direct `this.runner?.setAccumulatedText(this.previewTextarea.value)` call. (RUN-11)
- **Button wiring** — replaced `void 0` stubs with `registerDomEvent` handlers calling `handleCopy`/`handleSave`. (UI-09)
- **Button visibility** — `render()` now reads `outputDestination` on every call and sets `display` conditionally: `new-note` hides copyBtn, `clipboard` hides saveBtn, `both` shows both. (Pitfall 5)
- **Button disabled state** — `hasText = trim().length > 0` guard in `render()`.
- **`mod-cta` class** — added to both output buttons per UI-SPEC accent color rule.
- **`Notice` import** — added to the obsidian import line.

## Verification Results

| Check | Result |
|-------|--------|
| runner-extensions tests (3) | GREEN |
| protocol-runner tests (18) | GREEN (no regressions) |
| Full test suite | 51 passed / 1 pre-existing RED stub (node-picker-modal, Plan 03) |
| `tsc --noEmit --skipLibCheck` | 2 pre-existing errors (Wave 0 RED stubs) — no new errors introduced |
| No `innerHTML`/`outerHTML`/`addEventListener` | PASS |
| `setAccumulatedText` in both files | 2 matches |
| `handleCopy`/`handleSave` defined | 2 definitions + 2 call sites |
| `navigator.clipboard.writeText` | Exactly 1 match |
| `vault.create` + `vault.createFolder` | 2+ matches |
| `outputDestination` in render() | 1 match |
| `window.setTimeout` | Exactly 1 match |

## Deviations from Plan

### Auto-fixed Issues

None. Plan executed exactly as written, with one minor note:

**Input handler simplification:** Plan 01's stub used a double optional-chain cast to avoid TS errors before `setAccumulatedText` existed. Task 2 replaced it with the clean direct call `this.runner?.setAccumulatedText(...)` now that the method is public on `ProtocolRunner`. This is the intended final form, not a deviation.

## Known Stubs

None in the files modified by this plan. The `node-picker-modal` RED stub in `runner-commands.test.ts` is a Wave 0 pre-existing stub targeting Plan 03, not introduced here.

## Threat Flags

No new security surface introduced beyond what the plan's threat model covers:
- T-03-02-01: vault path from user settings (not canvas data) — no traversal risk
- T-03-02-02: vault.create wrapped in try/catch with Notice + console.error
- T-03-02-03: clipboard write is user-intentional — accepted
- T-03-02-04: undo stack cleared on manual edit — by design (D-05)

## Self-Check: PASSED

| Item | Status |
|------|--------|
| `src/runner/protocol-runner.ts` | FOUND |
| `src/views/runner-view.ts` | FOUND |
| `03-02-SUMMARY.md` | FOUND |
| Commit `4504046` (Task 1) | FOUND |
| Commit `50138e8` (Task 2) | FOUND |
