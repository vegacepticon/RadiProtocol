---
phase: 59
slug: inline-runner-feature-parity
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-24
---

# Phase 59 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `59-RESEARCH.md § Validation Architecture`.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest ^4.1.2 |
| **Config file** | `vitest.config.ts` (obsidian alias → `src/__mocks__/obsidian.ts`) |
| **Quick run command** | `npm test -- src/__tests__/views/inline-runner-modal.test.ts src/__tests__/main-inline-command.test.ts` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~2s quick / ~40s full (670 baseline tests) |

---

## Sampling Rate

- **After every task commit:** Run quick command on the two phase test files (once Wave 0 creates them).
- **After every plan wave:** Run full suite (`npm test`).
- **Before `/gsd-verify-work`:** Full suite must be green + manual UAT on real Obsidian vault with nested `templates/ALGO/nested.canvas` fixture.
- **Max feedback latency:** < 45 seconds (full suite).

---

## Per-Task Verification Map

*Populated by planner. Seed rows below map requirements to their target test assertions per the research — planner assigns concrete task IDs once plans are split.*

| Req ID | Behavior | Test Type | Target Test File | File Exists | Status |
|--------|----------|-----------|------------------|-------------|--------|
| INLINE-FIX-01 (a) | `handleRunProtocolInline` accepts `protocolFolderPath = "templates/ALGO"` with no trailing slash | unit | `src/__tests__/main-inline-command.test.ts` | ❌ W0 | ⬜ pending |
| INLINE-FIX-01 (b) | Trailing-slash variant `"templates/ALGO/"` is normalized and resolves | unit | same | ❌ W0 | ⬜ pending |
| INLINE-FIX-01 (c) | Windows backslash variant normalizes | unit | same | ❌ W0 | ⬜ pending |
| INLINE-FIX-01 (d) | Fallback `vault.getFiles()` path when `getAbstractFileByPath` returns null but canvases exist under prefix | unit | same | ❌ W0 | ⬜ pending |
| INLINE-FIX-01 (e) | Empty folder still emits the D8 Notice (preserve Phase 54 invariant) | unit | same | ❌ W0 | ⬜ pending |
| INLINE-FIX-04 (a) | MD snippet insert appends with configured `\n` separator between prior text and snippet content | unit | `src/__tests__/views/inline-runner-modal.test.ts` | ❌ W0 | ⬜ pending |
| INLINE-FIX-04 (b) | JSON zero-placeholder snippet insert applies separator | unit | same | ❌ W0 | ⬜ pending |
| INLINE-FIX-04 (c) | JSON with-placeholder snippet insert applies separator after modal submit | unit | same | ❌ W0 | ⬜ pending |
| INLINE-FIX-04 (d) | Per-node `radiprotocol_snippetSeparator: 'space'` overrides global | unit | same | ❌ W0 | ⬜ pending |
| INLINE-FIX-04 (e) | First-chunk invariant preserved (no leading separator when accumulator empty) | unit | same | ❌ W0 | ⬜ pending |
| INLINE-FIX-05 (a) | JSON snippet with placeholders triggers `new SnippetFillInModal(...)` call | unit (spy) | same | ❌ W0 | ⬜ pending |
| INLINE-FIX-05 (b) | Modal resolves with rendered string → `completeSnippet(rendered)` → note append via separator | unit | same | ❌ W0 | ⬜ pending |
| INLINE-FIX-05 (c) | Modal cancel (null) → `completeSnippet('')` → no note append (first-chunk invariant holds) | unit | same | ❌ W0 | ⬜ pending |
| INLINE-FIX-05 (d) | In-panel `renderSnippetFillIn` is no longer reachable (deleted/branch removed) | unit (source-string grep) | same | ❌ W0 | ⬜ pending |
| INLINE-FIX-05 (e) | Z-index sanity — `SnippetFillInModal` DOM appended to `document.body` after `.rp-inline-runner-container` | unit | same | ❌ W0 | ⬜ pending |
| Phase 54 D1 regression | Answer-click append path untouched (still uses `handleAnswerClick`) | integration | existing `__tests__` | ✅ | ⬜ pending |
| Phase 54 D1 regression | Inline container does NOT get `is-hidden` while `SnippetFillInModal` is open | unit (gate) | `src/__tests__/views/inline-runner-modal.test.ts` | ❌ W0 | ⬜ pending |
| Phase 54 D6 reversal | In-panel fill-in form path deleted; stacked Modal is the only fill-in surface | unit (grep) | same | ❌ W0 | ⬜ pending |
| Phase 54 D7 parity | Inline output snapshot matches sidebar output on identical snippet fixture | unit | same | ❌ W0 | ⬜ pending |
| Sidebar/tab unchanged | Existing `runner-view.test.ts` + `RunnerView.test.ts` remain green | regression | existing suite | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/__tests__/views/inline-runner-modal.test.ts` — **NEW FILE** — stubs for INLINE-FIX-04 (a–e), INLINE-FIX-05 (a–e), D1 regression gate, D6 reversal check, D7 parity.
- [ ] `src/__tests__/main-inline-command.test.ts` — **NEW FILE** — stubs for INLINE-FIX-01 (a–e). Requires extracting pure helper `resolveProtocolCanvasFiles(vault, folderPath): TFile[]` from `handleRunProtocolInline` so the folder-resolution logic is testable.
- [ ] `src/__mocks__/obsidian.ts` — **AUGMENT** — add minimal `TFolder`, `Modal`, `SuggestModal` exports so new tests can `instanceof`-check.
- [ ] No binary fixtures required — synthesize canvases inline as JSON strings.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Nested-folder bug actually resolved on user's vault | INLINE-FIX-01 | Root cause (A1) is vault-state-dependent; needs live Obsidian UAT | Set `protocolFolderPath = "templates/ALGO"`, run `Run protocol in inline`, verify picker lists nested `.canvas` files |
| Freeze/resume D1 invariant under fill-in modal | INLINE-FIX-05 | Active-leaf-change firing in real Obsidian ≠ jsdom | Open JSON-with-placeholder snippet in inline, switch tab and back, verify modal + inline container behave per D1 contract |
| Target-note-deleted D2 during modal await | INLINE-FIX-05 | Cross-event cleanup order needs live Obsidian | While fill-in modal is open, delete source note; verify clean teardown of both modal + inline |
| Cross-mode parity (sidebar vs inline same output) | INLINE-FIX-04, 05 | Snapshot unit test catches most; real Obsidian append formatting is final arbiter | Run same canvas in sidebar + inline modes on same source note; diff output should be empty |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (new test files + mock augmentation)
- [ ] No watch-mode flags
- [ ] Feedback latency < 45s
- [ ] `nyquist_compliant: true` set in frontmatter after all tests green

**Approval:** pending
