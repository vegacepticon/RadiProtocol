# Phase 23: Node Editor Auto-Save and Color-on-Type-Change — Research

**Researched:** 2026-04-11
**Domain:** Obsidian plugin — EditorPanelView debounce auto-save, flush-on-switch, inline status indicator, dirty-guard removal
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Transient indicator is inline text — "Saved ✓" in the area where the Save button used to be. Fades out (~2 seconds). No `Notice()` for auto-saves.
- **D-02:** On node switch with pending debounce — flush synchronously: call `saveNodeEdits()` with captured filePath/nodeId/edits, cancel timer, then `loadNode()` for new node. Latency on switch is acceptable.
- **D-03:** If flush save fails (canvas file not found), the switch still proceeds — do not block navigation on save errors.
- **D-04:** Type-change immediate save includes ALL currently pending edits (`{ ...this.pendingEdits }`) — not just type+color. Debounce timer is cancelled at this point.
- **D-05:** Delete `src/views/node-switch-guard-modal.ts` entirely. Remove import from `editor-panel-view.ts`. Guard logic in `handleNodeClick()` lines 103–110 is removed entirely. Same-node early-return stays.

### Claude's Discretion

- Exact debounce implementation (instance field `private _debounceTimer: ReturnType<typeof setTimeout> | null = null`, tiny helper, or library). Key invariant: callback captures `filePath`, `nodeId`, and edits snapshot **at schedule time** — not `this.currentFilePath`/`this.currentNodeId` at fire time.
- Exact CSS/DOM approach for the "Saved ✓" indicator fade (CSS class toggle, inline style transition, or `setTimeout` + `remove()`).
- Whether `saveNodeEdits()` returns a boolean/result used to conditionally show the indicator, or whether indicator always shows on call completion.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUTOSAVE-01 | Editing any field and waiting ~1 second saves to canvas file automatically | Debounce pattern via `setTimeout` + captured snapshot — no library needed [VERIFIED: codebase] |
| AUTOSAVE-02 | Switching node type saves immediately (no debounce) and updates canvas node colour | Type dropdown `onChange` extended: cancel timer, build full edits+color, call `saveNodeEdits()` immediately [VERIFIED: codebase] |
| AUTOSAVE-03 | Pending debounce on node switch writes to FIRST node's ID, not second's | Flush-on-switch in `handleNodeClick()` before `loadNode()`: snapshot capture at schedule time [VERIFIED: codebase] |
| AUTOSAVE-04 | Transient "Saved" indicator appears inline after each successful auto-save | Inline DOM element in save-row area; CSS opacity transition or timeout hide [VERIFIED: codebase] |
</phase_requirements>

---

## Summary

Phase 23 is a surgical refactor of `EditorPanelView` — one file to modify and one file to delete. The core technology is native browser `setTimeout`/`clearTimeout` debounce with snapshot capture, plain DOM manipulation for the status indicator, and CSS transition for fade-out. No new libraries are required.

The save path (`saveNodeEdits()`) is **not** changed — it already handles the live/Strategy A dual path. Only the trigger mechanism (button click → timer + immediate) and UX surface (modal guard → inline indicator) change.

The most critical correctness requirement is **cross-node write corruption prevention** (AUTOSAVE-03): the debounce callback must close over the captured `filePath`, `nodeId`, and `edits` at schedule time — never read `this.currentFilePath` at fire time. The flush-on-switch mechanism (D-02) reinforces this by ensuring the pending save fires before the view state changes.

**Primary recommendation:** Implement a private `_debounceTimer` field with inline `setTimeout`/`clearTimeout` — no library, minimal surface area, explicit snapshot capture pattern.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Native `setTimeout` / `clearTimeout` | Browser built-in | Debounce timer | Zero deps, Obsidian plugin env, sufficient for 1s debounce |
| Obsidian `Setting` API | Existing | DOM helper for form rows | Already used throughout `renderForm()` |
| CSS `opacity` + `transition` | Browser built-in | Fade-out for "Saved ✓" indicator | No framework needed, consistent with project's plain-DOM approach |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `NODE_COLOR_MAP` | Internal (`src/canvas/node-color-map.ts`) | Color lookup on type change | Already imported in `editor-panel-view.ts` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `setTimeout` | `lodash.debounce` | Lodash adds a dependency; plain `setTimeout` gives explicit snapshot control required by D-02 |
| CSS opacity transition | `Notice()` | `Notice()` is explicitly forbidden by D-01 for auto-saves |
| Inline `_debounceTimer` field | A helper `debounce()` function | Helper adds indirection; inline field makes snapshot capture unambiguous |

**Installation:** No new packages required. [VERIFIED: codebase]

---

## Architecture Patterns

### Relevant File Locations
```
src/views/
├── editor-panel-view.ts   ← PRIMARY: all changes go here
└── node-switch-guard-modal.ts  ← DELETE entirely (D-05)
src/styles.css             ← ADD .rp-editor-saved-indicator CSS rule
src/__tests__/
└── editor-panel.test.ts   ← ADD auto-save behaviour tests
```

### Pattern 1: Debounce with Snapshot Capture

**What:** Schedule save with `setTimeout`; capture `filePath`, `nodeId`, `edits` in the closure at schedule time.
**When to use:** Every `onChange` field handler fires this path.
**Key invariant:** Never reference `this.currentFilePath` inside the timer callback — only the captured locals.

```typescript
// Source: CONTEXT.md Debounce Architecture (Claude's Discretion)
private _debounceTimer: ReturnType<typeof setTimeout> | null = null;

private scheduleAutoSave(): void {
  if (this._debounceTimer !== null) {
    clearTimeout(this._debounceTimer);
  }
  // Snapshot at schedule time — NOT at fire time
  const filePath = this.currentFilePath;
  const nodeId = this.currentNodeId;
  const edits = { ...this.pendingEdits };

  if (!filePath || !nodeId) return;

  this._debounceTimer = setTimeout(() => {
    this._debounceTimer = null;
    void this.saveNodeEdits(filePath, nodeId, edits).then(() => {
      this.showSavedIndicator();
    });
  }, 1000);
}
```

### Pattern 2: Flush-on-Switch (D-02)

**What:** Before calling `loadNode()` for a new node, if a debounce timer is pending, cancel it and fire `saveNodeEdits()` synchronously (via `void`/`await`) with the first node's captured data.
**When to use:** `handleNodeClick()` — after same-node guard, before `loadNode()`.

```typescript
// Source: CONTEXT.md D-02
private async handleNodeClick(filePath: string, nodeId: string): Promise<void> {
  if (this.currentFilePath === filePath && this.currentNodeId === nodeId) return;

  // Flush pending debounce before switching
  if (this._debounceTimer !== null) {
    clearTimeout(this._debounceTimer);
    this._debounceTimer = null;
    if (this.currentFilePath && this.currentNodeId) {
      const editsSnapshot = { ...this.pendingEdits };
      // D-03: ignore save errors — do not block navigation
      try {
        await this.saveNodeEdits(this.currentFilePath, this.currentNodeId, editsSnapshot);
      } catch {
        // silent — D-03
      }
    }
  }

  this.loadNode(filePath, nodeId);
}
```

### Pattern 3: Type-Change Immediate Save (D-04)

**What:** In the type dropdown `onChange`, cancel any pending debounce, build full edits with color, call `saveNodeEdits()` immediately.
**When to use:** Node-type dropdown `onChange` handler only.

```typescript
// Source: CONTEXT.md D-04 + existing onClick color logic (lines 307-311)
.onChange(value => {
  this.pendingEdits['radiprotocol_nodeType'] = value || undefined;
  // Rebuild kind form section (existing)
  if (this.kindFormSection) {
    this.kindFormSection.empty();
    this.buildKindForm(this.kindFormSection, nodeRecord, value ? (value as RPNodeKind) : null);
  }
  // Immediate save — cancel debounce, include all pending edits + color
  if (this._debounceTimer !== null) {
    clearTimeout(this._debounceTimer);
    this._debounceTimer = null;
  }
  if (this.currentFilePath && this.currentNodeId) {
    const edits = { ...this.pendingEdits };
    const selectedType = edits['radiprotocol_nodeType'] as string | undefined;
    if (selectedType && selectedType !== '') {
      edits['color'] = (NODE_COLOR_MAP as Record<string, string | undefined>)[selectedType];
    } else if ('radiprotocol_nodeType' in edits) {
      edits['color'] = undefined;
    }
    void this.saveNodeEdits(this.currentFilePath, this.currentNodeId, edits)
      .then(() => { this.showSavedIndicator(); });
  }
})
```

### Pattern 4: "Saved ✓" Inline Indicator (D-01)

**What:** A `<span>` element rendered in place of the Save button row. Shown after each successful `saveNodeEdits()` call; hidden after ~2 seconds via CSS transition or `setTimeout`.
**When to use:** Called from `showSavedIndicator()` private method.

```typescript
// Source: CONTEXT.md D-01
private _savedIndicatorEl: HTMLElement | null = null;
private _indicatorTimer: ReturnType<typeof setTimeout> | null = null;

private showSavedIndicator(): void {
  if (!this._savedIndicatorEl) return;
  this._savedIndicatorEl.addClass('is-visible');
  if (this._indicatorTimer !== null) clearTimeout(this._indicatorTimer);
  this._indicatorTimer = setTimeout(() => {
    this._savedIndicatorEl?.removeClass('is-visible');
    this._indicatorTimer = null;
  }, 2000);
}
```

```css
/* src/styles.css — Phase 23 */
.rp-editor-saved-indicator {
  font-size: var(--font-text-size);
  color: var(--text-success, var(--color-green));
  opacity: 0;
  transition: opacity 0.2s ease-in-out;
  padding-top: var(--size-4-1);
}

.rp-editor-saved-indicator.is-visible {
  opacity: 1;
}
```

### Anti-Patterns to Avoid

- **Reading `this.currentFilePath` inside the timer callback:** Race condition — by the time the timer fires, `currentFilePath` may point to a different node. Always capture into a local variable at schedule time.
- **Calling `Notice()` for auto-save feedback:** Explicitly forbidden by D-01. Use inline indicator only.
- **Blocking node navigation on save failure:** D-03 requires the switch to proceed even if flush save fails.
- **Forgetting to cancel `_debounceTimer` on `renderForm()` re-render:** If a new node is loaded while a timer is pending (outside the normal `handleNodeClick` path), the stale timer must be cleared. Clear in `loadNode()` or at the start of `renderForm()`.
- **Leaving `_savedIndicatorEl` reference stale after `contentEl.empty()`:** `renderForm()` calls `this.contentEl.empty()` — the stored element reference becomes detached. Re-assign `_savedIndicatorEl` on each `renderForm()` call.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Debounce | Custom debounce class | Native `setTimeout` + `clearTimeout` | Already sufficient; custom class adds complexity without benefit |
| Fade animation | JS animation loop | CSS `opacity` + `transition` | Browser handles timing; no JS frame loop needed |
| Color palette lookup | Custom color resolver | `NODE_COLOR_MAP` (already exists) | Already imported, already tested, already correct |

**Key insight:** Every problem in this phase has a trivial solution already present in the codebase or browser platform. The complexity is in correctness (snapshot capture, flush ordering) — not in tooling.

---

## Common Pitfalls

### Pitfall 1: Stale `this.currentFilePath` in Debounce Closure
**What goes wrong:** Timer fires 1 second after user switches to a different node, writes second node's edits to first node's file — or vice versa.
**Why it happens:** Closure captures `this` reference, not a value snapshot; `this.currentFilePath` changes when `loadNode()` runs.
**How to avoid:** Always capture `const filePath = this.currentFilePath` BEFORE creating the `setTimeout`. The flush-on-switch (D-02) eliminates the race entirely, but snapshot capture is the belt-and-suspenders defense.
**Warning signs:** Test for cross-node corruption: schedule a save, switch node before 1s, observe which node was written.

### Pitfall 2: `_savedIndicatorEl` Reference Goes Stale After Re-Render
**What goes wrong:** `showSavedIndicator()` tries to modify a detached DOM node; no error thrown but indicator never appears.
**Why it happens:** `contentEl.empty()` (called in `renderForm()` / `renderNodeForm()`) removes all children, including the indicator element. The stored reference becomes orphaned.
**How to avoid:** Re-assign `this._savedIndicatorEl` at the end of each `renderForm()` call, after creating the new indicator element.
**Warning signs:** Indicator visible on first save only; disappears on subsequent node loads.

### Pitfall 3: Debounce Timer Not Cleared on `loadNode()`
**What goes wrong:** User clicks node A, types, immediately clicks node B (flush fires), then types in B — but the original A timer also fires 1 second later, writing stale A edits.
**Why it happens:** Flush via `handleNodeClick()` only cancels the timer on the "node switch" path. If `loadNode()` is called directly (e.g., from a context menu), no flush occurs.
**How to avoid:** Call `clearTimeout(this._debounceTimer); this._debounceTimer = null;` at the start of `loadNode()` (or at the start of `renderForm()`) as a safety net.
**Warning signs:** Intermittent saves of stale data; harder to reproduce in tests.

### Pitfall 4: `_indicatorTimer` Not Cleared When Indicator is Re-Triggered
**What goes wrong:** User triggers two quick saves; second save resets the indicator but the first timer fires early and hides it.
**Why it happens:** Two `setTimeout` calls outstanding; first fires before second's 2s window closes.
**How to avoid:** Always `clearTimeout(this._indicatorTimer)` before setting a new one in `showSavedIndicator()`.

### Pitfall 5: `Notice()` Leaking from `saveNodeEdits()` Auto-Save Path
**What goes wrong:** The existing `saveNodeEdits()` calls `new Notice('Node properties saved.')` on success — this fires on every auto-save, spamming the user with toasts.
**Why it happens:** `saveNodeEdits()` currently always fires a `Notice` on success. Auto-save calls it on every keystroke (after debounce).
**How to avoid:** Remove the success `Notice()` calls from `saveNodeEdits()`, or add a parameter (`showNotice: boolean`) to suppress them on auto-save calls. The inline "Saved ✓" indicator replaces the Notice for auto-save. Manual-save path (if any remains) can keep or drop Notice — but since the Save button is removed entirely, Notice calls in `saveNodeEdits()` should be removed.
**Warning signs:** Obsidian notification bar flooding after typing.

---

## Code Examples

### Existing Color Lookup Pattern (to reuse in type-change handler)
```typescript
// Source: editor-panel-view.ts lines 307-313 (existing Save button onClick)
const selectedType = edits['radiprotocol_nodeType'] as string | undefined;
if (selectedType && selectedType !== '') {
  edits['color'] = (NODE_COLOR_MAP as Record<string, string | undefined>)[selectedType];
} else if ('radiprotocol_nodeType' in edits) {
  edits['color'] = undefined;
}
```

### Existing `saveNodeEdits` Signature (unchanged)
```typescript
// Source: editor-panel-view.ts line 132
async saveNodeEdits(
  filePath: string,
  nodeId: string,
  edits: Record<string, unknown>
): Promise<void>
```

### Lines to Remove: Dirty Guard (D-05)
```typescript
// Source: editor-panel-view.ts lines 103-110 — DELETE THIS BLOCK
if (this.currentNodeId !== null && Object.keys(this.pendingEdits).length > 0) {
  const modal = new NodeSwitchGuardModal(this.plugin.app);
  modal.open();
  const confirmed = await modal.result;
  if (!confirmed) return;
  this.pendingEdits = {};
}
```

### Lines to Remove: Save Button (replace with indicator area)
```typescript
// Source: editor-panel-view.ts lines 294-321 — DELETE THIS BLOCK, replace with indicator element
const saveRow = panel.createDiv({ cls: 'rp-editor-save-row' });
new Setting(saveRow)
  .addButton(btn => { ... });
```

### Lines to Remove: Import
```typescript
// Source: editor-panel-view.ts line 4 — DELETE
import { NodeSwitchGuardModal } from './node-switch-guard-modal';
```

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` |
| Quick run command | `npx vitest run src/__tests__/editor-panel.test.ts` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTOSAVE-01 | `scheduleAutoSave()` called from field `onChange`; fires after 1000ms with captured snapshot | unit | `npx vitest run src/__tests__/editor-panel.test.ts` | ✅ (extend existing) |
| AUTOSAVE-01 | Snapshot captures filePath/nodeId/edits at schedule time, not at fire time | unit | `npx vitest run src/__tests__/editor-panel.test.ts` | ✅ (extend existing) |
| AUTOSAVE-02 | Type dropdown change: debounce cancelled, `saveNodeEdits` called immediately with color | unit | `npx vitest run src/__tests__/editor-panel.test.ts` | ✅ (extend existing) |
| AUTOSAVE-03 | Node switch while debounce pending: flush fires for first node, `loadNode` runs for second | unit | `npx vitest run src/__tests__/editor-panel.test.ts` | ✅ (extend existing) |
| AUTOSAVE-03 | D-03: flush save failure does not block node switch | unit | `npx vitest run src/__tests__/editor-panel.test.ts` | ✅ (extend existing) |
| AUTOSAVE-04 | `showSavedIndicator()` adds `is-visible` class; removed after 2000ms | unit | `npx vitest run src/__tests__/editor-panel.test.ts` | ✅ (extend existing) |
| AUTOSAVE-04 | No `Notice` fired on auto-save (verify Notice mock not called) | unit | `npx vitest run src/__tests__/editor-panel.test.ts` | ✅ (extend existing) |
| D-05 | `NodeSwitchGuardModal` import removed; guard block absent | static (compile) | `npx tsc --noEmit` | ✅ confirmed by build |

**Note:** Current `editor-panel.test.ts` has 7 tests covering only metadata and API existence. New tests must be added for all AUTOSAVE-* behaviours above. The file exists and the vitest mock infrastructure is in place — new `describe` blocks can be appended.

### Sampling Rate
- **Per task commit:** `npx vitest run src/__tests__/editor-panel.test.ts`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/editor-panel.test.ts` — needs new `describe('auto-save behaviour', ...)` block covering all AUTOSAVE-* requirements above. Framework and mocks already exist; only test logic is missing.

---

## Security Domain

This phase is UI-layer only — no new network calls, no authentication, no data ingestion from external sources. All writes go through the existing `saveNodeEdits()` path which is already audited.

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | No new inputs | Existing `pendingEdits` accumulation unchanged |
| V6 Cryptography | No | Not applicable |
| V2/V3/V4 Auth/Session/Access | No | Obsidian plugin context — no user auth |

No new threat patterns introduced. Timer-based writes use the same vault.modify() path already subject to the write-mutex pattern (Critical Pitfall #2 from STATE.md). [VERIFIED: codebase]

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual "Save changes" button | Debounced auto-save | Phase 23 | No user action needed to persist edits |
| `NodeSwitchGuardModal` confirmation | Synchronous flush on switch | Phase 23 | Zero friction node navigation |
| `Notice()` on save success | Inline "Saved ✓" indicator | Phase 23 | Feedback local to editor, not intrusive |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `saveNodeEdits()` success `Notice()` calls should be removed (not just suppressed) since the Save button is the only manual-save path and it is being deleted | Common Pitfalls #5 | If some other path calls `saveNodeEdits()` and expects a Notice, removing it would break that path — but no such path is visible in the codebase [VERIFIED: grep of codebase shows only onClick caller] |

---

## Open Questions

1. **Should `saveNodeEdits()` return a `boolean` to distinguish live-save vs. Strategy-A success?**
   - What we know: Currently returns `Promise<void>`; failures surface via `Notice()` which is being removed.
   - What's unclear: Whether `showSavedIndicator()` should fire only on success or unconditionally after the call.
   - Recommendation: Per Claude's Discretion — simplest correct approach is to show the indicator unconditionally after `saveNodeEdits()` resolves (errors are logged to console; the indicator signals "save attempted", not "save confirmed"). If the planner wants strict success-only indication, add a `boolean` return to `saveNodeEdits()`.

---

## Environment Availability

Step 2.6: SKIPPED — phase is pure TypeScript code changes in an existing Obsidian plugin. No new external tools, CLIs, databases, or runtimes introduced.

---

## Sources

### Primary (HIGH confidence)
- `src/views/editor-panel-view.ts` — full source read; line numbers cited throughout
- `src/views/node-switch-guard-modal.ts` — full source read; confirmed deletion scope
- `src/canvas/node-color-map.ts` — full source read; COLOR_MAP pattern verified
- `src/styles.css` — full source read; existing CSS classes confirmed, `.rp-editor-save-row` pattern noted
- `src/__tests__/editor-panel.test.ts` — full source read; existing test coverage confirmed
- `vitest.config.ts` — Vitest 4.1.2, node environment, `src/__tests__/**/*.test.ts` glob
- `.planning/phases/23-node-editor-auto-save-and-color-on-type-change/23-CONTEXT.md` — all decisions verbatim

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — Critical Pitfalls section; vault.modify() race condition history

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; all tools are browser built-ins or existing project imports
- Architecture: HIGH — all patterns derived directly from reading the exact source files being modified
- Pitfalls: HIGH — derived from code analysis of the actual implementation, especially the timer/closure interaction
- Test gaps: HIGH — vitest infrastructure confirmed running; existing test file confirmed extendable

**Research date:** 2026-04-11
**Valid until:** Stable (code changes are within this repo; no external dependency staleness concern)
