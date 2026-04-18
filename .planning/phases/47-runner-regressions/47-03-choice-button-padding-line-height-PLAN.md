---
phase: 47
plan: 03
type: execute
wave: 1
depends_on: []
files_modified:
  - src/styles/runner-view.css
  - src/styles/loop-support.css
  - styles.css
autonomous: true
requirements:
  - RUNFIX-03
must_haves:
  truths:
    - "Choice buttons in the Runner (answer, snippet-branch, loop-body, loop-exit) show enough horizontal+vertical padding and line-height that Cyrillic descenders («р», «у», «ц») and parentheses «(» «)» render inside the button box even when the label wraps to 2+ lines"
    - "`npm run build` regenerates root `styles.css` to include the new Phase 47 rules"
  artifacts:
    - path: "src/styles/runner-view.css"
      provides: "Phase 47 padding/line-height rules for .rp-answer-btn and .rp-snippet-branch-btn"
      contains: "Phase 47"
    - path: "src/styles/loop-support.css"
      provides: "Phase 47 padding/line-height rules for .rp-loop-body-btn and .rp-loop-exit-btn"
      contains: "Phase 47"
    - path: "styles.css"
      provides: "regenerated build artifact containing Phase 47 marker"
      contains: "Phase 47"
  key_links:
    - from: "src/styles/runner-view.css"
      to: "root styles.css"
      via: "esbuild concatenation (CSS_FILES list in esbuild.config.mjs)"
      pattern: "Phase 47"
    - from: "src/styles/loop-support.css"
      to: "root styles.css"
      via: "esbuild concatenation"
      pattern: "Phase 47"
---

<objective>
Close RUNFIX-03: choice buttons in the Protocol Runner must show enough padding and line-height that Cyrillic descenders («р», «у», «ц») and parentheses «(», «)» render fully inside the button box at every wrap count — current rules clip these glyphs because the top/bottom padding is tight (`--size-4-1` = 4px) and loop buttons have no `line-height` override.

Purpose: CSS is the right layer for this fix. Existing selectors (current values):
- `.rp-answer-btn` (src/styles/runner-view.css:86-95): `padding: var(--size-4-1) var(--size-4-2)` (~4px/8px), `line-height: 1.5`, `min-height: 40px`.
- `.rp-snippet-branch-btn` (src/styles/runner-view.css:216-227): `padding: var(--size-4-1) var(--size-4-2)`, `line-height: 1.5` (same tight vertical padding).
- `.rp-loop-body-btn` and `.rp-loop-exit-btn` (src/styles/loop-support.css:63-71): `padding: var(--size-2-3) var(--size-4-2)` (~8px/8px), **no `line-height`**, **no `min-height`**, `font-size: var(--font-ui-small)`.

Fix: append Phase 47 rules to the bottom of each CSS feature file (CLAUDE.md rule: CSS is append-only per phase) bumping vertical padding to `--size-4-2` (8px per Obsidian var) and pinning `line-height: 1.55` so descenders clear the baseline comfortably. Then run `npm run build` so root `styles.css` is regenerated with the new rules (CLAUDE.md: `styles.css` is generated, never hand-edited).

Output: two appended CSS blocks (one per feature file), one root `styles.css` regeneration, and one vitest-or-grep verification that the rules appear in both source and build output.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@.planning/todos/pending/runner-choice-button-text-padding.md
@./CLAUDE.md

<interfaces>
<!-- Existing selectors + their current rule values. Extracted from src/styles/ during planning. -->

From src/styles/runner-view.css:86-95 (.rp-answer-btn — current):
```css
.rp-answer-btn {
  width: 100%;
  text-align: left;
  min-height: 40px;
  padding: var(--size-4-1) var(--size-4-2); /* 8px 16px per the comment, but --size-4-1 is typically 4px in Obsidian */
  white-space: normal;
  word-break: break-word;
  font-size: var(--font-text-size);
  line-height: 1.5;
}
```

From src/styles/runner-view.css:216-227 (.rp-snippet-branch-btn — current):
```css
.rp-snippet-branch-btn {
  width: 100%;
  text-align: left;
  min-height: 40px;
  padding: var(--size-4-1) var(--size-4-2);
  white-space: normal;
  word-break: break-word;
  font-size: var(--font-text-size);
  line-height: 1.5;
  border-style: dashed;
}
```

From src/styles/loop-support.css:63-71 (.rp-loop-body-btn, .rp-loop-exit-btn — current):
```css
.rp-loop-body-btn,
.rp-loop-exit-btn {
  text-align: left;
  padding: var(--size-2-3) var(--size-4-2);
  border-radius: var(--radius-s);
  border: none;
  cursor: pointer;
  font-size: var(--font-ui-small);
}
```

Obsidian CSS spacing variables commonly used in this codebase:
- `--size-2-1` ≈ 4px, `--size-2-2` ≈ 6px, `--size-2-3` ≈ 8px
- `--size-4-1` ≈ 4px, `--size-4-2` ≈ 8px (despite the runner-view.css:90 comment saying "8px 16px", --size-4-2 is 8px in the resolved Obsidian theme variables — the existing comment is inaccurate)

Root styles.css is **generated** by esbuild from the files listed in esbuild.config.mjs `CSS_FILES`. Never hand-edit `styles.css`.
</interfaces>

<build_invariants>
- CLAUDE.md rule: CSS source lives in src/styles/ per-feature. Root `styles.css` is generated.
- CLAUDE.md rule: CSS files are append-only per phase — add new rules to the BOTTOM under a `/* Phase 47: ... */` header comment.
- CLAUDE.md rule: Never commit hand-edited changes to root `styles.css`. Run `npm run build` and commit the regenerated file.
</build_invariants>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Append Phase 47 padding/line-height rules to runner-view.css + loop-support.css, regenerate styles.css</name>
  <files>src/styles/runner-view.css, src/styles/loop-support.css, styles.css</files>
  <read_first>
    - src/styles/runner-view.css (full file — 228 lines; inspect .rp-answer-btn at line 86 and .rp-snippet-branch-btn at line 216 to confirm current selectors/values before appending the override block)
    - src/styles/loop-support.css (full file — 91 lines; inspect .rp-loop-body-btn + .rp-loop-exit-btn at lines 63-71 to confirm current selectors)
    - esbuild.config.mjs (confirm both files appear in CSS_FILES — they are already listed per CLAUDE.md table; this is a sanity read, no edit)
    - CLAUDE.md "CSS Architecture" + "CSS files: append-only per phase" + "After any CSS change" sections
    - .planning/todos/pending/runner-choice-button-text-padding.md
  </read_first>
  <action>
    Step 1: append the following block at the very bottom of `src/styles/runner-view.css` (after line 228, after the existing `.rp-snippet-branch-btn` rule). Do NOT modify any existing rule. Do NOT reorder or delete any pre-Phase 47 rule.

    ```css

    /* Phase 47: RUNFIX-03 — choice-button typography padding ──────────────── */
    /* Override vertical padding + line-height so Cyrillic descenders («р», «у», «ц») */
    /* and parentheses «(», «)» render inside the button box at every wrap count. */
    /* Horizontal padding kept at --size-4-2 (matches existing rhythm). */

    .rp-answer-btn,
    .rp-snippet-branch-btn {
      padding: var(--size-4-2) var(--size-4-2); /* ~8px vertical, ~8px horizontal */
      line-height: 1.55;
      min-height: 44px; /* was 40px — adds room for descender clearance on single-line labels */
    }
    ```

    Step 2: append the following block at the very bottom of `src/styles/loop-support.css` (after line 91). Do NOT modify any existing rule.

    ```css

    /* Phase 47: RUNFIX-03 — loop picker button typography padding ─────────── */
    /* Loop body + exit buttons previously had no line-height override and tight */
    /* padding — long labels («следующая проверка (базовая)», «другое») clipped */
    /* descenders and parentheses. Match the answer-button rhythm from runner-view.css. */

    .rp-loop-body-btn,
    .rp-loop-exit-btn {
      padding: var(--size-4-2) var(--size-4-2);
      line-height: 1.55;
      min-height: 44px;
      white-space: normal;
      word-break: break-word;
    }
    ```

    Step 3: run `npm run build` to regenerate root `styles.css`. Confirm the command exits 0.

    Step 4: verify both `Phase 47` markers appear in the generated `styles.css` (the build concatenates source files in the order declared in esbuild.config.mjs).

    Do NOT edit root `styles.css` by hand. Do NOT touch any other CSS feature file. Do NOT edit any .ts file (this plan is CSS-only). Do NOT delete any existing rule — the new block must be strictly additive and sit below the last pre-Phase 47 rule in each file.

    Note on rationale for chosen values (sensible defaults aligned to existing codebase rhythm):
    - `padding: var(--size-4-2) var(--size-4-2)` (≈ 8px / 8px) — doubles the previous `--size-4-1` vertical padding on answer/snippet buttons (was ~4px) without exceeding existing horizontal rhythm. For loop buttons, vertical goes from `--size-2-3` (~8px) to `--size-4-2` (~8px) — no visible change on single-line labels, but the new `line-height: 1.55` + `min-height: 44px` guarantees wrapped labels have vertical breathing room.
    - `line-height: 1.55` — slightly above the existing 1.5 on answer buttons; gives ~2px extra per line, enough for Cyrillic descenders without looking loose. Aligns with the 1.55 default used by several Obsidian community themes for Russian UI.
    - `min-height: 44px` — 4px bump from existing 40px on answer/snippet buttons; matches Apple HIG's 44pt tap-target minimum and leaves room for descenders on single-line labels. For loop buttons (which had no min-height), 44px sets a consistent floor.
  </action>
  <verify>
    <automated>npm run build</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "Phase 47" src/styles/runner-view.css` returns >=1 match at or after line 229 (appended block — NOT inserted earlier in the file).
    - `grep -n "Phase 47" src/styles/loop-support.css` returns >=1 match at or after line 92.
    - `grep -c "line-height: 1.55" src/styles/runner-view.css` returns >=1.
    - `grep -c "line-height: 1.55" src/styles/loop-support.css` returns >=1.
    - `grep -n "RUNFIX-03" src/styles/runner-view.css` returns >=1 match.
    - `grep -n "RUNFIX-03" src/styles/loop-support.css` returns >=1 match.
    - `npm run build` exits 0.
    - `grep -c "Phase 47" styles.css` returns >=2 (one per appended feature file — both concatenated into root styles.css).
    - `grep -c "line-height: 1.55" styles.css` returns >=2.
    - `git diff src/styles/runner-view.css src/styles/loop-support.css` shows ONLY appended content at the bottom of each file; `git diff` of existing lines is empty (no deletions, no re-orderings, no modifications to pre-Phase 47 rules).
    - `git diff styles.css` is a byproduct of `npm run build` — acceptable to commit because CLAUDE.md requires regenerating it after CSS changes. The diff must include the new Phase 47 blocks and must NOT contain hand-authored changes elsewhere.
    - No edits to any .ts file, no edits to any .css file outside the two listed under files_modified (plus the generated root styles.css).
  </acceptance_criteria>
  <done>
    Both CSS feature files have a Phase 47 appended block; root `styles.css` regenerated via `npm run build` and contains both Phase 47 markers; no pre-Phase 47 CSS rule was modified or deleted.
  </done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 2: Human smoke-test descender clearance on a wrapped choice label</name>
  <what-built>
    Phase 47 CSS rules appended to src/styles/runner-view.css + src/styles/loop-support.css, root styles.css regenerated. Choice buttons (.rp-answer-btn, .rp-snippet-branch-btn, .rp-loop-body-btn, .rp-loop-exit-btn) now carry padding: --size-4-2 / --size-4-2, line-height: 1.55, min-height: 44px.
  </what-built>
  <how-to-verify>
    1. Run `npm run build` (if not already run in Task 1) and reload the Obsidian plugin (Cmd/Ctrl+P → "Reload app without saving" or disable+enable the plugin).
    2. Open a test canvas that has:
       - An Answer node with a descender-heavy multi-line label, e.g. "результат обследования, при условии (раскрыть)".
       - A Loop node with at least one body-branch edge labeled similarly, e.g. "проверка (углублённая)".
    3. In the Runner view, reach the question and observe the `.rp-answer-btn` button. Confirm:
       - The descenders on «р», «у», «ц» are fully visible inside the button box (no bottom-clipping).
       - Parentheses «(» and «)» render fully inside the box.
       - On a label wrapping to 2+ lines, lines have visible vertical spacing; no lines overlap.
    4. Advance to the loop node. Observe the `.rp-loop-body-btn` with the descender-heavy label. Confirm the same three criteria above.
    5. Advance to «выход» view. Observe the `.rp-loop-exit-btn`. Confirm the same criteria (label text may be short and single-line; confirm no regression on short labels — vertical padding should look balanced, not excessive).
    6. If any glyph still clips, reject; Task 1 must be revisited (likely need to bump padding to var(--size-4-3) or line-height to 1.6 — report the specific glyph + selector).
  </how-to-verify>
  <resume-signal>Type "approved" to confirm RUNFIX-03 success, or describe which selector/glyph still clips for a follow-up pass.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| (none new) | CSS-only change to existing DOM selectors; no new input surface, no new data flow. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-47-03-01 | (n/a) | choice-button CSS rules | accept | CSS-only visual tweak; no attack surface. |

No new attack surface; changes are confined to appended CSS rules + esbuild-regenerated styles.css. No user-supplied data enters new code paths. ASVS L1 — no relevant threats.
</threat_model>

<verification>
- `npm run build` exits 0 and regenerates styles.css containing both Phase 47 markers.
- Grep checks in acceptance_criteria all pass.
- Human UAT step confirms descenders + parentheses are visible on wrapped Cyrillic labels for all four button classes.
</verification>

<success_criteria>
- RUNFIX-03 closed: choice buttons render Cyrillic descenders and parentheses without clipping at every wrap count.
- src/styles/runner-view.css and src/styles/loop-support.css each carry one Phase 47 appended block; no pre-Phase 47 rule modified.
- Root styles.css regenerated by `npm run build` — no hand edits.
</success_criteria>

<output>
After completion, create `.planning/phases/47-runner-regressions/47-03-SUMMARY.md` using the standard summary template. Reference RUNFIX-03 in the summary's requirements-closed section and note the appended-only CSS pattern (CLAUDE.md compliance).
</output>
