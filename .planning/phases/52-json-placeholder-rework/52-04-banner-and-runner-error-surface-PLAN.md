---
phase: 52
plan: 04
type: tdd
wave: 4
depends_on:
  - 52-03
files_modified:
  - src/views/snippet-editor-modal.ts
  - src/views/runner-view.ts
  - src/styles/snippet-manager.css
autonomous: true
requirements:
  - PHLD-01
tags:
  - error-surface
  - banner
  - css
  - green
  - phase-52
must_haves:
  truths:
    - "Opening a .json snippet with validationError !== null shows a red banner above the form in SnippetEditorModal"
    - "The banner text contains the snippet's validationError string verbatim, rendered via textContent (not innerHTML)"
    - "Save button is disabled when validationError !== null"
    - "The chip-editor content region is visually disabled (opacity/aria-disabled) when validationError !== null"
    - "Valid snippets (validationError === null) render the modal unchanged — no banner, Save enabled"
    - "Runner.handleSnippetFill rejects a JsonSnippet with validationError via the existing renderError error-panel path"
    - "Runner.handleSnippetPickerSelection rejects a JsonSnippet with validationError before the kind/placeholders branches"
    - "Phase 51 D-14 auto-insert path-shape dispatch at runner-view.ts:788-795 still works unchanged"
    - "All Plan 01 snippet-editor-modal-banner.test.ts tests flip GREEN"
    - "npm run build exits 0 (CSS additions regenerate styles.css)"
  artifacts:
    - path: src/views/snippet-editor-modal.ts
      provides: "validationError banner + disabled save + disabled content region"
      contains: "radi-snippet-editor-validation-banner"
    - path: src/views/runner-view.ts
      provides: "validationError guard in handleSnippetFill and handleSnippetPickerSelection"
      contains: "snippet.validationError !== null"
    - path: src/styles/snippet-manager.css
      provides: "banner styling appended per Phase 52"
      contains: "/* Phase 52"
  key_links:
    - from: SnippetEditorModal.onOpen
      to: JsonSnippet.validationError
      via: "check after renderContentRegion; call new renderValidationBanner"
      pattern: "validationError"
    - from: runner-view.ts handleSnippetFill guard
      to: existing renderError() pattern at :985-998
      via: "call renderError([validationError]) + this.runner.setError(...) / Notice"
      pattern: "snippet\\.kind === 'json' && snippet\\.validationError !== null"
    - from: src/styles/snippet-manager.css
      to: generated styles.css
      via: "esbuild CSS_FILES concatenation + npm run build"
      pattern: "/* Phase 52: validation banner */"
---

<objective>
Close PHLD-01 SC 4 by surfacing `validationError` at the two user-facing boundaries: SnippetEditorModal banner + RunnerView error panel. Also append a minimal CSS block for the banner in `src/styles/snippet-manager.css` and regenerate `styles.css` via `npm run build`.

Implements: D-04 (two error surfaces), with D-03's `validationError !== null` as the triggering condition. Respects Phase 51 D-14 by placing the guard AFTER null-check and BEFORE md-kind check in `handleSnippetFill`, per RESEARCH §"Where to Insert the validationError Guard".

Purpose: The model+service+UI narrowing (Plans 02-03) delivered the new contract but errors are currently silent — a broken snippet renders nothing useful. This plan makes the error visible at the two places the user interacts with snippets (Editor + Runner), keeping the fail-loud principle of CONTEXT D-04.

Output: Valid snippets continue to work unchanged. Broken snippets show a banner in Editor and a runner error panel (or non-fatal Notice + stepBack for auto-insert per RESEARCH §Runner state decision) in Runner. Full test suite green; full build green; styles.css regenerated.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/52-json-placeholder-rework/52-CONTEXT.md
@.planning/phases/52-json-placeholder-rework/52-RESEARCH.md
@.planning/phases/52-json-placeholder-rework/52-03-SUMMARY.md
@.planning/phases/50.1-loop-exit-plus-prefix/50.1-CONTEXT.md
@.planning/phases/51-snippet-picker-overhaul/51-CONTEXT.md
@CLAUDE.md

<interfaces>
<!-- Reusable patterns this plan mounts on. -->

From src/views/runner-view.ts:985-998 (renderError — full-screen error panel):
```typescript
private renderError(errors: string[]): void {
  this.contentEl.empty();
  if (this.selectorBarEl !== null) this.contentEl.prepend(this.selectorBarEl);
  const root = this.contentEl.createDiv({ cls: 'rp-runner-view' });
  const questionZone = root.createDiv({ cls: 'rp-question-zone rp-validation-panel' });
  questionZone.createEl('p', { text: 'Protocol error' });
  const ul = questionZone.createEl('ul', { cls: 'rp-error-list' });
  for (const err of errors) ul.createEl('li', { text: err });
}
```

From src/views/snippet-editor-modal.ts collision pattern (Phase 33):
```typescript
private updateCollisionUI(): void {
  if (this.hasCollision) {
    this.collisionErrorEl.style.display = '';
    this.saveBtnEl.disabled = true;
    this.saveBtnEl.setAttribute('title', 'Устраните конфликт имени, чтобы сохранить.');
  } else {
    this.collisionErrorEl.style.display = 'none';
    this.saveBtnEl.disabled = false;
    this.saveBtnEl.removeAttribute('title');
  }
}
```

Phase 51 D-14 path-shape dispatch at runner-view.ts:788-795 (MUST NOT be reordered — placing guard before it would break legacy id composition):
```typescript
const isPhase51FullPath =
  snippetId.includes('/') || snippetId.endsWith('.md') || snippetId.endsWith('.json');
const root = this.plugin.settings.snippetFolderPath;
const absPath = isPhase51FullPath ? `${root}/${snippetId}` : `${root}/${snippetId}.json`;
const snippet = await this.plugin.snippetService.load(absPath);   // :797
// AFTER :799 null-check, BEFORE :813 md-kind check → insert guard here
```
</interfaces>

<error_copy>
Text shown in SnippetEditorModal banner (uses snippet.validationError as-is):
```
{snippet.validationError}
```
Optionally with a prefix header "Сниппет «{snippet.name}» не может быть использован:" on a separate line (executor's call on wording). The banner `textContent` MUST include the raw `validationError` string from Plan 02's `validatePlaceholders` helper.

Text shown in Runner error panel for picker-click path (D-16):
```
Сниппет «{snippet.path}»: {snippet.validationError}
```

Text shown for auto-insert path (Phase 51 D-14, RESEARCH recommends non-fatal Notice):
```
Сниппет «{snippet.path}» не может быть использован. {snippet.validationError}
```
delivered via `new Notice(...)` — user stays in the Question with `stepBack()` applied so they can pick another option.

All three above are assembled by the executor from `snippet.validationError` + `snippet.path`. No new static Russian copy needs to be authored; the underlying cause text is Plan 02's `validatePlaceholders` output.
</error_copy>
</context>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| snippet.validationError string → banner DOM | Rendered into editor modal |
| snippet.validationError string → runner error-panel DOM | Rendered into runner content |
| snippet.path string → error copy | Rendered verbatim in both surfaces |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-52-09 | Tampering | banner DOM injection via crafted `ph.id` | mitigate | Use `banner.textContent = msg` — NEVER `innerHTML`. Acceptance criterion: grep `innerHTML` absent in edited portions. Obsidian's `createEl('li', { text })` also safe. |
| T-52-10 | Tampering | runner error-panel DOM injection | mitigate | Already handled by existing `renderError` → `ul.createEl('li', { text: err })` pattern. Reusing it is safe by construction. |
| T-52-11 | Information Disclosure | snippet.path leaks folder structure | accept | Path is inside user's vault; user authored the folder structure. No external exposure. |
| T-52-12 | Denial of Service | endless re-render on banner mount | mitigate | Banner renders once in `onOpen` after `renderContentRegion()`; no re-render loop. Explicit test asserts single-banner presence. |
</threat_model>

<tasks>

<task id="52-04-01" type="auto" tdd="true">
  <title>Task 01: SnippetEditorModal banner + disabled save + content-region read-only + CSS</title>
  <read_first>
    - src/views/snippet-editor-modal.ts (entire — 617 lines; critical: 129-184 onOpen, 327-356 renderContentRegion, 372-390 renderButtonRow, 431-445 updateCollisionUI)
    - src/styles/snippet-manager.css (entire — note the Phase 27 / 51 append markers so you know where to add Phase 52 block)
    - esbuild.config.mjs (confirm CSS_FILES list includes snippet-manager.css)
    - src/__tests__/views/snippet-editor-modal-banner.test.ts (Plan 01 RED contract)
    - .planning/phases/52-json-placeholder-rework/52-RESEARCH.md §"Pattern 1: Validation error-banner in Modal" + §"Banner injection in SnippetEditorModal (proposed)"
  </read_first>
  <behavior>
    - Add a private `validationBannerEl: HTMLElement | null` field.
    - In `onOpen`, AFTER `this.contentRegionEl = contentEl.createDiv(...)` + `this.renderContentRegion()` (around line 172), check `this.draft` if kind==='json' && `(this.draft as JsonSnippet).validationError !== null`. If so:
      - Create banner as the FIRST child of `contentEl` (use `contentEl.insertBefore` or reconstruct insertion order — simpler: create banner BEFORE `renderContentRegion`, but after title/type/folder/name). Clearest: render banner immediately BELOW `renderNameInput(contentEl)` and ABOVE `renderContentRegion`. Executor picks placement; the test asserts banner exists somewhere in `modal.contentEl` as a child element.
      - Set banner text via `banner.textContent = snippet.validationError` (banner may include a `<p>` child with the header line, each via `createEl({ text })`).
      - Set `this.saveBtnEl.disabled = true` after `renderButtonRow` has run (so add the disable call at the END of `onOpen` — OR inside `renderButtonRow` after creating saveBtn, check the flag).
      - Set `this.contentRegionEl.setAttribute('aria-disabled', 'true')` and `this.contentRegionEl.style.pointerEvents = 'none'` + `this.contentRegionEl.style.opacity = '0.5'` to visually disable the chip editor.
    - For valid snippets (`validationError === null`), behaviour is BYTE-IDENTICAL to current — no banner, no disabled flag, no opacity change.
    - Append one CSS block to `src/styles/snippet-manager.css`:
      ```css
      /* Phase 52: validation banner for SnippetEditorModal (D-04) */
      .radi-snippet-editor-validation-banner {
        background-color: var(--background-modifier-error);
        color: var(--text-on-accent);
        border-left: 3px solid var(--text-error);
        padding: var(--size-4-2) var(--size-4-3);
        margin-bottom: var(--size-4-3);
        border-radius: var(--radius-s);
        font-size: var(--font-ui-small);
      }
      .radi-snippet-editor-validation-banner p {
        margin: 0 0 var(--size-4-1) 0;
        font-weight: 600;
      }
      ```
    - Run `npm run build` to regenerate `styles.css`.
  </behavior>
  <action>
    **Step 1 — Add field + method to SnippetEditorModal.** Insert after `private saveErrorEl!: HTMLElement;` at :89:
    ```typescript
    /** Phase 52 D-04: banner shown when the loaded snippet carries a validationError. */
    private validationBannerEl: HTMLElement | null = null;
    ```

    **Step 2 — In `onOpen` after `renderNameInput(contentEl)` (~line 166) and before `contentRegionEl` creation (~line 171), insert banner rendering call:**
    ```typescript
    // Phase 52 D-04: render validation banner BEFORE content region so the user sees it immediately.
    if (this.draftKind === 'json') {
      const vErr = (this.draft as JsonSnippet).validationError;
      if (vErr !== null) {
        this.renderValidationBanner(contentEl, vErr);
      }
    }
    ```

    **Step 3 — After `this.renderButtonRow(contentEl);` (~line 180) and before `void this.runCollisionCheck();`, disable the form when banner is active:**
    ```typescript
    // Phase 52 D-04: lock the form when the snippet is unusable.
    if (this.validationBannerEl !== null) {
      this.saveBtnEl.disabled = true;
      this.saveBtnEl.setAttribute(
        'title',
        'Сниппет содержит ошибку — исправьте источник и откройте заново.',
      );
      this.contentRegionEl.setAttribute('aria-disabled', 'true');
      this.contentRegionEl.style.pointerEvents = 'none';
      this.contentRegionEl.style.opacity = '0.5';
    }
    ```

    **Step 4 — Add new private method `renderValidationBanner`** (insert near other renderers, e.g., after `renderContentRegion` around :356):
    ```typescript
    /**
     * Phase 52 D-04: render a red banner above the form when the loaded snippet
     * has a non-null validationError (emitted by validatePlaceholders in Plan 02).
     * Uses textContent (never innerHTML) — T-52-09 mitigation.
     */
    private renderValidationBanner(container: HTMLElement, msg: string): void {
      const banner = container.createDiv({ cls: 'radi-snippet-editor-validation-banner' });
      banner.setAttribute('role', 'alert');
      const header = banner.createEl('p');
      header.textContent = 'Этот сниппет не может быть использован:';
      const body = banner.createEl('div');
      body.textContent = msg;
      this.validationBannerEl = banner;
    }
    ```

    **Step 5 — Modify `onClose`** (~:186-202) to null the banner ref. Insert inside `onClose` before `this.contentEl.empty();`:
    ```typescript
    this.validationBannerEl = null;
    ```

    **Step 6 — Update `updateCollisionUI` at :431-445** to NOT re-enable save if banner is active:
    ```typescript
    private updateCollisionUI(): void {
      if (!this.collisionErrorEl || !this.saveBtnEl) return;
      // Phase 52 D-04: validation banner locks save; collision state defers to banner.
      if (this.validationBannerEl !== null) return;
      if (this.hasCollision) {
        this.collisionErrorEl.style.display = '';
        this.saveBtnEl.disabled = true;
        this.saveBtnEl.setAttribute('title', 'Устраните конфликт имени, чтобы сохранить.');
      } else {
        this.collisionErrorEl.style.display = 'none';
        this.saveBtnEl.disabled = false;
        this.saveBtnEl.removeAttribute('title');
      }
    }
    ```

    **Step 7 — Append to `src/styles/snippet-manager.css`** the CSS block from <behavior> above. Place it at the END of the file with the `/* Phase 52: validation banner for SnippetEditorModal (D-04) */` header comment per CLAUDE.md append-only-per-phase rule.

    **Step 8 — Run `npm run build`** to regenerate `styles.css`. This is required before commit per CLAUDE.md.

    **Preservation rule:** Do NOT remove:
    - Any existing CSS rule in `snippet-manager.css` (append-only)
    - `renderTypeToggle`, `renderFolderDropdown`, `renderNameInput`, `renderContentRegion`, `switchKind`, `renderButtonRow`, `scheduleCollisionCheck`, `runCollisionCheck`, `computeCandidatePath`, `handleSave`, `handleCancel`, `runUnsavedGuard`, `safeResolve`
    - `cloneSnippet`, `emptyJsonDraft`, `emptyMdDraft` (Plan 02 already patched these — do not re-touch unless tsc requires)
  </action>
  <acceptance_criteria>
    - `grep -c "validationBannerEl" src/views/snippet-editor-modal.ts` ≥ 4 (field decl + render + onClose null + updateCollisionUI check)
    - `grep -c "renderValidationBanner" src/views/snippet-editor-modal.ts` ≥ 2 (decl + call)
    - `grep -c "radi-snippet-editor-validation-banner" src/views/snippet-editor-modal.ts` ≥ 1
    - `grep -c "radi-snippet-editor-validation-banner" src/styles/snippet-manager.css` ≥ 1
    - `grep -c "/\\* Phase 52" src/styles/snippet-manager.css` ≥ 1
    - `grep -c "innerHTML" src/views/snippet-editor-modal.ts` equals `0` (T-52-09)
    - `npx vitest run src/__tests__/views/snippet-editor-modal-banner.test.ts` exits `0` — all Plan 01 RED tests flip GREEN
    - `npm run build` exits `0`
    - `grep -c "Phase 52" styles.css` ≥ 1 (build regenerated the concatenated CSS; a direct edit to styles.css is forbidden per CLAUDE.md)
    - Build artifact `main.js` exists and size is within ±20% of the pre-plan baseline (sanity check for no accidental bundling regression)
    - `npx tsc --noEmit --skipLibCheck` exits `0`
    - Zero deletions in `src/styles/snippet-manager.css` (append-only): `git diff src/styles/snippet-manager.css | grep "^-" | grep -v "^---" | wc -l` equals `0`
  </acceptance_criteria>
  <verify>
    <automated>npx vitest run src/__tests__/views/snippet-editor-modal-banner.test.ts && npm run build && npx tsc --noEmit --skipLibCheck</automated>
  </verify>
  <done>
    SnippetEditorModal shows a red banner when validationError !== null, with Save disabled and content-region grayed out. Valid snippets unchanged. CSS appended to snippet-manager.css, styles.css regenerated, build green. All Plan 01 banner RED tests GREEN.
  </done>
</task>

<task id="52-04-02" type="auto" tdd="true">
  <title>Task 02: RunnerView validationError guards — handleSnippetFill + handleSnippetPickerSelection + tests</title>
  <read_first>
    - src/views/runner-view.ts lines 660-730 (renderSnippetPicker onSelect), 732-779 (handleSnippetPickerSelection), 782-849 (handleSnippetFill with Phase 51 D-14 at :788-795), 985-998 (renderError reusable method)
    - src/__tests__/views/runner-snippet-picker.test.ts (the fakeBrokenSnippet fixture added in Plan 01 Task 02)
    - .planning/phases/52-json-placeholder-rework/52-RESEARCH.md §"Where to Insert the validationError Guard" + §"Runner state at auto-insert failure"
    - .planning/phases/51-snippet-picker-overhaul/51-CONTEXT.md §D-13..D-16 (preserve these)
  </read_first>
  <behavior>
    - In `handleSnippetFill` (`src/views/runner-view.ts:782`):
      - AFTER `const snippet = await this.plugin.snippetService.load(absPath);` at :797
      - AFTER the `if (snippet === null) { ... return; }` block at :799-806
      - BEFORE the `if (snippet.kind === 'md') { ... }` block at :813
      - Insert: guard on `snippet.kind === 'json' && snippet.validationError !== null` → emit non-fatal `new Notice(...)` (RESEARCH recommendation for auto-insert path) + call `this.runner.stepBack()` + `void this.autoSaveSession()` + `this.render()` + `return`. This leaves the user on the Question node with a visible Russian notice, allowing them to pick another path.
    - In `renderSnippetPicker` onSelect callback at :683-703 (right before `await this.handleSnippetPickerSelection(snippet)`):
      - After the `if (snippet === null) { ... return; }` block at :693-700
      - Insert: guard on `snippet.kind === 'json' && snippet.validationError !== null` → render inline error INSIDE the picker's questionZone (using the existing `questionZone.empty(); questionZone.createEl('p', { cls: 'rp-empty-state-body', text: ... })` pattern at :694-700, adapted for Phase 52 wording). This matches the existing «Сниппет не найден» UX for consistency.
      - Do NOT call `this.runner.setError(...)` — keep session alive; user can press Step-back.
    - In `handleSnippetPickerSelection` at :732 (defensive — the above caller already blocks, but the function is called directly from other paths too):
      - As the FIRST check (before `this.capturePendingTextareaScroll()`):
      - Insert: `if (snippet.kind === 'json' && snippet.validationError !== null) { new Notice(snippet.validationError); return; }`.
      - Placement before the scroll capture is intentional — a rejected snippet never advances, so no scroll capture is needed.
    - Add 3 new tests to `src/__tests__/views/runner-snippet-picker.test.ts` in the Phase 52 describe block (append to what Plan 01 Task 02 created):
      - Test 1: `handleSnippetFill` with a snippet whose `validationError !== null` emits a `new Notice(...)` with the validationError text and calls `runner.stepBack` (mock `Notice` constructor or spy on it).
      - Test 2: `renderSnippetPicker` onSelect with broken snippet renders a `.rp-empty-state-body` with the validationError text and does NOT call `handleSnippetPickerSelection`.
      - Test 3: (happy path regression) valid snippet (`validationError: null`) continues to take the modal path — `handleSnippetPickerSelection` is called, modal opens.
  </behavior>
  <action>
    **Step 1 — Patch `handleSnippetFill` at :797-813** to insert the guard between null-check and kind-check:

    ```typescript
    const snippet = await this.plugin.snippetService.load(absPath);

    if (snippet === null) {
      questionZone.empty();
      questionZone.createEl('p', {
        text: `Snippet '${snippetId}' not found. The snippet may have been deleted. Use step-back to continue.`,
        cls: 'rp-empty-state-body',
      });
      return;
    }

    // Phase 52 D-04: validationError guard — non-fatal Notice + stepBack per RESEARCH recommendation.
    // Keeps session alive; user can pick another path. `snippet.kind === 'json'` narrow is required
    // because validationError lives on JsonSnippet only (MdSnippet has no placeholders).
    if (snippet.kind === 'json' && snippet.validationError !== null) {
      new Notice(
        `Сниппет «${snippet.path}» не может быть использован. ${snippet.validationError}`,
      );
      this.runner.stepBack();
      void this.autoSaveSession();
      this.render();
      return;
    }

    // Phase 51 D-14: .md auto-insert (Phase 51 full-path) — completeSnippet directly, no modal
    if (snippet.kind === 'md') {
      // ... (unchanged block)
    }
    ```

    Ensure `Notice` is imported at top of file (should already be; grep `import.*Notice` to confirm).

    **Step 2 — Patch `renderSnippetPicker` onSelect at :693-703:**

    Replace:
    ```typescript
    if (snippet === null) {
      // D-04-style inline error in picker — does NOT mutate runner state
      questionZone.empty();
      questionZone.createEl('p', {
        cls: 'rp-empty-state-body',
        text: `Сниппет не найден: ${result.relativePath}`,
      });
      return;
    }
    await this.handleSnippetPickerSelection(snippet);
    ```
    With:
    ```typescript
    if (snippet === null) {
      questionZone.empty();
      questionZone.createEl('p', {
        cls: 'rp-empty-state-body',
        text: `Сниппет не найден: ${result.relativePath}`,
      });
      return;
    }
    // Phase 52 D-04: validationError guard — inline error, keeps session alive.
    if (snippet.kind === 'json' && snippet.validationError !== null) {
      questionZone.empty();
      questionZone.createEl('p', {
        cls: 'rp-empty-state-body',
        text: `Сниппет «${snippet.path}» не может быть использован. ${snippet.validationError}`,
      });
      return;
    }
    await this.handleSnippetPickerSelection(snippet);
    ```

    **Step 3 — Add defensive guard to `handleSnippetPickerSelection` at :732:**

    Insert as the FIRST statement inside the method body:
    ```typescript
    private async handleSnippetPickerSelection(snippet: Snippet): Promise<void> {
      // Phase 52 D-04: validationError defensive guard. renderSnippetPicker
      // onSelect already intercepts this case; this guard covers any other
      // future caller routing a broken snippet here.
      if (snippet.kind === 'json' && snippet.validationError !== null) {
        new Notice(
          `Сниппет «${snippet.path}» не может быть использован. ${snippet.validationError}`,
        );
        return;
      }
      this.capturePendingTextareaScroll();  // RUNFIX-02 — remains the first non-guard line
      // ... (unchanged body)
    }
    ```

    **Step 4 — Append 3 tests to the Phase 52 describe block in `src/__tests__/views/runner-snippet-picker.test.ts`.** Use the Plan 01 `fakeBrokenSnippet` helper if it was declared at module scope; otherwise inline-declare per test. Pattern:

    ```typescript
    // Inside the Phase 52 describe appended in Plan 01 Task 02
    it('handleSnippetFill blocks a broken snippet with Notice + stepBack (Phase 52 D-04)', async () => {
      // Arrange: mock snippetService.load to return a broken JsonSnippet
      const broken: JsonSnippet = {
        kind: 'json',
        path: 'Protocols/Snippets/broken.json',
        name: 'broken',
        template: 'V: {{v}}',
        placeholders: [{ id: 'v', label: 'V', type: 'choice', options: [] }],
        validationError: 'Плейсхолдер "v" типа "choice" не содержит ни одного варианта. Добавьте варианты или удалите плейсхолдер.',
      };
      // ... (reuse the file's existing runnerView+mockPlugin pattern)
      // Act: trigger handleSnippetFill via the awaiting-snippet-fill state
      // Assert: Notice constructor was called with text containing validationError
      // Assert: mockRunner.stepBack was called
      // Assert: renderError was NOT called (session stays alive)
    });
    ```

    Similar shape for Test 2 (picker-click broken) and Test 3 (picker-click happy).

    Executor adapts the exact mock surface to match the file's existing conventions (the `fakeSnippet` mock at :316, the mock plugin setup used elsewhere in the file). If the existing test harness doesn't spy on `Notice`, add a module-level `vi.mock('obsidian', ...)` stub that captures Notice calls — consistent with other tests in the project that assert on Notice.

    **Preservation rule:** Do NOT touch:
    - `capturePendingTextareaScroll` or any RUNFIX-02 invariant (Phase 47 contract)
    - Phase 51 D-14 path-shape detection at :788-795 (isPhase51FullPath logic BYTE-IDENTICAL)
    - The zero-placeholder short-circuit at :831-836 (`if (snippet.placeholders.length === 0)`)
    - `renderSnippetPicker` SnippetTreePicker instantiation (Phase 51 D-07)
    - The existing `Сниппет не найден` copy at :697 (unchanged)
    - `handleSnippetPickerSelection` body after the new guard (pickSnippet, completeSnippet, modal.open, etc.)
  </action>
  <acceptance_criteria>
    - `grep -c "snippet.validationError !== null" src/views/runner-view.ts` ≥ 3 (handleSnippetFill + renderSnippetPicker onSelect + handleSnippetPickerSelection defensive)
    - `grep -c "не может быть использован" src/views/runner-view.ts` ≥ 2 (Notice + inline picker error)
    - `grep -c "innerHTML" src/views/runner-view.ts` equals `0`
    - Phase 51 D-14 path-shape guard string intact: `grep -c "isPhase51FullPath" src/views/runner-view.ts` equals its pre-plan count (≥ 2)
    - Phase 47 invariant intact: `grep -c "capturePendingTextareaScroll" src/views/runner-view.ts` equals or exceeds pre-plan count
    - `grep -c "Phase 52 D-04" src/views/runner-view.ts` ≥ 3 (one comment per guard insertion)
    - `grep -c "handleSnippetFill blocks a broken snippet" src/__tests__/views/runner-snippet-picker.test.ts` equals `1`
    - `npx vitest run src/__tests__/views/runner-snippet-picker.test.ts` exits `0` — 3 new tests GREEN + all existing tests still GREEN
    - `npm test` full suite: total PASS = (Plan 03 baseline) + 3 new runner guard tests + any other net-new tests, zero regressions
    - `npm run build` exits `0` (no CSS changes in this task but build must still succeed)
    - `npx tsc --noEmit --skipLibCheck` exits `0`
    - Zero deletions in runner-view.ts outside the 3 insertion points: `git diff src/views/runner-view.ts | grep "^-" | grep -v "^---" | wc -l` reports only removed-line counts consistent with replacing the pre-plan «Сниппет не найден» block (which stays intact — we only inserted after it) — i.e. executor verifies there are no accidental deletions.
  </acceptance_criteria>
  <verify>
    <automated>npx vitest run src/__tests__/views/runner-snippet-picker.test.ts && npm test && npm run build</automated>
  </verify>
  <done>
    handleSnippetFill (auto-insert D-14 path) surfaces a non-fatal Notice + stepBack on validationError; renderSnippetPicker onSelect (D-16 picker-click path) renders inline error; handleSnippetPickerSelection has a defensive guard. 3 new runner tests GREEN. Phase 51 D-14 and Phase 47 invariants preserved.
  </done>
</task>

</tasks>

<verification>
After both tasks, run the full Phase 52 test matrix + build:

```bash
npm test && npm run build && npx tsc --noEmit --skipLibCheck
```

Expected:
- Full test suite GREEN
- Vitest reports total count = Plan 03 baseline + ~3 new runner tests
- npm run build succeeds and deploys main.js to TEST-BASE dev vault (per esbuild devVaultCopyPlugin)
- styles.css regenerated with Phase 52 banner CSS included

Manual sanity:
- Grep `'outstanding RED tests from Plan 01' = 0` — every Plan 01 test file is now fully GREEN.
</verification>

<success_criteria>
- D-04 SnippetEditorModal: banner + disabled save + read-only content region on broken snippet; unchanged behaviour on valid snippet
- D-04 RunnerView auto-insert path: non-fatal Notice + stepBack + session alive
- D-04 RunnerView picker-click path: inline error + session alive
- CSS appended to `src/styles/snippet-manager.css` with Phase 52 comment; styles.css regenerated by build
- Phase 51 D-14 + Phase 47 RUNFIX invariants preserved byte-for-byte in runner-view.ts
- Full vitest suite green; full build green
- No `innerHTML` in any Phase 52 edit (T-52-09 / T-52-10 compliance)
</success_criteria>

<output>
After completion, create `.planning/phases/52-json-placeholder-rework/52-04-SUMMARY.md` with:
- 1-2 commit SHAs per task
- Final total test count vs Plan 03 baseline (+banner tests +3 runner tests)
- Confirmation that every Plan 01 RED test is now GREEN (D-03 + D-05 + D-06 + D-09 + D-04 banner + D-04 runner)
- Build artifact sizes (main.js before/after; should be +2-5KB for banner + guards)
- CSS diff: only additions; `styles.css` regenerated
- Deviations per GSD Rule 1/2/3
- Note that Plan 05 (UAT) can now exercise the full unified-choice + validation flow in dev-vault
</output>
