# Phase 59: Inline Runner Feature Parity — Context

**Gathered:** 2026-04-24
**Status:** Ready for planning (post-hoc — captured after research + plan-checker surfaced the need for locked decisions)
**Source:** Derived from `59-RESEARCH.md` + direct user confirmation on D6 reversal (2026-04-24)

<domain>
## Phase Boundary

Phase 59 closes three correctness-class parity gaps between Inline Runner (Phase 54) and sidebar Runner — **no new UI design, no new features**. The goal is behavioural parity for three specific user workflows:

1. Opening the picker via `Run protocol in inline` when `protocolFolderPath` is a nested path (INLINE-FIX-01)
2. Inserting a snippet node output into the active note with the configured separator respected (INLINE-FIX-04)
3. Running a `.json` snippet with placeholders — fill-in UX must match sidebar (INLINE-FIX-05)

**Out of scope:** layout / position persistence (Phase 60), settings UX (Phase 61), release (Phase 62), any Phase 54 invariant changes not listed in the Locked Decisions below.
</domain>

<decisions>
## Implementation Decisions

### D-01 — Reverse Phase 54 D6 for INLINE-FIX-05 (LOCKED, user-confirmed 2026-04-24)

**Decision:** Inline Runner opens the same `SnippetFillInModal` as sidebar Runner for JSON snippets with placeholders. The Phase 54 D6 decision (in-panel fill-in form hosted inside `.rp-inline-runner-container`) is reversed.

**What this means concretely:**
- Delete `InlineRunnerModal.renderSnippetFillIn` (inline-runner-modal.ts:891-973)
- Collapse the `awaiting-snippet-fill` render arm (411-419) to a transient `Loading…` indicator that ends when the modal resolves
- `handleSnippetFill` (833-888) invokes `new SnippetFillInModal(this.app, snippet)` → `modal.open()` → `await modal.result` → branch on null (cancel) vs string (submit), exactly as `RunnerView.handleSnippetFill` does at runner-view.ts:997-1008

**Why:**
- Sidebar parity across all three modes (sidebar / tab / inline) is the explicit milestone goal
- The in-panel form is missing live preview, Custom override, and correct choice-separator semantics — porting those features into the in-panel form costs more than reusing the proven Modal
- `SnippetFillInModal` has 52 existing tests and is a stable dependency — no Phase 59 edits to it
- Phase 60 (layout/position) is unblocked: removing 82 lines simplifies the modal surface area

**What this does NOT change:**
- Phase 54 D1 (freeze/resume on `active-leaf-change`) — must be preserved via D-02 below
- Phase 54 D2 (target-note-deleted cleanup), D3 (close-button disposal), D4 (note IS the buffer), D5 (no on-note running indicator), D7 (append formatting parity), D8 (no-canvases Notice), D9 (no-active-markdown Notice) — untouched

### D-02 — `isFillModalOpen` gate for Phase 54 D1 invariant (LOCKED)

**Decision:** Before opening `SnippetFillInModal` (per D-01), `InlineRunnerModal` sets an internal `isFillModalOpen = true` flag. The `active-leaf-change` handler that implements Phase 54 D1 freeze/hide skips its hide path when the flag is true. The flag clears in a `try/finally` wrapper around `await modal.result`, regardless of resolve or reject.

**Why:** Research A4 flags the risk that opening an Obsidian `Modal` may fire `active-leaf-change` events as focus transitions to the modal backdrop. Even if it does not fire in practice, the guard costs ~5 lines and deterministically eliminates a whole class of D1-regression bugs.

**Test gate:** Wave 0 test scaffolding includes a regression check — inline container does NOT receive `is-hidden` class while fill-in modal is open.

### D-03 — `console.debug` instrumentation for INLINE-FIX-01 A1 uncertainty (LOCKED)

**Decision:** `handleRunProtocolInline` (and the extracted `resolveProtocolCanvasFiles` helper) includes `console.debug` logging at every guard/branch point — `getAbstractFileByPath` result, TFolder vs TFile discrimination, fallback-scan entry, normalized-path value. Kept in the shipped build; `console.debug` is already the project's sanctioned log level (STATE.md Pitfall 6).

**Why:** Research Assumption A1 cannot be verified without live reproduction on the user's vault. Shipping instrumentation makes future UAT diagnosis a one-step task (open devtools console, run the command, read the trace) rather than requiring a diagnostic commit + rebuild + reinstall cycle.

**Scope limit:** Instrumentation only in the path-resolution flow. No blanket logging of vault reads elsewhere.

### D-04 — Shared helper `appendDeltaFromAccumulator` introduced in Plan 59-02, reused in Plan 59-03 (LOCKED)

**Decision:** The accumulator-diff append pattern (capture `beforeText = runner.getCurrentText()`, perform runner mutation that applies separator internally, compute `delta = runner.getCurrentText().slice(beforeText.length)`, append delta to note via `appendAnswerToNote`) is extracted into a reusable helper `appendDeltaFromAccumulator(beforeText)` on `InlineRunnerModal`. It is introduced in Plan 59-02 (Wave 1b, INLINE-FIX-04) and reused by Plan 59-03 (Wave 1c, INLINE-FIX-05) — which is why 59-03 depends on 59-02.

**Why:** Single source of truth for "how inline appends snippet output" — eliminates drift and keeps the "separator is the runner's job, not the sink's job" invariant enforceable.

### Claude's Discretion

- Exact test-file directory layout within `src/__tests__/views/` and `src/__tests__/` (as long as names match the paths in `59-VALIDATION.md`)
- Mock augmentation style in `src/__mocks__/obsidian.ts` (as long as `TFolder`, `Modal`, `SuggestModal` are exported and support `instanceof` checks)
- Wording of the transient "Loading…" indicator in the collapsed `awaiting-snippet-fill` arm
- Wording of `console.debug` messages in D-03 instrumentation (use existing project log style)
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 59 artifacts (this directory)
- `.planning/phases/59-inline-runner-feature-parity/59-RESEARCH.md` — Full technical research; Validation Architecture, Regression Risk Map, Assumptions A1–A5
- `.planning/phases/59-inline-runner-feature-parity/59-PATTERNS.md` — Analog file map with concrete code excerpts
- `.planning/phases/59-inline-runner-feature-parity/59-VALIDATION.md` — Per-requirement test map + Wave 0 requirements

### Phase 54 design contract (invariants to preserve)
- `.planning/milestones/v1.8-phases/54-inline-protocol-display-mode/54-CONTEXT.md` — D1–D9 invariants (D6 reversed here; all others preserved)
- `.planning/milestones/v1.8-phases/54-inline-protocol-display-mode/54-VERIFICATION.md` — How Phase 54 was verified — regression fixtures to re-run

### Project guardrails
- `./CLAUDE.md` — CSS architecture (per-feature files, append-only), shared-file editing rules, build process
- `.planning/STATE.md` — v1.9 pitfalls, carry-over guardrails (WriteMutex, no innerHTML, console.debug only, etc.)

### Parity references (DO NOT EDIT — read-only analogs)
- `src/views/runner-view.ts:555-576` — `handleAnswerClick` accumulator-diff pattern (template for INLINE-FIX-04)
- `src/views/runner-view.ts:997-1008` — `handleSnippetFill` SnippetFillInModal invocation (template for INLINE-FIX-05)
- `src/views/snippet-fill-in-modal.ts` (full file) — reused verbatim
- `src/runner/protocol-runner.ts:567-585` — `resolveSeparator` (separator authority; untouched)
</canonical_refs>

<specifics>
## Specific Ideas

- Extract `resolveProtocolCanvasFiles(vault: Vault, folderPath: string): TFile[]` as a **pure, exported** helper in `src/main.ts` so it can be unit-tested without instantiating the whole plugin. Signature must accept a minimal `Vault`-like interface so mocks can inject a fake.
- Normalization steps in helper: trim whitespace → replace `\\` with `/` → strip leading `/` → strip trailing `/`. Empty-string result triggers D8 Notice (preserve Phase 54 invariant).
- Fallback scan: `vault.getFiles().filter(f => f.extension === 'canvas' && (f.path === norm || f.path.startsWith(norm + '/')))`. Only engages when `getAbstractFileByPath(norm)` returns null or returns a non-TFolder.
- `isFillModalOpen` flag lives as `private isFillModalOpen = false` on `InlineRunnerModal`. Set to `true` immediately before `modal.open()`; cleared in `finally` after `await modal.result`.
- Transient "Loading…" arm: keep the existing render-state machine; just replace the rich form with a single `el.createSpan({ text: 'Loading…' })` while the modal is open.

## Out of Scope (v1.9 but NOT Phase 59)

- Inline Runner layout compactness + drag-position persistence → **Phase 60**
- Folder autocomplete in settings → **Phase 61**
- v1.9.0 BRAT release → **Phase 62**
</specifics>

<deferred>
## Deferred Ideas

- Porting live preview / Custom override / choice separator into the in-panel fill-in form (rejected by D-01 — we reverse to sidebar-parity instead)
- Resize handle on Inline Runner (v1.9 REQUIREMENTS.md Out-of-Scope row 1)
- Auto-fade on cursor proximity for Inline Runner (v1.9 REQUIREMENTS.md Out-of-Scope row 2)
- Retroactive Nyquist VALIDATION.md for older phases (tech debt; VAL-F01)
</deferred>

---

*Phase: 59-inline-runner-feature-parity*
*Context gathered: 2026-04-24 post-hoc from research + explicit user confirmation on D-01 (D6 reversal)*
