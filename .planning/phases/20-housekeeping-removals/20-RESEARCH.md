# Phase 20: Housekeeping Removals — Research

**Researched:** 2026-04-10
**Domain:** TypeScript dead-code removal, CSS polishing, Obsidian plugin internals
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**free-text-input removal strategy — Option A (Silent Skip)**
Canvas nodes with `radiprotocol_nodeType=free-text-input` are excluded from the ProtocolGraph entirely by the parser. They are not remapped to text-block, not included in adjacency lists, and generate no validator errors or warnings. Edges from/to these nodes are dropped silently. The runner never halts at them; no text is appended.
Implementation: add `'free-text-input'` to a `DEPRECATED_KINDS` set in `canvas-parser.ts`; when encountered, skip the node without adding it to the graph.

**text-block: snippetId handling — Option A (Append plain text)**
After removing snippet insertion from the text-block runner branch, the runner always appends the node's `radiprotocol_text` / `text` field and auto-advances — regardless of whether the canvas JSON still contains a `radiprotocol_snippetId` key. The parser ignores `snippetId` when parsing text-block nodes. `TextBlockNode` TypeScript interface removes the `snippetId` field.

**awaiting-snippet-fill session loading**
Sessions with `runnerStatus: "awaiting-snippet-fill"` are treated as stale. The session manager starts a fresh session from the beginning of the current canvas (same code path as sessions with missing nodeIds or unknown statuses). No error is shown.

**Runner textarea hover colour (UX-01)**
Add CSS override `.rp-preview-textarea:hover { background: var(--background-primary); }` to suppress Obsidian's default textarea hover background change. Focus state colour change (`:focus`) is acceptable and left as-is.

**Node Editor answer textarea size (UX-02)**
Set `rows` attribute to `6` on the answer textarea element in `editor-panel-view.ts`. Minimum 6 visible rows — no maximum imposed.

### Claude's Discretion

None.

### Deferred Ideas (OUT OF SCOPE)

None captured during discussion. Phase 20 does NOT add snippet node type, color coding, auto-save, or any new capability — only deletion of dead paths and two CSS/DOM polish items.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| NTYPE-01 | free-text-input node type is removed from the plugin | Locked decision: DEPRECATED_KINDS silent-skip in parser; remove from RPNodeKind union, FreeTextInputNode interface, validator nodeLabel switch, editor-panel-view.ts dropdown, runner enterFreeText(), getSerializableState() type guard |
| NTYPE-02 | Existing canvas nodes with `radiprotocol_nodeType=free-text-input` are treated as text-block — no validator errors | Locked decision: silently skipped by parser — never enters graph, so validator never sees them |
| NTYPE-03 | text-block auto-advances and inserts plain text only — all snippet insertion logic removed from its runner branch | Locked decision: remove snippetId branch from advanceThrough(); remove completeSnippet(); remove snippetId field from TextBlockNode |
| NTYPE-04 | Runner state `awaiting-snippet-fill` is retired; sessions persisted with this status load without errors | Locked decision: treat as stale in openCanvas(); remove AwaitingSnippetFillState union member and all references |
| UX-01 | Protocol Runner textarea does not change colour on mouse hover | Single CSS rule: `.rp-preview-textarea:hover { background: var(--background-primary); }` |
| UX-02 | Answer text field in Node Editor is large enough for multi-line input (min 6 rows) | Set `rows="6"` on the answer textarea in `buildKindForm` case `'answer'` |
</phase_requirements>

---

## Summary

Phase 20 is a pure removal and polish phase. All decisions are fully locked — no design choices remain. The work divides into four independent streams:

1. **Free-text-input extinction** — purge `FreeTextInputNode` type, its `RPNodeKind` union member, the parser case, the validator `nodeLabel` branch, the runner `enterFreeText()` method and its `free-text-input` halt in `advanceThrough()`, the editor-panel dropdown option and form case, and the `resolveSeparator` union type. Replace with a `DEPRECATED_KINDS` silent-skip in `canvas-parser.ts`.

2. **Text-block simplification** — remove the `snippetId` branch from `advanceThrough()` (the `if (node.snippetId !== undefined)` block that transitions to `awaiting-snippet-fill`), remove `completeSnippet()`, remove `snippetId` from the `TextBlockNode` interface, remove the "Snippet ID" field from the editor form, and remove `snippetId`/`snippetNodeId` private fields from `ProtocolRunner`.

3. **awaiting-snippet-fill retirement** — remove `AwaitingSnippetFillState` interface and the `'awaiting-snippet-fill'` member from `RunnerStatus` / `RunnerState` union, remove the `awaiting-snippet-fill` switch branch from `render()` and `getState()`, remove `handleSnippetFill()`, update `handleSelectorSelect()` mid-session guard, update `getSerializableState()` return type signature, update `PersistedSession.runnerStatus` union type, add degradation handling in `openCanvas()` for legacy sessions.

4. **UX polish** — one CSS line for the hover fix; one `rows` attribute on the answer textarea.

**Primary recommendation:** Work through the files in dependency order — types first (graph-model.ts, runner-state.ts, session-model.ts), then engine (canvas-parser.ts, graph-validator.ts, protocol-runner.ts), then views (runner-view.ts, editor-panel-view.ts), then CSS (styles.css). TypeScript compiler errors guide cleanup completeness.

---

## Standard Stack

This phase uses only the project's existing toolchain. No new libraries are required.

| Tool | Version | Purpose |
|------|---------|---------|
| TypeScript | existing (esbuild) | Type-safe dead-code removal — TS errors pinpoint every reference to removed types |
| Vitest | 4.1.2 [VERIFIED: package.json] | Unit tests for pure modules (canvas-parser, protocol-runner, graph-validator) |
| Obsidian API | existing | DOM manipulation for `rows` attribute; CSS variables for hover fix |

**Installation:** None required.

---

## Architecture Patterns

### File-by-file change inventory (ordered by dependency depth)

**Layer 0 — Pure types (no imports from project)**

`src/graph/graph-model.ts`
- Remove `'free-text-input'` from `RPNodeKind` union
- Delete `FreeTextInputNode` interface
- Remove `FreeTextInputNode` from `RPNode` union
- Remove `snippetId?: string` field from `TextBlockNode` interface
- Update `resolveSeparator` call sites (the union type `FreeTextInputNode | AnswerNode | TextBlockNode` in `protocol-runner.ts` private helper must drop `FreeTextInputNode`)

`src/runner/runner-state.ts`
- Remove `'awaiting-snippet-fill'` from `RunnerStatus` union
- Delete `AwaitingSnippetFillState` interface
- Remove `AwaitingSnippetFillState` from `RunnerState` union

`src/sessions/session-model.ts`
- Update `PersistedSession.runnerStatus` type from `'at-node' | 'awaiting-snippet-fill'` to `'at-node'` only

**Layer 1 — Pure engine modules**

`src/graph/canvas-parser.ts`
- Add `DEPRECATED_KINDS` constant set: `new Set(['free-text-input'])`
- In `parseNode()`: after the `kind === undefined || kind === null` null check and before the `validKinds` check, add: `if (DEPRECATED_KINDS.has(kind)) return null;`
- Remove `'free-text-input'` from the `validKinds` array
- Remove the `case 'free-text-input':` block from the switch
- Remove `FreeTextInputNode` from import list
- In the `case 'text-block':` block: remove the `snippetId` line (`snippetId: props['radiprotocol_snippetId'] ...`)

`src/graph/graph-validator.ts`
- Remove `case 'free-text-input':` branch from `nodeLabel()` private method

`src/runner/protocol-runner.ts`
- Remove `enterFreeText()` public method entirely
- Remove `completeSnippet()` public method entirely
- Remove `private snippetId: string | null` field
- Remove `private snippetNodeId: string | null` field
- In `start()`: remove `this.snippetId = null; this.snippetNodeId = null;` lines
- In `stepBack()`: remove `this.snippetId = null; this.snippetNodeId = null;` lines
- In `advanceThrough()`, `case 'text-block':` block: remove the `if (node.snippetId !== undefined)` branch entirely; keep only the plain-text append path
- In `advanceThrough()`: remove `case 'free-text-input':` from the halt block (currently `case 'question': case 'free-text-input':`) — leave only `case 'question':`
- In `getState()`: remove the `case 'awaiting-snippet-fill':` branch
- In `getSerializableState()`: update return type — remove `'awaiting-snippet-fill'` from `runnerStatus` union; remove `snippetId` and `snippetNodeId` from the returned object
- In `restoreFrom()`: update parameter type — remove `snippetId` and `snippetNodeId` fields
- In `resolveSeparator()`: update union type parameter to drop `FreeTextInputNode`
- Remove `FreeTextInputNode` import if it was imported (it is used in `resolveSeparator` union)

**Layer 2 — Views**

`src/views/runner-view.ts`
- Remove `case 'awaiting-snippet-fill':` branch from `render()` switch
- Remove `handleSnippetFill()` private method
- In `handleSelectorSelect()`: update the `needsConfirmation` check — remove `state.status === 'awaiting-snippet-fill'` condition (becomes `state.status === 'at-node'` only)
- Remove `SnippetFillInModal` import (only used by `handleSnippetFill`)
- In `openCanvas()`: add handling for legacy sessions with `runnerStatus === 'awaiting-snippet-fill'` — treat as stale and start fresh (same code path as `missingIds.length > 0` but without the error display — just `clear()` and fall through to normal start)

`src/views/editor-panel-view.ts`
- Remove `case 'free-text-input':` block from `buildKindForm()` switch
- Remove `'free-text-input'` option from the node type dropdown in `renderForm()`
- In `case 'text-block':` form section: remove the "Snippet ID (optional)" `Setting` block
- In `case 'answer':` form section: add `rows` attribute to the answer textarea

**Layer 3 — CSS**

`src/styles.css`
- Add to `.rp-preview-textarea` rule block (or as a new override rule after it):
  ```css
  .rp-preview-textarea:hover {
    background: var(--background-primary);
  }
  ```

### DEPRECATED_KINDS pattern

```typescript
// [VERIFIED: codebase — canvas-parser.ts parseNode() method]
// Place at module scope, before the class declaration:
const DEPRECATED_KINDS = new Set<string>(['free-text-input']);

// In parseNode(), after the kind === null check, before validKinds:
if (DEPRECATED_KINDS.has(kind)) return null; // silently skip — legacy node type
```

This is the minimum-touch implementation: the existing `null` return path already causes the node to be silently skipped by the caller (line 84–86 of canvas-parser.ts confirms `result === null` → `continue`). Edges to/from these nodes are already dropped by the adjacency builder at lines 103–104.

### awaiting-snippet-fill degradation in openCanvas()

The current `openCanvas()` in `runner-view.ts` handles `missingIds` by clearing the session and rendering an error. The `awaiting-snippet-fill` stale case should NOT show an error — it should silently fall through to a fresh start. The cleanest location is immediately after the `missingIds` check:

```typescript
// [VERIFIED: codebase — runner-view.ts openCanvas(), line 103–141]
// After the missingIds guard block, before showing ResumeSessionModal:
if (session !== null && session.runnerStatus === 'awaiting-snippet-fill') {
  await this.plugin.sessionService.clear(filePath);
  // fall through to normal start — no error, no modal
}
```

Note: `PersistedSession.runnerStatus` will be updated to `'at-node'` only, so this guard must check the raw JSON value (or be handled before TypeScript's type narrowing can exclude `'awaiting-snippet-fill'`). The simplest approach is to add this guard immediately after `load()` returns, before the `missingIds` check, and cast the loaded JSON to `unknown` before narrowing — or alternatively, keep `'awaiting-snippet-fill'` in the `PersistedSession.runnerStatus` type as a legacy-only value but never write it.

**Recommended approach for session-model.ts:** Change `runnerStatus` to `'at-node' | 'awaiting-snippet-fill'` → `'at-node'` in the type, but treat a loaded value of `'awaiting-snippet-fill'` as stale by checking `(session as { runnerStatus: string }).runnerStatus === 'awaiting-snippet-fill'` in `openCanvas()` before narrowing.

### UX-02: rows attribute on answer textarea

Obsidian's `Setting.addTextArea()` returns a `TextAreaComponent`. The `inputEl` property exposes the raw `HTMLTextAreaElement`. Pattern from codebase:

```typescript
// [VERIFIED: codebase — editor-panel-view.ts, buildKindForm 'answer' case]
// Current:
.addTextArea(ta => {
  ta.setValue(...)
    .onChange(...);
});

// After:
.addTextArea(ta => {
  ta.inputEl.rows = 6;
  ta.setValue(...)
    .onChange(...);
});
```

The `rows` DOM property is an integer — setting it before `setValue()` has no ordering dependency.

### Anti-Patterns to Avoid

- **Do not remove `AwaitingSnippetFillState` from `RunnerState` before removing all switch branches that reference it** — TypeScript exhaustiveness checks (`_exhaustive: never`) will catch missed branches.
- **Do not add a parseError for deprecated kinds** — the decision is silent skip, not rejection.
- **Do not remap free-text-input to text-block in the parser** — the decision is exclusion from the graph entirely (Option A).
- **Do not remove the `free-text-input` runner halt case without removing the `enterFreeText()` method** — a halted runner at a node type that no longer exists in the graph is impossible after parser change, but the dead method should still be removed for cleanliness.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead |
|---------|-------------|-------------|
| Finding all references to `free-text-input` | Manual grep | TypeScript compiler errors after removing the type — TS will surface every remaining reference |
| CSS hover override specificity | Custom JS hover logic | Single CSS `:hover` rule — browser handles it |
| Session migration for stale `awaiting-snippet-fill` sessions | JSON migration script | Runtime check in `openCanvas()` — stale sessions are silently cleared; no migration needed |

---

## Common Pitfalls

### Pitfall 1: Forgetting the `resolveSeparator` union type in protocol-runner.ts

**What goes wrong:** After removing `FreeTextInputNode` from graph-model.ts, `resolveSeparator()` still has `FreeTextInputNode` in its parameter union type annotation — TypeScript may not catch this if the type is inlined.

**Location:** `protocol-runner.ts` line 403–409 — the private `resolveSeparator` method has an explicit union type with `FreeTextInputNode` in it.

**How to avoid:** After removing `FreeTextInputNode` from `graph-model.ts`, run `tsc --noEmit` — the missing type in `resolveSeparator` will be flagged.

### Pitfall 2: getSerializableState() / restoreFrom() type signatures reference 'awaiting-snippet-fill'

**What goes wrong:** `getSerializableState()` return type union includes `'awaiting-snippet-fill'`; `restoreFrom()` parameter type also includes `snippetId`/`snippetNodeId`. Removing these without updating `restoreFrom()` creates a shape mismatch.

**How to avoid:** Update both methods together. The `restoreFrom()` call site in `runner-view.ts` passes a `PersistedSession` — update the parameter type to exclude the retired fields.

### Pitfall 3: handleSelectorSelect still checks `awaiting-snippet-fill`

**What goes wrong:** After removing the state from the union, the `needsConfirmation` check `state.status === 'at-node' || state.status === 'awaiting-snippet-fill'` will produce a TypeScript error (comparing against a non-existent union member).

**How to avoid:** Update `needsConfirmation` to `state.status === 'at-node'` only.

### Pitfall 4: SnippetFillInModal import left dangling in runner-view.ts

**What goes wrong:** `handleSnippetFill()` is the only consumer of `SnippetFillInModal`. After removing that method, the import becomes unused — TypeScript/ESLint may warn, but more importantly, it's dead code.

**How to avoid:** Remove the `SnippetFillInModal` import from `runner-view.ts` when removing `handleSnippetFill()`.

### Pitfall 5: Legacy session files in developer vault

**What goes wrong:** If the developer has an existing session file on disk with `runnerStatus: "awaiting-snippet-fill"`, the type narrowing in `openCanvas()` will fail at runtime when reading the `runnerStatus` field — because the TypeScript type now only allows `'at-node'`.

**How to avoid:** The degradation guard added to `openCanvas()` must check the raw JSON value before TypeScript narrowing. Reading the JSON via `session-service.ts` returns `PersistedSession | null`. To safely handle legacy values, cast: `(session as unknown as { runnerStatus: string }).runnerStatus === 'awaiting-snippet-fill'` before the type-safe usage. Or: read the raw value before assigning to typed variable.

### Pitfall 6: CSS specificity — Obsidian's textarea hover selector

**What goes wrong:** Obsidian's default stylesheet has a selector like `textarea:hover { background: ... }` that is more specific or later in cascade than `.rp-preview-textarea`. Simply adding a `:hover` rule to `.rp-preview-textarea` may not override it.

**How to avoid (per CONTEXT.md decision):** The exact CSS override is specified: `.rp-preview-textarea:hover { background: var(--background-primary); }`. This uses class + pseudo-class specificity (0,2,0) which outranks Obsidian's element + pseudo-class selector `textarea:hover` (0,1,1). If Obsidian uses a class selector, increasing specificity further (`.rp-preview-textarea.rp-preview-textarea:hover`) is an option, but the simple form is sufficient based on how Obsidian's default CSS is structured. [ASSUMED — Obsidian's exact selector not inspected; the decision in CONTEXT.md is authoritative]

### Pitfall 7: text-block fixture `snippet-block.canvas` in tests

**What goes wrong:** The existing test `snippet-block.canvas` fixture and the tests that use it (`protocol-runner.test.ts`, lines 229–254) test the `awaiting-snippet-fill` transition and `completeSnippet()`. After removing both, these tests will fail.

**How to avoid:** Remove or rewrite the affected tests. The `snippet-block.canvas` fixture itself can remain as a file — the test cases that expect `awaiting-snippet-fill` state must be rewritten to expect that the runner auto-advances through the text-block with static content (or be removed if they test functionality that no longer exists).

### Pitfall 8: free-text-input halt in advanceThrough() shares case with question

**What goes wrong:** In `protocol-runner.ts` `advanceThrough()`, the halt for `free-text-input` is a fall-through case: `case 'question': case 'free-text-input':`. Removing the `case 'free-text-input':` line is safe — `question` remains the only halting case there.

**Location:** `protocol-runner.ts` lines 472–478.

---

## Code Examples

### DEPRECATED_KINDS silent-skip in canvas-parser.ts

```typescript
// [VERIFIED: codebase — canvas-parser.ts structure]
// Add at module scope (before the class):
const DEPRECATED_KINDS = new Set<string>(['free-text-input']);

// In parseNode(), after the typeof kind !== 'string' check, before validKinds:
if (DEPRECATED_KINDS.has(kind)) return null; // silently skip deprecated node type
```

### text-block advanceThrough() simplified

```typescript
// [VERIFIED: codebase — protocol-runner.ts lines 454–470]
// Before (remove the snippetId branch):
case 'text-block': {
  if (node.snippetId !== undefined) {
    this.runnerStatus = 'awaiting-snippet-fill';
    this.snippetId = node.snippetId;
    this.snippetNodeId = cursor;
    return;
  }
  this.accumulator.appendWithSeparator(node.content, this.resolveSeparator(node));
  // ...advance...
}

// After (plain-text only):
case 'text-block': {
  this.accumulator.appendWithSeparator(node.content, this.resolveSeparator(node));
  const next = this.firstNeighbour(cursor);
  if (next === undefined) {
    this.transitionToComplete();
    return;
  }
  cursor = next;
  break;
}
```

### openCanvas() degradation for legacy awaiting-snippet-fill sessions

```typescript
// [VERIFIED: codebase — runner-view.ts openCanvas(), lines 101–141]
// Add after: const session = await this.plugin.sessionService.load(filePath);
if (session !== null) {
  // Treat legacy awaiting-snippet-fill sessions as stale (NTYPE-04)
  const rawStatus = (session as unknown as { runnerStatus: string }).runnerStatus;
  if (rawStatus === 'awaiting-snippet-fill') {
    await this.plugin.sessionService.clear(filePath);
    // fall through to normal start — no error shown
  } else {
    // ... existing missingIds check and ResumeSessionModal logic ...
  }
}
```

### CSS hover fix

```css
/* [VERIFIED: codebase — styles.css, .rp-preview-textarea rule at line 39] */
/* Add after the existing .rp-preview-textarea rule: */
.rp-preview-textarea:hover {
  background: var(--background-primary);
}
```

### rows attribute on answer textarea

```typescript
// [VERIFIED: codebase — editor-panel-view.ts, buildKindForm 'answer' case, line 343]
.addTextArea(ta => {
  ta.inputEl.rows = 6;
  ta.setValue((nodeRecord['radiprotocol_answerText'] as string | undefined) ?? '')
    .onChange(v => { ... });
});
```

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `vitest.config.ts` (project root) |
| Quick run command | `npm test -- --reporter=verbose` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| NTYPE-01 | `free-text-input` removed from RPNodeKind — parser returns null for it | unit | `npm test -- canvas-parser` | Yes — `canvas-parser.test.ts` |
| NTYPE-02 | Canvas with `free-text-input` node parses successfully with no graph errors | unit | `npm test -- canvas-parser` | Needs new test case |
| NTYPE-03 | text-block with `radiprotocol_snippetId` still auto-advances with plain text | unit | `npm test -- protocol-runner` | Needs new test case (existing awaiting-snippet-fill tests break) |
| NTYPE-04 | `ProtocolRunner.getState()` never returns `awaiting-snippet-fill` | unit | `npm test -- protocol-runner` | Needs new test case; existing snippet tests removed |
| NTYPE-04 (session) | `openCanvas()` with legacy session file containing `awaiting-snippet-fill` starts fresh | unit | `npm test -- RunnerView` | Needs new test case |
| UX-01 | CSS rule present in styles.css | manual (visual) | — | n/a |
| UX-02 | Answer textarea `inputEl.rows === 6` | unit | `npm test -- editor-panel` | Needs new test case |

### Sampling Rate

- **Per task commit:** `npm test`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] New fixture: `deprecated-free-text.canvas` — canvas with a `free-text-input` node to verify silent skip (NTYPE-01, NTYPE-02)
- [ ] New test case in `canvas-parser.test.ts` — parser silently skips `free-text-input` node and drops edges to/from it
- [ ] Remove/rewrite test cases in `protocol-runner.test.ts` at lines 229–254 (`awaiting-snippet-fill state` describe block)
- [ ] New test case in `protocol-runner.test.ts` — text-block with `radiprotocol_snippetId` in JSON auto-advances with plain content text
- [ ] New test case in `editor-panel.test.ts` — answer textarea has `rows === 6`
- [ ] New test case in `RunnerView.test.ts` — openCanvas() with legacy `awaiting-snippet-fill` session starts fresh

---

## Security Domain

This phase removes dead code and adds no new surface. No ASVS categories are applicable.

---

## Open Questions

1. **CSS specificity of Obsidian's textarea hover**
   - What we know: CONTEXT.md specifies `.rp-preview-textarea:hover { background: var(--background-primary); }` as the fix
   - What's unclear: If Obsidian's default uses a class-level selector, this override may need increased specificity
   - Recommendation: Apply as specified. If visual testing shows the hover colour still changes, escalate specificity to `.rp-preview-textarea.rp-preview-textarea:hover` or add `!important` as last resort. [ASSUMED — not inspected in live Obsidian CSS]

2. **Legacy session files in the developer vault**
   - What we know: The degradation guard handles this at runtime
   - What's unclear: Whether the developer wants a Notice shown or truly silent degradation
   - Recommendation: CONTEXT.md says "no error is shown" — implement as silent clear and start fresh

---

## Sources

### Primary (HIGH confidence)

- `src/graph/graph-model.ts` — verified current interfaces and union types
- `src/graph/canvas-parser.ts` — verified parseNode() control flow and validKinds
- `src/graph/graph-validator.ts` — verified nodeLabel() free-text-input case
- `src/runner/protocol-runner.ts` — verified all free-text-input and awaiting-snippet-fill references
- `src/runner/runner-state.ts` — verified RunnerStatus and RunnerState union
- `src/sessions/session-model.ts` — verified PersistedSession.runnerStatus type
- `src/sessions/session-service.ts` — verified load/clear patterns
- `src/views/runner-view.ts` — verified awaiting-snippet-fill render branch and handleSelectorSelect
- `src/views/editor-panel-view.ts` — verified free-text-input form case and Snippet ID field
- `src/views/canvas-switch-modal.ts` — verified (no free-text-input/snippet references)
- `src/styles.css` — verified .rp-preview-textarea existing styles (lines 39–52)
- `src/__tests__/fixtures/` — verified existing fixture files
- `src/__tests__/runner/protocol-runner.test.ts` — verified awaiting-snippet-fill test cases
- `.planning/phases/20-housekeeping-removals/20-CONTEXT.md` — all decisions verified
- `vitest.config.ts` — test configuration verified
- `package.json` — vitest version and test script verified

### Secondary (MEDIUM confidence)

None — all research was from direct codebase inspection.

### Tertiary (LOW confidence)

None.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Obsidian's default textarea hover uses an element-level selector (`textarea:hover`) so `.rp-preview-textarea:hover` has sufficient specificity | Common Pitfalls / Pitfall 6 | If Obsidian uses a class-level selector, the override won't work — fix is simple (increase specificity or add `!important`) |

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all technology verified directly from codebase files
- Architecture: HIGH — all file locations, line numbers, and code shapes verified from direct reads
- Pitfalls: HIGH — identified from direct code inspection; Obsidian CSS specificity is the only non-verified item
- Test infrastructure: HIGH — vitest.config.ts and existing test files verified

**Research date:** 2026-04-10
**Valid until:** 2026-05-10 (stable codebase; no external dependencies)
