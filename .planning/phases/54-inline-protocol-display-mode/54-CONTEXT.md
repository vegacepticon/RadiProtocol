# Phase 54 — Inline Protocol Display Mode — CONTEXT

**Goal (from ROADMAP)**: Third Runner display mode — **inline** — floating non-blocking modal over the active note; each answer selection appends directly to end of that note. Launched only via command palette entry `Run protocol in inline`.

**Prior art loaded**:
- `.planning/notes/inline-protocol-mode.md` — 4 locked decisions from `/gsd-explore` (2026-04-20)
- `src/main.ts:197-248` — `activateRunnerView()` (sidebar/tab wiring, reused concept)
- `src/settings.ts:16` — `runnerViewMode: 'sidebar' | 'tab'` (inline is NOT added here — launch is command-only)
- `src/views/runner-view.ts` — existing Runner host

## Locked from `/gsd-explore` (do NOT reopen)

1. **Append destination** = end of the source note. Always. No cursor, no marker, no per-node override.
2. **Protocol bound to source note** for the run's lifetime. Output never redirects to another note.
3. **Launch = command palette only.** New command `Run protocol in inline`. No per-canvas setting, no global default, no canvas-selector entry point.
4. **No textarea in inline mode.** Note IS the buffer. Immediate append per selection. Undo = Obsidian native.

## Decisions from discuss-phase

### D1 — Note-switch behavior (SC #4 resolved)
**Freeze + resume.** When user switches to a different note, modal hides; when user returns to the source note, modal reappears at the same node. Run progress is preserved.
- **Why:** Matches user's mental model ("I'll come back to this"); avoids losing in-flight state on accidental tab clicks.
- **How to apply:** Planner specs a hide/show mechanism keyed on active-file change. No state reset on hide. No timer / expiry.

### D2 — Source-note tab closed mid-run
**End protocol.** Closing the tab = explicit intent to leave. Modal closes, run is marked ended, no auto-reopen.
- **Why:** Closing a tab is a stronger signal than switching. Auto-reopening fights the user.
- **How to apply:** Listen for `file-open` / leaf close; if source file has no open leaves, terminate the run cleanly.

### D3 — Cancel / abort semantics
**Leave partial output as-is.** When user closes the modal mid-run, already-appended text stays in the note. Cleanup path = native Obsidian Ctrl+Z. No "undo everything" escape hatch, no confirmation dialog.
- **Why:** Simplest model. Each append is already a discrete edit in Obsidian's history; undo already works.
- **How to apply:** Close button → just dispose modal. No rollback tracking, no confirm dialog.

### D4 — Modal chrome: position & size
**Fixed corner, fixed size.** Bottom-right corner, fixed dimensions. No drag, no resize.
- **Why:** v1 simplicity; no drag/resize JS, no position persistence, no CSS grab handles. Users can always request this later.
- **How to apply:** Pure CSS `position: fixed; bottom / right`. No state for position. Design assumes standard Obsidian viewport.

### D5 — On-note running indicator
**None.** Indication lives entirely inside the modal. No status-bar icon, no tab-title marker, no frontmatter stamp.
- **Why:** The modal itself is the indicator. Touching the note for state = risk of leaving orphan markers if the run crashes.
- **How to apply:** No writes to frontmatter / workspace.tabs / status bar for "running" state.

### D6 — Nested UI (snippet fill-in, loop iteration)
**Host inside the inline modal.** Snippet fill-in modal (Phase 27) and loop iteration UI render in-place within the floating inline modal, not as a stacked Obsidian `Modal` on top.
- **Why:** Fixed-corner placement means a stacked centered Modal would feel disconnected. Keeps focus anchored.
- **How to apply:** Runner's existing snippet/loop hosts must be rendered into the inline-modal DOM subtree, not `document.body`. Planner should verify both features render correctly inside a constrained container.

### D7 — Append formatting
**Exactly like sidebar/tab.** Inline writes the same string to the note end that sidebar/tab would have placed into the textarea — same per-node formatting rules, same loop-iteration handling. No extra visual separators.
- **Why:** 1:1 parity with existing Runner. Zero risk of inline-only formatting divergence.
- **How to apply:** Reuse existing text-assembly logic; change only the sink (note end instead of textarea).

### D8 — Canvas picker when `Protocol` folder missing / empty
**Notice + abort.** Show Notice `No protocol canvases found in 'Protocol' folder.` and do nothing. No fallback to vault-wide, no auto-create folder.
- **Why:** Explicit scope. User controls their structure.
- **How to apply:** Planner enumerates `.canvas` under `Protocol/`; empty list → Notice + early return.

### D9 — Command guard when no active markdown note
**Notice + abort.** Command runs but shows `Open a markdown note first, then run this command.` Does not hide via `checkCallback`, does not create an untitled note.
- **Why:** Predictable palette (command is always visible); explicit feedback beats silent unavailability.
- **How to apply:** On invoke, check `workspace.getActiveFile()` is a markdown file; otherwise Notice + return.

## Implementation hints (for researcher/planner)

- Inline is **not** a value of `runnerViewMode` setting — do NOT add `'inline'` to the settings union. Settings continue to control only sidebar vs tab for the existing flows.
- Reuse `RunnerView` rendering logic if possible, but the **host** differs: inline uses a floating `HTMLElement` appended to `document.body` (or workspace container), not an `ItemView` leaf.
- Source-note binding: track `TFile` reference at launch; subscribe to `workspace.on('active-leaf-change')` for freeze/resume; subscribe to file-close for D2 termination.
- Append sink: reuse existing answer-assembly, replace textarea write with `vault.process(file, content => content + newText)` (or equivalent append API).
- Test parity (for planner's UAT): every existing Runner behavior (snippet nodes, loops, skip, close) must work identically inside the inline modal.

## Deferred ideas (NOT this phase)

- Per-canvas `preferredDisplayMode` attribute.
- Global setting for default display mode.
- Inline launched from canvas selector UI.
- Draggable / resizable modal chrome.
- Position persistence.
- Insertion at cursor / at marker / into a different note.
- Mid-run target-note switching.
- "Undo everything from this run" escape hatch.
- On-note running indicator (status bar / frontmatter / tab dot).

## Next step

Run `/gsd-plan-phase 54` to produce PLAN.md.
