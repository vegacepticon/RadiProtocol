---
template_version: 1
date: 2026-10-15T17:45:20+0300
author: Hermes
branch: main
repository: RadiProtocol
topic: Runner conclusion draft
status: ready
verdict: pass-with-runtime-limits
---

# Runner conclusion draft — implementation and validation

## Approved behavior

- Shared UI in floating and sidebar Runner, below answer choices.
- Plain Enter turns pending nonblank lines into editable, deletable, reorderable items; drag handle and keyboard-accessible move buttons.
- Entire draft, including pending input, inserts as newline-separated plain text at the retained cursor of the bound note. No heading, bullets, unrelated-note fallback or selected-text replacement.
- Draft survives Back/Redo and answer rerenders, remains visible after insertion, and repeated successful insertion inserts the entire current draft again.
- Session-only memory: no workspace/settings/protocol/server persistence; teardown discards it.
- Enabled by default, optional setting affects newly launched sessions.
- Uninserted text prevents automatic completion/self-check close. Runner close/Escape asks before discarding. Native tab X and middle-click are intercepted before detach, scoped to the corresponding sidebar tab.

## Safety and failure behavior

- Target requires an open editing-mode view for the bound file, not the currently active unrelated note. Rename uses the same bound TFile.
- Insertion and immediate Markdown-view save use the existing per-note lock. Awaiting `save()` prevents a subsequent vault append from reading pre-insertion disk contents while Obsidian's normal autosave is still debounced.
- Failed save retains its exact editor snapshot, blocks dependent protocol operations and retries saving without duplicate insertion when that snapshot is unchanged.
- Pending operations and confirmation callbacks are lifecycle-guarded; disposal removes resize/workspace/tab listeners and dismisses confirmation.
- Floating runner with uninserted text is not silently disposed/left hidden when its note leaf closes.
- No protocol graph/schema, Library, backend or patient-data changes.

## Verification actually executed

- `npm run check:release && git diff --check` — exit 0: build/TypeScript, ESLint, Stylelint, 97 Vitest files / 1347 tests, planning freshness, consistency, agent-docs, CSS audit and en/ru i18n audit.
- Knip remains advisory: existing exports/types outside the new feature are listed. CSS audit reports only existing `rp-snippet-tree-spacer` and `rp-option-order-chip-host` findings, no new draft-class drift.
- Real Chromium browser (Browser Use session, synthetic standalone component + Obsidian DOM-helper shim): Enter-to-items, DataTransfer drag reorder, pending-input inclusion, acknowledged snapshot retention, width-change reflow, long-draft scroll/answer access, capture-phase X/middle close guard, clean-close pass-through and destroy all passed.
- Browser measurement after narrowing 420→260 px: textarea border-box 220→875 px, clientHeight=scrollHeight=873 px. A real border-box clipping defect found during smoke was fixed; regression unit test covers border accounting and resize observer teardown.
- Synthetic cursor/insertion tests cover mid-note insertion, multiline/repeat insertion, bound-editor identity, read mode, rename, Back/Redo, self-check, cancellation, missing editor, queued edits, stale disposal, editor-save ordering and failed-save retry.

## Remaining limitations / manual acceptance

- Native tab close guard depends on undocumented Obsidian DOM. Static installed Obsidian 1.12.7 bundle inspection confirms `onClose()` cannot veto detach. Command/menu/programmatic closes, plugin unload and application exit intentionally remain unguarded. Drafts do not survive restart.
- Chromium component smoke is not an actual Obsidian runtime test. Manual verification in both Runner shells, actual note cursor/save/undo behavior and native tab X in the user's Obsidian remains outstanding.
- Source/build version remains 3.6.12 until release authorization. No version tag or release has been created for this feature.
- Existing release workflow publishes and then retains three latest releases/tags. Releasing the next patch with the current remote list would delete release and tag 3.6.10. Explicit scoped retention authorization is still absent; publication is blocked, not silently bypassed.
