---
phase: 46-free-text-input-removal
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/graph/graph-model.ts
  - src/graph/canvas-parser.ts
  - src/graph/graph-validator.ts
  - src/__tests__/fixtures/free-text.canvas
autonomous: true
requirements: [CLEAN-01, CLEAN-02]
tags: [removal, migration-error, graph-model, validator]

must_haves:
  truths:
    - "FreeTextInputNode interface is gone from the graph model"
    - "'free-text-input' is gone from the RPNodeKind union and the RPNode discriminated union"
    - "CanvasParser no longer emits a FreeTextInputNode; encountering 'radiprotocol_nodeType': 'free-text-input' in canvas JSON leaves a raw record that GraphValidator rejects"
    - "GraphValidator emits a single aggregated Russian error naming every offending node and the literal token «free-text-input» when a canvas contains legacy free-text-input nodes"
    - "GraphValidator's migration check for free-text-input runs BEFORE LOOP-04 and reachability checks so the author sees one focused error"
    - "npm test's new free-text-input migration test passes green against the repurposed free-text.canvas fixture"
  artifacts:
    - path: "src/graph/graph-model.ts"
      provides: "RPNodeKind union without 'free-text-input'; FreeTextInputNode interface deleted; RPNode union without FreeTextInputNode"
      contains_not: "FreeTextInputNode"
    - path: "src/graph/canvas-parser.ts"
      provides: "parseNode no longer accepts 'free-text-input' as a valid kind; case arm and import removed"
      contains_not: "FreeTextInputNode"
    - path: "src/graph/graph-validator.ts"
      provides: "new Migration Check branch (or extension of the existing Migration Check) that rejects canvases whose raw nodes carry radiprotocol_nodeType === 'free-text-input'"
      contains: "free-text-input"
    - path: "src/__tests__/fixtures/free-text.canvas"
      provides: "A minimal canvas with one node carrying radiprotocol_nodeType=\"free-text-input\" — used by the migration test as the CLEAN-02 rejection fixture. The fixture itself is retained, only its SEMANTIC ROLE changes (happy-path → rejection proof)."
      contains: "\"radiprotocol_nodeType\": \"free-text-input\""
  key_links:
    - from: "src/graph/graph-validator.ts"
      to: "raw canvas data with radiprotocol_nodeType='free-text-input'"
      via: "validator receives a ProtocolGraph (not raw JSON) — so validator-level detection requires either (a) a parse-time marker/field on the graph, or (b) an earlier rejection at parser level that surfaces as a GraphValidator error string"
      pattern: "free-text-input"
      note: "Decision made in Task 1 below (Option A2 chosen): parser itself returns a `{ parseError }` record for legacy free-text-input nodes, and `CanvasParser.parse()` already surfaces parseErrors as a `{ success: false, error }` result. GraphValidator.validate() is unchanged structurally — the error surfaces via the existing parser-error path, NOT via a new validator check. This deviates from the Phase 43 MIGRATE-01 pattern because there is no downstream runtime that needs to see a typed legacy node. See <decisions> in this PLAN."
---

<objective>
Excise the `free-text-input` kind from the graph model and the parser, and ensure any canvas JSON still declaring `radiprotocol_nodeType = "free-text-input"` is rejected with a clear Russian rebuild instruction.

Purpose: Close CLEAN-01 (type-layer deletion) and CLEAN-02 (parser/validator rejection). Restores the v1.0 decision after the v1.2 regression that introduced free-text-input.

Output:
- `src/graph/graph-model.ts` with 3 deletions (union member, interface, RPNode arm)
- `src/graph/canvas-parser.ts` with 3 deletions (import, validKinds entry, case arm) + 1 addition (legacy-reject branch producing Russian parseError)
- `src/graph/graph-validator.ts` — EITHER byte-identical (if Task 1 Option A2 is chosen) OR extended with a new Migration Check (if Option A1 is chosen)
- `src/__tests__/fixtures/free-text.canvas` repurposed as the CLEAN-02 rejection fixture (content unchanged — it already carries the offending `radiprotocol_nodeType`, it just changes role)
- 1 new green vitest case in `src/__tests__/runner/protocol-runner.test.ts` OR a new test file proving the rejection
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/REQUIREMENTS.md
@CLAUDE.md

<interfaces>
<!-- Key contracts the executor must preserve or modify. Extracted from codebase. -->

From src/graph/graph-model.ts (BEFORE this plan):
```typescript
export type RPNodeKind =
  | 'start'
  | 'question'
  | 'answer'
  | 'free-text-input'        // ← DELETE this line
  | 'text-block'
  | 'loop-start'             // @deprecated Phase 43 D-03 — KEEP (Phase 43 legacy)
  | 'loop-end'               // @deprecated Phase 43 D-03 — KEEP (Phase 43 legacy)
  | 'snippet'
  | 'loop';

export interface FreeTextInputNode extends RPNodeBase {     // ← DELETE entire interface (lines 46-52)
  kind: 'free-text-input';
  promptLabel: string;
  prefix?: string;
  suffix?: string;
  radiprotocol_separator?: 'newline' | 'space';
}

export type RPNode =
  | StartNode
  | QuestionNode
  | AnswerNode
  | FreeTextInputNode       // ← DELETE this line (line 121)
  | TextBlockNode
  | LoopStartNode
  | LoopEndNode
  | SnippetNode
  | LoopNode;
```

From src/graph/canvas-parser.ts (BEFORE this plan):
```typescript
// Line 13 — DELETE from import list:
import type {
  // ...
  FreeTextInputNode,        // ← DELETE
  // ...
}

// Line 160-164 — REMOVE 'free-text-input' from validKinds:
const validKinds: RPNodeKind[] = [
  'start', 'question', 'answer', 'free-text-input',   // ← REMOVE 'free-text-input' from this array
  'text-block', 'loop-start', 'loop-end', 'snippet',
  'loop',
];

// Line 210-226 — DELETE entire case arm:
case 'free-text-input': {
  const node: FreeTextInputNode = {
    ...base,
    kind: 'free-text-input',
    promptLabel: getString(props, 'radiprotocol_promptLabel', raw.text ?? ''),
    // ... (whole 17-line block)
  };
  return node;
}
```

The parser already has an unknown-kind rejection path (line 166-168):
```typescript
if (!(validKinds as string[]).includes(kind)) {
  return { parseError: `Node "${raw.id}" has unknown radiprotocol_nodeType: "${kind}"` };
}
```

After removing 'free-text-input' from validKinds, legacy canvases will hit this branch and be rejected. BUT the error message is English and generic. Task 1 Option A2 REPLACES this with a dedicated Russian rejection BRANCH that fires BEFORE the `includes()` check — see <decisions>.

From src/graph/graph-validator.ts (BEFORE this plan):
```typescript
// nodeLabel() line 243 — DELETE this case arm (the kind no longer exists in the union):
case 'free-text-input': return node.promptLabel || node.id;
```
</interfaces>
</context>

<decisions>
Phase 46 Plan 01 decisions (made at planning time, not left to executor discretion):

**D-46-01-A — Option A chosen (delete `free-text-input` from `RPNodeKind`, NOT `@deprecated`-keep).**
Rationale per planner-antipatterns pattern #3: Phase 43 kept `loop-start`/`loop-end` in the union because `LoopNode` was the replacement kind — downstream `editor-panel-view.ts` / `runner-view.ts` / `protocol-runner.ts` needed the typed node to surface helpful "rebuild as unified loop" messaging. Free-text-input has NO replacement. Keeping it in the union as `@deprecated` would bloat every exhaustive switch (NODE_COLOR_MAP, nodeLabel, editor-panel-view form switch, protocol-runner advanceThrough, runner-view render) for zero downstream gain. Therefore: **hard-delete from the union.**

**D-46-01-A2 — Rejection lives at PARSE TIME, not at validate() time.**
Consequence of D-46-01-A: since the kind is not in `RPNodeKind`, `GraphValidator.validate()` receives a `ProtocolGraph` whose `nodes: Map<string, RPNode>` CANNOT contain a free-text-input node (the parser never produced one). Therefore the validator has no data to detect the legacy canvas from. Two options:
- A1: Have the parser PRESERVE the legacy node as some "raw" sentinel that validator then grep's for. Requires widening the graph shape. Rejected — pollutes the core type.
- **A2 (chosen): Have the PARSER detect `radiprotocol_nodeType === 'free-text-input'` BEFORE the `validKinds.includes(kind)` branch and return a dedicated Russian parseError.** `CanvasParser.parse()` already surfaces parseErrors as `{ success: false, error: string }` to every caller (RunnerView, Node Editor). The ROADMAP / REQUIREMENTS wording says "a GraphValidator error" — in practice users see `parseResult.success === false` rendered in the same RunnerView error panel as validator errors (MIGRATE-02 covers that rendering for loop-legacy canvases and applies identically here). Therefore A2 satisfies CLEAN-02 "encountering one produces a validator error" in spirit — the canvas is rejected with a clear Russian explanation BEFORE reaching validator. No change to `graph-validator.ts` structure is required.

**D-46-01-B — Russian parseError text.** The exact string the executor must write:
```
Узел "{nodeId}" использует устаревший тип "free-text-input". Этот тип был удалён. Замените узел на question или text-block и перестройте ветвь вручную.
```
(Where `{nodeId}` is the literal raw node id, NOT a label — the legacy node was never typed, so `nodeLabel()` cannot be called on it.)

Mandatory tokens for the acceptance criterion grep: must contain `устаревший`, `free-text-input` (literal), AND `question` (as the replacement hint).

**D-46-01-C — Fixture repurposing.** `src/__tests__/fixtures/free-text.canvas` stays on disk with its current content (one start + one free-text-input node). Its SEMANTIC ROLE changes from "RUN-04 happy path" to "CLEAN-02 rejection fixture". The new test (Task 3) imports it and asserts `parse().success === false` with `error` containing «устаревший». Legacy RUN-04 tests that still use it (protocol-runner.test.ts lines 103-144) are handled in Plan 46-03 (CLEAN-04) — they will be DELETED, not migrated, because free-text is gone.

**D-46-01-D — nodeLabel() deletion scope.** `graph-validator.ts` line 243 `case 'free-text-input': return node.promptLabel || node.id;` MUST be deleted — it's an exhaustive switch over `RPNodeKind`, so with the union shrunk TypeScript enforces removal via compile error. The executor does NOT need a separate grep for this — TS exhaustiveness is the forcing function. No other validator changes.
</decisions>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: RED — add failing test proving CLEAN-02 rejection of legacy free-text-input canvas</name>
  <files>
    - src/__tests__/free-text-input-migration.test.ts (NEW file)
  </files>
  <read_first>
    - src/__tests__/fixtures/free-text.canvas (confirm its current content matches the RawCanvasData shape)
    - src/graph/canvas-parser.ts (confirm `parse(jsonString, canvasFilePath)` signature and `{ success: false, error: string }` return shape on error)
    - src/__tests__/runner/protocol-runner.test.ts (lines 103-145: the existing `describe('enterFreeText() — free-text input node (RUN-04)')` block — DO NOT edit in this task, just observe the fixture-loader helper `loadGraph` so you can build a parallel helper here)
  </read_first>
  <behavior>
    - Test 1 (CLEAN-02 — rejection with Russian token): `new CanvasParser().parse(fs.readFileSync('src/__tests__/fixtures/free-text.canvas', 'utf-8'), 'test.canvas')` returns `{ success: false, error: ... }` where `error` contains the literal substring «устаревший» AND the literal substring «free-text-input» AND the node id «n-ft1».
    - Test 2 (CLEAN-02 — inline minimal canvas): parsing an inline JSON string with one start node + one `radiprotocol_nodeType: "free-text-input"` node returns `{ success: false, error }` with the same three tokens, substituting the inline id.
    - Test 3 (negative control — happy-path canvas still parses): `parse()` of `src/__tests__/fixtures/text-block.canvas` (existing Phase 4 fixture that does NOT use free-text-input) returns `{ success: true, graph }`. This proves the new rejection branch is scoped, not a blanket regression.
  </behavior>
  <action>
    Create a new test file `src/__tests__/free-text-input-migration.test.ts`. Use the same module stance as `src/__tests__/node-picker-modal.test.ts` — pure-function test, no `vi.mock('obsidian')` directive (the project's vitest config aliases `obsidian` automatically). Import `CanvasParser` from `../graph/canvas-parser` and use `fs.readFileSync` + `path.join(__dirname, 'fixtures', 'free-text.canvas')` for Test 1 (mirror the loadGraph pattern from protocol-runner.test.ts).

    For Test 2, construct the inline JSON as a raw string:
    ```json
    {"nodes":[{"id":"s","type":"text","text":"S","x":0,"y":0,"width":100,"height":60,"radiprotocol_nodeType":"start"},{"id":"ft-x","type":"text","text":"F","x":0,"y":60,"width":100,"height":60,"radiprotocol_nodeType":"free-text-input"}],"edges":[]}
    ```

    For Test 3, read `src/__tests__/fixtures/text-block.canvas` (already exists — verify by reading it before writing the test).

    Run `npm test -- src/__tests__/free-text-input-migration.test.ts --run`. **ALL 3 tests MUST fail** (Test 1 + 2 fail because the current parser ACCEPTS free-text-input and returns `{ success: true }`; Test 3 passes). Commit with message `test(46-01): RED - CLEAN-02 rejection tests for legacy free-text-input canvas`.

    Do NOT edit `canvas-parser.ts`, `graph-model.ts`, or `graph-validator.ts` in this task — RED phase must only add the failing test.
  </action>
  <verify>
    <automated>npm test -- src/__tests__/free-text-input-migration.test.ts --run 2>&1 | grep -E "FAIL|Tests.*failed|✗" && echo "RED confirmed"</automated>
  </verify>
  <acceptance_criteria>
    - File `src/__tests__/free-text-input-migration.test.ts` exists
    - `grep -c "устаревший" src/__tests__/free-text-input-migration.test.ts` returns >= 2 (Test 1 + Test 2 each assert the token)
    - `grep -c "free-text-input" src/__tests__/free-text-input-migration.test.ts` returns >= 3 (import of fixture path reference + 2 assertion tokens + inline JSON)
    - `npm test -- src/__tests__/free-text-input-migration.test.ts --run` exits NON-ZERO with at least 2 failing tests (Test 1 + Test 2; Test 3 passes)
    - `npx tsc --noEmit --skipLibCheck` exits 0 (the test file compiles cleanly against the PRE-excision types)
    - The test file contains NO `vi.mock('obsidian')` literal (grep count == 0)
    - Commit exists with message matching `^test\(46-01\): RED` (verify via `git log -1 --format=%s`)
  </acceptance_criteria>
  <done>RED test file committed; all CLEAN-02 rejection tests fail as expected because the parser still accepts the legacy kind.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: GREEN — excise free-text-input from graph-model.ts + canvas-parser.ts + graph-validator.ts; add parser rejection branch</name>
  <files>
    - src/graph/graph-model.ts
    - src/graph/canvas-parser.ts
    - src/graph/graph-validator.ts
  </files>
  <read_first>
    - src/graph/graph-model.ts (full file — confirm the 3 deletion sites: line 13 union member, lines 46-52 interface, line 121 RPNode arm)
    - src/graph/canvas-parser.ts (full file — confirm the 3 deletion sites: line 13 import, line 161 validKinds entry, lines 210-226 case arm — AND the insertion point for the new rejection branch, between lines 158 and 160)
    - src/graph/graph-validator.ts (lines 238-250 nodeLabel switch — confirm line 243 `case 'free-text-input':` is the only free-text-input-specific arm)
    - src/__tests__/free-text-input-migration.test.ts (the RED tests from Task 1 — this task turns them GREEN)
  </read_first>
  <action>
    Execute deletions + one addition in this exact order (commit as a single GREEN commit — no intermediate commits):

    **Step 1 — graph-model.ts (3 deletions):**
    - Delete line 13 `  | 'free-text-input'` from the `RPNodeKind` union (leave surrounding union members byte-identical — including the `// Phase 43 D-01` block comment header)
    - Delete lines 46-52 (the entire `FreeTextInputNode` interface including its 2 blank-line separators). Preserve the surrounding `AnswerNode` and `TextBlockNode` interfaces byte-identically.
    - Delete line 121 `  | FreeTextInputNode` from the `RPNode` discriminated union (leave the `| StartNode | QuestionNode | AnswerNode | TextBlockNode | LoopStartNode | LoopEndNode | SnippetNode | LoopNode` surrounding arms byte-identical with their @deprecated comments)

    **Step 2 — canvas-parser.ts (3 deletions + 1 addition):**
    - Delete line 13 `  FreeTextInputNode,` from the `import type { ... } from './graph-model';` list (preserve all other imports byte-identically, including the `LoopStartNode`, `LoopEndNode`, `SnippetNode`, `LoopNode` entries)
    - Delete the literal substring `'free-text-input', ` from the `validKinds: RPNodeKind[]` array at line 161 so the array reads:
      ```typescript
      const validKinds: RPNodeKind[] = [
        'start', 'question', 'answer',
        'text-block', 'loop-start', 'loop-end', 'snippet',  // Phase 29
        'loop',  // Phase 43 D-05 — unified loop (LOOP-01, LOOP-02)
      ];
      ```
    - Delete the entire `case 'free-text-input': { ... }` block (lines 210-226 in the pre-excision file; 17 lines including the closing brace and trailing blank line).
    - **Add a dedicated rejection branch IMMEDIATELY BEFORE `if (!(validKinds as string[]).includes(kind))`** (the line that starts with `if (!(validKinds`). Insertion text (per D-46-01-B):
      ```typescript
      // Phase 46 CLEAN-02 — legacy free-text-input канвасы отвергаются на parse-time.
      // Kind удалён из RPNodeKind (Phase 46 D-46-01-A); отдельная ветка даёт автору
      // осмысленное русское сообщение вместо generic "unknown radiprotocol_nodeType".
      if (kind === 'free-text-input') {
        return { parseError: `Узел "${raw.id}" использует устаревший тип "free-text-input". Этот тип был удалён. Замените узел на question или text-block и перестройте ветвь вручную.` };
      }
      ```

    **Step 3 — graph-validator.ts (1 deletion):**
    - In the `nodeLabel()` switch (lines 238-250), delete line 243 `      case 'free-text-input': return node.promptLabel || node.id;` and ITS trailing newline (so the switch goes directly from `answer` arm to `text-block` arm). TypeScript will enforce via exhaustiveness that this is the only mandatory deletion in this file.

    **Do NOT touch any other file.** Do NOT edit `styles.css` / `src/styles.css` / `src/styles/*.css` in this task — CSS belongs to Plan 46-02. Do NOT edit `src/views/*`, `src/runner/*`, `src/canvas/*`, or any `__tests__/` file other than what Task 1 already created.

    After edits, run:
    ```bash
    npx tsc --noEmit --skipLibCheck 2>&1 | head -40
    ```
    Expect compile errors in `src/canvas/node-color-map.ts`, `src/runner/protocol-runner.ts`, `src/views/editor-panel-view.ts`, `src/views/runner-view.ts`, `src/__tests__/runner/protocol-runner.test.ts`, `src/__tests__/node-picker-modal.test.ts` — these are INTENTIONAL and will be fixed by Plan 46-02 + 46-03 in wave 2. **Document the expected error count in the commit message** (rough count: ≈ 10-15 errors across those files — executor records actual count at commit time).

    Then run the CLEAN-02 test file ONLY:
    ```bash
    npm test -- src/__tests__/free-text-input-migration.test.ts --run
    ```
    All 3 tests MUST pass. Do NOT run the full test suite yet — it will fail because of the expected downstream breakage handled by Plans 46-02 and 46-03.

    Commit with message `feat(46-01): GREEN - excise free-text-input type; parser rejects legacy canvases with Russian error`.
  </action>
  <verify>
    <automated>npm test -- src/__tests__/free-text-input-migration.test.ts --run</automated>
  </verify>
  <acceptance_criteria>
    - `grep -c "free-text-input" src/graph/graph-model.ts` returns 0
    - `grep -c "FreeTextInputNode" src/graph/graph-model.ts` returns 0
    - `grep -c "FreeTextInputNode" src/graph/canvas-parser.ts` returns 0
    - `grep -c "free-text-input" src/graph/canvas-parser.ts` returns exactly 2 (the Russian comment mentioning the kind literally, and the `if (kind === 'free-text-input')` check — plus the error string interpolation; acceptable range 2-4 — executor records actual count)
    - `grep -c "устаревший" src/graph/canvas-parser.ts` returns 1 (the rejection error string)
    - `grep -c "free-text-input" src/graph/graph-validator.ts` returns 0 (the nodeLabel arm is the only reference and it's deleted)
    - `npm test -- src/__tests__/free-text-input-migration.test.ts --run` exits 0 with 3 passing tests
    - `git log -2 --format=%s` shows both the Task 1 RED commit AND this Task 2 GREEN commit with the message prefix `feat(46-01): GREEN`
    - (Intentional) `npx tsc --noEmit --skipLibCheck` exits NON-ZERO — expected breakage in downstream layers handled by Plan 46-02. Executor records the error count in the commit body so Plan 46-02 can verify it closes exactly those errors.
  </acceptance_criteria>
  <done>CLEAN-01 type deletion + CLEAN-02 parser rejection shipped; dedicated migration test green; build red downstream as expected (wave-2 closes it).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| canvas-file → parser | Canvas JSON on disk is user-authored; parser must reject malformed / legacy types gracefully without throwing |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-46-01-01 | info | user experience | accept (documented) | Users with persisted canvases containing `free-text-input` nodes will see the canvas start failing validation on upgrade. This is a PRODUCT concern explicitly called out in the ROADMAP ("restoring the original v1.0 decision after the v1.2 regression"), not a security threat. Mitigation = the Russian parseError (D-46-01-B) telling the user exactly which node is offending and how to rebuild (replace with question or text-block). |
| T-46-01-02 | T (tampering) | canvas-parser.ts | mitigate | Parser already catches malformed JSON at line 68-72 (`try { JSON.parse } catch { return { success: false } }`); new rejection branch operates on already-typed `kind` string — cannot crash on malformed input. |
| T-46-01-03 | D (DoS) | GraphValidator | accept | No new code path added to validator; removal shrinks attack surface. No action. |
| T-46-01-04 | I (info disclosure) | parser error message | accept | Error message interpolates `raw.id` — node IDs are author-controlled strings already surfaced in existing parseErrors (line 157, 253). No new PII path. |
</threat_model>

<verification>
- `npm test -- src/__tests__/free-text-input-migration.test.ts --run` passes
- `grep -rn "FreeTextInputNode" src/graph/` returns 0 matches
- `grep -c "free-text-input" src/graph/graph-model.ts` returns 0
- `grep -c "free-text-input" src/graph/graph-validator.ts` returns 0
- `grep -c "устаревший.*free-text-input\|free-text-input.*устаревший" src/graph/canvas-parser.ts` returns >= 1 (proves the rejection branch contains both mandatory tokens)
- Build red ONLY in downstream files (node-color-map.ts, protocol-runner.ts, runner-view.ts, editor-panel-view.ts, runner-state.ts, 2 test files) — confirmed by running `npx tsc --noEmit --skipLibCheck 2>&1 | grep "error TS" | awk -F: '{print $1}' | sort -u` and confirming the list matches the Plan 46-02 + 46-03 `files_modified` scope.
</verification>

<success_criteria>
- Plan 46-01 closes CLEAN-01 at the type layer (RPNodeKind + FreeTextInputNode + RPNode union) and CLEAN-02 at the parse-rejection layer (Russian parseError).
- Exactly 2 commits on branch: RED (Task 1) + GREEN (Task 2).
- `src/__tests__/free-text-input-migration.test.ts` exists with 3 green tests.
- Build is intentionally red in wave-1; Plan 46-02 (wave-2) closes the downstream TS exhaustiveness errors.
</success_criteria>

<output>
After completion, create `.planning/phases/46-free-text-input-removal/46-01-graph-model-parser-validator-SUMMARY.md` documenting:
- The 3 deletions in graph-model.ts + 3 deletions + 1 addition in canvas-parser.ts + 1 deletion in graph-validator.ts
- The exact `npx tsc --noEmit --skipLibCheck` error count and file list (so Plan 46-02 has a known baseline)
- The 3 test names + assertion tokens in the new migration test file
- Both commit hashes (RED + GREEN)
- Decisions D-46-01-A, A2, B, C, D confirmation
</output>
