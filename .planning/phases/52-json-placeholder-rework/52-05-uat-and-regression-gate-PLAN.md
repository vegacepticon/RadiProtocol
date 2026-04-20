---
phase: 52
plan: 05
type: execute
wave: 5
depends_on:
  - 52-04
files_modified:
  - .planning/phases/52-json-placeholder-rework/52-UAT.md
  - .planning/phases/52-json-placeholder-rework/52-05-SUMMARY.md
  - .planning/STATE.md
  - .planning/ROADMAP.md
  - .planning/REQUIREMENTS.md
autonomous: false
requirements:
  - PHLD-01
tags:
  - uat
  - regression-gate
  - phase-52
must_haves:
  truths:
    - "npm test reports full-suite GREEN with total count >= Plan 04 baseline"
    - "npm run build reports exit 0 with main.js deployed to TEST-BASE dev vault"
    - "tsc --noEmit --skipLibCheck reports exit 0"
    - "zero 'joinSeparator' / 'multi-choice' / ''number'' substrings survive in src/ (counted greps all equal 0)"
    - "D-08 dev-vault UAT checklist completed; user signs off on options-list roundtrip"
    - "User signs off on Runner + Editor error surfaces for at least 2 legacy/broken scenarios"
    - "STATE.md + ROADMAP.md + REQUIREMENTS.md reflect Phase 52 complete"
  artifacts:
    - path: .planning/phases/52-json-placeholder-rework/52-UAT.md
      provides: "UAT record — automated gates + 5 manual scenarios with pass/fail"
      min_lines: 60
    - path: .planning/phases/52-json-placeholder-rework/52-05-SUMMARY.md
      provides: "Phase 52 rollup summary"
      min_lines: 40
  key_links:
    - from: 52-UAT.md
      to: ROADMAP.md §Phase 52 Success Criteria 1-4
      via: "scenario row per SC + mapping table"
      pattern: "PHLD-01"
---

<objective>
Ship Phase 52 — run the automated gate, complete the D-08 dev-vault UAT, record the two user-facing surfaces (Editor banner + Runner error), and flip STATE.md / ROADMAP.md / REQUIREMENTS.md.

Purpose: Plans 02-04 delivered the contract. This plan is the final evidence the change is safe and usable — combining automated proof (full test green + build green + static audits) with user-level UAT on the SC 2 options-list roundtrip (which RESEARCH verdict said is non-reproducible but which only a human can fully confirm) and the SC 4 error surfaces.

Output: A UAT.md with 5 scenario rows signed off by the user + a rollup commit that closes Phase 52.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/52-json-placeholder-rework/52-CONTEXT.md
@.planning/phases/52-json-placeholder-rework/52-RESEARCH.md
@.planning/phases/52-json-placeholder-rework/52-VALIDATION.md
@.planning/phases/52-json-placeholder-rework/52-04-SUMMARY.md
@.planning/phases/50.1-loop-exit-plus-prefix/50.1-UAT.md
@.planning/phases/51-snippet-picker-overhaul/51-HUMAN-UAT.md
@CLAUDE.md

<uat_format_reference>
Use the Phase 50.1 UAT.md format (automated gates checkboxes at top, manual scenarios as numbered rows with Arrange/Act/Assert + user approval line). Paste user's verbatim resume signal.
</uat_format_reference>
</context>

<threat_model>
## Trust Boundaries
N/A for UAT gate (documentation + test-execution task).

## STRIDE Threat Register
| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-52-13 | Elevation of Privilege | UAT blindly checked | mitigate | Every manual scenario lists arrange/act/assert steps and requires an explicit user resume signal before passing. No auto-pass. |
</threat_model>

<tasks>

<task id="52-05-01" type="auto">
  <title>Task 01: Automated gate — full tests, full build, static audits, generate UAT.md skeleton</title>
  <read_first>
    - .planning/phases/52-json-placeholder-rework/52-04-SUMMARY.md (confirm all prior plans green)
    - .planning/phases/50.1-loop-exit-plus-prefix/50.1-05-PLAN.md (automated gate pattern reference)
    - .planning/phases/52-json-placeholder-rework/52-VALIDATION.md (Nyquist Per-Task Map — confirm populated)
  </read_first>
  <action>
    **Step 1 — Full suite:** Run `npm test` and record total pass/skip/fail count. Capture vitest output tail.

    **Step 2 — Full build:** Run `npm run build`. Confirm exit 0 and verify `main.js` was deployed to the TEST-BASE dev vault path (esbuild `devVaultCopyPlugin` handles this; observe stdout for the copy line).

    **Step 3 — Static audits:** Run all of these greps and capture results:
    ```bash
    # D-01 narrowed-union audit — all must be 0 in src/
    grep -rn "'multi-choice'" src/ --include="*.ts" | grep -v __tests__ | wc -l
    grep -rn "'multichoice'" src/ --include="*.ts" | grep -v __tests__ | wc -l
    # 'number' is a common keyword in TS — narrow to placeholder-type literal context
    grep -rn "type: 'number'" src/ --include="*.ts" | grep -v __tests__ | wc -l
    grep -rn "=== 'number'" src/ --include="*.ts" | grep -v __tests__ | wc -l

    # D-02 rename audit — joinSeparator dead in src/
    grep -rn "joinSeparator" src/ --include="*.ts" | grep -v __tests__ | wc -l

    # D-07 unit field dead
    grep -rn "ph\\.unit\\|placeholder\\.unit" src/ --include="*.ts" | grep -v __tests__ | wc -l

    # D-03 validationError reach — confirm ≥ 5 production hits
    grep -rn "validationError" src/ --include="*.ts" | grep -v __tests__ | wc -l

    # D-04 banner CSS present in styles.css (regenerated from snippet-manager.css)
    grep -c "radi-snippet-editor-validation-banner" styles.css

    # Threat-model guard — innerHTML absent in all Phase 52-edited files
    grep -l "innerHTML" src/snippets/snippet-model.ts src/snippets/snippet-service.ts src/views/snippet-chip-editor.ts src/views/snippet-fill-in-modal.ts src/views/snippet-editor-modal.ts

    # Phase 51 D-14 invariant preserved
    grep -c "isPhase51FullPath" src/views/runner-view.ts

    # Phase 47 RUNFIX-02 invariant preserved
    grep -c "capturePendingTextareaScroll" src/views/runner-view.ts

    # Phase 51 D-13 auto-insert arm still present in protocol-runner
    grep -c "radiprotocol_snippetPath\\|snippet-fill\\|awaiting-snippet-fill" src/runner/protocol-runner.ts
    ```

    Expected values:
    | Grep | Expected |
    |------|----------|
    | `'multi-choice'` in production src/ | `0` |
    | `'multichoice'` | `0` |
    | `type: 'number'` as placeholder literal | `0` |
    | `=== 'number'` in placeholder-type context | `0` |
    | `joinSeparator` | `0` |
    | `ph\\.unit` / `placeholder\\.unit` | `0` |
    | `validationError` in src/ production | `≥ 5` |
    | banner class in `styles.css` | `≥ 1` |
    | innerHTML in edited files | `0` matching files |
    | `isPhase51FullPath` | `≥ 2` |
    | `capturePendingTextareaScroll` | `pre-plan count preserved (≥ 4)` |

    If any audit fails, STOP and escalate via GSD Rule 4.

    **Step 4 — VALIDATION.md sign-off:** Open `.planning/phases/52-json-placeholder-rework/52-VALIDATION.md`, fill in the "Per-Task Verification Map" row-by-row with the actual task IDs from Plans 01-04 and their automated commands. Flip `nyquist_compliant: true` in frontmatter.

    **Step 5 — Create `52-UAT.md` skeleton:**

    ```markdown
    ---
    phase: 52
    type: uat
    status: pending
    created: 2026-04-20
    ---

    # Phase 52 — User Acceptance Testing

    ## Automated Gates (Task 01 of Plan 05)

    - [ ] `npm test` — {count} passed / {skip} skipped / 0 failed (baseline Plan 04: {baseline_count})
    - [ ] `npm run build` — exit 0; main.js deployed to TEST-BASE
    - [ ] `npx tsc --noEmit --skipLibCheck` — exit 0
    - [ ] Static audit: zero `'multi-choice'` / `'multichoice'` / `joinSeparator` / `ph.unit` in production src/
    - [ ] `validationError` appears in ≥ 5 production src/ files
    - [ ] Banner class `radi-snippet-editor-validation-banner` present in regenerated `styles.css`
    - [ ] No `innerHTML` in any Phase 52-edited file (T-52-09/T-52-10)
    - [ ] Phase 51 D-14 + Phase 47 RUNFIX-02 invariants preserved (grep counts match pre-plan)

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

    PHLD-01 status → closed on {date}
    ```

    Fill in the `{count}` / `{baseline_count}` / `{date}` placeholders using actual values from the Task 01 gate run.
  </action>
  <acceptance_criteria>
    - `npm test` output captured; pass count recorded; non-zero fail count → STOP
    - `npm run build` exit 0
    - `npx tsc --noEmit --skipLibCheck` exit 0
    - All static audits match "Expected values" table above; any mismatch → STOP
    - `.planning/phases/52-json-placeholder-rework/52-UAT.md` exists
    - UAT.md automated-gate section has every checkbox filled (either `[x]` for pass or explicit `[ ] FAILED — {reason}` with escalation note)
    - UAT.md contains 5 manual scenarios covering SC 1, 2, 3, 4 (editor), 4 (runner)
    - VALIDATION.md Per-Task Map populated (row per task from Plans 01-04); `nyquist_compliant: true` in frontmatter
  </acceptance_criteria>
  <verify>
    <automated>npm test && npm run build && npx tsc --noEmit --skipLibCheck</automated>
  </verify>
  <done>
    Automated gate complete; all audits pass; UAT.md skeleton ready for human UAT; VALIDATION.md signed off.
  </done>
</task>

<task id="52-05-02" type="checkpoint:human-verify" gate="blocking">
  <title>Task 02: Human UAT in TEST-BASE (5 scenarios)</title>
  <what-built>
    Plans 02-04 landed the Phase 52 contract: model + service + chip-editor + fill-in modal + banner + runner error surfaces. Task 01 confirmed automated gates pass. Now the user must verify the 5 dev-vault UAT scenarios in `52-UAT.md` on TEST-BASE.
  </what-built>
  <how-to-verify>
    1. Open TEST-BASE vault in Obsidian. Confirm RadiProtocol plugin is enabled and reloaded with the fresh `main.js` (close + reopen vault to be safe).
    2. Run Scenario 1: D-08 options-list roundtrip. Follow arrange/act/assert in `52-UAT.md` §Scenario 1.
    3. Run Scenario 2: D-02 separator rename — opens the .json file on disk with a text editor and confirms the field rename.
    4. Run Scenario 3: D-05 unified choice multi-select — run the protocol and exercise checkbox + Custom override behaviour.
    5. Run Scenario 4: D-04 editor banner — create a legacy `type: 'number'` .json externally, open it in Manager, see banner.
    6. Run Scenario 5: D-04 runner error — run a canvas pointing at the legacy snippet; observe inline error (picker) or Notice+stepBack (auto-insert).
    7. For each scenario, tick the checkbox or document the failure. If ANY scenario fails, pause and return to Plan 03 or Plan 04 for a targeted fix (gap-closure mode).
    8. On all 5 PASS: type `approved` in the resume signal AND at the bottom of the UAT.md User final approval signal line.
  </how-to-verify>
  <resume-signal>
    Type `approved` (lowercase, verbatim) OR describe specific issues for gap closure.
  </resume-signal>
</task>

<task id="52-05-03" type="auto">
  <title>Task 03: Rollup — SUMMARY + STATE + ROADMAP + REQUIREMENTS + commit</title>
  <read_first>
    - 52-UAT.md (confirm all 5 scenarios PASS and user typed `approved`)
    - .planning/STATE.md (current progress + current position section)
    - .planning/ROADMAP.md §Phase 52 row + Progress table row
    - .planning/REQUIREMENTS.md §PHLD-01 + Traceability table row
    - .planning/phases/50.1-loop-exit-plus-prefix/50.1-05-SUMMARY.md (rollup format precedent)
  </read_first>
  <action>
    **Reminder (per checker INFO 7):** Replace every `2026-04-XX` date placeholder in SUMMARY / ROADMAP / REQUIREMENTS closure annotations with the actual ISO commit date (`date -I`) before shipping.

    **Step 1 — Write `52-05-SUMMARY.md`:** Rollup summary covering all 5 plans, final test count vs v1.8 baselines, commit SHA chain, dev-UAT verdict (all 5 scenarios PASS), and PHLD-01 closure line.

    **Step 2 — Update `STATE.md`:**
    - `stopped_at`: "Phase 52 complete — PHLD-01 closed via UAT PASS in TEST-BASE (5/5 scenarios)."
    - `last_updated`: current ISO datetime
    - `progress.completed_phases`: +1
    - `progress.total_plans`: +5 (Plans 01-05 shipped)
    - `progress.completed_plans`: +5
    - `progress.percent`: recompute
    - Append a new bullet under `### v1.8 Execution Log` summarising Phase 52 outcome.
    - Update `## Current Position` → Phase: 53 (next) if sequential, else leave cursor guidance.

    **Step 3 — Update `ROADMAP.md`:**
    - Flip Phase 52 checkbox `[ ]` → `[x]`.
    - Append completion annotation: `— ✅ Complete 2026-04-XX. PHLD-01 closed by UAT PASS (5/5 scenarios): D-08 options-list roundtrip, D-02 separator rename, D-05 unified choice multi-select, D-04 editor banner, D-04 runner error. Tests: {count}/1/0.`
    - Update the Progress table row for Phase 52.
    - Update the `Plans:` list under Phase 52 Phase Details to check each of the 5 plan rows.

    **Step 4 — Update `REQUIREMENTS.md`:**
    - Flip `- [ ] **PHLD-01**:` → `- [x] **PHLD-01**:` and append closure line `✅ Closed by Phase 52 (2026-04-XX). Union narrowed to {free-text, choice}; joinSeparator renamed to separator; unit removed; validatePlaceholders helper emits hard-validation error for legacy types; editor banner + runner error panel surface the error; UAT PASS 5/5 in TEST-BASE.`
    - Update the Traceability table row: `PHLD-01 | Phase 52 | ✅ complete ({date})`

    **Step 5 — Commit rollup:** Stage and commit:
    ```bash
    git add .planning/phases/52-json-placeholder-rework/52-UAT.md \
            .planning/phases/52-json-placeholder-rework/52-05-SUMMARY.md \
            .planning/STATE.md .planning/ROADMAP.md .planning/REQUIREMENTS.md \
            .planning/phases/52-json-placeholder-rework/52-VALIDATION.md

    git commit -m "$(cat <<'EOF'
    docs(52): Phase 52 complete — PHLD-01 closed via UAT PASS

    Plans 01-05 shipped. Union narrowed to 'free-text' | 'choice';
    joinSeparator renamed to separator; unit removed; validatePlaceholders
    emits hard-validation error for legacy types; SnippetEditorModal banner
    + RunnerView Notice/inline-error close D-04. Tests: ... passed /1/0.
    UAT PASS 5/5 in TEST-BASE (D-08 roundtrip, D-02 rename, D-05 multi,
    D-04 editor, D-04 runner).

    Closes PHLD-01.

    Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
    EOF
    )"
    ```

    NO git push. NO ROADMAP row flip to ✅ if user-approval is anything other than literal "approved" — a partial approval means gap closure is needed first.
  </action>
  <acceptance_criteria>
    - `52-05-SUMMARY.md` exists; ≥ 40 lines; contains final test count + UAT verdict + PHLD-01 closure line
    - `STATE.md` has Phase 52 summary in execution log + progress numbers incremented
    - `ROADMAP.md` Phase 52 row is `- [x]` with completion annotation
    - `REQUIREMENTS.md` PHLD-01 row is `- [x]` + traceability row updated
    - One commit staged with all 5 files + UAT.md; git log shows the rollup commit as HEAD
    - `git status` is clean after commit
    - No git push executed
  </acceptance_criteria>
  <verify>
    <automated>git log -1 --oneline && git status && grep -c "\\[x\\] \\*\\*Phase 52" .planning/ROADMAP.md</automated>
  </verify>
  <done>
    Phase 52 is shipped at plan level. Phase-level orchestrator gates (regression gate, code review, verify_phase_goal on commits from Plan 01 through Plan 05) remain pending per GSD workflow, but this plan's rollup commit cleanly closes PHLD-01 at the requirements layer.
  </done>
</task>

</tasks>

<verification>
Final verification after Task 03:

```bash
git log --oneline -10
git status
grep -A 1 "PHLD-01" .planning/REQUIREMENTS.md | head -5
grep -A 1 "Phase 52:" .planning/ROADMAP.md | head -3
```

Expected:
- HEAD is the rollup commit with message `docs(52): Phase 52 complete — PHLD-01 closed via UAT PASS`
- Working tree clean
- PHLD-01 row starts with `- [x]`
- ROADMAP Phase 52 row starts with `- [x]`
</verification>

<success_criteria>
- All 4 ROADMAP Phase 52 Success Criteria verified:
  - SC 1: schema narrowed + separator default `", "` + override works — Scenario 2 + Plan 01/02 tests
  - SC 2: options-list editor works end-to-end — Scenario 1 + Plan 01 Task 05 A2 test (GREEN on current code per RESEARCH verdict)
  - SC 3: Runner renders unified choice as multi-select, default + override separator — Scenario 3 + Plan 01 Task 04 tests
  - SC 4: legacy .json surfaces hard-validation in Editor + Runner, blocks Runner use — Scenarios 4-5 + Plan 04 tests
- User resume signal captured verbatim in UAT.md
- STATE + ROADMAP + REQUIREMENTS reflect completion
- One rollup commit created; no push
</success_criteria>

<output>
After Task 03, create `.planning/phases/52-json-placeholder-rework/52-05-SUMMARY.md` and commit as specified. No further writes. The orchestrator picks up phase-level gates from here.
</output>
