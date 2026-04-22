---
phase: 52
plan: 03
type: tdd
wave: 3
depends_on:
  - 52-02
files_modified:
  - src/views/snippet-chip-editor.ts
  - src/views/snippet-fill-in-modal.ts
autonomous: true
requirements:
  - PHLD-01
tags:
  - ui-narrowing
  - unified-choice
  - green
  - phase-52
must_haves:
  truths:
    - "snippet-chip-editor's PH_COLOR has exactly 2 keys ('free-text' and 'choice'), matching the narrowed union"
    - "snippet-chip-editor's `+ Add placeholder` mini-form type-select shows exactly 2 options"
    - "snippet-chip-editor's expanded-placeholder type-dropdown shows exactly 2 options"
    - "renderNumberExpanded function is deleted; renderExpandedPlaceholder is the sole expanded renderer"
    - "The Разделитель field is rendered for ALL `choice` placeholders (not just multi-choice), bound to ph.separator"
    - "snippet-fill-in-modal's renderField has exactly 2 branches (free-text → renderFreeTextField, choice → renderChoiceField with isMulti=true)"
    - "renderNumberField function is deleted"
    - "renderChoiceField reads placeholder.separator (not joinSeparator) and always renders checkboxes"
    - "D-06 Custom free-text override behaviour is byte-identical to Phase 31"
    - "All Plan 01 snippet-fill-in-modal.test.ts RED tests flip GREEN"
    - "Plan 01 snippet-chip-editor.test.ts Phase-52 probes A1/A3/A4 flip GREEN"
  artifacts:
    - path: src/views/snippet-chip-editor.ts
      provides: "narrowed 2-type UI: PH_COLOR, miniTypeSelect, phTypesLocal, separator field rename, renderNumberExpanded deleted"
      contains: "'free-text': 'var(--color-cyan)'"
    - path: src/views/snippet-fill-in-modal.ts
      provides: "unified-choice dispatch + checkbox-only rendering + separator rename"
      contains: "placeholder.separator ?? ', '"
  key_links:
    - from: snippet-chip-editor PH_COLOR
      to: SnippetPlaceholder['type'] (snippet-model.ts)
      via: "Record<SnippetPlaceholder['type'], string>"
      pattern: "Record<SnippetPlaceholder\\['type'\\], string>"
    - from: snippet-fill-in-modal renderField
      to: renderChoiceField(isMulti: true)
      via: "simplified dispatch: 2 branches instead of 4"
      pattern: "renderChoiceField\\(.*true\\)"
---

<objective>
Narrow the snippet UI tier (chip editor + fill-in modal) to match the Plan 02 model shape. Remove every reference to `'number'`, `'multi-choice'`, `renderNumberField`, `renderNumberExpanded`, `joinSeparator`, and `unit` from the two view files. Flip Plan 01's remaining RED tests in `snippet-fill-in-modal.test.ts` and `snippet-chip-editor.test.ts` Phase-52 probes to GREEN.

Implements: D-05 (unified choice = checkbox-list always), D-06 (Custom override preserved), D-09 (empty choice = ''), plus the UI-side tail of D-01/D-02/D-07.

Purpose: After Plan 02, the model and service speak the new 2-type contract but the UI still renders 4 selector options + a 'number'-specific expanded form + a joinSeparator input. This plan closes that gap in one atomic commit per file so tsc stays green and the dev-vault UAT in Plan 05 exercises the real unified flow.

Output: Chip editor renders 2 types only, uses `separator` everywhere the user sees it; fill-in modal renders checkboxes only for `choice`, reads `placeholder.separator`, preserves Custom override.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/52-json-placeholder-rework/52-CONTEXT.md
@.planning/phases/52-json-placeholder-rework/52-RESEARCH.md
@.planning/phases/52-json-placeholder-rework/52-02-SUMMARY.md
@.planning/phases/51-snippet-picker-overhaul/51-CONTEXT.md
@CLAUDE.md

<interfaces>
<!-- The stable public surface of both view files. Task 01/02 preserve these. -->

From src/views/snippet-chip-editor.ts (after this plan):
```typescript
export interface ChipEditorHandle { destroy(): void; }
export function mountChipEditor(
  container: HTMLElement,
  draft: JsonSnippet,
  onChange: () => void,
  options?: { skipName?: boolean },
): ChipEditorHandle;
```

From src/views/snippet-fill-in-modal.ts (after this plan):
```typescript
export class SnippetFillInModal extends Modal {
  constructor(app: App, snippet: JsonSnippet);
  readonly result: Promise<string | null>;
  onOpen(): void;
  onClose(): void;
}
```

Neither file's exported surface changes. All changes are internal.
</interfaces>
</context>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Chip editor option input → draft.placeholders[i].options[j] | Direct string mutation into user-authored snippet; no trust beyond CLAUDE V5 standard |
| Fill-in modal Custom input / checkboxes → snippet template substitution | User-run Runner interpolation; output is later inserted into Runner textarea (user-visible) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-52-07 | Tampering | Разделитель input writes directly to ph.separator | accept | User authoring their own snippet; sanitizeJson at save-time strips control chars (existing Phase 32 V5 control). |
| T-52-08 | Tampering | checkbox dispatch still renders for legacy-typed placeholder carried on disk | mitigate | After Plan 02, a legacy-typed snippet enters Editor with `validationError !== null` → Plan 04 banner blocks rendering. Even if blocked surface is bypassed, renderField's narrowed dispatch has NO arm for `'number'`/`'multi-choice'` — unknown type renders nothing (defensive silence). |
</threat_model>

<tasks>

<task id="52-03-01" type="auto" tdd="true">
  <title>Task 01: Narrow snippet-chip-editor — PH_COLOR, mini type-select, expanded type-select, delete renderNumberExpanded, rename joinSeparator→separator, extend Разделитель to all choice</title>
  <read_first>
    - src/views/snippet-chip-editor.ts (entire — 494 lines; critical lines 28-34 PH_COLOR, 143-208 mini form, 294-298 expand dispatch, 351-377 type-change handler, 429-463 join separator + renderNumberExpanded)
    - src/__tests__/views/snippet-chip-editor.test.ts (the Plan 01 Phase-52 RED tests A1/A3/A4/A5)
    - .planning/phases/52-json-placeholder-rework/52-RESEARCH.md §"Dead-Code Audit" → "src/views/snippet-chip-editor.ts"
  </read_first>
  <behavior>
    - `PH_COLOR` becomes 2 keys matching the narrowed union: `{ 'free-text': 'var(--color-cyan)', 'choice': 'var(--color-orange)' }`.
    - `phTypes` (mini-form) and `phTypesLocal` (expanded type-change dropdown) arrays hold exactly 2 entries in this order: `{value:'free-text', label:'Free text'}`, `{value:'choice', label:'Choice'}`.
    - The new-placeholder factory (`:192-199`) drops the `'multi-choice' ? { joinSeparator: ', ' }` and `'number' ? { unit: '' }` spreads. For `'choice'`, `options: []` is initialised. No separator initialisation (default-at-read is handled by the Разделитель section in the expanded form).
    - The chip-click expand dispatch (`:294-298`) becomes a single call to `renderExpandedPlaceholder(...)` — no more `if (ph.type === 'number') renderNumberExpanded(...)` branch.
    - The expanded type-change handler (`:362-377`) simplifies: on change to `'choice'`, ensure `options = options ?? []` and `separator = separator ?? ', '` (optional default). On change to `'free-text'`, clear `options` and `separator` via `delete` (or set to `undefined`) so disk payload stays minimal.
    - The Разделитель (Join separator) section (`:429-442`) is now rendered for ALL `choice` placeholders (not guarded by `if (ph.type === 'multi-choice')`). Label text: «Разделитель» (Russian per user-facing copy convention; executor may keep English «Join separator» if existing project UI is English elsewhere — Claude's Discretion per CONTEXT § Claude's Discretion). Input bound to `ph.separator` with default placeholder `, `.
    - `renderNumberExpanded` function (`:445-463`) deleted in full.
    - All `ph.unit` references deleted.
    - All `joinSeparator` references renamed to `separator`.
  </behavior>
  <action>
    Edit `src/views/snippet-chip-editor.ts` in place. Detailed step-by-step:

    **Patch 1 — PH_COLOR (:29-34):**
    Replace the 4-key dictionary with 2:
    ```typescript
    // Phase 27 D-02 / Phase 52 D-01: fixed colour bar per placeholder type (narrowed to 2)
    const PH_COLOR: Record<SnippetPlaceholder['type'], string> = {
      'free-text':    'var(--color-cyan)',
      'choice':       'var(--color-orange)',
    };
    ```

    **Patch 2 — phTypes (:143-148):**
    ```typescript
    const phTypes: Array<{ value: SnippetPlaceholder['type']; label: string }> = [
      { value: 'free-text', label: 'Free text' },
      { value: 'choice', label: 'Choice' },
    ];
    ```

    **Patch 3 — new-placeholder factory (:191-199):**
    ```typescript
    const phType = miniTypeSelect.value as SnippetPlaceholder['type'];
    const newPh: SnippetPlaceholder = {
      id: slug,
      label: rawLabel,
      type: phType,
      ...(phType === 'choice' ? { options: [] } : {}),
    };
    ```
    Delete the two spreads: `...(phType === 'multi-choice' ? ...)` and `...(phType === 'number' ? ...)`.

    **Patch 4 — chip-click expand dispatch (:287-302):**
    ```typescript
    on(chip, 'click', (e: MouseEvent) => {
      if (
        e.target === removeBtn ||
        (e.target as HTMLElement).closest('.rp-placeholder-chip-handle')
      ) return;
      chip.toggleClass('is-expanded', !chip.hasClass('is-expanded'));
      if (chip.hasClass('is-expanded')) {
        renderExpandedPlaceholder(ph, chip, labelSpan, badge);
      } else {
        chip.querySelector('.rp-placeholder-expanded')?.remove();
      }
    });
    ```
    Delete the `if (ph.type === 'number') { renderNumberExpanded(...) } else { ... }` fork.

    **Patch 5 — phTypesLocal (:351-356):**
    ```typescript
    const phTypesLocal: Array<{ value: SnippetPlaceholder['type']; label: string }> = [
      { value: 'free-text', label: 'Free text' },
      { value: 'choice', label: 'Choice' },
    ];
    ```

    **Patch 6 — type-change handler (:362-380):**
    ```typescript
    on(typeSelect, 'change', () => {
      ph.type = typeSelect.value as SnippetPlaceholder['type'];
      badge.textContent = ph.type;
      if (ph.type === 'choice') {
        if (!ph.options) ph.options = [];
      } else {
        // free-text: drop choice-only fields
        ph.options = undefined;
        ph.separator = undefined;
      }
      renderExpandedPlaceholder(ph, row, labelSpan, badge);
      onChange();
    });
    ```
    Note: all references to `ph.joinSeparator` and `ph.unit` are gone. Type system (post-Plan-02) does not have those fields so any stale reference is a tsc error.

    **Patch 7 — Separator section (:428-442):**
    Remove the `if (ph.type === 'multi-choice')` guard; always render for `choice`. Rename `joinSeparator` → `separator`. Result:
    ```typescript
    // Phase 52 D-02/D-05: Разделитель rendered for all choice placeholders
    if (ph.type === 'choice') {
      const sepSec = expanded.createDiv({ cls: 'rp-snippet-form-section' });
      const sepLabel = sepSec.createEl('label');
      sepLabel.textContent = 'Разделитель';
      sepLabel.htmlFor = `rp-ph-sep-${ph.id}`;
      const sepInput = sepSec.createEl('input', { type: 'text' });
      sepInput.id = `rp-ph-sep-${ph.id}`;
      sepInput.value = ph.separator ?? ', ';
      sepInput.placeholder = ', ';
      on(sepInput, 'input', () => {
        ph.separator = sepInput.value;
        onChange();
      });
    }
    ```

    **Patch 8 — Delete renderNumberExpanded (:445-463):**
    Remove the entire `function renderNumberExpanded(ph, row) { ... }` declaration.

    **Preservation rule (CLAUDE.md Standing Pitfall 8):** Do NOT touch:
    - `insertAtCursor` helper
    - `mountChipEditor` signature (`(container, draft, onChange, options?)` with `skipName` destructure)
    - Drag-reorder handlers (`onRaw(chip, 'dragstart', ...)` etc. :255-285)
    - Template textarea + `refreshOrphanBadges` wiring
    - `renderOptionRows` + `+ Add option` button — D-08 verdict (not reproducible) means THIS code stays byte-identical
    - `refreshOrphanBadges` bottom-of-file helper
    - `destroy` handle
    If tsc complains about a field, it's because your edit elsewhere left a stray reference. Fix via deletion of the stray, not via preservation of the old field.
  </action>
  <acceptance_criteria>
    - `grep -c "'multi-choice'" src/views/snippet-chip-editor.ts` equals `0`
    - `grep -c "'number'" src/views/snippet-chip-editor.ts` equals `0`
    - `grep -c "joinSeparator" src/views/snippet-chip-editor.ts` equals `0`
    - `grep -c "renderNumberExpanded" src/views/snippet-chip-editor.ts` equals `0`
    - `grep -c "ph.unit" src/views/snippet-chip-editor.ts` equals `0`
    - `grep -c "ph.separator" src/views/snippet-chip-editor.ts` ≥ 2 (value read + value write)
    - `grep -c "'free-text'" src/views/snippet-chip-editor.ts` ≥ 4 (PH_COLOR + 2 dropdown arrays + factory)
    - `grep -c "'choice'" src/views/snippet-chip-editor.ts` ≥ 5
    - PH_COLOR is declared exactly once with exactly 2 keys (verify by counting entries: `grep -A 4 "const PH_COLOR" src/views/snippet-chip-editor.ts` shows 2 key-value lines)
    - `npx vitest run src/__tests__/views/snippet-chip-editor.test.ts` exits `0` — tests A1/A3/A4 flip GREEN (A2 was already GREEN; A5 probe either GREEN or documented skip)
    - `npx tsc --noEmit --skipLibCheck` exits `0`
    - `git diff --stat src/views/snippet-chip-editor.ts` shows ~20-40 lines changed, entirely inside the sections specified
    - Zero deletions of the options-list rendering (`renderOptionRows` + `+ Add option` + drag-reorder) — SC 2 GREEN preserved
  </acceptance_criteria>
  <verify>
    <automated>npx vitest run src/__tests__/views/snippet-chip-editor.test.ts src/__tests__/snippet-model.test.ts && npx tsc --noEmit --skipLibCheck</automated>
  </verify>
  <done>
    snippet-chip-editor.ts speaks the 2-type contract: PH_COLOR narrowed, both selects narrowed, Разделитель rendered for all `choice`, `renderNumberExpanded` / `unit` / `joinSeparator` gone, option-list and drag-reorder untouched. A1/A3/A4 RED tests flip GREEN.
  </done>
</task>

<task id="52-03-02" type="auto" tdd="true">
  <title>Task 02: Narrow snippet-fill-in-modal — 2-branch renderField, delete renderNumberField, unified checkbox rendering, rename joinSeparator→separator</title>
  <read_first>
    - src/views/snippet-fill-in-modal.ts (entire — 255 lines; critical: 85-98 renderField, 113-129 renderNumberField, 136-212 renderChoiceField with isMulti param at :160 joinSeparator line)
    - src/__tests__/views/snippet-fill-in-modal.test.ts (Plan 01 RED contract this must GREEN)
    - .planning/phases/52-json-placeholder-rework/52-RESEARCH.md §"Fill-in Modal — Unified choice Rendering"
  </read_first>
  <behavior>
    - `renderField` dispatch narrowed to exactly 2 branches: `'free-text' → renderFreeTextField`; `'choice' → renderChoiceField(fieldDiv, placeholder, true)`.
    - `renderNumberField` function deleted in full.
    - `renderChoiceField` — drop the `isMulti: boolean` parameter OR hardcode `true` at call site (executor's choice; RESEARCH §prefers dropping the param). Either way, the `inputType = isMulti ? 'checkbox' : 'radio'` dispatch becomes unconditional `'checkbox'`. The `if (isMulti) { ... join(sep) } else { ... single }` fork becomes a single multi-branch.
    - `placeholder.joinSeparator` → `placeholder.separator` at :160 (was the only consumer).
    - Custom-override behaviour (`customInput.addEventListener('input', ...)`) byte-identical — Phase 31 D-09 preserved per CONTEXT D-06.
    - Empty state: 0 boxes checked + empty Custom → `this.values[placeholder.id] = ''` per D-09. No code change needed; this follows naturally from the unconditional multi-branch (empty filtered array `.join('')` returns `''`).
  </behavior>
  <action>
    Edit `src/views/snippet-fill-in-modal.ts` in place.

    **Patch 1 — renderField (:85-98):**
    ```typescript
    private renderField(placeholder: SnippetPlaceholder): void {
      const fieldDiv = this.contentEl.createDiv({ cls: 'rp-snippet-modal-field' });
      if (placeholder.type === 'free-text') {
        this.renderFreeTextField(fieldDiv, placeholder);
      } else if (placeholder.type === 'choice') {
        this.renderChoiceField(fieldDiv, placeholder);
      }
      // Phase 52: unknown types render nothing. Plan 04 guards upstream via validationError.
    }
    ```

    **Patch 2 — Delete renderNumberField (:113-129):** remove the whole private method.

    **Patch 3 — renderChoiceField signature and body (:136-212):**
    Drop the `isMulti: boolean` parameter. Inside the function:
    - Replace `const sep = placeholder.joinSeparator ?? ', ';` at :160 with `const sep = placeholder.separator ?? ', ';`
    - Remove the `else` branch `if (isMulti) { ... } else { const selected = checkboxEls.find(cb => cb.checked); ... }` at :162-165 — keep only the `isMulti` branch logic (it correctly handles 0, 1, ≥2 checked).
    - Replace `const inputType = isMulti ? 'checkbox' : 'radio';` at :176 with `const inputType = 'checkbox';`

    Final renderChoiceField shape (roughly):
    ```typescript
    private renderChoiceField(
      container: HTMLElement,
      placeholder: SnippetPlaceholder,
    ): void {
      const fieldset = container.createEl('fieldset');
      const legend = fieldset.createEl('legend', { cls: 'rp-snippet-modal-label' });
      legend.textContent = placeholder.label;

      const optionsDiv = fieldset.createDiv({ cls: 'rp-snippet-modal-options' });
      const options = placeholder.options ?? [];

      const checkboxEls: HTMLInputElement[] = [];
      let customInput: HTMLInputElement | null = null;

      const recomputeValue = (): void => {
        if (customInput && customInput.value.trim() !== '') {
          this.values[placeholder.id] = customInput.value.trim();
        } else {
          const selected = checkboxEls.filter(cb => cb.checked).map(cb => cb.value);
          const sep = placeholder.separator ?? ', ';
          this.values[placeholder.id] = selected.join(sep);
        }
        this.updatePreview();
      };

      for (const opt of options) {
        const row = optionsDiv.createDiv();
        row.style.display = 'flex';
        row.style.alignItems = 'center';
        row.style.gap = '4px';

        const ctrl = row.createEl('input', { type: 'checkbox' });
        ctrl.name = `rp-${placeholder.id}`;
        ctrl.value = opt;

        const lbl = row.createEl('label');
        lbl.textContent = opt;

        checkboxEls.push(ctrl);

        ctrl.addEventListener('change', () => {
          if (customInput) customInput.value = '';
          recomputeValue();
        });
      }

      // Custom: free-text override (D-06 preserved verbatim from Phase 31 D-09)
      const customRow = optionsDiv.createDiv({ cls: 'rp-snippet-modal-custom-row' });
      const customLabel = customRow.createEl('label');
      customLabel.textContent = 'Custom:';

      customInput = customRow.createEl('input', { type: 'text' });
      customInput.setAttribute('aria-label', `Custom value for ${placeholder.label}`);

      customInput.addEventListener('input', () => {
        if (customInput && customInput.value.trim() !== '') {
          for (const cb of checkboxEls) cb.checked = false;
        }
        recomputeValue();
      });
    }
    ```

    **Preservation rule:** Do NOT touch:
    - Constructor, `onOpen`, `onClose`, `safeResolve`, `result` promise
    - `renderFreeTextField`
    - `renderPreview`, `updatePreview`, `renderButtonRow` (they read from `this.values[placeholder.id]` unchanged)
    - The field-div class name `rp-snippet-modal-field`
  </action>
  <acceptance_criteria>
    - `grep -c "renderNumberField" src/views/snippet-fill-in-modal.ts` equals `0`
    - `grep -c "joinSeparator" src/views/snippet-fill-in-modal.ts` equals `0`
    - `grep -c "placeholder.unit" src/views/snippet-fill-in-modal.ts` equals `0`
    - `grep -c "'multi-choice'" src/views/snippet-fill-in-modal.ts` equals `0`
    - `grep -c "'number'" src/views/snippet-fill-in-modal.ts` equals `0`
    - `grep -c "type === 'choice'" src/views/snippet-fill-in-modal.ts` ≥ 1
    - `grep -c "placeholder.separator" src/views/snippet-fill-in-modal.ts` equals `1`
    - `grep -c "inputType" src/views/snippet-fill-in-modal.ts` equals `0` OR `grep -c "type: 'checkbox'" src/views/snippet-fill-in-modal.ts` ≥ 1 (executor's choice of implementation)
    - `grep -c "isMulti" src/views/snippet-fill-in-modal.ts` equals `0`
    - `npx vitest run src/__tests__/views/snippet-fill-in-modal.test.ts` exits `0` — all 9 Plan 01 tests flip GREEN
    - `npx tsc --noEmit --skipLibCheck` exits `0`
    - `git diff --stat src/views/snippet-fill-in-modal.ts` shows ~30-50 lines changed (the field simplification is sizeable), entirely inside renderField + renderNumberField (delete) + renderChoiceField
    - Zero deletions of unrelated code (constructor / onOpen / onClose / renderPreview / updatePreview / renderButtonRow)
  </acceptance_criteria>
  <verify>
    <automated>npx vitest run src/__tests__/views/snippet-fill-in-modal.test.ts && npx tsc --noEmit --skipLibCheck</automated>
  </verify>
  <done>
    snippet-fill-in-modal.ts dispatches 2 branches only; renderNumberField deleted; checkbox-only rendering; reads placeholder.separator; Custom override preserved; all 9 Plan 01 RED tests flip GREEN.
  </done>
</task>

</tasks>

<verification>
After both tasks:

```bash
npx vitest run src/__tests__/snippet-model.test.ts src/__tests__/snippet-service-validation.test.ts src/__tests__/views/snippet-fill-in-modal.test.ts src/__tests__/views/snippet-chip-editor.test.ts src/__tests__/views/runner-snippet-picker.test.ts && npx tsc --noEmit --skipLibCheck
```

Expected: ALL GREEN except the banner-specific tests in snippet-editor-modal-banner.test.ts (Plan 04 owns those).

Full suite `npm test`: target `previous + 9 (chip-editor Phase 52 probes) + 9 (fill-in-modal)` GREEN from Plan 02 baseline. Only Plan-04-owned banner RED tests remain.
</verification>

<success_criteria>
- D-01 UI tail: zero `'number'`/`'multi-choice'` in either view file
- D-02 UI tail: zero `joinSeparator` anywhere in src/ after this plan (combined with Plan 02 service/model)
- D-05: fill-in modal renders checkboxes only
- D-06: Custom override behaviour byte-identical
- D-07 UI tail: renderNumberField + renderNumberExpanded + unit references gone
- Plan 01 snippet-fill-in-modal.test.ts fully GREEN
- Plan 01 snippet-chip-editor.test.ts Phase-52 probes GREEN
- tsc green; no build-step required yet (CSS untouched — Plan 04 may add banner CSS)
</success_criteria>

<output>
After completion, create `.planning/phases/52-json-placeholder-rework/52-03-SUMMARY.md` with:
- 2 commit SHAs (one per task OR one combined)
- Before/after test counts — target: +18 GREEN vs Plan 02 baseline (9 chip-editor + 9 fill-in-modal)
- Confirmation that every Plan 02 tsc-tolerance cast (if any) is now removed
- Confirmation Plan 04 can proceed
- Deviations per GSD Rule 1/2/3
</output>
