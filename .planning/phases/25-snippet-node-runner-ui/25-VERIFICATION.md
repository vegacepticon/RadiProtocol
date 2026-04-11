---
phase: 25-snippet-node-runner-ui
verified: 2026-04-11T21:30:00Z
status: gaps_found
score: 14/15 must-haves verified
overrides_applied: 0
gaps:
  - truth: "npx tsc --noEmit проходит без ошибок"
    status: failed
    reason: >
      Commit 070d3fa (Phase 25-01 Task 1) accidentally removed
      `snippetNodeFolderPath` from `RadiProtocolSettings` in settings.ts
      while it was modifying unrelated settings changes. Phase 24 added this
      field; Phase 25-01 deleted it. runner-view.ts line 524 references
      `this.plugin.settings.snippetNodeFolderPath` which no longer exists,
      producing: "Property 'snippetNodeFolderPath' does not exist on type
      'RadiProtocolSettings'. Did you mean 'snippetFolderPath'?"
    artifacts:
      - path: "src/settings.ts"
        issue: >
          Missing `snippetNodeFolderPath: string` field in
          RadiProtocolSettings interface and DEFAULT_SETTINGS object.
          Field was present in commit d4febd7 (Phase 24) but deleted by
          commit 070d3fa (Phase 25-01). The settings UI entry was also
          removed (Storage group "Default snippet files folder" setting).
      - path: "src/views/runner-view.ts"
        issue: >
          Line 524: `this.plugin.settings.snippetNodeFolderPath.trim()`
          references a field that no longer exists on RadiProtocolSettings.
          TypeScript error: TS2551.
    missing:
      - >
        Restore `snippetNodeFolderPath: string` to RadiProtocolSettings
        interface in src/settings.ts (with JSDoc comment: SNIPPET-06).
      - >
        Restore `snippetNodeFolderPath: ''` to DEFAULT_SETTINGS in
        src/settings.ts.
      - >
        Restore the "Default snippet files folder" Setting entry in the
        Storage group of RadiProtocolSettingsTab.display() in src/settings.ts.
      - >
        After restoring, `npx tsc --noEmit` must exit with code 0 (only
        pre-existing vitest module-resolution errors are acceptable).
---

# Phase 25: snippet-node-runner-ui Verification Report

**Phase Goal:** Implement complete snippet node flow — graph/runner backend (SnippetNode type, halt, completeSnippetFile) + UI frontend (SnippetFilePickerModal, runner-view snippet branch)
**Verified:** 2026-04-11T21:30:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | SnippetNode interface exported from graph-model.ts with `folderPath?` and `buttonLabel?` fields | VERIFIED | Lines 67-73 of graph-model.ts — `export interface SnippetNode extends RPNodeBase` with both optional fields |
| 2 | RPNodeKind union includes `'snippet'` | VERIFIED | Line 12 of graph-model.ts — `\| 'snippet'` in union |
| 3 | canvas-parser.ts parses nodes with `radiprotocol_nodeType='snippet'` into SnippetNode objects | VERIFIED | Lines 261-275 canvas-parser.ts — `case 'snippet':` with D-09 fallback chain for buttonLabel |
| 4 | graph-validator.ts handles snippet node without errors (nodeLabel exhaustive switch) | VERIFIED | Line 201 graph-validator.ts — `case 'snippet': return node.buttonLabel ?? node.id` |
| 5 | `AtNodeState.isAtSnippetNode?: boolean` added in runner-state.ts | VERIFIED | Line 36 runner-state.ts — `isAtSnippetNode?: boolean` with JSDoc |
| 6 | `ProtocolRunner.advanceThrough()` halts on snippet node in `at-node` state | VERIFIED | Lines 550-554 protocol-runner.ts — `case 'snippet': { this.currentNodeId = cursor; this.runnerStatus = 'at-node'; return; }` |
| 7 | `ProtocolRunner.getState()` returns `isAtSnippetNode: true` when current node is snippet | VERIFIED | Line 322 protocol-runner.ts — `isAtSnippetNode: this.graph?.nodes.get(this.currentNodeId ?? '')?.kind === 'snippet'` |
| 8 | `ProtocolRunner.completeSnippetFile(text, nodeId)` appends text via defaultSeparator and advances runner | VERIFIED | Lines 198-223 protocol-runner.ts — full implementation with undo push, appendWithSeparator, advance |
| 9 | Runner-view renders rp-answer-btn on snippet node | VERIFIED | Lines 396-408 runner-view.ts — `case 'snippet':` creates button with `cls: 'rp-answer-btn'` |
| 10 | Button opens SnippetFilePickerModal with .md and .json files from configured folder | VERIFIED | Lines 521-548 runner-view.ts — `handleSnippetFilePick()` filters by extension and opens modal |
| 11 | .md file selection appends plain-text content and advances runner | VERIFIED | Lines 551-558 runner-view.ts — `handleChosenSnippetFile()` reads file, calls `completeSnippetFile()`, renders |
| 12 | .json file (valid SnippetFile) opens SnippetFillInModal; filled text appends and runner advances | VERIFIED | Lines 563-605 runner-view.ts — `handleSnippetJsonFile()` validates, opens SnippetFillInModal, calls `completeSnippetFile()` |
| 13 | Cancelling picker or SnippetFillInModal leaves runner on snippet node unchanged | VERIFIED | D-03: `SnippetFilePickerModal.onChooseItem` only fires on selection (Esc = no call); D-07: `if (rendered === null) return` in handleSnippetJsonFile |
| 14 | per-node folderPath takes priority over global snippetNodeFolderPath | VERIFIED | Lines 522-525 runner-view.ts — `rawFolder !== '' ? rawFolder : globalFolder` fallback chain |
| 15 | npx tsc --noEmit passes without errors | FAILED | `src/views/runner-view.ts(524,47): error TS2551: Property 'snippetNodeFolderPath' does not exist on type 'RadiProtocolSettings'` — commit 070d3fa accidentally deleted this field from settings.ts |

**Score:** 14/15 truths verified

---

## Root Cause of Failure

Commit `070d3fa` (Phase 25-01, Task 1: "add SnippetNode to graph layer") was a large multi-file commit that also accidentally removed `snippetNodeFolderPath` from `src/settings.ts`. Phase 24 (`d4febd7`) had correctly added this field. The 25-01 commit's diff shows three deletions from settings.ts: the interface field, the DEFAULT_SETTINGS entry, and the Settings tab UI entry.

The runner-view.ts (added in 25-02) correctly references `this.plugin.settings.snippetNodeFolderPath`, which is the right field name — the field just needs to be restored in settings.ts.

**Impact:** SNIPPET-07 (per-node folderPath > global setting) is structurally implemented correctly in runner-view.ts, but the global fallback path is broken at compile time because the settings field does not exist.

---

## Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `src/graph/graph-model.ts` | SnippetNode interface, RPNodeKind 'snippet' | VERIFIED | Both present; SnippetNode in RPNode union |
| `src/graph/canvas-parser.ts` | 'snippet' in validKinds, case 'snippet' in parseNode() | VERIFIED | Both present with D-09 buttonLabel fallback chain |
| `src/graph/graph-validator.ts` | case 'snippet' in nodeLabel() | VERIFIED | Line 201 — exhaustive switch case present |
| `src/runner/runner-state.ts` | isAtSnippetNode?: boolean in AtNodeState | VERIFIED | Line 36 |
| `src/runner/protocol-runner.ts` | completeSnippetFile() method, case 'snippet' halt, isAtSnippetNode in getState() | VERIFIED | All three present |
| `src/views/snippet-file-picker-modal.ts` | SnippetFilePickerModal FuzzySuggestModal subclass | VERIFIED | Created in 25-02; exports class with getItems/getItemText/onChooseItem |
| `src/views/runner-view.ts` | case 'snippet': branch, handleSnippetFilePick() | VERIFIED | Both present; full dispatch chain implemented |
| `src/settings.ts` | snippetNodeFolderPath: string in RadiProtocolSettings | FAILED | Field missing — deleted by commit 070d3fa |

---

## Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| runner-view.ts case 'snippet': button | SnippetFilePickerModal.open() | registerDomEvent click → handleSnippetFilePick | WIRED | Line 406: `void this.handleSnippetFilePick(snippetNode, state.currentNodeId)` → line 546: `new SnippetFilePickerModal(...).open()` |
| runner-view.ts handleSnippetFilePick() | runner.completeSnippetFile(text, nodeId) | vault.read() for .md; SnippetFillInModal for .json | WIRED | Lines 554, 603: `this.runner.completeSnippetFile(content/rendered, nodeId)` |
| protocol-runner.ts advanceThrough() | at-node state | case 'snippet' halt | WIRED | Lines 550-554: `case 'snippet': { this.currentNodeId = cursor; this.runnerStatus = 'at-node'; return; }` |
| runner-view.ts handleSnippetFilePick() | settings.snippetNodeFolderPath | direct property access | BROKEN | TypeScript error TS2551: field does not exist on RadiProtocolSettings |

---

## Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| runner-view.ts case 'snippet' button | snippetNode.buttonLabel | SnippetNode parsed from canvas via canvas-parser.ts | Yes — reads radiprotocol_buttonLabel from canvas JSON | FLOWING |
| runner-view.ts handleChosenSnippetFile | file content | app.vault.read(file) | Yes — reads actual vault file content | FLOWING |
| runner-view.ts handleSnippetJsonFile | rendered text | SnippetFillInModal.result | Yes — user fills template; modal returns rendered string | FLOWING |
| handleSnippetFilePick globalFolder | this.plugin.settings.snippetNodeFolderPath | RadiProtocolSettings | No — field missing from interface (compile error) | DISCONNECTED |

---

## Behavioral Spot-Checks

Step 7b: SKIPPED — Obsidian plugin; requires runtime environment. Cannot test without running Obsidian. Core logic is verified structurally.

---

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| SNIPPET-02 | 25-01, 25-02 | Runner renders file-picker button on snippet node | SATISFIED | case 'snippet': in runner-view.ts renders rp-answer-btn; isAtSnippetNode in getState() |
| SNIPPET-03 | 25-02 | Picker shows only files from configured folder | SATISFIED (partial) | handleSnippetFilePick filters vault files by folder + extension; SnippetFilePickerModal implemented — but settings.snippetNodeFolderPath compile error means global folder cannot be read |
| SNIPPET-04 | 25-02 | .md file selection appends plain text and advances runner | SATISFIED | handleChosenSnippetFile reads .md via vault.read(), calls completeSnippetFile() |
| SNIPPET-05 | 25-02 | .json SnippetFile opens SnippetFillInModal; rendered text appends | SATISFIED | handleSnippetJsonFile validates JSON, opens SnippetFillInModal, calls completeSnippetFile() |
| SNIPPET-07 | 25-02 | per-node folderPath overrides global setting | SATISFIED (partial) | Fallback chain implemented in handleSnippetFilePick — per-node path works; global path broken by missing settings field |

---

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| src/settings.ts | — | Missing field `snippetNodeFolderPath` (deleted by commit 070d3fa) | Blocker | TypeScript compile error TS2551 in runner-view.ts line 524; global folder fallback in SNIPPET-07 non-functional |

No other stub patterns found. All implementations are substantive:
- `completeSnippetFile()` has real undo-push + accumulator mutation + advance logic
- `handleSnippetFilePick()` has real folder resolution + file filtering + modal open
- `handleSnippetJsonFile()` has real JSON parse + structural validation + modal dispatch
- `SnippetFilePickerModal` is a real FuzzySuggestModal subclass with functional getItems/getItemText/onChooseItem

---

## Human Verification Required

### 1. End-to-end snippet node flow (after fixing settings.ts)

**Test:** In Obsidian with plugin loaded, open a canvas containing a snippet node. Configure `snippetNodeFolderPath` in Settings → Storage. Run the protocol.
**Expected:** Button appears; picker opens with only .md/.json files from the folder; selecting a .md file appends its content; selecting a valid .json snippet opens SnippetFillInModal; Esc at either modal leaves runner on the snippet node.
**Why human:** Requires Obsidian runtime — cannot test DOM events, modal interactions, or vault.read() in a headless environment.

### 2. per-node folderPath override (SNIPPET-07)

**Test:** Set `radiprotocol_folderPath` on a canvas snippet node to a different folder than the global setting. Run the protocol to that node.
**Expected:** The node-specific folder is used for file filtering, not the global setting.
**Why human:** Requires canvas editing + runtime verification of folder resolution.

---

## Gaps Summary

One gap blocks the TypeScript clean-build criterion. All structural implementation is correct and complete, but `snippetNodeFolderPath` was accidentally deleted from `src/settings.ts` by commit `070d3fa` (Phase 25-01 Task 1). This was an incidental regression — that commit's primary purpose was adding SnippetNode to the graph layer, but it included unrelated settings.ts changes that removed a field Phase 24 had correctly added.

The fix is surgical: restore three lines to `src/settings.ts`:
1. Interface field: `snippetNodeFolderPath: string;`
2. Default value: `snippetNodeFolderPath: '',`
3. Settings tab UI: the "Default snippet files folder" Setting entry in the Storage group

After restoring these, `npx tsc --noEmit` should pass (only pre-existing vitest module-resolution errors remain, which are unrelated to Phase 25 work).

---

_Verified: 2026-04-11T21:30:00Z_
_Verifier: Claude (gsd-verifier)_
