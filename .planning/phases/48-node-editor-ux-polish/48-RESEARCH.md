# Phase 48: Node Editor UX Polish — Research

**Researched:** 2026-04-19
**Domain:** Obsidian plugin UI — Node Editor panel (TypeScript + Obsidian Setting API + per-feature CSS)
**Confidence:** HIGH (all five requirements map to <=20-line touch points in code that is already opened and audited; environment + browser capabilities verified via WebSearch; no external tooling required)

---

## Summary

Phase 48 is a strictly additive/replacement UX polish across **two source files** — `src/views/editor-panel-view.ts` and `src/styles/editor-panel.css` — with one 4-line edit in `src/canvas/canvas-node-factory.ts`. All five NODEUI-* requirements collapse to small, localized changes:

1. **NODEUI-01** — delete 10 lines (the `Snippet ID (optional)` `new Setting(container)` block inside the `'text-block'` case) in editor-panel-view.ts. The parser/runner/session paths that read `radiprotocol_snippetId` must be left alone (load-bearing for existing canvases — see Critical Landmine below).
2. **NODEUI-02** — change one line in `canvas-node-factory.ts`: offset goes from `{ x: anchor.x + anchor.width + NODE_GAP, y: anchor.y }` to `{ x: anchor.x, y: anchor.y + anchor.height + NODE_GAP }`. Anchor-height-aware (we already read `anchor.height` since the table exposes it). One unit test needs its assertion flipped.
3. **NODEUI-03** — re-order two `new Setting(container)` blocks inside the `'answer'` case in editor-panel-view.ts (Display label first, Answer text second). Obsidian's `Setting` API puts label+desc adjacent to its own control, so re-ordering the JS blocks is sufficient; no CSS needed for this criterion.
4. **NODEUI-04** — the Question `addTextArea` currently lives inside a `new Setting(container)` row which renders `.setting-item-info` (label) LEFT and `.setting-item-control` (textarea) RIGHT via flexbox. To get label-above + full-width textarea we must stop using the `Setting` wrapper for the textarea and instead emit custom DOM: label `<div>` + desc `<p>` + `<textarea class="rp-question-textarea">`. Auto-grow uses the **same** JS pattern already proven in `runner-view.ts:822–840` (`requestAnimationFrame` + `input` listener setting `height = scrollHeight`). CSS `field-sizing: content` is available (Chromium 123+ ships the feature; Obsidian 1.12 bundles Electron 39 / Chromium 139+) but we recommend the JS pattern for parity with the existing codebase.
5. **NODEUI-05** — CSS-only + one DOM re-order. Move `renderToolbar(this.contentEl)` call from the **top** of `renderIdle`/`renderForm` to after the form body, change `.rp-editor-create-toolbar` from `flex-direction: row` + `flex-wrap: wrap` to `flex-direction: column` with full-width buttons, and use `margin-top: auto` on the toolbar (parent `.rp-editor-panel` is already `display: flex; flex-direction: column`) so the toolbar sticks to the bottom.

**Primary recommendation:** One plan per NODEUI requirement is overkill; ship as **two plans** — Plan 01: TypeScript (NODEUI-01, 02, 03, 04) in editor-panel-view.ts + canvas-node-factory.ts + one test flip; Plan 02: CSS + toolbar DOM re-order (NODEUI-05) in editor-panel.css + editor-panel-view.ts. Keeps commits scoped and matches CLAUDE.md's append-only CSS discipline.

---

## User Constraints (from CONTEXT.md)

No CONTEXT.md file exists under `.planning/phases/48-node-editor-ux-polish/` at research time — this phase was spawned directly into research without a prior `/gsd-discuss-phase` session. All five NODEUI requirements are well-defined by ROADMAP.md success criteria + REQUIREMENTS.md signal rows + five pending TODO files (all dated 2026-04-18, priority medium). The success criteria ARE the locked decisions.

### Locked Decisions (from ROADMAP.md Success Criteria + REQUIREMENTS.md Signal rows)

- **NODEUI-01:** Snippet ID input gone from form; save path does not write `radiprotocol_snippetId`; legacy value on disk is ignored (ROADMAP wording: "ignored (or removed) if present on existing canvases" — the safe reading is *leave the parser/runner load-path alone; just stop showing the input*).
- **NODEUI-02:** `CanvasNodeFactory` offset becomes `(0, dy)` — vertical; applies to all four quick-create buttons (they already share one code path — `createNode`).
- **NODEUI-03:** Answer form reads Display label first, Answer text second.
- **NODEUI-04:** Question textarea auto-grows; label + helper stack ABOVE textarea; textarea uses full panel width.
- **NODEUI-05:** `.rp-editor-create-toolbar` anchored at panel bottom; single full-width vertical column of four buttons; `flex-wrap` rule no longer needed.

### Claude's Discretion

- **NODEUI-04 auto-grow mechanism:** JS `scrollHeight` pattern vs CSS `field-sizing: content`. Recommend JS pattern — matches runner-view.ts:822–840 verbatim, zero risk, works even if Obsidian bumps down Electron (BRAT min-version is 1.5.7 per manifest). `field-sizing: content` would work at runtime but adds a version-floor risk vs. the current 100% JS pattern already in the codebase.
- **NODEUI-05 toolbar anchor mechanism:** (a) DOM-reorder + `margin-top: auto` on toolbar (parent is already `display: flex; flex-direction: column`), or (b) `position: sticky; bottom: 0`. Recommend (a) — cleaner, no sticky paint weirdness, and zero change to scroll behaviour inside `.rp-editor-form` which is already `overflow-y: auto`.
- **Duplicate Node button (Phase 40) layout:** currently lives inside the same toolbar. Success criterion NODEUI-05 enumerates only the four create buttons — research recommendation: include the Duplicate button in the same bottom vertical stack (five full-width buttons) to avoid a second toolbar. Disabled state already handled (`dupBtn.disabled = !this.currentNodeId`). Planner should confirm during plan creation.
- **NODEUI-01 cleanup of `radiprotocol_snippetId` on save:** The ROADMAP says "ignored (or removed) if present on existing canvases." Two readings possible:
  - **Conservative (recommended):** stop writing the field from the form (delete UI block only). Legacy value on disk continues to load via `canvas-parser.ts:221` into `TextBlockNode.snippetId`, and the runner branch at `protocol-runner.ts:545` still opens the fill-in modal. Zero regression risk.
  - **Aggressive:** also strip `radiprotocol_snippetId` from the node during `saveNodeEdits` when a text-block is saved. This actively destroys legacy data. **Reject** — `src/__tests__/fixtures/snippet-block.canvas` and `protocol-runner.test.ts:187-195` still assert the awaiting-snippet-fill transition. Aggressive stripping would fail these tests and break any user canvas that still uses the v1.0 pattern.
  - Recommend the conservative reading. Align with Standing Pitfall #11 in STATE.md (preserve backward compatibility of stored canvas shape).

### Deferred Ideas (OUT OF SCOPE for Phase 48)

- Removing the Phase 5 text-block→snippet-fill runtime path (`protocol-runner.ts:545`). That feature is load-bearing and predates v1.4 snippet nodes.
- Deleting the `snippetId?: string` field from `TextBlockNode` interface (`graph-model.ts:48`). Downstream runner + session + serializer all read it; this is a cross-phase refactor, not UX polish.
- Redesigning the whole form layout beyond the five listed changes (e.g., separator dropdown placement, saved-indicator position).

---

## Phase Requirements

| ID | Description (from REQUIREMENTS.md) | Research Support (where/how to implement) |
|----|-----------------------------------|-------------------------------------------|
| NODEUI-01 | Remove Snippet ID (optional) field from Text block form; save path no longer writes `radiprotocol_snippetId` | Delete lines 477–486 of `src/views/editor-panel-view.ts` (one `new Setting(container).setName('Snippet ID (optional)')…addText()` block inside `case 'text-block':`). Keep parser/runner paths untouched. |
| NODEUI-02 | Quick-create buttons position new node BELOW anchor — `CanvasNodeFactory` offset becomes `(0, dy)` instead of `(dx, 0)` | One-line change at `src/canvas/canvas-node-factory.ts:52`. Change `{ x: anchor.x + anchor.width + NODE_GAP, y: anchor.y }` to `{ x: anchor.x, y: anchor.y + anchor.height + NODE_GAP }`. Flip assertion in `canvas-node-factory.test.ts:155-160` (Test 5). |
| NODEUI-03 | Answer form: Display label ABOVE Answer text | Re-order two `new Setting(container)` blocks at `src/views/editor-panel-view.ts:424–444` — put the `Display label (optional)` block (435–444) first, the `Answer text` block (424–434) second. |
| NODEUI-04 | Question textarea auto-grows; label + helper stacked ABOVE textarea; full panel width | Replace `new Setting(container).setName('Question text').setDesc(...).addTextArea(...)` at `src/views/editor-panel-view.ts:408–418` with custom DOM block: label `<div>` + helper `<p>` + `<textarea class="rp-question-textarea">` and attach input listener that sets `height = scrollHeight` (same pattern as `runner-view.ts:822–840`). Add `.rp-question-textarea` CSS rule (width: 100%, min-height: 80px, box-sizing: border-box) to `src/styles/editor-panel.css`. |
| NODEUI-05 | `.rp-editor-create-toolbar` anchored at bottom of panel as single full-width vertical column | (a) Move `renderToolbar(this.contentEl)` call sites from top of form to bottom — i.e., call it AFTER the form area is built in both `renderIdle()` and `renderForm()`. (b) CSS: change `.rp-editor-create-toolbar` from `flex-direction: row` to `flex-direction: column`, remove `flex-wrap: wrap` rule (line 165–168), add `margin-top: auto`, `width: 100%`, and set each button to `width: 100%; justify-content: flex-start` (or `center`). Parent `.rp-editor-panel` already has `display: flex; flex-direction: column` so `margin-top: auto` works. |

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Node Editor form rendering | Obsidian ItemView (EditorPanelView) | — | All form logic lives in the side-panel view class; no cross-tier concerns. |
| Quick-create node placement | CanvasNodeFactory service | Obsidian internal Canvas API | Factory computes pos + type + color, then defers to `canvas.createTextNode()`. |
| Textarea auto-grow | DOM event listener in view | — | Pure client-side; no persistence tier involved. |
| CSS layout (toolbar anchoring) | Per-feature CSS file (editor-panel.css) | esbuild CSS concat | Build-time concat into `styles.css`; Obsidian loads at plugin enable. |
| Legacy `radiprotocol_snippetId` ingestion | canvas-parser (TextBlockNode build) | ProtocolRunner | Unchanged — NODEUI-01 is a write-side removal only. |

---

## Standard Stack

### Core (already in place — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| obsidian | 1.12.3 (runtime + types) | ItemView + Setting API + setIcon | Plugin-native; [VERIFIED: package.json line 33] |
| vitest | ^4.1.2 | Test runner | Already used across existing tests |
| TypeScript | 6.0.2 | Build-time type checks | `npm run build` runs `tsc -noEmit -skipLibCheck` first |
| esbuild | 0.28.0 | Bundler + CSS concat plugin | Concatenates `src/styles/*.css` in the order declared in `esbuild.config.mjs:31-38` |

### Supporting (existing patterns to reuse, not new libraries)

| Pattern | Location | Purpose | When to Use |
|---------|----------|---------|-------------|
| `requestAnimationFrame` + `input` → `scrollHeight` auto-grow | `src/views/runner-view.ts:822–840` | Textarea auto-grow | NODEUI-04 — copy this exact pattern verbatim. |
| `registerDomEvent(el, 'input', cb)` | `src/views/editor-panel-view.ts:102, 111` + many more | Lifecycle-managed event listener | NODEUI-04 — use for the textarea input listener so it tears down with the view. |
| `new Setting(container).setName(..).setDesc(..).addText(..)` | widely used | Obsidian's opinionated label-left / control-right row | NODEUI-03 — reuse for answer form fields. |
| `new Setting(container).setHeading().setName(..)` | `editor-panel-view.ts:398, 407, 422, 465, 510, 522, 538` | Section heading | Keep for Question/Answer/Text-block headings. |
| Custom DOM emit via `container.createDiv / createEl` | `src/views/editor-panel-view.ts:145–149, 370–374` | Side-step Setting API when label-above is needed | NODEUI-04 — use this instead of `new Setting(...).addTextArea(...)`. |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| JS `scrollHeight` auto-grow for NODEUI-04 | CSS `field-sizing: content` | Pure-CSS, simpler code. Ships in Chromium 123+ (March 2024). Obsidian 1.12 uses Electron 39 / Chromium 139+ ([CITED: forum.obsidian.md + electronjs.org timelines]), so supported at runtime. BUT: manifest.json `minAppVersion: 1.5.7` would allow older Obsidian builds (pre-Chromium-123) to load the plugin. **Reject** — keep JS pattern for safety parity with runner-view.ts. |
| DOM-reorder + `margin-top: auto` for NODEUI-05 | `position: sticky; bottom: 0` on toolbar | Sticky avoids DOM re-order but paints oddly when `.rp-editor-form` scrolls past. Since `.rp-editor-panel` is already `display: flex; flex-direction: column`, `margin-top: auto` is one line + DOM re-order is 2 lines. Cleaner. |
| Stripping `radiprotocol_snippetId` on save (aggressive NODEUI-01) | Conservative read — UI removal only | Aggressive path breaks `snippet-block.canvas` fixture + `protocol-runner.test.ts:187` assertions. **Reject**. |

**Installation:** None. All changes use existing dependencies.

**Version verification:**
- `obsidian@1.12.3` — [VERIFIED: package.json line 33, 2026-04-19]
- `vitest@^4.1.2` — [VERIFIED: package.json line 31]
- Chrome `field-sizing: content` — [VERIFIED: caniuse.com + developer.chrome.com/docs/css-ui/css-field-sizing, shipped Chrome 123 / March 2024]
- Electron 39 bundled with Obsidian 1.12 — [CITED: Obsidian Forum upgrade threads + obsidian.md/changelog entry March 2026]

---

## Architecture Patterns

### System Data Flow (Phase 48 touch points)

```
User selects text-block node on canvas
    → canvasPointerdownHandler (editor-panel-view.ts:81-99)
        → setTimeout(0) → handleNodeClick(filePath, nodeId)
            → renderNodeForm → renderForm → buildKindForm(kind='text-block')
                ↓
            NODEUI-01 change site (lines 464-504)
            — delete the "Snippet ID (optional)" Setting block —
                ↓
        User types in a form field
            → pendingEdits[key] = value
            → scheduleAutoSave() [800ms debounce]
                → saveNodeEdits() → canvasLiveEditor.saveLive() OR vault.modify()

User clicks "Create question node" in the toolbar
    → onQuickCreate('question') (lines 694-733)
        → canvasNodeFactory.createNode(canvasPath, kind, currentNodeId as anchor)
            ↓
        NODEUI-02 change site (canvas-node-factory.ts:52)
        — flip offset from (dx, 0) to (0, dy) —
            ↓
        canvas.createTextNode({ pos, text:'', size:{250,60} })
            → setData({ ...nodeData, radiprotocol_nodeType, color })
            → canvas.requestSave()
        → renderForm(newNodeData, kind)
```

### Recommended Project Structure

No new files. Changes land in these existing files only:

```
src/
├── canvas/
│   └── canvas-node-factory.ts   # NODEUI-02 — one-line offset flip
├── views/
│   └── editor-panel-view.ts     # NODEUI-01/03/04/05 — form + toolbar
├── styles/
│   └── editor-panel.css         # NODEUI-04/05 — append Phase 48 CSS blocks
└── __tests__/
    ├── canvas-node-factory.test.ts   # flip Test 5 assertion
    ├── editor-panel.test.ts          # may add NODEUI-01 negative-assertion test
    └── editor-panel-create.test.ts   # may add NODEUI-02 coordinate test
```

### Pattern 1: Auto-growing textarea via scrollHeight

**What:** Set `textarea.style.height = 'auto'` then `= scrollHeight + 'px'` on mount (inside rAF) and on each `input` event.
**When to use:** Any multiline input where content length is open-ended.
**Example (verbatim copy of the proven pattern):**

```typescript
// Source: src/views/runner-view.ts:822-840 (Phase 12 LAYOUT-01, re-verified Phase 47)
const textarea = container.createEl('textarea', { cls: 'rp-question-textarea' });
textarea.value = initialText;
textarea.style.width = '100%';
requestAnimationFrame(() => {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
});
this.registerDomEvent(textarea, 'input', () => {
  textarea.style.height = 'auto';
  textarea.style.height = textarea.scrollHeight + 'px';
});
```

### Pattern 2: Label-above-control custom block (side-stepping Setting API)

**What:** When Obsidian's `Setting` layout (label LEFT, control RIGHT) is inadequate — emit a plain `<div class="rp-label">` + `<p class="rp-desc">` + control.
**When to use:** NODEUI-04. Can also be a precedent for future wide-textarea forms.
**Example:**

```typescript
// Proposed NODEUI-04 pattern
const qBlock = container.createDiv({ cls: 'rp-question-block' });
qBlock.createDiv({ cls: 'rp-field-label', text: 'Question text' });
qBlock.createEl('p', {
  cls: 'rp-field-desc',
  text: 'Displayed to the user during the protocol session.',
});
const ta = qBlock.createEl('textarea', { cls: 'rp-question-textarea' });
ta.value = (nodeRecord['radiprotocol_questionText'] as string | undefined)
  ?? (nodeRecord['text'] as string | undefined) ?? '';
// auto-grow via Pattern 1
requestAnimationFrame(() => {
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
});
this.registerDomEvent(ta, 'input', () => {
  ta.style.height = 'auto';
  ta.style.height = ta.scrollHeight + 'px';
  this.pendingEdits['radiprotocol_questionText'] = ta.value;
  this.pendingEdits['text'] = ta.value;
  this.scheduleAutoSave();
});
```

### Pattern 3: Bottom-anchored toolbar inside flex-column panel

**CSS:**

```css
/* Phase 48 NODEUI-05: anchor toolbar at bottom of panel, vertical column */
.rp-editor-create-toolbar {
  flex-direction: column;
  margin-top: auto;
  width: 100%;
  border-bottom: none;
  border-top: 1px solid var(--background-modifier-border);
  padding-top: var(--size-4-2);
}
.rp-editor-create-toolbar > button {
  width: 100%;
  justify-content: center;
}
```

**DOM (editor-panel-view.ts):** move `this.renderToolbar(this.contentEl)` call from line 144 (in `renderIdle`) and line 329 (in `renderForm`) to AFTER the form body, so tab-order and visual order both put the toolbar at the bottom.

### Anti-Patterns to Avoid

- **Silent deletion of CSS rules added by earlier phases.** Per CLAUDE.md + STATE.md Standing Pitfall #7. Append Phase 48 CSS at the bottom of `editor-panel.css` with a `/* Phase 48: ... */` marker. Override prior rules by CSS specificity, not by deletion. The one exception is `.rp-editor-create-toolbar { flex-direction: row; flex-wrap: wrap }` — those two declarations **must** be overridden by the new rule or Phase 48 can't deliver its success criterion. Override by appending a new `.rp-editor-create-toolbar { flex-direction: column; flex-wrap: nowrap; }` block AFTER the existing one — CSS cascade handles the rest; the old rule stays in the file.
- **Editing `styles.css` directly.** It is generated. `npm run build` regenerates it from `src/styles/*.css`.
- **Writing `radiprotocol_snippetId` back to the canvas while still removing the form field.** Would leave the save path schizophrenic. Stop *only* when removing the form field; existing disk values stay.
- **Blindly reordering `new Setting()` blocks in the Answer form without preserving the Separator dropdown.** The Answer form has THREE `Setting` rows (Answer text, Display label, Text separator — in that order today). NODEUI-03 only asks for Display label ABOVE Answer text; Text separator should stay where it is (third).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Textarea auto-grow | A new helper class or a MutationObserver-based resize manager | The copy-paste `scrollHeight` pattern from runner-view.ts:822-840 | Proven in Phase 12 + Phase 47; 8 lines total; tests exist in RunnerView.test.ts lines 160-210 |
| Bottom-anchoring toolbar | `position: sticky` + manual scroll math | `margin-top: auto` in an existing flex-column parent | `.rp-editor-panel` is already `display: flex; flex-direction: column`; auto-margin is the idiomatic solution |
| Custom label+textarea layout system | A `FormField` abstraction or a custom class system | Emit three DOM nodes directly (label div + desc p + textarea) | Only one form field needs it; a new abstraction would be YAGNI |
| Canvas offset computation | A collision-avoidance solver | The existing anchor-relative offset (NODE_GAP = 40) | Obsidian canvas already handles overlaps by stacking z; user can drag if needed. No prior phase has requested collision avoidance. |

**Key insight:** Every NODEUI-* requirement has a pattern already present in the codebase. Phase 48 is pure composition of existing idioms — no new abstractions, no new dependencies.

---

## Common Pitfalls

### Pitfall 1: Deleting parser / runner / session logic that reads `radiprotocol_snippetId`
**What goes wrong:** An executor over-interprets "remove the Snippet ID field" and deletes the parser code at `canvas-parser.ts:221-223`, the runner branch at `protocol-runner.ts:545-550`, or the `snippetId?: string` field on `TextBlockNode` (`graph-model.ts:48`).
**Why it happens:** The requirement text says "underlying `radiprotocol_snippetId` property on Text blocks is either ignored or removed on save" — "removed on save" is ambiguous. And an over-eager "cleanup" pass looks like a good refactor.
**How to avoid:** Phase 48's scope is **UI removal only**. The canvas-parser, protocol-runner, and session-model all support an existing v1.0 feature (SNIP-06 in v1.0 REQUIREMENTS) that still ships in current builds. `src/__tests__/fixtures/snippet-block.canvas` + `protocol-runner.test.ts:187` encode this as a passing invariant. Any deletion there will fail CI. The plan should explicitly list these files as **DO NOT TOUCH**.
**Warning signs:** `npm test` fails on `protocol-runner.test.ts` — "transitions to awaiting-snippet-fill when reaching a text-block with snippetId" or `session-service.test.ts:39` snapshot mismatch.

### Pitfall 2: Breaking the in-memory fallback in `renderNodeForm`
**What goes wrong:** An executor touches `renderNodeForm` while "cleaning up" and breaks the Phase 42 fallback (lines 308–316) that pulls node data from live canvas when the disk JSON hasn't flushed yet.
**Why it happens:** `renderNodeForm` is where form re-renders get triggered after NODEUI-04 textarea edits; easy to interleave edits there.
**How to avoid:** Phase 48 has no reason to touch `renderNodeForm`. The NODEUI-04 change is inside `buildKindForm(case 'question')`. The plan should NOT edit `renderNodeForm`. If a test starts failing on `dcc-node-1` in-memory fallback (editor-panel-create.test.ts lines 369-390), it's a signal that untouched code was touched.
**Warning signs:** `editor-panel-create.test.ts` — "renderNodeForm uses in-memory canvas data when disk JSON lacks the node" fails.

### Pitfall 3: Double-click-creates-node regression on canvas listener
**What goes wrong:** The Phase 42 Plan 03 fix (`setTimeout(0)` + `dblclick` registration at lines 81-116) is easy to damage — a change to `attachCanvasListener` or `handleNodeClick` can undo the 4-month-old fix.
**Why it happens:** NODEUI-05 requires re-calling `renderToolbar` at a different position in `renderIdle`/`renderForm`. Edits near those methods are nearby in the file.
**How to avoid:** The plan should explicitly list `attachCanvasListener`, `canvasPointerdownHandler`, and `handleNodeClick` as DO NOT TOUCH. Unit tests at `editor-panel-create.test.ts:482-626` cover this regression — keep them green.
**Warning signs:** "deferred selection read invokes handleNodeClick when node appears after setTimeout(0)" fails.

### Pitfall 4: Obsidian `Setting` API styling vs custom DOM
**What goes wrong:** NODEUI-04 replaces a `Setting`-wrapped textarea with a custom DOM block, but the surrounding rows are still `Setting`. Visually, the custom block may look mis-aligned (different padding / border / margin than Obsidian's `.setting-item` boxes).
**Why it happens:** Obsidian applies `.setting-item` styling at an Obsidian-theme level; custom DOM inherits nothing by default.
**How to avoid:** Add Phase 48 CSS for `.rp-question-block` that mirrors `.setting-item` spacing — specifically `padding: var(--size-4-2) 0; border-top: 1px solid var(--background-modifier-border);` — or preferably use a dedicated class that aligns visually without cloning Obsidian's look (project's house style is minimalist — reference the existing `.rp-editor-type-hint` + `.rp-editor-start-note` rules at lines 40-45, 123-130 of editor-panel.css).
**Warning signs:** Visual review by user during UAT — "the Question field looks different from the others" would be the signal.

### Pitfall 5: `flex-wrap: wrap` still applies after NODEUI-05 change
**What goes wrong:** The append-only CSS rule at `editor-panel.css:165-168` sets `.rp-editor-create-toolbar { flex-wrap: wrap; row-gap: var(--size-4-1); }`. The Phase 48 NODEUI-05 new rule must explicitly set `flex-wrap: nowrap` or the old rule wins on some browsers (shouldn't, because later rules override, but explicit is safer than implicit on a feature CSS file).
**Why it happens:** CSS cascade is well-defined but CLAUDE.md rules forbid modifying earlier Phase blocks.
**How to avoid:** New Phase 48 block: `.rp-editor-create-toolbar { flex-direction: column; flex-wrap: nowrap; /* ... */ }`. Both declarations explicitly.
**Warning signs:** In narrow sidebar mode, buttons still wrap onto a new row instead of stacking vertically.

### Pitfall 6: Toolbar appearing twice (in both renderIdle and renderForm)
**What goes wrong:** NODEUI-05 re-positions the toolbar. Both `renderIdle` (line 144) and `renderForm` (line 329) call `renderToolbar(this.contentEl)` at the top. If an executor moves one call but not the other, the layout becomes inconsistent between "no node selected" vs "node loaded" states.
**Why it happens:** Two call sites, same change needed in both.
**How to avoid:** Plan should explicitly list both call sites. An integration test that exercises both render paths would catch this, but no such test exists today — rely on code review.
**Warning signs:** User clicks idle → opens a node → sees buttons in a different position.

---

## Runtime State Inventory

Not applicable — Phase 48 is a UI-only phase. No rename, no migration, no data reshape.

- **Stored data:** None. `radiprotocol_snippetId` on existing canvases is **intentionally preserved** on disk (conservative NODEUI-01 reading). Nothing to migrate.
- **Live service config:** None. No external services.
- **OS-registered state:** None.
- **Secrets/env vars:** None.
- **Build artifacts:** `styles.css` (generated at plugin root) + `src/styles.css` (convenience copy) both regenerated by `npm run build` after CSS edits. Nothing stale after Phase 48; just run the build.

**Nothing found in category:** Verified by reading REQUIREMENTS.md success criteria and the five TODO files — no migration or runtime-state implications.

---

## Environment Availability

Phase 48 has no external dependencies beyond the existing toolchain.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | esbuild build pipeline | ✓ (assumed — project already shipping) | ≥18 | — |
| npm (package installer + test runner) | `npm test`, `npm run build` | ✓ | — | — |
| `obsidian` npm package | TypeScript type-checking | ✓ | 1.12.3 (package.json:33) | — |
| `vitest` | Test runner | ✓ | ^4.1.2 | — |
| Obsidian desktop app (for UAT) | NODEUI-04 / NODEUI-05 visual verification | ✓ (TEST-BASE vault exists per Phase 47 UAT) | ≥1.5.7 per manifest | Run unit tests; request human UAT only for visual criteria |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None — all required tools are already in use for Phase 47.

---

## Validation Architecture

`workflow.nyquist_validation` is **enabled** per `.planning/config.json:19`. This section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.2 |
| Config file | None at project root — vitest uses default discovery; `vi.mock('obsidian')` pattern relies on `src/__mocks__/obsidian.ts` |
| Quick run command | `npm test -- src/__tests__/editor-panel.test.ts src/__tests__/editor-panel-create.test.ts src/__tests__/editor-panel-loop-form.test.ts src/__tests__/canvas-node-factory.test.ts` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| NODEUI-01 | Text block form no longer emits a `Setting` row with name "Snippet ID (optional)" | unit | `npm test -- src/__tests__/editor-panel.test.ts -t "text-block"` (needs new test) | ❌ Wave 0 — add negative-assertion test that `settingCalls.setName` in text-block form does not contain "Snippet ID (optional)" (use `editor-panel-loop-form.test.ts` SettingProto mock pattern) |
| NODEUI-01 | Save path does not write `radiprotocol_snippetId` (textarea onChange never sets that key) | unit | same file | ❌ Wave 0 — add test capturing `pendingEdits` keys after simulating text-block form lifecycle |
| NODEUI-01 (legacy invariant) | Existing canvases with `radiprotocol_snippetId` still load + runner still transitions to awaiting-snippet-fill | unit (regression) | `npm test -- src/__tests__/runner/protocol-runner.test.ts -t "awaiting-snippet-fill"` | ✅ exists (line 187) — MUST stay green |
| NODEUI-02 | `CanvasNodeFactory.createNode` with anchor offsets new node to `(anchor.x, anchor.y + anchor.height + NODE_GAP)` | unit | `npm test -- src/__tests__/canvas-node-factory.test.ts -t "Test 5"` | ✅ exists (line 144-161) — must FLIP assertion from `{ x: 100+300+40, y: 200 }` to `{ x: 100, y: 200+80+40 }` |
| NODEUI-03 | Answer form calls `setName('Display label (optional)')` BEFORE `setName('Answer text')` | unit | `npm test -- src/__tests__/editor-panel.test.ts -t "answer"` (needs new test) | ❌ Wave 0 — capture `settingCalls.setName` order during answer-form render; assert index("Display label (optional)") < index("Answer text") |
| NODEUI-04 | Question form emits a `<textarea class="rp-question-textarea">` NOT wrapped in `.setting-item` | unit | `npm test -- src/__tests__/editor-panel.test.ts -t "question"` (needs new test) | ❌ Wave 0 — spy on `createEl('textarea', {cls: 'rp-question-textarea'})` via fakeNode pattern at lines 412-429 of editor-panel-create.test.ts |
| NODEUI-04 | Textarea input event sets `element.style.height = scrollHeight + 'px'` | unit | same file | ❌ Wave 0 — simulate `input` event on captured textarea; assert `style.height` was written. Requires a fake textarea with settable `style.height` + readable `scrollHeight`. |
| NODEUI-04 | Label + helper text render as sibling DOM nodes BEFORE the textarea (not inside `.setting-item-info`) | unit + manual UAT | same file + visual | ❌ Wave 0 unit + manual UAT in TEST-BASE vault — auto-grow visual verification matches Phase 12/19 precedent (`manual-only` for the visual) |
| NODEUI-05 | `.rp-editor-create-toolbar` CSS contains `flex-direction: column` + `margin-top: auto` | unit (CSS parse) | `npm test -- src/__tests__/editor-panel.test.ts -t "toolbar anchor"` (needs new test) OR grep-based assertion | ❌ Wave 0 — simpler: add a build-time check reading `styles.css` for the phrase, OR write a unit test that parses `src/styles/editor-panel.css` and asserts the rule exists. Manual UAT covers the visual. |
| NODEUI-05 | `renderToolbar` is invoked AFTER the form body in both `renderIdle` and `renderForm` (DOM order) | unit | same file | ❌ Wave 0 — capture `createDiv`/`renderToolbar` call order during renderForm; assert toolbar is last child of `contentEl`. |
| NODEUI-05 (regression) | Existing quick-create button tests still pass | unit | `npm test -- src/__tests__/editor-panel-create.test.ts` | ✅ exists (all 7 tests in first `describe` block) |

### Sampling Rate

- **Per task commit:** `npm test -- src/__tests__/editor-panel.test.ts src/__tests__/editor-panel-create.test.ts src/__tests__/editor-panel-loop-form.test.ts src/__tests__/canvas-node-factory.test.ts` (~4 test files, fast)
- **Per wave merge:** `npm test` (full suite, 428+ tests currently green per STATE.md)
- **Phase gate:** Full suite green + manual UAT in TEST-BASE vault covering all five NODEUI-* visual criteria before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] Add negative-assertion for NODEUI-01 to `src/__tests__/editor-panel.test.ts` (or new file `editor-panel-forms.test.ts`): text-block form does NOT render "Snippet ID (optional)".
- [ ] Add order-assertion for NODEUI-03 in same file: answer form Setting names ordered Display label → Answer text.
- [ ] Add custom-DOM assertion for NODEUI-04: question form emits `textarea.rp-question-textarea` NOT inside `.setting-item`.
- [ ] Add input-event auto-grow test for NODEUI-04: simulated input triggers `style.height = scrollHeight + 'px'` write.
- [ ] Add DOM-order assertion for NODEUI-05: `.rp-editor-create-toolbar` is the last child of `contentEl` after `renderForm`.
- [ ] Flip assertion in `src/__tests__/canvas-node-factory.test.ts` Test 5 (line 155-160): expected `pos: { x: 100, y: 200 + 80 + 40 }`.

**Framework install:** Not needed — vitest already installed.

**Reuse pattern:** The Setting-prototype mock + `settingCalls.setName / setDesc` capture pattern at `editor-panel-loop-form.test.ts:52-90` is the cleanest harness for NODEUI-01 / NODEUI-03 assertions. For NODEUI-04 + NODEUI-05 DOM-order tests, use the `fakeNode()` recursive stub at `editor-panel-create.test.ts:412-429` which already records `createEl` / `createDiv` calls.

---

## Security Domain

`security_enforcement` not present in `.planning/config.json` — treat as default. Phase 48 is a client-side UI polish with zero auth / crypto / network / data-validation surface.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | minimal | Phase 48 does not add new inputs; existing Question/Answer/Text-block inputs already rely on Obsidian's canvas JSON shape. No new validation surface. |
| V6 Cryptography | no | — |

### Known Threat Patterns for stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via `innerHTML` on user-supplied text | Tampering | Standing Pitfall #3 (STATE.md) — use `createEl` / `setText` / Obsidian DOM helpers; never `innerHTML`. Phase 48 code follows existing patterns. |
| Data loss on auto-save race | Denial-of-service (data) | Existing D-02 flush pattern (editor-panel-view.ts:122-134) captures pendingEdits snapshot before node switch. Phase 48 does not touch this logic. |

No new threats introduced by NODEUI-01..05.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Textarea manual resize (default browser) | Auto-grow via `scrollHeight` JS pattern | Phase 12 (v1.2, LAYOUT-01) | Standard approach inside this project; NODEUI-04 must reuse it. |
| Textarea auto-grow via CSS | `field-sizing: content` | Chrome 123 / March 2024 | Available in Obsidian 1.12 runtime but **not adopted** in this codebase; staying with JS pattern for version-safety. |
| Quick-create right-of-anchor | Quick-create below-anchor | Phase 48 (this) | NODEUI-02 — only delta from Phase 38 original design. |

**Deprecated/outdated:** None relevant to Phase 48.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Conservative NODEUI-01 reading (UI removal only, parser/runner/fixture untouched) is the user's intent | User Constraints → Deferred / Discretion | LOW — ROADMAP success criterion 1 says "ignored (or removed) if present on existing canvases", and "ignored" is the strictly-safer reading. If user wants aggressive cleanup, discuss-phase can unlock it in a follow-up. Signal of mistake: user complains "Snippet ID still shows up as a ghost property on old canvases." |
| A2 | The Duplicate button (`rp-duplicate-btn`) should join the vertical stack alongside the four create buttons | User Constraints → Claude's Discretion | LOW — visual consistency argument. If rejected, the Duplicate button gets its own row or is kept separate in a different toolbar. Signal: UAT feedback. |
| A3 | Answer form's "Text separator" dropdown (third Setting block) keeps its current third position | Pitfalls 2 + Requirements table | LOW — NODEUI-03 only mandates Display label above Answer text; separator position is not specified. Keeping it third is the minimal-change path. |
| A4 | `field-sizing: content` works in all Obsidian builds ≥1.5.7 | Standard Stack → Alternatives | LOW — we're **not** adopting it; the JS pattern is used instead. Documented for completeness only. |
| A5 | The `/* Phase 42 Plan 04: responsive toolbar */` override block at editor-panel.css:164-168 is safe to **shadow** with a Phase 48 override (both rules remain in the file; Phase 48 wins by cascade order) | Anti-Patterns + Pitfall 5 | LOW — CSS cascade guarantees order of identical-specificity rules; last wins. Keeps CLAUDE.md append-only rule satisfied. |

**If this table is empty:** N/A — five assumptions documented above; none block plan creation.

---

## Open Questions

1. **Should Duplicate button be in the bottom stack?**
   - What we know: NODEUI-05 mentions four create buttons only. Duplicate is Phase 40 code living in the same toolbar.
   - What's unclear: user preference for five-in-a-column vs. separate toolbars.
   - Recommendation: include in the stack; flag as A2 assumption; confirm at code-review or UAT if ambiguity surfaces.

2. **NODEUI-04: should the textarea get a min-height?**
   - What we know: runner-view.ts's auto-grow textarea has `min-height: 80px` per Phase 12 precedent.
   - What's unclear: whether a min-height is aesthetically right for an empty Question field.
   - Recommendation: use `min-height: 80px` (same as runner) for consistency. Fine-tune during UAT.

3. **Should we add tests for NODEUI-05's CSS (as opposed to just unit-testing the DOM order)?**
   - What we know: vitest does not parse CSS by default. We can read the file as text and assert substring presence.
   - What's unclear: whether a build-time grep check is preferred over a vitest-level test.
   - Recommendation: cheapest path — a vitest test that `fs.readFileSync('src/styles/editor-panel.css','utf8')` and asserts `.includes('flex-direction: column')` near the Phase 48 marker. Planner to decide.

---

## Project Constraints (from CLAUDE.md)

- **CSS source lives in `src/styles/`** — per-feature files, concatenated in the order declared in `esbuild.config.mjs:31-38`. `styles.css` at project root is **generated**; never edit directly.
- **Editing shared files (`src/views/editor-panel-view.ts`, `src/main.ts`, `src/styles/*.css`):** "ONLY add or modify code relevant to the current phase. NEVER delete rules, functions, or event listeners that you did not add in this phase." Phase 48 must respect this verbatim.
- **CSS append-only per phase:** "Add new rules at the bottom of that file with a phase comment: `/* Phase N: description */`. Never rewrite existing sections." — Phase 48 CSS goes at the bottom of `src/styles/editor-panel.css` with a `/* Phase 48: NODEUI-XX */` marker.
- **After any CSS change:** `npm run build` (regenerates `styles.css` + `src/styles.css`). Never commit direct edits to `styles.css`.
- **Unique exception for Phase 48:** NODEUI-01 requires *deleting* a `Setting` block the project added in Phase 5 (inside `case 'text-block':`). This is **in scope** by explicit success-criterion wording. The broader "never delete" rule is about **unrelated** code — the Snippet ID input is the exact code the phase is targeted to remove. Plan should call this out so the rule is not mis-applied.
- **Tests:** `npm test` (vitest). Full suite currently 428+ passed per STATE.md; Phase 48 target: keep all green + add Wave 0 tests.
- **Commit discipline (implied):** scoped commits per plan, matching Phase 47 pattern (`feat(48-01): ...`, `fix(48-01): ...`).

---

## Sources

### Primary (HIGH confidence)

- `src/views/editor-panel-view.ts` (881 lines) — full read; all NODEUI-* change sites identified by exact line numbers.
- `src/canvas/canvas-node-factory.ts` (115 lines) — full read; NODEUI-02 change is a single line (line 52).
- `src/styles/editor-panel.css` (199 lines) — full read; toolbar CSS rules identified at lines 47-57, 164-168; all prior Phase blocks marked.
- `src/__tests__/editor-panel.test.ts`, `src/__tests__/editor-panel-create.test.ts`, `src/__tests__/editor-panel-loop-form.test.ts`, `src/__tests__/canvas-node-factory.test.ts` — test harness patterns identified for Wave 0 additions.
- `src/views/runner-view.ts:816-840` — auto-grow pattern to copy for NODEUI-04.
- `src/graph/canvas-parser.ts:216-229` — legacy `radiprotocol_snippetId` ingestion path (DO NOT TOUCH).
- `src/runner/protocol-runner.ts:544-551` — legacy runner branch for text-block + snippetId (DO NOT TOUCH).
- `src/__tests__/fixtures/snippet-block.canvas` + `protocol-runner.test.ts:187-195` — invariant that NODEUI-01 must preserve.
- `.planning/REQUIREMENTS.md:27-48` — NODEUI-01..05 signals.
- `.planning/ROADMAP.md:214-226` — Phase 48 success criteria.
- `.planning/STATE.md` — Standing Pitfalls + Phase 47 execution log (auto-grow + append-only CSS precedent).
- `.planning/todos/pending/{remove-snippet-id-from-text-block,question-textarea-autogrow,new-nodes-placed-below-last,swap-answer-fields-order,node-editor-create-buttons-bottom-stack}.md` — original user requests.
- `CLAUDE.md` — project-wide editing rules.
- `package.json:33` — obsidian@1.12.3 version verification.
- `esbuild.config.mjs:31-38` — CSS concat order.

### Secondary (MEDIUM confidence)

- [developer.chrome.com — CSS field-sizing](https://developer.chrome.com/docs/css-ui/css-field-sizing) — shipped Chrome 123 (March 2024)
- [caniuse.com — field-sizing: content](https://caniuse.com/mdn-css_properties_field-sizing_content) — browser support table
- [electronjs.org — Electron Release Timelines](https://www.electronjs.org/docs/latest/tutorial/electron-timelines) — Electron 39 → Chromium 139
- [obsidian.md/changelog](https://obsidian.md/changelog/) — Obsidian 1.12.x uses Electron 39

### Tertiary (LOW confidence)

- None — all Phase 48 claims are either verified in the codebase or cited from authoritative web sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies already pinned; no new libraries.
- Architecture: HIGH — five change sites identified by line number in already-audited files.
- Pitfalls: HIGH — three of six pitfalls are codified as passing tests today; tests must stay green.
- NODEUI-01 conservative reading: MEDIUM-HIGH — ROADMAP wording is slightly ambiguous ("ignored or removed"), but tests + STATE.md Pitfall #11 make the conservative path unambiguous.
- NODEUI-04 auto-grow mechanism: HIGH — exact pattern is already shipped in runner-view.ts:822-840 and verified by Phase 12/19 tests.

**Research date:** 2026-04-19
**Valid until:** 2026-05-19 (30 days — stable; no external dependencies to go stale)
