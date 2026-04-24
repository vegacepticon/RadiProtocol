# Phase 59: Inline Runner Feature Parity - Research

**Researched:** 2026-04-24
**Domain:** Obsidian plugin — TypeScript — floating-modal Runner parity with sidebar Runner
**Confidence:** HIGH (code paths mapped; two of three root causes pinpointed; one requires live reproduction)

## Summary

Phase 59 closes three correctness-class parity gaps between the v1.8 `InlineRunnerModal` and the established sidebar `RunnerView`. The inline runner is a parallel class — it has its own `ProtocolRunner` instance, its own DOM, and its own snippet/fill-in dispatch — so divergence between the two is likely and was confirmed by v1.8 UAT-production usage.

- **INLINE-FIX-04 (separator)** has a pinpoint-able root cause: the inline runner's snippet dispatch paths (`handleSnippetPickerSelection`, `handleSnippetFill`, `renderSnippetFillIn`) call `appendAnswerToNote(snippet.content | snippet.template | rendered)` — passing the RAW snippet text to the note-append sink. This bypasses the separator that `runner.completeSnippet()` just prepended to the accumulator. The sidebar has no such bug because the sidebar's sink IS the accumulator-backed textarea (separator already applied). The fix is to mirror the `handleAnswerClick` pattern (lines 555-576) for snippet paths: diff `beforeText`/`afterText` from the accumulator post-`completeSnippet` and append the delta.
- **INLINE-FIX-05 (SnippetFillInModal)** is architectural — Phase 54 D6 locked an in-panel inline fill-in form (`renderSnippetFillIn` at line 891) that diverges materially from `SnippetFillInModal` (phase 52): no live preview, no Custom-override field on choice, no tab-order guarantees, no `separator` between selected choice options (uses `textSeparator` enum instead of `placeholder.separator`). Phase 59 reverses D6 by instantiating `SnippetFillInModal` from inline mode, same as the sidebar does at runner-view.ts:908/997. Obsidian's Modal class auto-stacks with `--layer-modal` z-index, and `.rp-inline-runner-container` also uses `--layer-modal` — so the Modal will render ABOVE the inline container only if CSS stacking-context rules cooperate. Z-index validation and focus-trap interaction are the primary risk.
- **INLINE-FIX-01 (nested protocol folder path)** has a code path that LOOKS correct on inspection (`handleRunProtocolInline` recursively collects `.canvas` files via `TFolder.children` — identical algorithm to `CanvasSelectorWidget.renderPopoverContent`). User-reported bug is confirmed real (PROJECT.md:17) but the exact trigger requires live reproduction. Likely causes (in decreasing probability): (a) trailing-slash or leading-slash in the stored setting bypasses `getAbstractFileByPath`; (b) Windows path separator `\` sneaking into the setting; (c) Obsidian vault-index timing on plugin boot. Research recommends: add `.replace(/^\/+|\/+$/g, '').replace(/\\/g, '/')` normalization + fallback to `vault.getFiles()` filter when `getAbstractFileByPath` returns null.

**Primary recommendation:** All three fixes can be waved in parallel — they touch disjoint code regions of `InlineRunnerModal` (path resolution in `main.ts:handleRunProtocolInline`, snippet-dispatch in `inline-runner-modal.ts:800-985`, and one flag-flip to stop calling `renderSnippetFillIn`). Wave 0 establishes test scaffolding; Waves 1a/1b/1c land the fixes; Wave 2 regression-tests against Phase 54 invariants.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Nested protocol-folder enumeration | Plugin main (Node/Obsidian API layer) | Inline modal | `handleRunProtocolInline` in `main.ts` owns `TFolder` traversal; modal only receives a canvas path |
| Snippet separator application | ProtocolRunner (pure module) | Inline modal | Runner.completeSnippet already applies separator to accumulator; modal just needs to read the delta, not re-apply |
| JSON fill-in modal UI | Obsidian Modal subclass | Inline modal (launcher only) | Reuse `SnippetFillInModal` from sidebar; inline is the caller, not the renderer |
| Note append sink | Inline modal (only) | WriteMutex (plugin-owned) | Inline's unique concern — sidebar uses textarea. Append path stays in inline, mutex is shared |
| Active-note / freeze-resume semantics | Inline modal (Phase 54 invariant) | — | Out of scope for Phase 59 — must remain unchanged |

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| INLINE-FIX-01 | Inline Runner correctly resolves multi-segment Protocols folder paths | `main.ts:handleRunProtocolInline` (lines 421-487) already recursive — fix = path normalization + fallback scan via `vault.getFiles()` |
| INLINE-FIX-04 | Inline Runner applies configured separator when inserting snippet | Change snippet-dispatch in `inline-runner-modal.ts` to mirror `handleAnswerClick` diff pattern (lines 555-576); use `extractAccumulatedText` before/after `runner.completeSnippet` |
| INLINE-FIX-05 | Inline Runner opens `SnippetFillInModal` for JSON snippets with placeholders | Delete `renderSnippetFillIn` path (lines 891-973) + `awaiting-snippet-fill` in-panel branch; instantiate `SnippetFillInModal` the same way `RunnerView.handleSnippetFill` does (runner-view.ts:997); verify z-index stacking with inline container |

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| obsidian | 1.12.3 | Plugin API (`App`, `TFolder`, `TFile`, `Modal`, `SuggestModal`, `Notice`) | Project dep `[VERIFIED: package.json:34]` |
| typescript | 6.0.2 | Source language | Project dep `[VERIFIED: package.json:27]` |
| vitest | ^4.1.2 | Test runner | Project `npm test` script `[VERIFIED: package.json:11]` |
| async-mutex | ^0.5.0 | `WriteMutex` (already wraps `appendAnswerToNote`) | Existing pitfall 2 — must keep inline append mutex-wrapped `[VERIFIED: src/main.ts:29, src/views/inline-runner-modal.ts:586]` |

### Supporting (in-repo modules)

| Module | Path | Purpose |
|--------|------|---------|
| `ProtocolRunner` | `src/runner/protocol-runner.ts` | Owns `resolveSeparator` + `accumulator.appendWithSeparator` (lines 573-583, 28-32) |
| `TextAccumulator` | `src/runner/text-accumulator.ts` | `appendWithSeparator(text, 'newline' \| 'space')`; first chunk never gets a separator (line 20-32) |
| `SnippetFillInModal` | `src/views/snippet-fill-in-modal.ts` | Obsidian Modal subclass; `result: Promise<string \| null>` (line 32-46); used by sidebar at runner-view.ts:908,997 |
| `SnippetTreePicker` | `src/views/snippet-tree-picker.ts` | Directory-bound snippet picker (reused verbatim in inline — not touched by this phase) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Reuse `SnippetFillInModal` (Obsidian Modal, centered) | Keep `renderSnippetFillIn` inline form | Phase 54 D6 chose in-panel to keep focus anchored at fixed corner. Phase 59 reverses: user prefers full parity with sidebar; fixed corner didn't justify custom form. `[ASSUMED]` — discuss phase should confirm D6 reversal |
| Mirror `handleAnswerClick` diff pattern | Re-apply separator manually in `appendAnswerToNote` | Diff pattern is single source of truth (runner.accumulator). Manual re-application duplicates `resolveSeparator` and risks drift `[VERIFIED: inline-runner-modal.ts:555-576 pattern already works for answers]` |
| `vault.getFiles().filter(f => f.path.startsWith(folder) && f.extension==='canvas')` | `TFolder.children` recursion | getFiles is an O(N) full-vault scan — slower, but robust against any TFolder indexing quirk. Use as fallback when `getAbstractFileByPath` returns null/non-folder `[CITED: Obsidian API docs]` |

## Architecture Patterns

### System Architecture Diagram

```
Command palette "Run protocol in inline"
        │
        ▼
main.ts::handleRunProtocolInline()  ← INLINE-FIX-01 lives here
        │  (1) Check active .md note (D9 guard)
        │  (2) Resolve protocolFolderPath via getAbstractFileByPath
        │  (3) Recursively collect .canvas files from TFolder.children
        │  (4) Open SuggestModal picker
        │  (5) user picks → openInlineRunner(canvasFile, targetNote)
        ▼
new InlineRunnerModal(app, plugin, canvasPath, targetNote)
        │
        ▼
modal.open()
        │  - Parse canvas / validate / runner.start(graph)
        │  - Subscribe: active-leaf-change (D1), vault delete (D2)
        │  - updateModalPosition() — attach to active CM editor rect
        │
        ▼
render() — switch on runner.getState().status
        │
        ├─ at-node / question → answer buttons, snippet-branch buttons, skip
        │       │
        │       ├─ click answer  → handleAnswerClick
        │       │    runner.chooseAnswer → diff before/after → appendAnswerToNote(delta)  ✅ correct
        │       │
        │       └─ click snippet-branch (directory-bound) → chooseSnippetBranch → awaiting-snippet-pick
        │
        ├─ awaiting-snippet-pick → renderSnippetPicker
        │       │
        │       └─ SnippetTreePicker onSelect → handleSnippetPickerSelection
        │               ├─ runner.pickSnippet → status: awaiting-snippet-fill
        │               ├─ MD kind: runner.completeSnippet(content)   ← accumulator gets separator
        │               │            appendAnswerToNote(content)       ← BUG INLINE-FIX-04: RAW text, no separator
        │               ├─ JSON zero-placeholder: runner.completeSnippet(template)
        │               │                         appendAnswerToNote(template)  ← SAME BUG
        │               └─ JSON with placeholders: render() re-entered → awaiting-snippet-fill arm
        │
        └─ awaiting-snippet-fill → handleSnippetFill → renderSnippetFillIn  ← INLINE-FIX-05
                │                                       (in-panel form — divergent from SnippetFillInModal)
                │                                       on submit: runner.completeSnippet(rendered)
                │                                                  appendAnswerToNote(rendered)  ← SAME BUG
                │
                ▼ (fixed version)
                new SnippetFillInModal(app, snippet).open()
                modal.result → runner.completeSnippet(rendered)
                              diff accumulator → appendAnswerToNote(delta)
```

### Recommended Project Structure (unchanged — edits only)

```
src/
├── main.ts                            # handleRunProtocolInline — INLINE-FIX-01 edit site
├── views/
│   ├── inline-runner-modal.ts         # Snippet dispatch — INLINE-FIX-04 + INLINE-FIX-05 edit site
│   ├── snippet-fill-in-modal.ts       # Reused verbatim — DO NOT EDIT
│   └── runner-view.ts                 # Sidebar reference — DO NOT EDIT
├── runner/
│   ├── protocol-runner.ts             # resolveSeparator authority — DO NOT EDIT
│   └── text-accumulator.ts            # appendWithSeparator — DO NOT EDIT
├── styles/
│   └── inline-runner.css              # Phase 54 styles — leave alone; no edits required
└── __tests__/
    └── views/
        └── inline-runner-modal.test.ts  # NEW FILE — Wave 0 scaffolding (no tests exist yet)
```

### Pattern 1: Accumulator-diff for note append

**What:** Compute `beforeText` from the runner state, let the runner mutate, compute `afterText`, append the delta (which includes the separator the runner applied).

**When to use:** Every site in `InlineRunnerModal` that calls a runner method and then wants to sync the note.

**Example (already present in inline for answer path — 555-576):**

```typescript
// Source: src/views/inline-runner-modal.ts:555-576 (handleAnswerClick)
private async handleAnswerClick(answerNode: AnswerNode): Promise<void> {
  const stateBefore = this.runner.getState();
  const beforeText = this.extractAccumulatedText(stateBefore);

  this.runner.chooseAnswer(answerNode.id);

  const stateAfter = this.runner.getState();
  const afterText = this.extractAccumulatedText(stateAfter);

  if (afterText.length > beforeText.length) {
    if (!afterText.startsWith(beforeText)) {
      console.warn('[RadiProtocol] Text changed non-monotonically, skipping append');
      this.render();
      return;
    }
    const appendedText = afterText.slice(beforeText.length);
    await this.appendAnswerToNote(appendedText);  // delta with separator
  }
  this.render();
}
```

### Pattern 2: SnippetFillInModal invocation from sidebar (parity target)

```typescript
// Source: src/views/runner-view.ts:997-1007 (handleSnippetFill JSON-with-placeholders arm)
const modal = new SnippetFillInModal(this.app, snippet);
modal.open();
const rendered = await modal.result;
if (rendered !== null) {
  this.runner.completeSnippet(rendered);
} else {
  // D-11: Cancel = skip — advance runner with empty string
  this.runner.completeSnippet('');
}
// <sidebar: autoSaveSession + render; inline adds: accumulator diff + appendAnswerToNote(delta)>
```

### Pattern 3: Protocol folder path normalization (fix for INLINE-FIX-01)

```typescript
// Research-recommended fix for main.ts:handleRunProtocolInline
const folderPath = this.settings.protocolFolderPath
  .trim()
  .replace(/\\/g, '/')          // Windows path normalization
  .replace(/^\/+|\/+$/g, '');   // strip leading/trailing slashes

let folder = this.app.vault.getAbstractFileByPath(folderPath);
if (!(folder instanceof TFolder)) {
  // Fallback: scan all vault files for canvas files under the folder path prefix
  // Matches snippet-service pattern (adapter.list for nested paths)
  const allFiles = this.app.vault.getFiles();
  const canvasFiles = allFiles.filter(f =>
    f.extension === 'canvas' &&
    (f.path === folderPath || f.path.startsWith(folderPath + '/'))
  );
  if (canvasFiles.length === 0) {
    new Notice(`Protocol folder not found or contains no canvases: "${folderPath}".`);
    return;
  }
  // proceed with canvasFiles directly
  ...
}
```

### Anti-Patterns to Avoid

- **Re-applying separator manually in `appendAnswerToNote`:** the accumulator is already the single source of truth. Double-applying = duplicate separators. Use the diff pattern instead.
- **Deleting existing Phase 54 render arms during cleanup:** CLAUDE.md's shared-file rule is active. Only the `awaiting-snippet-fill` branch (line 411-419) and `renderSnippetFillIn` (lines 891-973) should be modified/deleted as part of INLINE-FIX-05. Leave `handleActiveLeafChange`, `handleTargetNoteDeleted`, `updateModalPosition`, etc., untouched.
- **Editing `styles.css` or `src/styles/snippet-fill-modal.css`:** CSS is generated; `SnippetFillInModal` already has working styles. No new CSS required for Phase 59.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Separator application | Per-site re-application in inline modal | `runner.completeSnippet()` + accumulator diff | Already implemented, tested, and correct in protocol-runner.ts |
| Fill-in UI (tab nav, live preview, Custom override, choice separator) | In-panel `renderSnippetFillIn` | `SnippetFillInModal` | 52 tests in `snippet-fill-in-modal.test.ts` cover the full contract — rebuilding inline = 52 tests to duplicate |
| Recursive folder walk | Custom `collectCanvases` | `vault.getFiles()` filter (fallback) | Obsidian-native, handles nested indexing |
| Modal stacking z-index | Custom z-index on inline modal | `--layer-modal` Obsidian CSS var (already used) | Obsidian assigns stacking contexts consistently; manipulating z-index per component causes ordering bugs |

**Key insight:** Phase 54 D6 (host fill-in inside inline modal) was a v1.8 decision driven by fixed-corner placement. Phase 60 will reposition the inline modal (draggable + persisted), so the "fixed corner" justification for D6 no longer applies in v1.9. Reversing to `SnippetFillInModal` aligns inline with sidebar and unlocks the Phase 60 work.

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no persistent data model changes | none |
| Live service config | None | none |
| OS-registered state | None | none |
| Secrets/env vars | None | none |
| Build artifacts | `styles.css` (generated) — will rebuild automatically; no CSS edits required for Phase 59 | `npm run build` after any CSS touch (none planned) |

## Common Pitfalls

### Pitfall 1: Double-separator on MD/zero-placeholder snippet insert

**What goes wrong:** Applying separator in both `completeSnippet` and `appendAnswerToNote`.
**Why it happens:** A naive fix for INLINE-FIX-04 might be "prepend separator inside `appendAnswerToNote`." Since `completeSnippet` already does this on the accumulator, doing it twice = two newlines.
**How to avoid:** Use the diff pattern — read the delta from the accumulator; that delta already includes the separator.
**Warning signs:** User sees `\n\n` before every snippet in the note output.

### Pitfall 2: Modal z-index collision with `rp-inline-runner-container`

**What goes wrong:** `SnippetFillInModal` opens but renders BEHIND the floating inline container.
**Why it happens:** `.rp-inline-runner-container` is declared `z-index: var(--layer-modal)` (inline-runner.css:12). Obsidian Modal uses the same `--layer-modal` token. Stacking depends on document order and creation order.
**How to avoid:** Obsidian appends Modal to `document.body` when `.open()` is called. Since the inline container is already on body, and later-appended siblings paint on top, the Modal SHOULD render above the inline container. BUT: if the inline container establishes a stacking context with `position: fixed` + `z-index`, the Modal still paints above because it's a sibling. Verify during implementation; if broken, temporarily lower the inline container's z-index to `var(--layer-modal) - 1` while the fill modal is open.
**Warning signs:** User clicks a JSON-with-placeholders snippet, expects a centered fill-in modal, sees the modal is hidden or clipped by the inline container.

### Pitfall 3: Inline modal freeze-on-note-switch (D1) closing the fill-in modal

**What goes wrong:** `handleActiveLeafChange` fires when `SnippetFillInModal` opens (Obsidian internally shifts focus); inline modal thinks the user switched notes and either hides or closes.
**Why it happens:** Opening a Modal may trigger workspace events. Phase 54 D1 hides inline when `workspace.getActiveFile()` is not the target note.
**How to avoid:** Check whether opening `SnippetFillInModal` triggers `active-leaf-change`. If yes, either:
- Gate the D1 handler: skip hide/show when `app.workspace.activeLeaf` is a modal leaf (no `TFile`).
- Capture a "fill-in-in-flight" flag and skip D1 transitions while the modal is awaiting.

**Warning signs:** User clicks snippet → fill modal opens → inline disappears → user submits modal → error or broken state.

### Pitfall 4: CLAUDE.md append-only rule violation in `inline-runner-modal.ts`

**What goes wrong:** Executor deletes existing Phase 54 methods while refactoring snippet dispatch.
**Why it happens:** The `renderSnippetFillIn` method is 82 lines (891-973); an executor unfamiliar with CLAUDE.md might aggressively simplify the file.
**How to avoid:** Explicit planner instructions to:
- Keep `handleActiveLeafChange`, `handleTargetNoteDeleted`, `updateModalPosition`, `resolveSeparator`, `handleLoopBranchClick`, `extractAccumulatedText`, `renderOutputToolbar`, `renderSnippetPicker`, `renderError` **unchanged**.
- Only the `awaiting-snippet-fill` arm (`render()` cases 411-419 + `handleSnippetFill` 833-888) and the snippet picker dispatch paths (800-830) may be modified.
- Delete `renderSnippetFillIn` (891-973) only after confirming no caller remains.

**Warning signs:** Diff includes unrelated line deletions; UAT finds unrelated features broken (step-back, loop-picker, close button).

### Pitfall 5: INLINE-FIX-01 "fix" that doesn't match reported bug

**What goes wrong:** Normalizing path + adding fallback still doesn't fix the user's reported failure.
**Why it happens:** Current code paths look correct under inspection; the real trigger is unknown until live reproduction.
**How to avoid:** The plan MUST include:
- A UAT step that reproduces the user's exact scenario: set `protocolFolderPath = "templates/ALGO"`, create a nested `.canvas`, run the inline command.
- If the normalization fix doesn't resolve it, instrument `handleRunProtocolInline` with `console.debug` for `folderPath`, `folder instanceof TFolder`, and `canvasFiles.length` to identify which guard trips.
**Warning signs:** Unit test passes with mocked TFolder, real Obsidian vault still shows "No protocol canvases found" notice.

## Code Examples

Verified patterns — references are in-repo.

### Example A: Fixed `handleSnippetPickerSelection` (INLINE-FIX-04)

```typescript
// Replaces inline-runner-modal.ts:800-830
private async handleSnippetPickerSelection(snippet: Snippet): Promise<void> {
  if (snippet.kind === 'json' && snippet.validationError !== null) {
    new Notice(`Snippet "${snippet.path}" cannot be used. ${snippet.validationError}`);
    return;
  }

  const pickId = snippet.kind === 'md' ? snippet.path : (snippet.id ?? snippet.name);
  this.runner.pickSnippet(pickId);

  // Capture baseline BEFORE completeSnippet so the delta includes the separator
  const beforeState = this.runner.getState();
  const beforeText = this.extractAccumulatedText(beforeState);

  if (snippet.kind === 'md') {
    this.runner.completeSnippet(snippet.content);
    await this.appendDeltaFromAccumulator(beforeText);
    this.snippetTreePicker?.unmount();
    this.snippetTreePicker = null;
    this.render();
    return;
  }

  if (snippet.placeholders.length === 0) {
    this.runner.completeSnippet(snippet.template);
    await this.appendDeltaFromAccumulator(beforeText);
    this.snippetTreePicker?.unmount();
    this.snippetTreePicker = null;
    this.render();
    return;
  }

  // Snippet has placeholders — advance to awaiting-snippet-fill, handled by render arm
  this.render();
}

/** New helper — mirrors handleAnswerClick's diff logic. */
private async appendDeltaFromAccumulator(beforeText: string): Promise<void> {
  const afterText = this.extractAccumulatedText(this.runner.getState());
  if (afterText.length <= beforeText.length) return;
  if (!afterText.startsWith(beforeText)) {
    console.warn('[RadiProtocol] Text changed non-monotonically, skipping append');
    return;
  }
  await this.appendAnswerToNote(afterText.slice(beforeText.length));
}
```

### Example B: Fixed `handleSnippetFill` with `SnippetFillInModal` (INLINE-FIX-05)

```typescript
// Replaces inline-runner-modal.ts:833-888 + DELETES renderSnippetFillIn (891-973)
private async handleSnippetFill(snippetId: string, questionZone: HTMLElement): Promise<void> {
  const isPhase51FullPath =
    snippetId.includes('/') || snippetId.endsWith('.md') || snippetId.endsWith('.json');
  const root = this.plugin.settings.snippetFolderPath;
  const absPath = snippetId.startsWith(root + '/')
    ? snippetId
    : isPhase51FullPath ? `${root}/${snippetId}` : `${root}/${snippetId}.json`;

  const snippet = await this.plugin.snippetService.load(absPath);

  if (snippet === null) {
    questionZone.empty();
    questionZone.createEl('p', {
      text: `Snippet '${snippetId}' not found.`,
      cls: 'rp-empty-state-body',
    });
    return;
  }

  if (snippet.kind === 'json' && snippet.validationError !== null) {
    new Notice(`Snippet "${snippet.path}" cannot be used. ${snippet.validationError}`);
    this.runner.stepBack();
    this.render();
    return;
  }

  const beforeText = this.extractAccumulatedText(this.runner.getState());

  if (snippet.kind === 'md') {
    if (isPhase51FullPath) {
      this.runner.completeSnippet(snippet.content);
      await this.appendDeltaFromAccumulator(beforeText);
      this.render();
      return;
    }
    // Legacy path — MD snippet via legacy id lookup
    questionZone.empty();
    questionZone.createEl('p', { text: `Snippet '${snippetId}' not found.`, cls: 'rp-empty-state-body' });
    return;
  }

  if (snippet.placeholders.length === 0) {
    this.runner.completeSnippet(snippet.template);
    await this.appendDeltaFromAccumulator(beforeText);
    this.render();
    return;
  }

  // JSON with placeholders — open SnippetFillInModal (parity with sidebar)
  const modal = new SnippetFillInModal(this.app, snippet);
  modal.open();
  const rendered = await modal.result;
  if (rendered !== null) {
    this.runner.completeSnippet(rendered);
  } else {
    // Cancel = skip — sidebar parity: completeSnippet('') still advances runner (D-11/D-14)
    this.runner.completeSnippet('');
  }
  await this.appendDeltaFromAccumulator(beforeText);
  this.render();
}
```

### Example C: Separator resolution chain (reference — already correct in runner)

```typescript
// Source: src/runner/protocol-runner.ts:573-583 — DO NOT EDIT
private resolveSeparator(
  node: AnswerNode | TextBlockNode | SnippetNode,
): 'newline' | 'space' {
  if (node.kind === 'snippet') {
    return node.radiprotocol_snippetSeparator ?? this.defaultSeparator;
  }
  return node.radiprotocol_separator ?? this.defaultSeparator;
}
```

**Precedence chain (matches success-criterion 2 of the phase):**
1. Per-node `radiprotocol_snippetSeparator` (for SnippetNode) or `radiprotocol_separator` (for AnswerNode, TextBlockNode)
2. `defaultSeparator` = `plugin.settings.textSeparator` (passed in `new ProtocolRunner({ defaultSeparator })` — done at inline-runner-modal.ts:57)
3. Hard default `'newline'` (protocol-runner.ts:45)

This chain is owned by `ProtocolRunner` and applies identically to both sidebar and inline — the inline bug is NOT in the chain itself, it's that inline bypasses the accumulator-applied result.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Build + tests | ✓ | (system) | — |
| npm | Install deps | ✓ | (system) | — |
| obsidian (npm) | Source imports + types | ✓ | 1.12.3 | — |
| vitest | Test runner | ✓ | ^4.1.2 | — |
| esbuild | Bundler | ✓ | 0.28.0 | — |
| typescript | Type check | ✓ | 6.0.2 | — |
| Windows paths | Runtime vault | ✓ (OS `win32`) | — | Path normalization (`\` → `/`) — see INLINE-FIX-01 fix |

**Missing dependencies with no fallback:** None — this is a pure-code / pure-test phase.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest ^4.1.2 |
| Config file | `vitest.config.ts` (obsidian alias → `src/__mocks__/obsidian.ts`) |
| Quick run command | `npm test -- src/__tests__/views/inline-runner-modal.test.ts` (once created) |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| INLINE-FIX-01 (a) | `handleRunProtocolInline` accepts `protocolFolderPath = "templates/ALGO"` with no trailing slash | unit | `npm test -- src/__tests__/main-inline-command.test.ts` | ❌ Wave 0 |
| INLINE-FIX-01 (b) | Trailing-slash variant `"templates/ALGO/"` is normalized and resolves | unit | same | ❌ Wave 0 |
| INLINE-FIX-01 (c) | Windows backslash variant normalizes | unit | same | ❌ Wave 0 |
| INLINE-FIX-01 (d) | Fallback `vault.getFiles()` path when `getAbstractFileByPath` returns null but canvases exist under the prefix | unit | same | ❌ Wave 0 |
| INLINE-FIX-01 (e) | Empty folder still produces the D8 Notice | unit | same | ❌ Wave 0 (edge guard — must survive fix) |
| INLINE-FIX-04 (a) | MD snippet insert appends with configured `\n` separator between prior text and snippet content | unit | `npm test -- src/__tests__/views/inline-runner-modal.test.ts` | ❌ Wave 0 |
| INLINE-FIX-04 (b) | JSON zero-placeholder snippet insert applies separator | unit | same | ❌ Wave 0 |
| INLINE-FIX-04 (c) | JSON with-placeholder snippet insert applies separator after modal submit | unit | same | ❌ Wave 0 |
| INLINE-FIX-04 (d) | Per-node `radiprotocol_snippetSeparator: 'space'` overrides global | unit | same | ❌ Wave 0 |
| INLINE-FIX-04 (e) | First-chunk invariant preserved (no leading separator when accumulator empty) | unit | same | ❌ Wave 0 |
| INLINE-FIX-05 (a) | JSON snippet with placeholders triggers `new SnippetFillInModal(...)` call | unit (spy) | same | ❌ Wave 0 |
| INLINE-FIX-05 (b) | Modal resolves with rendered string → `completeSnippet(rendered)` → note append | unit | same | ❌ Wave 0 |
| INLINE-FIX-05 (c) | Modal cancel (null) → `completeSnippet('')` → no note append (first-chunk invariant holds) | unit | same | ❌ Wave 0 |
| INLINE-FIX-05 (d) | In-panel `renderSnippetFillIn` is no longer reachable (deleted / branch removed) | unit (source-string grep) | same | ❌ Wave 0 |
| INLINE-FIX-05 (e) | Z-index sanity — `SnippetFillInModal` DOM appended to document.body after `.rp-inline-runner-container` | unit | same | ❌ Wave 0 |
| Phase 54 regression | Answer-click append path untouched (still uses `handleAnswerClick`) | integration | existing `__tests__` | ✅ (regression guard — no new test; run full suite) |
| Phase 54 regression | Freeze/resume D1 + target-note-deleted D2 unchanged | integration | UAT | ✅ (UAT only — no unit test for D1/D2 exists) |
| Phase 54 regression | Sidebar and tab modes unchanged | unit | existing `runner-view.test.ts` + `RunnerView.test.ts` | ✅ (full-suite green) |

### Sampling Rate

- **Per task commit:** `npm test -- src/__tests__/views/inline-runner-modal.test.ts src/__tests__/main-inline-command.test.ts`
- **Per wave merge:** `npm test` (full suite — ~670 tests baseline)
- **Phase gate:** Full suite green + manual UAT on real Obsidian vault with nested `templates/ALGO/nested.canvas` fixture before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/__tests__/views/inline-runner-modal.test.ts` — **NEW FILE** — covers INLINE-FIX-04 (a–e) and INLINE-FIX-05 (a–e). No existing tests for `InlineRunnerModal` — scaffold from scratch using the `FakeNode` pattern in `runner-snippet-sibling-button.test.ts` (lines 37-100) + `MockEl` pattern in `snippet-fill-in-modal.test.ts` (lines 18-60). Use `vi.mock('obsidian')` to stub `Modal` so `SnippetFillInModal` can be instantiated in tests; resolve its `result` promise manually via a spy.
- [ ] `src/__tests__/main-inline-command.test.ts` — **NEW FILE** — covers INLINE-FIX-01 (a–e). Testing `handleRunProtocolInline` directly is hard because it's private and constructs `SuggestModal` inline; recommended approach: extract the folder-resolution logic into a pure helper `resolveProtocolCanvasFiles(vault, folderPath): TFile[]` and test the helper.
- [ ] Obsidian mock augmentation: `src/__mocks__/obsidian.ts` currently lacks `TFolder` export. Wave 0 adds minimal `TFolder` + `Modal` + `SuggestModal` mocks so tests can `instanceof`-check.
- [ ] Test fixtures: no binary fixture files needed — synthesize canvases inline as JSON strings.

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | no | — |
| V5 Input Validation | yes | Vault path normalization + `snippet-service.assertInsideRoot` (existing; not this phase) |
| V6 Cryptography | no | — |

### Known Threat Patterns for inline runner

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via `protocolFolderPath` setting | Tampering | Normalize then use `getAbstractFileByPath` — already Obsidian-safe. `vault.getFiles()` fallback cannot traverse outside vault by construction. |
| Race on concurrent `vault.modify` during note append | Tampering / DoS | Existing `insertMutex.runExclusive(targetNote.path)` (inline-runner-modal.ts:586) — preserved as-is |
| Prompt injection via snippet template | — | Out of scope for v1.9 (no LLM) |

No new security surface introduced by Phase 59.

## Regression Risk Map (Phase 54 invariants × each fix)

| Phase 54 Invariant | INLINE-FIX-01 Risk | INLINE-FIX-04 Risk | INLINE-FIX-05 Risk | Guard |
|--------------------|--------------------|--------------------|--------------------|-------|
| D1: freeze/resume on active-leaf-change | None (path resolution happens before modal open) | None (snippet paths don't touch workspace events) | **MEDIUM** — opening `SnippetFillInModal` may fire active-leaf-change and trigger D1 hide | Test: assert inline container does NOT get `is-hidden` class when `SnippetFillInModal` is open. Gate: add `this.isFillModalOpen` flag; skip D1 hide when flag set. |
| D2: target-note-deleted closes modal | None | None | Low — modal awaits promise; delete during await should still close inline via existing handler | Test: simulate delete during modal await, verify cleanup order. |
| D3: close button disposes cleanly | None | None | Medium — close while modal is open may leave modal orphaned | Test: close inline while `SnippetFillInModal.result` pending, verify no leaked DOM. Guard: in `close()`, call `modal.close()` via stored ref. |
| D4: no textarea — note IS the buffer | None | None (delta pattern preserves invariant) | None | — |
| D5: no on-note running indicator | None | None | None | — |
| D6: nested UI hosted inside inline modal | None | None | **REVERSAL** — D6 is explicitly reversed by INLINE-FIX-05 | Document reversal in discuss-phase / CONTEXT.md for Phase 59 (locked decision) |
| D7: append formatting 1:1 with sidebar | None | **FIX** — this fix RESTORES D7 parity | Low — modal output goes through same runner.completeSnippet as sidebar | Test: snapshot compare inline output vs sidebar output on identical fixture |
| D8: no canvases → Notice + abort | **Must preserve** — new normalization/fallback must still emit Notice on empty list | None | None | Test INLINE-FIX-01 (e) above |
| D9: no active markdown note → Notice | **Must preserve** | None | None | Test: no active `.md` file, run command, verify Notice + abort. |
| Sidebar and tab modes unchanged | None | **None** (inline-runner-modal.ts only) | **None** (SnippetFillInModal reused, not modified) | Full test suite green |

**Highest risk item:** D1 interaction with `SnippetFillInModal`. Requires either empirical verification during Wave 1c or a proactive guard flag.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Phase 54 D6: in-panel fill-in form | Phase 59: stacked `SnippetFillInModal` | v1.9 (this phase) | Feature parity + regression tests amortize across modes |
| Inline raw `snippet.content` append | Accumulator-diff delta append | v1.9 (this phase) | Separator correctness; single source of truth |

**Deprecated/outdated:**
- `InlineRunnerModal.renderSnippetFillIn` — removed by INLINE-FIX-05
- Inline `awaiting-snippet-fill` render arm that loads & renders inline form — collapsed to a transient "Loading…" state that ends when `SnippetFillInModal.result` resolves

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | INLINE-FIX-01 root cause is path-normalization (Windows backslash or trailing slash) | Summary / Pattern 3 | Medium — if actual root cause is e.g. a race with vault-index, the normalization fix won't resolve it. Mitigation: UAT includes explicit reproduction step + instrumentation; planner should include a debug-log task. |
| A2 | Phase 54 D6 reversal is acceptable to the user | Architecture section / Don't Hand-Roll | Medium — discuss-phase should confirm. Alternative is to port `SnippetFillInModal` features (live preview, Custom override, choice separator) into the in-panel form — at significantly more cost. |
| A3 | Obsidian Modal stacking above inline container "just works" via `--layer-modal` | Pitfall 2 | Low-medium — if stacking is broken, we add a temporary z-index shift during fill-in. Requires live verification. |
| A4 | Inline `SnippetFillInModal` open does NOT trigger D1 hide in practice | Regression Risk Map, Pitfall 3 | Medium — if it does, we need the `isFillModalOpen` gate. Unit test this during Wave 1c. |
| A5 | The reported "nested path" bug is real in current code (not a caching/stale-install issue) | INLINE-FIX-01 | Low — verified against user report (PROJECT.md:17, STATE.md:62, REQUIREMENTS.md:13). |

## Open Questions

1. **What is the exact trigger for INLINE-FIX-01 on the user's vault?**
   - What we know: The recursive `collectCanvases` function in `main.ts:444-453` is algorithmically correct. `getAbstractFileByPath("templates/ALGO")` SHOULD return a TFolder in Obsidian 1.12.3.
   - What's unclear: Whether the user has a trailing slash in the setting, whether their OS path uses backslash, or whether the plugin reads settings before the vault is fully indexed on launch.
   - Recommendation: Plan includes a Wave 0 UAT step that asks user to share their `data.json` value for `protocolFolderPath`. Executor adds console.debug logging during the fix task to confirm which guard trips.

2. **Will `SnippetFillInModal.open()` trigger an `active-leaf-change` event that hides the inline container?**
   - What we know: Obsidian Modals are not registered as workspace leaves, so in principle no active-leaf-change should fire.
   - What's unclear: In practice, focus transitions may cause transient events. Requires empirical check.
   - Recommendation: Wave 1c includes a focused test case + manual UAT step: "open JSON-with-placeholder snippet in inline, verify inline container remains visible while modal is active."

3. **Is Phase 54 D6 reversal a locked decision for Phase 59, or should discuss-phase raise it?**
   - What we know: Without reversing D6, INLINE-FIX-05 cannot match sidebar parity (live preview, Custom override, full separator-per-placeholder semantics).
   - What's unclear: User may have a reason to prefer in-panel (e.g., visual continuity).
   - Recommendation: Discuss-phase should make D6 reversal an explicit locked decision. Research recommends reversal.

## Project Constraints (from CLAUDE.md)

- **Append-only CSS per phase:** No new CSS required for Phase 59 (reusing `snippet-fill-modal.css` which already works). If any inline CSS DOES become necessary, add to `src/styles/inline-runner.css` at the bottom with `/* Phase 59: description */` comment — do NOT edit existing Phase 54 rules.
- **Shared files (append-only rule):** `src/main.ts`, `src/views/inline-runner-modal.ts`, and `src/views/runner-view.ts` are shared files. Executor MUST only modify code specifically called out in this research. Do NOT delete unrelated functions, event listeners, or branches.
  - In `main.ts`: only `handleRunProtocolInline` (lines 421-487) is in scope.
  - In `inline-runner-modal.ts`: only the `awaiting-snippet-fill` render arm (411-419), `handleSnippetPickerSelection` (800-830), `handleSnippetFill` (833-888), and `renderSnippetFillIn` (891-973) are in scope. EVERYTHING ELSE IS OUT OF SCOPE.
  - In `runner-view.ts`: DO NOT EDIT — referenced only for pattern parity.
- **After any CSS change:** run `npm run build` to regenerate `styles.css` (not expected for this phase, but mandated if it happens).
- **No `innerHTML`, no `require('fs')`, no `console.log`** — use DOM API, `app.vault.*`, and `console.debug()`.
- **No modification to `.canvas` files while open in Canvas view** (Pitfall 1) — not triggered by this phase.
- **`WriteMutex` for vault writes** — already applied in `appendAnswerToNote` via `this.plugin['insertMutex'].runExclusive`. Preserve.

## Dependencies and Load Order

**All three fixes are independent within this phase.** They can be waved in parallel:

| Wave | Scope | Files | Depends On |
|------|-------|-------|-----------|
| 0 | Test scaffolding + Obsidian mock augmentation | `src/__mocks__/obsidian.ts`, `src/__tests__/views/inline-runner-modal.test.ts` (NEW), `src/__tests__/main-inline-command.test.ts` (NEW) | — |
| 1a | INLINE-FIX-01 | `src/main.ts:handleRunProtocolInline` (+ extract helper `resolveProtocolCanvasFiles`) | Wave 0 |
| 1b | INLINE-FIX-04 | `src/views/inline-runner-modal.ts:800-830` (handleSnippetPickerSelection) + new helper `appendDeltaFromAccumulator` | Wave 0 |
| 1c | INLINE-FIX-05 | `src/views/inline-runner-modal.ts:411-419, 833-888, 891-973` (awaiting-snippet-fill arm + handleSnippetFill rewrite + delete renderSnippetFillIn) | Wave 0, Wave 1b (shares `appendDeltaFromAccumulator` helper) |
| 2 | Regression verification + UAT | full test suite + manual vault testing | Waves 1a, 1b, 1c |

**Note on Wave 1b → Wave 1c coupling:** The `appendDeltaFromAccumulator` helper is introduced in Wave 1b and reused in Wave 1c. If planner prefers strict independence, Wave 1c can inline the diff logic — minor duplication, same behavior. Recommendation: introduce the helper in Wave 1b and reuse in Wave 1c (cleaner).

**Parallel to Phase 60:** Phase 60 modifies `inline-runner-modal.ts` for layout/position — different methods (`updateModalPosition`, new drag handlers, CSS). No merge conflict expected. Phase 59 should merge first if scheduled concurrently, since INLINE-FIX-05 removes `renderSnippetFillIn` (82 lines) which could otherwise cause a trivial merge conflict with any new positioning code that touches adjacent lines.

## Sources

### Primary (HIGH confidence — in-repo, directly inspected)
- `src/views/inline-runner-modal.ts` — lines 1-985 (full file read)
- `src/views/runner-view.ts` — lines 1-150, 350-400, 701-1008 (sidebar reference)
- `src/views/snippet-fill-in-modal.ts` — lines 1-229 (full file read)
- `src/main.ts` — lines 1-120, 280-495 (handleRunProtocolInline + related)
- `src/runner/protocol-runner.ts` — lines 1-200, 297-395, 567-585 (separator + completeSnippet + chooseSnippetBranch)
- `src/runner/text-accumulator.ts` — lines 1-65 (full; appendWithSeparator contract)
- `src/settings.ts` — lines 1-152 (full file read)
- `src/styles/inline-runner.css`, `src/styles/snippet-fill-modal.css` — full read
- `.planning/milestones/v1.8-phases/54-inline-protocol-display-mode/` — CONTEXT.md, VERIFICATION.md, 01/02/03-SUMMARY.md, UAT.md
- `.planning/STATE.md`, `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md`, `.planning/v1.8-MILESTONE-AUDIT.md`
- `.planning/PROJECT.md` — confirms INLINE-FIX-01 user-reported behavior
- `package.json`, `vitest.config.ts`, `esbuild.config.mjs`

### Secondary (MEDIUM confidence)
- Obsidian API patterns inferred from in-repo usage — e.g., `getAbstractFileByPath` returning `TFolder` for nested paths, `Modal` auto-stacking via `--layer-modal`. Standard Obsidian plugin conventions.

### Tertiary (LOW confidence)
- Exact trigger for the user-reported INLINE-FIX-01 failure — reproduced via live UAT during Wave 1a only.

## Metadata

**Confidence breakdown:**
- INLINE-FIX-04 root cause: **HIGH** — code-path diff vs sidebar shows unambiguous bug at inline-runner-modal.ts:812/821/881/969
- INLINE-FIX-05 fix design: **HIGH** — sidebar's `SnippetFillInModal` invocation is the parity target and is a small, self-contained change
- INLINE-FIX-01 fix design: **MEDIUM** — recommended fix (path normalization + fallback) is defensive but may not match actual root cause without live reproduction
- Regression risk on Phase 54 D1 during fill-in modal open: **MEDIUM** — requires empirical verification
- Test scaffolding approach: **HIGH** — patterns from existing `snippet-fill-in-modal.test.ts` and `runner-snippet-sibling-button.test.ts` are proven

**Research date:** 2026-04-24
**Valid until:** 2026-05-24 (30 days — stable Obsidian API, stable internal code)
