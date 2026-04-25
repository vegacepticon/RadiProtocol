# Phase 67 UAT Checklist — Inline Runner Resizable Modal & File-Bound Snippet Parity

**Goal:** Human verifies in a real Obsidian vault that INLINE-FIX-06 (resize + persistence + clamp + back-compat) and INLINE-FIX-07 (file-bound snippet parity in loop-body / direct-edge traversals) ship correctly without regressing Phase 54 invariants (Inline Runner does not block note editing) or Phase 60 invariants (position persists, clamps on viewport change).

**Prerequisites:**
1. Latest `main.js` and `styles.css` built via `npm run build` (root of repo).
2. Test vault with the plugin loaded (e.g. via BRAT or symlinked plugin folder).
3. A `.canvas` protocol file containing:
   - At least one Loop node with one body branch terminating at a Snippet node bound to a `.md` file via the Node Editor (`📄` caption visible on canvas).
   - At least one Loop node with one body branch terminating at a Snippet node bound to a directory (`📁` caption visible — directory-bound).
   - At least one regular Question with two Answer branches (for Phase 54/60 regression guard).

---

## Scenario 1 — INLINE-FIX-06 §1: Resize works smoothly

**Setup:** Open any note. Run command `Run protocol in inline` and select a canvas.

**Steps:**
1. Locate the SE (bottom-right) corner of the floating Inline Runner modal — the browser's native resize grip should be visible.
2. Drag the SE corner outward (resize larger).
3. Drag the SE corner inward (resize smaller). Stop at a size between min and max bounds.
4. Try to resize below `min-width: 240px` — the modal should refuse to shrink below 240px wide.
5. Try to resize below `min-height: 120px` — the modal should refuse to shrink below 120px tall.
6. Try to resize beyond `viewport - 32px` — the modal should refuse to grow beyond `100vw - 32px` wide and `100vh - 32px` tall.

**Expected:**
- Resize is smooth (no jumps, no focus loss).
- During an active resize, a subtle elevated shadow is visible (`.is-resizing` class).
- Min/max bounds are enforced at the CSS level — the cursor can attempt to drag past them, but the modal's box stops at the boundary.

**Result:** [ ] PASS  [ ] FAIL  ▸ Notes: ___________________________________________

---

## Scenario 2 — INLINE-FIX-06 §2: Persistence across tab switch + Obsidian restart

**Setup:** Continuing from Scenario 1 with a non-default size set.

**Steps:**
1. Note the current Inline Runner modal width and height (visually estimate or use browser DevTools `getBoundingClientRect`).
2. Switch to another Obsidian tab (or the file explorer).
3. Switch back to the original note's tab.
4. **Expected:** Modal restores at the same width/height as before the switch.
5. Close the Inline Runner modal (× button).
6. Re-invoke `Run protocol in inline` on the same canvas.
7. **Expected:** Modal opens at the same width/height (saved from step 1).
8. Restart Obsidian (Cmd/Ctrl-Q, then reopen the vault).
9. Open the same note and re-invoke `Run protocol in inline`.
10. **Expected:** Modal opens at the saved width/height — persistence survived plugin reload.

**Result:** [ ] PASS  [ ] FAIL  ▸ Notes: ___________________________________________

---

## Scenario 3 — INLINE-FIX-06 §3: Clamp-on-restore after viewport change

**Setup:** Use the saved size from Scenario 2 (assumed to be larger than ~50% of current viewport).

**Steps:**
1. Resize the Obsidian window to the smallest practical size (e.g. 600×400 px).
2. Open the Inline Runner.
3. **Expected:** Modal restores at the smaller of (saved size) vs (`viewport - 32px`) — width ≤ 568, height ≤ 368.
4. Modal is fully visible inside the viewport — no off-screen portion.
5. Modal remains draggable (header drag still works) and resizable (SE corner still grabbable).
6. Resize the Obsidian window back to its original (large) size.
7. The modal stays at the clamped size (does NOT spring back to the originally saved larger size — re-clamp persists the smaller value per D-11).

**Result:** [ ] PASS  [ ] FAIL  ▸ Notes: ___________________________________________

---

## Scenario 4 — INLINE-FIX-06 §4: Legacy `data.json` back-compat (D-06 default fallback)

**Setup:** Manually edit the test vault's `.obsidian/plugins/radiprotocol/data.json` and replace the `inlineRunnerPosition` field with a position-only payload (no width/height) — e.g. `"inlineRunnerPosition": {"left": 100, "top": 100}`. Save the file.

**Steps:**
1. Restart Obsidian (Cmd/Ctrl-Q).
2. Open a note and run `Run protocol in inline`.
3. **Expected:** Modal opens at position (100, 100) and at the default size 360×240 (the D-06 fallback constants `INLINE_RUNNER_DEFAULT_WIDTH=360` / `INLINE_RUNNER_DEFAULT_HEIGHT=240`).
4. Resize the modal once (e.g. to 500×300).
5. Inspect `data.json` — the `inlineRunnerPosition` field now contains `width` and `height` keys alongside `left`/`top`.
6. The settings field name is still `inlineRunnerPosition` (NOT `inlineRunnerLayout`) — confirms D-05 on-disk back-compat.

**Result:** [ ] PASS  [ ] FAIL  ▸ Notes: ___________________________________________

---

## Scenario 5 — INLINE-FIX-07 §1: Loop-body file-bound snippet inserts in INLINE Runner

**Setup:** A canvas with a Loop node whose body branch terminates at a Snippet node bound to a `.md` file (e.g. `abdomen/ct.md` containing some markdown body text).

**Steps:**
1. Open a note. Run `Run protocol in inline` and select the canvas.
2. Reach the loop picker — the body branch button caption should read `📄 <filename-stem>` (or `📄 <snippetLabel>` if the node has a `snippetLabel` set).
3. Click the body branch button.
4. **Expected (FIX-07):**
   - The configured file's content is appended to the active note (`abdomen/ct.md` body text appears at the end of the note).
   - The picker dialog (`SnippetTreePicker`) does NOT appear at any point.
   - If the file is `.json` with placeholders, the `SnippetFillInModal` opens INSTEAD of the picker (Phase 59 INLINE-FIX-05 behaviour preserved).
5. The runner advances past the snippet and either returns to the loop picker (loop body re-entry) or exits via the `+exit` edge — no stuck state.

**Result:** [ ] PASS  [ ] FAIL  ▸ Notes: ___________________________________________

---

## Scenario 6 — INLINE-FIX-07 §2: Loop-body file-bound snippet inserts in SIDEBAR Runner (parity)

**Setup:** Same canvas as Scenario 5.

**Steps:**
1. Open the sidebar Runner (e.g. via `Open RadiProtocol Runner` command).
2. Select the canvas; reach the loop picker.
3. Body branch button caption is `📄 …` (same character-for-character as inline mode — D-15 caption parity).
4. Click the body branch button.
5. **Expected:** Same behaviour as Scenario 5 — file content is appended; no picker dialog appears.
6. Step-back from the post-insert state restores the loop picker view; back again restores the pre-loop state. (Phase 66 step-back invariants preserved.)

**Result:** [ ] PASS  [ ] FAIL  ▸ Notes: ___________________________________________

---

## Scenario 7 — INLINE-FIX-07 regression guard: Directory-bound snippet still shows picker

**Setup:** Canvas with a Loop node whose body branch terminates at a Snippet node bound to a DIRECTORY (e.g. `Findings/Chest`) — no `radiprotocol_snippetPath` set.

**Steps:**
1. Open the Inline Runner; reach the loop picker.
2. Body branch button caption reads `📁 <subfolderPath or snippetLabel>` — directory-bound (Phase 30 D-07 caption preserved per D-15).
3. Click the body branch button.
4. **Expected:** The `SnippetTreePicker` opens — NOT a direct file insert. (Phase 30 D-07 picker path is preserved for directory-bound; only file-bound is fast-tracked.)
5. Pick any snippet from the picker; it appends to the note as expected.

**Result:** [ ] PASS  [ ] FAIL  ▸ Notes: ___________________________________________

---

## Scenario 8 — Phase 54 / Phase 60 regression guard

**Steps:**
1. With the Inline Runner open and the active note focused, type a few characters in the note's body. (Phase 54 D2 invariant: modal does not block note editing.)
2. **Expected:** Typing works in the underlying note while the modal is visible.
3. Drag the modal header to a new position (Phase 60 D-01).
4. Switch tabs and switch back — position restores at the dragged location (Phase 60 persistence).
5. Reach a Question node; click an Answer button.
6. **Expected:** Answer text is appended to the active note (Phase 54 D3 invariant).
7. Step-back from the post-answer state — answer is removed from the note.

**Result:** [ ] PASS  [ ] FAIL  ▸ Notes: ___________________________________________

---

## Sign-off

All 8 scenarios PASSED — Phase 67 UAT approved.

Tester: ____________________  Date: ____________________

Outstanding issues (if any FAIL): ____________________________________________
