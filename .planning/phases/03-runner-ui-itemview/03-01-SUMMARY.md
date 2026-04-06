---
phase: 03-runner-ui-itemview
plan: "01"
subsystem: views
tags: [itemview, dom, css, runner-ui, layout]
dependency_graph:
  requires:
    - src/runner/protocol-runner.ts
    - src/runner/runner-state.ts
    - src/graph/graph-model.ts
    - src/graph/canvas-parser.ts
    - src/graph/graph-validator.ts
    - src/main.ts
  provides:
    - src/views/runner-view.ts
    - src/styles.css
  affects:
    - src/main.ts (Plan 03 will wire registerView + commands)
tech_stack:
  added: []
  patterns:
    - Obsidian ItemView lifecycle (onOpen/onClose/getState/setState)
    - DOM construction via createEl/createDiv exclusively (no innerHTML)
    - Stable elements use registerDomEvent; ephemeral buttons use el.onclick
    - Render dispatcher switching on RunnerState discriminant union
    - Native <details>/<summary> for collapsible legend
key_files:
  created:
    - src/styles.css
  modified:
    - src/views/runner-view.ts
decisions:
  - "getState() interface extends Record<string,unknown> to satisfy Obsidian ItemView base type constraint"
  - "openCanvas() guards vault.getAbstractFileByPath() null return before TFile cast (T-03-01-03)"
  - "Copy/save button handlers are stub void 0 — Plan 02 wires clipboard and vault behavior"
  - "setAccumulatedText optional chain cast avoids compile error since method added in Plan 02"
metrics:
  duration_minutes: 25
  completed_date: "2026-04-06"
  tasks_completed: 2
  files_changed: 2
---

# Phase 03 Plan 01: RunnerView Two-Zone ItemView Skeleton Summary

**One-liner:** Full RunnerView ItemView replacing Phase 1 stub — two-zone flex layout (question zone + preview textarea) with collapsible legend, openCanvas(), render dispatcher, and all render helpers using Obsidian createEl DOM API exclusively.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | RunnerView full implementation | 913efca | src/views/runner-view.ts |
| 2 | CSS layout rules | 681e3ff | src/styles.css |

---

## What Was Built

### src/views/runner-view.ts (405 lines)

Full `RunnerView` class replacing the Phase 1 stub:

- **Lifecycle:** `onOpen()` calls `buildSkeleton()` then `renderIdle()`; `onClose()` empties contentEl
- **buildSkeleton():** Constructs the permanent DOM once — `rp-runner-view` root, `rp-question-zone`, zone divider, `rp-preview-zone` (with heading + textarea + output toolbar), and `<details class="rp-legend">` with 7 node-type rows
- **openCanvas(filePath):** Public entry point — null-guards `vault.getAbstractFileByPath()`, parses canvas JSON via `CanvasParser`, validates via `GraphValidator`, then starts `ProtocolRunner` and calls `render()`
- **render():** Dispatcher switching on `RunnerState.status` — updates textarea value, rebuilds question zone, controls button visibility per `plugin.settings.outputDestination` (read fresh each render per Pitfall 5)
- **renderIdle/renderAtNode/renderQuestionNode/renderFreeTextNode/renderComplete/renderError/renderValidationErrors:** All render helpers building DOM in question zone via createEl
- **getState/setState:** Workspace persistence storing `{ canvasFilePath }` only (D-09)

### src/styles.css (155 lines)

21 `rp-` CSS rules using Obsidian CSS custom properties exclusively:
- Two-zone flex layout: question zone (`flex: 0 0 auto`) + preview zone (`flex: 1 1 auto`)
- Legend, answer buttons, free-text input, step-back, validation panel, empty state, complete state

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed getState() TypeScript type compatibility**
- **Found during:** Task 1 verification
- **Issue:** `RunnerViewPersistedState` interface not assignable to `Record<string, unknown>` required by Obsidian `ItemView.getState()` base signature
- **Fix:** Extended interface with `Record<string, unknown>`: `interface RunnerViewPersistedState extends Record<string, unknown>`
- **Files modified:** src/views/runner-view.ts
- **Commit:** 913efca (applied in same commit, TSC was clean after fix)

---

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| Copy button handler: `void 0` | src/views/runner-view.ts | ~111 | Plan 02 wires clipboard behavior |
| Save button handler: `void 0` | src/views/runner-view.ts | ~112 | Plan 02 wires vault.create() behavior |
| `setAccumulatedText` optional-chain cast | src/views/runner-view.ts | ~91 | Method added to ProtocolRunner in Plan 02 |

These stubs do not prevent the plan's goal (structural DOM skeleton) from being achieved. Plan 02 wires all output behaviors.

---

## Threat Flags

No new threat surface beyond what is documented in the plan's threat model. The `openCanvas()` null-guard for `T-03-01-03` was implemented as specified.

---

## Verification Results

- `npx tsc --noEmit --skipLibCheck`: PASS (0 errors)
- `npx vitest run`: 38/38 tests pass (all Phase 2 engine tests still green)
- No `innerHTML`, `outerHTML`, `insertAdjacentHTML` in runner-view.ts: PASS
- No raw `addEventListener` in runner-view.ts: PASS
- `wc -l src/views/runner-view.ts`: 405 lines (>= 200 required)
- All 4 required rp- class names present in runner-view.ts: PASS
- All 7 acceptance criteria CSS classes present in styles.css: PASS
- No hardcoded hex values in styles.css: PASS
- `flex-direction: column` appears 3 times in styles.css (>= 2 required): PASS

---

## Self-Check: PASSED

- [x] src/views/runner-view.ts exists and has 405 lines
- [x] src/styles.css exists and has 155 lines
- [x] Commit 913efca exists (RunnerView implementation)
- [x] Commit 681e3ff exists (CSS rules)
- [x] TypeScript compiles cleanly
- [x] All 38 tests pass
