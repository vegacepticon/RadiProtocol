# Phase 67: Inline Runner Resizable Modal & File-Bound Snippet Parity — Context

**Gathered:** 2026-04-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 67 closes two v1.10 user-experience gaps:

1. **INLINE-FIX-06 — Resizable Inline Runner.** The `InlineRunnerModal` (`src/views/inline-runner-modal.ts`) becomes drag-resizable. Width and height persist alongside the Phase 60 position state in plugin `loadData/saveData` and survive tab switch + plugin reload. Dimensions are clamped to the current viewport on restore (mirroring Phase 60 D-02 clamp-on-restore).
2. **INLINE-FIX-07 — File-bound Snippet parity in ALL traversal paths.** A Snippet node carrying `radiprotocol_snippetPath` (file-bound) inserts the configured file when reached **regardless of how the runner arrived at it** — sibling-button click (Phase 56, already correct), loop-body branch traversal (currently broken), or any future direct-edge traversal. Bug root-cause is in `src/runner/protocol-runner.ts:736-741` — `advanceThrough()` case `'snippet'` unconditionally halts at `awaiting-snippet-pick` without consulting `radiprotocol_snippetPath`. This affects **both sidebar Runner and Inline Runner** (shared core).

**In scope:**
- `src/views/inline-runner-modal.ts` — add resize handlers, ResizeObserver-based save trigger, layout persistence wiring (FIX-06)
- `src/styles/inline-runner.css` — append-only Phase 67 rules: `resize: both`, min/max sizes, `.is-resizing` class (FIX-06)
- `src/settings.ts` — rename `InlineRunnerPosition` → `InlineRunnerLayout`, add optional `width`, `height` (FIX-06)
- `src/main.ts` — adapt `getInlineRunnerPosition()` / `saveInlineRunnerPosition()` accessors to the renamed type (FIX-06)
- `src/runner/protocol-runner.ts` — `advanceThrough()` case `'snippet'`: branch on `radiprotocol_snippetPath` (FIX-07)
- `src/graph/node-label.ts` — `snippet` arm parity with sibling-button caption grammar (FIX-07)
- Test files: ProtocolRunner unit, RunnerView regression, InlineRunnerModal regression, node-label tests, settings layout tests
- ROADMAP.md / STATE.md — note that FIX-07 root-cause was in runner-core (not inline-only); update §Phase 67 dependency line

**Out of scope:**
- Per-canvas remembered size — single global layout only
- Auto-fade on cursor proximity (deferred since v1.9 REQUIREMENTS.md)
- Settings UI control to reset layout (no Settings UI surface added)
- Resize handles on top/left/W/N/etc. — native CSS `resize: both` covers SE corner only
- Touching `chooseSnippetBranch` / `pickSnippet` / `pickFileBoundSnippet` (Phase 56 contract preserved)
- Migration logic for stored layout (back-compat is satisfied by optional fields + DEFAULT_WIDTH/HEIGHT fallback)
- Phase 54 D1–D9 invariants (only width/height/clamp shape touched; D6 already reversed in Phase 59)

</domain>

<decisions>
## Implementation Decisions

### Resize UX & CSS (INLINE-FIX-06)

- **D-01 — Native CSS `resize: both`.** `.rp-inline-runner-container` gets `resize: both` and the appropriate `overflow` (so the browser can paint the SE corner grip). `.rp-inline-runner-content` keeps its existing `overflow-y: auto`. Minimum JS — no custom edge zones, no pointer-listeners on N/E/S/W edges. The browser provides cursor states and grip rendering.
- **D-02 — `.is-resizing` class parallel to `.is-dragging`.** During an active resize, the container carries `.is-resizing` with `box-shadow: var(--shadow-xl)` — exact mirror of the Phase 60 `.is-dragging` rule (`src/styles/inline-runner.css:178-180`). Class is added on the first ResizeObserver tick after a stable size and cleared on debounce timeout (D-04). No is-resizing class state machine beyond on/off.
- **D-03 — Browser default `::-webkit-resizer` — no custom styling.** Obsidian runs Chromium; the default resizer matches `textarea` UX users already know. Zero CSS cost. Can be revisited if dark-theme contrast complaints arise.
- **D-04 — ResizeObserver + debounce 400 ms.** A single `ResizeObserver` (the modal already declares one as a class field at `inline-runner-modal.ts:81`) listens to the container; each tick resets a 400 ms debounce timer. Timer expiry = "resize ended" → save layout via `saveInlineRunnerLayout()` and remove `.is-resizing`. No `pointerdown`/`pointerup` listeners on the resizer itself (browser captures those for native resize).

### Persistence shape & save timing (INLINE-FIX-06)

- **D-05 — Type rename: `InlineRunnerPosition` → `InlineRunnerLayout` with `{left, top, width?, height?}`.** Semantics now match content. Touched files (verified via grep): `src/settings.ts`, `src/main.ts`, `src/views/inline-runner-modal.ts`, plus any test that imports the type — planner enumerates exhaustively in PLAN.md. Settings field name `inlineRunnerPosition` is **NOT** renamed — preserves on-disk back-compat with users who have an existing `data.json`.
- **D-06 — Optional `width`/`height` for migration-free back-compat.** Existing users have stored `{left, top}` only. New code reads both fields; when `width` or `height` is missing/non-finite, `applyPosition()` and `clampInlineRunnerLayout()` fall back to `INLINE_RUNNER_DEFAULT_WIDTH = 360` / `INLINE_RUNNER_DEFAULT_HEIGHT = 240` (constants already declared at `inline-runner-modal.ts:24-25`). No one-time migration step; no version bump in stored shape.
- **D-07 — Save only on resize-end (paritet with Phase 60 D-01).** Phase 60 saves position only on `pointerup` after drag (`inline-runner-modal.ts:672`). Phase 67 saves layout only on resize-end debounce timeout (D-04). Live ResizeObserver ticks DO NOT trigger `saveData` — they only manage the `.is-resizing` class and feed the debounce. Same persistence rhythm as drag.
- **D-08 — Single accessor, single field.** `plugin.saveInlineRunnerPosition` becomes `plugin.saveInlineRunnerLayout` (or stays as `saveInlineRunnerPosition` accepting the renamed type — planner picks the cleaner one; both names are acceptable since the settings field is unchanged). One accessor in `main.ts`, one settings field, one atomic save.

### Min/max & clamp (INLINE-FIX-06)

- **D-09 — `min-width: 240px`, `min-height: 120px`.** 240 px is wider than `INLINE_RUNNER_MIN_VISIBLE_WIDTH = 160` (used for position-clamp; do NOT change that constant — it gates position recovery). 240 px guarantees the Phase 65 footer Back/Skip row fits in a single row with visible labels. 120 px allows header (~32 px) + ≥1 row of branch buttons + footer; remaining content scrolls inside `.rp-inline-runner-content`. Both enforced in CSS via `min-width` / `min-height`.
- **D-10 — `max = viewport − 32px margin`.** CSS: `max-width: calc(100vw - 32px); max-height: calc(100vh - 32px);` (the `--size-4-8 = 32px` token already pervades inline-runner.css). JS clamp inside the new `clampInlineRunnerLayout()` mirrors the bounds: `width = min(saved.width, viewport.width - 32); height = min(saved.height, viewport.height - 32)`. Mirrors the Phase 60 D-02 clamp-on-restore pattern, extended to size.
- **D-11 — Re-clamp on window resize.** The existing `windowResizeHandler` (declared at `inline-runner-modal.ts:91`) already re-clamps position on viewport change; Phase 67 extends it to also re-clamp width/height (and re-apply via `applyPosition()` / a new `applyLayout()`). Live viewport shrink keeps the modal visible and resizable.

### File-bound Snippet parity in runner-core (INLINE-FIX-07)

- **D-12 — Root cause in `protocol-runner.ts:736-741`.** `advanceThrough()` case `'snippet'` unconditionally sets `runnerStatus = 'awaiting-snippet-pick'` regardless of whether the node is file-bound. This path is hit when the runner traverses to a snippet node via an edge (most commonly: loop-body branch terminating at a snippet). Phase 56 reversed the auto-insert decision **only** for the Question→Snippet sibling-button click path (RunnerView/InlineRunnerModal dispatch); the runner-core traversal arm was left untouched.
- **D-13 — Scope expansion: ROADMAP and STATE updated.** ROADMAP.md §Phase 67 originally said "Inline Runner-only work in `InlineRunnerModal` + `src/styles/inline-runner.css`; ... isolated from Node Editor and Runner UX phases". This is no longer accurate — fix is in shared `protocol-runner.ts` and `node-label.ts`. PLAN.md must explicitly document the deviation; ROADMAP.md and STATE.md are amended in the first plan of the phase.
- **D-14 — `protocol-runner.ts` case `'snippet'` branches on `radiprotocol_snippetPath`.** New code path:
  ```ts
  case 'snippet': {
    this.currentNodeId = cursor;
    if (typeof node.radiprotocol_snippetPath === 'string' && node.radiprotocol_snippetPath !== '') {
      // File-bound: bypass picker, direct dispatch (parity with Phase 56 D-03 pickFileBoundSnippet).
      this.snippetId = node.radiprotocol_snippetPath;
      this.snippetNodeId = cursor;
      this.runnerStatus = 'awaiting-snippet-fill';
    } else {
      // Directory-bound (or unbound): existing Phase 30 D-07 picker path.
      this.runnerStatus = 'awaiting-snippet-pick';
    }
    return;
  }
  ```
  No undo entry pushed in `advanceThrough` (Pitfall 1 rule — `advanceThrough` never pushes; the caller already pushed for the predecessor). Verified by reading `pickFileBoundSnippet` (Phase 56 D-03 implementation) — the undo there is for the **Question** node sibling-button entry, not the snippet node itself.
- **D-15 — `node-label.ts` snippet arm parity with sibling-button captions.** Replace `'snippet (root)'` fallback with the same caption grammar `inline-runner-modal.ts:350-364` and `runner-view.ts` use:
  ```ts
  case 'snippet': {
    const isFileBound = typeof node.radiprotocol_snippetPath === 'string' && node.radiprotocol_snippetPath !== '';
    if (isFileBound) {
      const path = node.radiprotocol_snippetPath as string;
      if (node.snippetLabel !== undefined && node.snippetLabel.length > 0) return `📄 ${node.snippetLabel}`;
      const lastSlash = path.lastIndexOf('/');
      const basename = lastSlash >= 0 ? path.slice(lastSlash + 1) : path;
      const dot = basename.lastIndexOf('.');
      const stem = dot > 0 ? basename.slice(0, dot) : basename;
      return stem.length > 0 ? `📄 ${stem}` : '📄 Snippet';
    }
    if (node.snippetLabel !== undefined && node.snippetLabel.length > 0) return `📁 ${node.snippetLabel}`;
    return node.subfolderPath ? `snippet (${node.subfolderPath})` : 'snippet (root)';
  }
  ```
  Existing test `node-label.test.ts:46-47` is updated: `subfolderPath` arm preserves `snippet (Findings/Chest)` / `snippet (root)` for directory-bound (back-compat with `graph-validator` error messages); file-bound case adds new assertions.
- **D-16 — `inline-runner-modal.ts` is NOT modified for FIX-07.** Existing handlers `inline-runner-modal.ts:343-380` (sibling-button isFileBound branch) and `inline-runner-modal.ts:1021-1118` (`handleSnippetFill`) are already correct (Phase 56 + Phase 59). The runner-core fix (D-14) automatically routes loop-body and direct-edge traversals into the same `awaiting-snippet-fill` state, which the existing `case 'awaiting-snippet-fill'` arm (`inline-runner-modal.ts:475-483`) handles via `handleSnippetFill`.
- **D-17 — `runner-view.ts` is NOT modified for FIX-07.** Symmetric reasoning: existing `runner-view.ts:543-552` and `runner-view.ts:938-1018` are already correct. Runner-core fix covers sidebar automatically.

### Test strategy

- **D-18 — Test layers:**
  1. **ProtocolRunner unit tests** (new or extend `src/__tests__/protocol-runner-*.test.ts`): `advanceThrough` reaching a file-bound snippet via loop-body edge → asserts `runnerStatus === 'awaiting-snippet-fill'`, `snippetId === node.radiprotocol_snippetPath`. Mirror test for directory-bound → `awaiting-snippet-pick`.
  2. **RunnerView regression** (extend `src/__tests__/views/runner-snippet-*.test.ts`): loop-body branch click → file-bound snippet → `.md` inserts immediately; `.json` w/ placeholders → `SnippetFillInModal`; `.json` w/o placeholders → inserts template. Sidebar-mode reproduction of the user's bug report.
  3. **InlineRunnerModal regression** (extend or new `src/__tests__/views/inline-runner-modal-*.test.ts`): same three scenarios as #2 but in inline mode. Inline-mode reproduction of user's bug report.
  4. **node-label.test.ts**: file-bound vs directory-bound snippet caption assertions added; legacy `snippet (root)` / `snippet (Findings/Chest)` arms remain green for directory-bound back-compat.
  5. **Settings layout tests** (new `src/__tests__/inline-runner-layout.test.ts` or extend existing): `clampInlineRunnerLayout` clamps width/height to viewport bounds; missing width/height falls back to defaults; window-resize re-clamp triggers `applyLayout`.
  6. **Resize-end debounce test**: simulated ResizeObserver tick burst → single `saveData` call after debounce; `.is-resizing` class lifecycle.

### Claude's Discretion

- Exact debounce constant (300 vs 400 vs 500 ms). Planner picks within 300–500 ms based on test timing realism.
- Whether `clampInlineRunnerPosition` is renamed to `clampInlineRunnerLayout` and accepts size, or whether a new `clampInlineRunnerLayout` wraps the old one. Either is acceptable — planner picks the lower-blast-radius option after reading the test files.
- Whether `applyPosition()` is renamed to `applyLayout()` or kept (with a new sibling). Same reasoning.
- Exact location of the new `case 'snippet'` branch in `advanceThrough` — the existing 4-line block at lines 736-741 is replaced; the new block is structurally identical to `pickFileBoundSnippet` minus the undo push.
- Exact wording of the deviation note in PLAN.md / commit messages explaining why `protocol-runner.ts` and `node-label.ts` are touched in a phase ROADMAP labeled "Inline-Runner-only".
- Whether existing `node-label.test.ts:47` `snippet (root)` assertion stays for legacy directory-bound or is removed (planner inspects callers — `graph-validator.ts` uses nodeLabel for error formatting; back-compat there is mandatory).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase precedents (locked invariants)
- `.planning/milestones/v1.9-phases/60-inline-runner-layout-position-persistence/60-CONTEXT.md` — Phase 60 D-01..D-04 (workspace-state persistence, clamp-on-restore, compact default, no-resize-in-v1.9). D-04 is now reversed by Phase 67.
- `.planning/milestones/v1.8-phases/56-snippet-button-ux-reversal/56-CONTEXT.md` — Phase 56 D-01..D-04 (file-bound = button + direct-insert). Sibling-button click path locked; runner-core traversal NOT covered by Phase 56 — that gap is Phase 67's INLINE-FIX-07.
- `.planning/milestones/v1.9-phases/59-inline-runner-feature-parity/59-CONTEXT.md` — Phase 59 D-01..D-04 (inline uses sidebar `SnippetFillInModal`, `isFillModalOpen` gate, accumulator-diff `appendDeltaFromAccumulator`). All preserved.
- `.planning/milestones/v1.8-phases/54-inline-protocol-display-mode/54-CONTEXT.md` — Phase 54 D1, D2, D3, D4, D5, D7, D8, D9 invariants preserved (D6 already reversed in Phase 59). Resize must not break D1 freeze/resume on `active-leaf-change`.

### Requirements & roadmap
- `.planning/REQUIREMENTS.md` — `INLINE-FIX-06` (resizable + persisted dimensions + clamp-on-restore), `INLINE-FIX-07` (file-bound Snippet honoured in all three runner modes). Out-of-Scope rows for resize handle / auto-fade / per-canvas remain in force.
- `.planning/ROADMAP.md` §Phase 67 — Goal + 5 Success Criteria. **Note:** the "Depends on: Nothing (Inline Runner-only work)" line is inaccurate after Phase 67 root-cause discovery — runner-core (`protocol-runner.ts`) and `node-label.ts` are touched. PLAN.md must explicitly document this and amend ROADMAP/STATE in its first plan.
- `.planning/STATE.md` — Standing Pitfalls #6 (`console.debug` only), #11 (back-compat of stored canvas + settings shape), #12 (Phase 67 resize must follow Phase 60 clamp-on-restore pattern, NOT clamp-on-save).

### Existing code touched
- `src/views/inline-runner-modal.ts:24-25` — `INLINE_RUNNER_DEFAULT_WIDTH=360 / DEFAULT_HEIGHT=240` constants; reused as fallback for missing layout fields.
- `src/views/inline-runner-modal.ts:35-51` — `clampInlineRunnerPosition` exported pure function; extended (or wrapped) to clamp size.
- `src/views/inline-runner-modal.ts:81` — `resizeObserver` field declaration (Phase 67 wires the listener and debounce).
- `src/views/inline-runner-modal.ts:91` — `windowResizeHandler` field; extended to re-clamp size.
- `src/views/inline-runner-modal.ts:178-180` — `.is-dragging` shadow rule; `.is-resizing` mirror added beneath.
- `src/views/inline-runner-modal.ts:613-672` — drag and `applyPosition` lifecycle; `applyLayout` (or extended `applyPosition`) added; resize lifecycle hooks attach here.
- `src/runner/protocol-runner.ts:736-741` — `advanceThrough` case `'snippet'`. **Replaced** with file-bound branch (D-14). This is an explicit phase mandate exception to CLAUDE.md "never remove existing code you didn't add" — the 4-line block is part of the bug, not unrelated existing code.
- `src/graph/node-label.ts:18-30` — `nodeLabel` snippet arm; extended for file-bound parity (D-15). Existing directory-bound arm preserved for `graph-validator` error formatting back-compat.
- `src/settings.ts:7-10` — `InlineRunnerPosition` interface; renamed to `InlineRunnerLayout`, fields `width?`/`height?` added.
- `src/settings.ts:28` — `inlineRunnerPosition` settings field; type updated; field name unchanged for back-compat.
- `src/main.ts:229-237` — `getInlineRunnerPosition` / `saveInlineRunnerPosition` accessors; type updated.

### Test files touched
- `src/__tests__/graph/node-label.test.ts:45-47` — extend with file-bound snippet captions.
- `src/__tests__/views/runner-snippet-*.test.ts` — add loop-body → file-bound regression.
- `src/__tests__/views/inline-runner-modal-*.test.ts` — add same regression for inline mode (creates new file if none covers loop-body in inline).
- `src/__tests__/views/runner-footer-layout.test.ts:375` — already mocks `getInlineRunnerPosition: vi.fn(() => null)`; review if mock signature needs update for layout shape.
- `src/__tests__/protocol-runner-*.test.ts` — add advanceThrough file-bound dispatch unit tests.
- New (suggested) `src/__tests__/inline-runner-layout.test.ts` — clamp size, fallback to defaults, window-resize re-clamp, debounce + `.is-resizing` lifecycle.

### Project guardrails
- `CLAUDE.md` — **CSS Architecture**: Phase 67 CSS goes ONLY in `src/styles/inline-runner.css`, append-only under `/* Phase 67: ... */` comment; `styles.css` regenerated by `npm run build`. **Never remove existing code you didn't add**: the `protocol-runner.ts:736-741` block IS removed — phase mandate exception, must be documented in commit message.
- `.planning/STATE.md` Standing Pitfall #6 — `console.debug` only.
- `.planning/STATE.md` Standing Pitfall #11 — back-compat of stored shape: existing `inlineRunnerPosition` records without width/height MUST keep working unchanged. Optional fields + DEFAULT_WIDTH/HEIGHT fallback (D-06) satisfies this natively.
- `.planning/STATE.md` Standing Pitfall #12 — clamp-on-restore (NOT clamp-on-save) for resize persistence; mirror Phase 60 pattern.

### User memory
- `memory/project_snippet_node_ux.md` — file-bound = button + direct insert; directory-bound = button → picker. Phase 67 D-14/D-15 extend this from sibling-button-only (Phase 56) to **all** runner traversal paths (loop-body, direct-edge, sibling-button).
- `memory/feedback_language.md` — discuss-phase ведётся на русском; CONTEXT.md остаётся на английском (downstream agents читают на английском).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`pickFileBoundSnippet`** (`protocol-runner.ts`, Phase 56 D-03) — canonical reference for file-bound dispatch. `advanceThrough` case `'snippet'` fix mirrors its body minus the undo push (advanceThrough never pushes — Pitfall 1).
- **`clampInlineRunnerPosition`** (`inline-runner-modal.ts:35-51`) — pure exported function; extend (or wrap) to also clamp width/height. Already unit-testable without instantiating the modal.
- **`getDefaultPosition`** / `applyPosition` (`inline-runner-modal.ts:604-622`) — lifecycle hooks for reading saved layout, computing default, applying to DOM. Extend to layout shape.
- **`ResizeObserver`** field (`inline-runner-modal.ts:81`) — already declared. Phase 67 wires the listener (currently unused).
- **`windowResizeHandler`** (`inline-runner-modal.ts:91`) — already wired for position re-clamp; extend to re-clamp size.
- **`.rp-inline-runner-container.is-dragging`** rule (`inline-runner-modal.css:178-180`) — template for `.is-resizing` rule (parallel structure).
- **`SnippetFillInModal`** (`src/views/snippet-fill-in-modal.ts`) — reused verbatim by both runners. The runner-core fix (D-14) routes loop-body → file-bound snippet → `awaiting-snippet-fill` → existing `handleSnippetFill` → `SnippetFillInModal`. Zero changes to fill-in modal.
- **Sibling-button caption grammar** (`inline-runner-modal.ts:350-364`, mirrored in `runner-view.ts`) — reused verbatim in `node-label.ts` snippet arm (D-15).

### Established Patterns
- **`advanceThrough` never pushes UndoEntry** (Pitfall 1) — undo is the caller's responsibility (e.g. `chooseLoopBranch` pushes before calling `advanceThrough`). Phase 67 D-14 conforms.
- **Append-only CSS per phase** (CLAUDE.md) — Phase 67 rules go at the bottom of `inline-runner.css` under `/* Phase 67: resizable inline runner */` comment.
- **Phase 60 persistence pattern** — pure-function clamp + `loadData/saveData` accessor on plugin + `applyPosition` from saved-or-default. Phase 67 mirrors this exactly for size.
- **Optional schema fields + default constants for back-compat** (Pitfall #11) — preferred over migration logic.
- **Obsidian theme variables** — `var(--shadow-xl)`, `var(--background-modifier-border)` etc. used throughout; Phase 67 uses these.

### Integration Points
- **`protocol-runner.ts:736-741`** — single 4-line block for D-14 file-bound dispatch (replace).
- **`node-label.ts:26`** — single line for D-15 snippet arm (replace, preserve directory-bound back-compat).
- **`inline-runner-modal.ts` constructor / lifecycle** — single class; resize listener attaches in `open()` (or wherever drag listener attaches), detaches in `close()`.
- **`inline-runner-modal.ts` `applyPosition`** — single site where saved layout (position+size) is read and applied on first paint.
- **`settings.ts` `InlineRunnerPosition` declaration** — single source of truth for the interface; rename here propagates.
- **`main.ts:229-237`** — single accessor pair; type-only change, no logic change.
- **`inline-runner.css` end-of-file** — single append point for Phase 67 rules under a phase comment.

</code_context>

<specifics>
## Specific Ideas

- The user's bug report (during this discuss session) is the canonical repro for FIX-07: "if a snippet node has a target file set in the node editor, the inline runner shows `snippet (root)` on the loop-body button without an icon, and clicking opens the picker instead of inserting the file." This same scenario reproduces in sidebar Runner — confirming root-cause is shared (`protocol-runner.ts`).
- Native CSS `resize: both` is intentionally chosen over a custom 8-direction handle — Obsidian community plugins universally use it for consistency with textarea UX. The single SE-corner grip is acceptable; users complaining about top/left edges have not surfaced.
- The `.is-resizing` class is intentionally mirrored to `.is-dragging` instead of unified into a `.is-interacting` superclass — keeping them distinct lets future work add per-state nuances (e.g. different shadow elevations) without breaking either.
- Renaming the **type** but not the **settings field** is intentional: the type rename is a clean code refactor visible only to TypeScript readers; the settings field rename would force on-disk migration for every existing user. The two changes are decoupled.
- D-14 takes pains to push NO undo entry — confirmed by reading `pickFileBoundSnippet` (Phase 56 D-03) and observing that the undo there is for the **predecessor Question node**, NOT the snippet itself. `advanceThrough` is reached after caller's undo push has already happened (e.g. `chooseLoopBranch` pushes loop-picker undo before advancing into the body). Adding an undo here would double-push.
- The directory-bound `snippet (root)` / `snippet (Findings/Chest)` strings in `nodeLabel` are preserved because `graph-validator.ts` uses them in error messages (e.g. `nodeLabel.test.ts:47` — see references). Touching them would cascade into validator error UX. Phase 67 only ADDS the file-bound case.

</specifics>

<deferred>
## Deferred Ideas

- **Per-canvas remembered layout** — different size for different protocols. Roadmap calls out only one global layout; deferred.
- **Resize handles on N/W/E edges** — extend beyond SE corner. Native CSS `resize: both` covers SE only; multi-edge handles would require custom pointer logic (rejected in D-01). Revisit if user feedback demands.
- **Auto-fade Inline Runner on cursor proximity** — v1.9 REQUIREMENTS.md Out-of-Scope row 2; still out of scope.
- **Settings UI for "reset inline layout"** — no Settings UI control added (Phase 60 D-01 stance preserved).
- **Touch / mobile resize** — not tested; Obsidian mobile is out-of-scope per current milestone.
- **Migration to a versioned settings schema** — current optional-fields + defaults pattern (D-06) suffices. Schema versioning would buy nothing today.
- **Unifying `.is-dragging` and `.is-resizing` into `.is-interacting`** — see specifics; rejected for now to keep state-specific styling open.

### Reviewed Todos (not folded)
- None — `.planning/todos/pending/` was scanned; no inline-runner / resize / file-bound related todos surfaced.

</deferred>

---

*Phase: 67-inline-runner-resizable-modal-file-bound-snippet-parity*
*Context gathered: 2026-04-25*
