---
phase: 52
type: uat
status: pending
created: 2026-04-20
---

# Phase 52 — User Acceptance Testing

**Build:** `main.js` produced by `npm run build` (tsc + esbuild production) from HEAD after Plan 52-04 (commit `55f7c6a`); deployed via esbuild `devVaultCopyPlugin` to `Z:\documents\vaults\TEST-BASE\.obsidian\plugins\radiprotocol\main.js` on 2026-04-20.
**Tests:** 642 passed / 1 skipped / 0 failed (47 files, vitest 4.1.2).
**Tester:** shulgharoman@gmail.com

---

## Automated Gates (Task 01 of Plan 05) — 2026-04-20

- [x] `npm test` — **642** passed / **1** skipped / **0** failed (baseline Plan 04: 642/1/0 → zero regression)
- [x] `npm run build` — exit 0; `main.js` deployed to TEST-BASE (`Z:\documents\vaults\TEST-BASE\.obsidian\plugins\radiprotocol`) via esbuild `devVaultCopyPlugin`
- [x] `npx tsc --noEmit --skipLibCheck` — exit 0
- [x] Static audit: zero `'multi-choice'` / `'multichoice'` / `joinSeparator` / `ph.unit` as **live literal values** in production src/ (remaining hits are all in the `snippet-model.ts` validator `legacyTypes` Set — which must contain these strings to REJECT legacy types — and in docs-only comments that describe the rename). Raw counts, with justifications:
  - `'multi-choice'` → 3 hits in `src/snippets/snippet-model.ts` (2 comments documenting the rename + 1 `legacyTypes` Set entry — intentional per D-01 validator contract)
  - `'multichoice'` → 2 hits in `src/snippets/snippet-model.ts` (1 comment + 1 `legacyTypes` Set entry — intentional)
  - `type: 'number'` as placeholder literal → 0 (pass)
  - `=== 'number'` in placeholder-type context → 1 hit in `src/graph/canvas-parser.ts:55` (`typeof v === 'number'` — unrelated JS type guard, not a placeholder-type literal; pass)
  - `joinSeparator` → 1 hit in `src/snippets/snippet-model.ts` (doc comment «Renamed from legacy `joinSeparator`» — no live use)
  - `ph.unit` / `placeholder.unit` → 0 (pass)
- [x] `validationError` appears in **28** production src/ hits (≥ 5 required)
- [x] Banner class `radi-snippet-editor-validation-banner` present in regenerated `styles.css` — **2** hits (selector rule + descendant rule)
- [x] No `innerHTML` in any Phase 52-edited file (T-52-09/T-52-10) — grep across `src/snippets/snippet-model.ts`, `src/snippets/snippet-service.ts`, `src/views/snippet-chip-editor.ts`, `src/views/snippet-fill-in-modal.ts`, `src/views/snippet-editor-modal.ts` returns **0 files**
- [x] Phase 51 D-14 + Phase 47 RUNFIX-02 invariants preserved:
  - `isPhase51FullPath` in `src/views/runner-view.ts` = **3** (unchanged from pre-plan baseline per Plan 04 SUMMARY; ≥ 2 required)
  - `capturePendingTextareaScroll` in `src/views/runner-view.ts` = **6** (unchanged from pre-plan baseline per Plan 04 SUMMARY)
- [x] Phase 51 D-13 auto-insert arm still present — `radiprotocol_snippetPath` / `snippet-fill` / `awaiting-snippet-fill` grep in `src/runner/protocol-runner.ts` = **20** hits (≥ 1 required)

**Verdict (automated gate):** PASS. All 10 static audits satisfied (non-zero results on narrow-union greps are justified in-place as validator-required legacy detection strings or unrelated JS type guards, matching the 52-04 SUMMARY self-check). Phase 52 passes the automated integration gate and is ready for human UAT in TEST-BASE.

---

## Manual Scenarios (Task 02 — human UAT)

### Scenario 1 — D-08 options-list roundtrip (SC 2)

**Arrange:**
1. Open TEST-BASE dev vault in Obsidian.
2. Open Snippet Manager.
3. Create a new JSON snippet via «+ Новый» → JSON.
4. Name: `phase52-options-roundtrip-test`. Click Create.

**Act:**
5. Click «+ Add placeholder»; Label: «Side»; Type: «Choice»; Add.
6. Click the new placeholder chip to expand.
7. Click «+ Add option» three times.
8. Fill in: «Left», «Right», «Bilateral».
9. Click × on the middle option to remove it.
10. Type into a remaining option input to edit it.
11. Click Save.
12. Close the modal.
13. Re-open the snippet from the Manager tree.

**Assert:**
- Options persist after save/reload: two entries remain, with the edited value reflected.
- Add/edit/remove all work without UI glitch.

**User resume signal:** _____________________

### Scenario 2 — D-02 separator rename (SC 1)

**Arrange:** Same snippet from Scenario 1 (or fresh).

**Act:**
1. Re-expand the Choice placeholder.
2. Confirm «Разделитель» (or «Join separator» — executor's label choice per Plan 03) field is visible and pre-filled with `, `.
3. Change separator to ` / `.
4. Save and close.
5. Open the .json file in a text editor (outside Obsidian).

**Assert:**
- On disk: placeholder object has `"separator": " / "` field.
- On disk: NO `"joinSeparator"` field.

**User resume signal:** _____________________

### Scenario 3 — D-05 unified choice multi-select in Runner (SC 3)

**Arrange:**
1. Edit snippet from Scenario 2: template = `Side: {{side}}`.
2. Add options to the Side placeholder: «Left», «Right», «Bilateral».
3. Save.
4. Create a canvas with a Question node → edge → Snippet node bound to this snippet.
5. Open Protocol Runner and start the canvas.

**Act:**
6. Reach the Snippet step and open the fill-in modal.
7. Observe: the Side placeholder renders CHECKBOXES (not radios), plus a Custom input below.
8. Check one option → observe live preview inserts that option verbatim.
9. Check a second option → preview shows the two values joined by the chosen separator.
10. Type a value into Custom → preview shows only the Custom value (checkboxes visually cleared).
11. Clear Custom → preview reverts to checkbox state.
12. Confirm. Observe the inserted text in the Runner textarea.

**Assert:**
- All 5 behaviours (checkbox render, single select, multi join, Custom override, Custom clear) work as expected.

**User resume signal:** _____________________

### Scenario 4 — D-04 SnippetEditorModal banner (SC 4, editor surface)

**Arrange:**
1. Open TEST-BASE file system outside Obsidian.
2. Create a legacy .json snippet at `Protocols/Snippets/legacy-number.json` with contents:
   ```json
   { "template": "Size: {{sz}}", "placeholders": [{ "id": "sz", "label": "Size", "type": "number", "unit": "mm" }] }
   ```
3. Refresh Snippet Manager.

**Act:**
4. Click the `legacy-number` entry to open the editor modal.

**Assert:**
- A red banner appears above the form with Russian text mentioning «удалённый тип "number"» and placeholder id «sz».
- «Сохранить» / Save button is disabled.
- The chip-editor section is visually grayed out / not interactive.

**User resume signal:** _____________________

### Scenario 5 — D-04 RunnerView error surface (SC 4, runner surface)

**Arrange:**
1. Keep the legacy-number.json from Scenario 4.
2. Create a canvas referencing `legacy-number.json` via either directory-bound (Snippet node with subfolderPath to Protocols/Snippets + user picks) or file-bound (Phase 51 radiprotocol_snippetPath="legacy-number.json").

**Act:**
3. Start the Runner; reach the snippet step.
4a. For picker-click path (directory-bound): click the legacy-number row in the snippet picker.
4b. For auto-insert path (file-bound with single-edge Question → Snippet): observe the auto-advance.

**Assert:**
- For 4a: inside the picker, an inline Russian error message appears naming the path and citing `«удалённый тип "number"»`. The Runner remains on the picker; session is alive; Step-back works.
- For 4b: a non-fatal Notice pops up with the Russian error text; the Runner steps back to the Question and the user can pick another path.

**User resume signal:** _____________________

## Sign-off

- [ ] Scenario 1 PASS
- [ ] Scenario 2 PASS
- [ ] Scenario 3 PASS
- [ ] Scenario 4 PASS
- [ ] Scenario 5 PASS

---
User final approval signal: _____________________

PHLD-01 status → closed on 2026-04-XX
