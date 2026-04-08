---
phase: 10-insert-into-current-note
plan: "01"
subsystem: runner-ui
tags: [output, insert, vault-write, workspace-event]
dependency_graph:
  requires: []
  provides: [insertIntoCurrentNote, insert-into-note-button]
  affects: [src/main.ts, src/views/runner-view.ts]
tech_stack:
  added: []
  patterns: [WriteMutex-per-file-path, registerEvent-workspace, getActiveViewOfType]
key_files:
  modified:
    - src/main.ts
    - src/views/runner-view.ts
decisions:
  - insertMutex added as a separate WriteMutex instance on RadiProtocolPlugin (not reusing snippetService mutex) to keep file-path keying isolated
  - insertBtn created before early-return guard so DOM element always exists for the active-leaf-change listener
  - Notice fires outside the mutex runExclusive block so it appears only after write completes
metrics:
  duration: ~10 minutes
  completed: "2026-04-08"
  tasks_completed: 2
  files_modified: 2
---

# Phase 10 Plan 01: Insert Into Current Note Summary

One-liner: "Insert into note" button added to runner complete-state, appending protocol text to the active markdown file via `WriteMutex`-guarded `vault.read()` + `vault.modify()`, with dynamic enable/disable via `active-leaf-change` workspace event.

## What Was Built

- `insertIntoCurrentNote(text: string): Promise<void>` method on `RadiProtocolPlugin` in `src/main.ts`
- "Insert into note" button (`rp-insert-btn`) in `RunnerView.renderOutputToolbar()` in `src/views/runner-view.ts`
- `active-leaf-change` workspace event listener to keep button disabled state in sync with the active leaf

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add insertIntoCurrentNote() to RadiProtocolPlugin | bcdc08d | src/main.ts |
| 2 | Add Insert into note button and active-leaf-change listener | 1e99f2c | src/views/runner-view.ts |

## Implementation Details

### main.ts changes
- Added `MarkdownView` to existing obsidian import line
- Added `import { WriteMutex } from './utils/write-mutex'`
- Added `private readonly insertMutex = new WriteMutex()` class field
- Added `insertIntoCurrentNote(text)` method: reads active markdown file, appends with `\n\n---\n\n` separator (or no separator if file is empty), writes via `insertMutex.runExclusive()`, fires Notice after write

### runner-view.ts changes
- Added `MarkdownView` to existing obsidian import line
- Added `private insertBtn: HTMLButtonElement | null = null` class field
- Rewrote `renderOutputToolbar()`: creates `rp-insert-btn` button before early-return guard, sets initial disabled state via `getActiveViewOfType(MarkdownView)`, registers `active-leaf-change` listener (only in enabled path), click handler calls `this.plugin.insertIntoCurrentNote(finalText)`

## Verification

- `npm run build` passes with zero errors (uses `tsc -noEmit -skipLibCheck`)
- String checks: all 7 required strings present in `main.ts`, all 8 required strings present in `runner-view.ts`
- No `innerHTML`, `require('fs')`, or `console.log` introduced

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — button is fully wired to `insertIntoCurrentNote()` which performs the real vault write.

## Threat Flags

No new security surface beyond what the plan's threat model documents (T-10-01 through T-10-04).

## Self-Check: PASSED

- src/main.ts: exists and contains all required symbols
- src/views/runner-view.ts: exists and contains all required symbols
- Commits bcdc08d and 1e99f2c: present in git log
