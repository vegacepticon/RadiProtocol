---
date: 2026-08-20T08:13:22+0300
author: Roman Shulgha
commit: e26fd56
branch: main
repository: RadiProtocol
topic: "Sidebar runner and free-text Answers"
tags: [plan, blueprint, runner, sidebar, answers, obsidian]
status: ready
parent: .rpiv/artifacts/research/2026-08-19_23-13-03_sidebar-runner-and-free-text-answers.md
phase_count: 5
phases:
  - { n: 1, title: "Free-text Answer contract and pure command", files: [src/graph/graph-model.ts, src/protocol/protocol-document.ts, src/protocol/protocol-document-parser.ts, src/graph/graph-validator.ts, src/runner/protocol-runner.ts, src/i18n/locales/en.json, src/i18n/locales/ru.json, src/__tests__/protocol-document-parser.test.ts, src/__tests__/graph-validator.test.ts, src/__tests__/runner/protocol-runner-free-text-answer.test.ts], depends_on: [] }
  - { n: 2, title: "Shared Session Host with Floating Parity", files: [src/views/runner-session-host.ts, src/views/inline-runner-modal.ts, src/constants/css-classes.ts, src/runner/render/render-snippet-picker.ts, src/styles/runner-session.css, src/styles/inline-runner.css, src/styles/snippet-tree-picker.css, esbuild.config.mjs, src/i18n/locales/en.json, src/i18n/locales/ru.json, src/__tests__/runner/runner-renderer-host-fixtures.ts, src/__tests__/views/runner-session-host.test.ts, src/__tests__/views/inline-runner-modal.test.ts, src/__tests__/views/inline-runner-modal-keyboard.test.ts, src/__tests__/views/inline-runner-modal-loop-body-file-bound.test.ts, src/__tests__/views/inline-runner-modal-output-toolbar.test.ts], depends_on: [1] }
  - { n: 3, title: "Free-text Runner Controls and Drafts", files: [src/runner/render/render-question.ts, src/views/runner-session-host.ts, src/styles/runner-session.css, src/i18n/locales/en.json, src/i18n/locales/ru.json, src/__tests__/runner/render-question.test.ts, src/__tests__/runner/runner-renderer-host-fixtures.ts, src/__tests__/views/runner-session-host.test.ts], depends_on: [1, 2] }
  - { n: 4, title: "Protocol Authoring Toggle", files: [src/views/protocol-editor-view.ts, src/i18n/locales/en.json, src/i18n/locales/ru.json, src/__tests__/protocol-editor-helpers.test.ts, src/__tests__/views/protocol-editor-keyboard.test.ts], depends_on: [1, 3] }
  - { n: 5, title: "Multi-leaf Sidebar Presentation and Routing", files: [src/views/sidebar-runner-view.ts, src/main.ts, src/settings.ts, src/styles/runner-session.css, src/i18n/locales/en.json, src/i18n/locales/ru.json, src/__mocks__/obsidian.ts, src/__tests__/settings-tab.test.ts, src/__tests__/runner-commands.test.ts, src/__tests__/views/sidebar-runner-view.test.ts, src/__tests__/views/runner-presentation-routing.test.ts], depends_on: [2, 3, 4] }
unresolved_phase_count: 0
last_updated: 2026-08-20T20:05:25+0300
last_updated_by: Roman Shulgha
---

# Sidebar Runner and Free-text Answers Implementation Plan

## Overview
RadiProtocol will gain a presentation-neutral `RunnerSessionHost` that preserves the floating runner's protocol bootstrap, traversal, snippet orchestration, fixed-note accumulator deltas, and transient state while allowing both the floating panel and a new multi-instance right-sidebar `ItemView` to mount the same session UI. Answer nodes will gain a backward-compatible `freeText: boolean` runtime/document projection; accepted user text will travel through the existing Answer branch identity, separator, undo/redo, automatic traversal, and note-delta path.

## Requirements
- Add a persisted `useSidebarRunner` setting that defaults to `false` when absent.
- Route both normal Run and Start from specific node through the selected presentation while preserving the captured Markdown note and optional start node.
- Create a new right-sidebar leaf for every sidebar launch; do not deduplicate sidebar sessions.
- Keep each session bound to the note captured at launch and serialize writes through the plugin's path-keyed mutex.
- Keep sidebar sessions interactive after active-note changes, visibly identify the bound note and mismatch, and provide a focus-note action.
- Keep sessions and drafts transient across plugin reload, workspace restore, and restart.
- Add canonical/runtime `freeText: boolean`, normalized to `false` for absent or malformed fields without a schema-version migration.
- Expose the flag as an Answer editor toggle and preserve explicit `false` when the Answer is saved.
- Reject free-text Answers whose effective prompt, `displayLabel ?? answerText`, is blank after trimming.
- Render free-text Answers at their authored Answer position with an empty multiline textarea and localized Submit button.
- Preserve drafts by Answer ID across destructive rerenders for the current session lifetime.
- Auto-grow each field to full content height with host-owned overflow; submit via click or Mod+Enter while plain Enter remains a newline.
- Reject blank submissions with a localized accessible inline alert and focus restoration, with no runner/history/note mutation.
- Preserve accepted leading, trailing, and internal whitespace exactly.
- Auto-focus a free-text field only when it is the sole actionable Answer/Question/Snippet option.
- Preserve preset Answer behavior and automatic downstream output.
- Auto-close both presentations at the existing completion boundary and close a sidebar leaf if its bound note is deleted.

## Current State Analysis
`ProtocolRunner` already owns branch identity, separators, append-only accumulation, automatic traversal, and snapshot-based Back/Redo, but `chooseAnswer()` can only append authored `answerText`. `InlineRunnerModal` currently mixes session bootstrap/effects with floating layout, active-note visibility, and registry policy. `renderQuestionAtNode()` always emits Answer buttons, and `main.ts` has two launch paths with different construction/deduplication behavior.

### Key Discoveries
- `src/graph/graph-model.ts:59-64` defines the current Answer runtime contract without a discriminator.
- `src/protocol/protocol-document.ts:64-91` keeps node fields open-ended, so an additive boolean does not require a V1 migration.
- `src/protocol/protocol-document-parser.ts:35-64,232-241` provides canonical-first boolean normalization but does not project an Answer flag.
- `src/runner/protocol-runner.ts:89-128,356-419,731-750` separates Answer ID from appended text and snapshots before mutation.
- `src/runner/render/render-question.ts:14-33,64-165` centralizes Answer controls across grouped and authored-order rendering.
- `src/views/inline-runner-modal.ts:130-307,413-614,751-1041` contains the extraction target: bootstrap, render dispatch, snippets, deltas, and cleanup.
- `src/views/snippet-manager-view.ts:194-300` supplies the chosen mounted/generation async-ownership pattern.
- `src/main.ts:325-381,471-527` contains the two launch routes that must converge.
- `src/main.ts:208-223` is a singleton ItemView precedent and must not be copied for multi-instance sidebar launches.
- `node_modules/obsidian/obsidian.d.ts:6989-7003,7290-7330` exposes `getRightLeaf(false)`, `setViewState`, and ephemeral state on the project's installed API typings.
- `src/styles/inline-runner.css:149-189` couples shared controls to the floating actions ancestor and must be split into presentation-neutral rules.
- Historical commit `e516943` extracted render adapters while leaving host effects in each shell; `b899821` later removed the prior persisted RunnerView surface.

## Desired End State
```ts
// Existing protocol: absent flag remains a preset Answer at runtime.
const preset: AnswerNode = { ...base, kind: 'answer', answerText: 'No effusion.', freeText: false };

// Authored free-text Answer: authored text is a prompt, not inserted content.
const entered: AnswerNode = {
  ...base,
  kind: 'answer',
  answerText: 'Describe the finding',
  freeText: true,
  radiprotocol_separator: 'newline',
};

// The selected Answer ID still chooses the branch; the payload supplies report text.
runner.chooseAnswer(entered.id, '  Multiline\ncase-specific finding.  ');
```

```ts
// Composition root routes both commands through one presentation selector.
await plugin.openRunnerSession({
  protocolPath: protocolFile.path,
  targetNote: capturedMarkdownFile,
  startNodeId: optionalStartNodeId,
});
```

```text
Right sidebar
┌ Bound note: reports/chest.md  [Focus note]
│ Active note differs
├ Question prompt
├ Describe the finding
│ ┌───────────────────────────┐
│ │ user-entered multiline…   │
│ └───────────────────────────┘ [Submit]
└ Back / Redo / Skip / Close
```

## What We're NOT Doing
- No separate free-text node kind and no revival of the removed `free-text-input` traversal surface.
- No persisted runner sessions, workspace-restored drafts, or resume modal.
- No replacement or retirement of the floating runner.
- No retargeting writes to `workspace.getActiveFile()` after launch.
- No note-aware Back/Redo that removes or re-appends bytes already written.
- No transaction/rollback coupling between runner mutation and asynchronous vault writes.
- No change to first-chunk note separation; separator de-duplication remains limited to provenance-confirmed synthetic prefixes so authored leading whitespace is preserved.
- No schema-version bump or structural migration for an additive V1 node field.
- No singleton sidebar activation helper or same-protocol/note sidebar deduplication.
- No Run again action after completion; both shells close at the current terminal boundary.
- No generated `main.js` or `styles.css` hand edits.

## Decisions

### Shared presentation architecture
The shared boundary is a view-layer `RunnerSessionHost` above `ProtocolRunner` and below presentation shells. It owns bootstrap, runner/render dispatch, drafts, snippet child lifetimes, fixed-note writes, progress/self-check behavior, and idempotent disposal; floating layout/visibility and sidebar workspace chrome remain in their shells (`src/views/inline-runner-modal.ts:130-307,413-614,751-1041`).

### Canonical and runtime field name
**Ambiguity:** The research fixed a boolean toggle but not its name.

**Explored:**
- `freeText` — matches concise canonical names and the no-`is` boolean convention (`loop` in `src/protocol/protocol-document-parser.ts:220-221`).
- `isFreeText` — explicit predicate but diverges from existing canonical boolean naming.
- `userInput` — payload-oriented but less specific to the authored field semantics.

**Decision:** Use `fields.freeText` and backward-compatible runtime `AnswerNode.freeText?: boolean`; canonical parser projection applies `getOptionalBoolean(...) ?? false`, while direct compatibility graphs treat absence as preset behavior via `freeText === true` checks.

### Submitted Answer API
Keep Answer ID as branch identity and extend `chooseAnswer(answerId, submittedText?)` so a flagged Answer validates a nonblank payload before redo clearing and undo snapshot creation. Preset Answers continue to use authored `answerText`; accepted submitted text is appended verbatim with the Answer's effective separator (`src/runner/protocol-runner.ts:89-128,731-750`).

### Prompt validation
Validate only flagged Answers and evaluate the actual renderer prompt expression, `(displayLabel ?? answerText).trim()`, so a whitespace-only display label cannot mask valid answer text (`src/runner/render/render-question.ts:24-33`). Existing empty preset Answers remain valid.

### Draft ownership and renderer ports
Drafts and field errors live in session-host maps keyed by Answer ID. The renderer receives narrow draft/input/submit/focus/i18n ports, emits safe DOM text, and never acquires runner, vault, workspace, or lifecycle ownership (`src/runner/render/render-question.ts:14-20`; `src/views/option-order-chip-editor.ts:37-119`).

### Async ownership
Apply a mounted flag plus monotonic generation to protocol reads, snippet resolution/fill completion, note writes, and scheduled completion. Close/dispose invalidates the generation and child resources before shell teardown (`src/views/snippet-manager-view.ts:194-300`).

### Sidebar launch context
Each launch calls `workspace.getRightLeaf(false)`, sets the registered view type, then initializes that concrete view instance with protocol path, captured `TFile`, and optional start node. Session context remains in instance fields and is never returned from durable view state. This follows the live post-`setViewState` handoff shape in `src/main.ts:208-223` without its singleton leaf reuse.

### Completion and target-note deletion
The developer chose parity with floating behavior: detach/close at the existing completion/self-check boundary and immediately close the sidebar leaf when the bound note is deleted (`src/views/inline-runner-modal.ts:522-553,665-684`).

### Active-note mismatch
Only sidebar presentation policy changes: the session stays interactive and fixed to the start note, while the shell renders the bound path, mismatch status, and focus-note action. Floating hide/show behavior remains unchanged.

### CSS ownership
Move common runner session zones and controls into new source `src/styles/runner-session.css`; keep only fixed positioning, drag/resize, and floating overrides in `src/styles/inline-runner.css`. Register the shared file before the floating override in `esbuild.config.mjs`.

## Phase 1: Free-text Answer contract and pure command

### Overview
Defines the persisted/runtime contract and pure traversal behavior; foundation phase with no dependencies.

### Changes Required:

#### 1. src/graph/graph-model.ts
```ts
export interface AnswerNode extends RPNodeBase {
  kind: 'answer';
  answerText: string;
  displayLabel?: string;
  /**
   * When true, the Answer is rendered as a user-entered multiline value.
   * The Answer id remains the branch identity; answerText/displayLabel supply
   * only the prompt. Absent/false keeps preset Answer behavior.
   */
  freeText?: boolean;
  radiprotocol_separator?: 'newline' | 'space';
}
```

#### 2. src/protocol/protocol-document.ts
```ts
  /**
   * Typed node fields. Keys are camelCase without prefix:
   * - questionText, answerText, displayLabel, freeText, content, separator,
   *   loop, optionOrder, subfolderPath, snippetLabel, snippetSeparator, snippetPath.
   *
   * Parser validates field presence/absence per node kind.
   */
  fields: Record<string, unknown>;
```

#### 3. src/protocol/protocol-document-parser.ts
```ts
      case 'answer': {
        const node: AnswerNode = {
          ...base,
          kind: 'answer',
          answerText: getString(fields, 'answerText', raw.text ?? '', 'radiprotocol_answerText'),
          displayLabel: getOptionalString(fields, 'displayLabel', 'radiprotocol_displayLabel'),
          freeText: getOptionalBoolean(fields, 'freeText', 'radiprotocol_freeText') ?? false,
          radiprotocol_separator: getSeparator(fields, 'separator', 'radiprotocol_separator'),
        };
        return node;
      }
```

#### 4. src/graph/graph-validator.ts
```ts
    // Free-text Answers use displayLabel ?? answerText as the visible prompt.
    // Validate that exact projection: a whitespace-only displayLabel masks a
    // nonblank answerText and therefore still produces an unusable control.
    for (const [, node] of graph.nodes) {
      if (node.kind !== 'answer' || node.freeText !== true) continue;
      const prompt = node.displayLabel ?? node.answerText;
      if (prompt.trim() === '') {
        errors.push(this.t('graphValidator.freeTextAnswerPromptRequired', { id: node.id }));
      }
    }
```

#### 5. src/runner/protocol-runner.ts
```ts
  /**
   * User selects an Answer. Preset Answers append their authored answerText;
   * free-text Answers append the submitted command payload while retaining the
   * Answer id as branch identity. A blank free-text payload is rejected before
   * redo/history/accumulator/navigation mutation. Accepted text is preserved
   * verbatim after the blank-only check.
   *
   * @returns true when the Answer command was accepted; false for a wrong-state,
   * invalid Answer, or blank free-text submission.
   */
  chooseAnswer(answerId: string, submittedText?: string): boolean {
    if (this.runnerStatus !== RUNNER_STATUS.AT_NODE) return false;
    if (this.graph === null || this.currentNodeId === null) return false;

    const answerNode = this.graph.nodes.get(answerId);
    if (answerNode === undefined || answerNode.kind !== 'answer') {
      this.transitionToError(`Answer node '${answerId}' not found or is not an answer node.`);
      return false;
    }

    const textToAppend = answerNode.freeText === true
      ? submittedText
      : answerNode.answerText;
    if (answerNode.freeText === true && (textToAppend === undefined || textToAppend.trim() === '')) {
      return false;
    }

    // Forward action — clear redo stack (any undone transition is now invalidated)
    this.redoStack = [];
    // Push undo entry BEFORE any mutation (Pitfall 3 — snapshot must come first)
    this.undoStack.push({
      nodeId: this.currentNodeId,
      textSnapshot: this.accumulator.snapshot(),
      loopContextStack: this.loopContextStack.map(f => ({ ...f })),
    });

    this.appendAnswerText(textToAppend ?? '', this.resolveSeparator(answerNode));

    // Advance to the next node after this answer.
    // A dead-end answer inside a loop body returns to the owning picker;
    // outside a loop, a dead-end completes the protocol.
    const neighbors = this.graph.adjacency.get(answerId);
    const next = neighbors !== undefined ? neighbors[0] : undefined;
    if (next === undefined) {
      this.advanceOrReturnToLoop(undefined);
      return true;
    }
    this.advanceThrough(next);
    return true;
  }

// Inside advanceThrough(), replace the `case 'answer'` append line with:
        case 'answer': {
          // A free-text Answer's authored text is a prompt only. Selected
          // free-text Answers are handled by chooseAnswer(answerId, payload);
          // if one is encountered in an automatic chain, pass through without
          // inserting its prompt.
          this.appendAnswerText(
            node.freeText === true ? '' : node.answerText,
            this.resolveSeparator(node),
          );
          const next = this.firstNeighbour(cursor);

          // Quick-exit from loop body: if an answer node inside a loop body is wired
          // directly to the same target as any of the loop's isLoopExit edges, pop the loop frame
          // so the runner continues past the loop instead of returning to the picker
          // when the branch eventually hits a dead-end.
          if (this.graph !== null && this.loopContextStack.length > 0 && next !== undefined) {
            const topLoop = this.loopContextStack[this.loopContextStack.length - 1];
            if (topLoop !== undefined) {
              const exitsToNext = this.graph.edges.some(
                e => e.fromNodeId === topLoop.loopNodeId && e.isLoopExit === true && e.toNodeId === next
              );
              if (exitsToNext) {
                this.loopContextStack.pop();
              }
            }
          }

          if (this.advanceOrReturnToLoop(next) === 'halted') return;
          cursor = next!;
          break;
        }
```

#### 6. src/i18n/locales/en.json
```json
    "freeTextAnswerPromptRequired": "Free-text Answer \"{id}\" needs a nonblank display label or answer text to use as its prompt.",
```

#### 7. src/i18n/locales/ru.json
```json
    "freeTextAnswerPromptRequired": "Для ответа со свободным текстом \"{id}\" нужна непустая подпись или текст ответа, используемые как подсказка.",
```

#### 8. src/__tests__/protocol-document-parser.test.ts
```ts
  it('normalizes Answer freeText booleans and gives canonical values precedence', () => {
    const doc = docWithNodes([
      { id: 'true', kind: 'answer', fields: { answerText: 'Prompt', freeText: true } },
      { id: 'false', kind: 'answer', fields: { answerText: 'Preset', freeText: false } },
      { id: 'absent', kind: 'answer', fields: { answerText: 'Preset' } },
      { id: 'malformed', kind: 'answer', fields: { answerText: 'Preset', freeText: 'true' } },
      {
        id: 'canonical-wins',
        kind: 'answer',
        fields: { answerText: 'Preset', freeText: false, radiprotocol_freeText: true },
      },
      {
        id: 'legacy',
        kind: 'answer',
        fields: { answerText: 'Prompt', radiprotocol_freeText: true },
      },
    ]);

    const result = parser.parse(JSON.stringify(doc), 'test.rp.json');

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect((result.graph.nodes.get('true') as any).freeText).toBe(true);
    expect((result.graph.nodes.get('false') as any).freeText).toBe(false);
    expect((result.graph.nodes.get('absent') as any).freeText).toBe(false);
    expect((result.graph.nodes.get('malformed') as any).freeText).toBe(false);
    expect((result.graph.nodes.get('canonical-wins') as any).freeText).toBe(false);
    expect((result.graph.nodes.get('legacy') as any).freeText).toBe(true);
  });
```

#### 9. src/__tests__/graph-validator.test.ts
```ts
import type { AnswerNode, ProtocolGraph, RPNode } from '../graph/graph-model';

function graphWithFreeTextAnswer(
  answer: Pick<AnswerNode, 'answerText' | 'displayLabel' | 'freeText'>,
): ProtocolGraph {
  const nodes = new Map<string, RPNode>([
    ['start', { id: 'start', kind: 'start', x: 0, y: 0, width: 100, height: 60 }],
    ['question', {
      id: 'question', kind: 'question', questionText: 'Choose',
      x: 0, y: 80, width: 100, height: 60,
    }],
    ['answer', {
      id: 'answer', kind: 'answer', ...answer,
      x: 0, y: 160, width: 100, height: 60,
    }],
  ]);
  return {
    canvasFilePath: 'free-text-answer.rp.json',
    nodes,
    edges: [
      { id: 'start-question', fromNodeId: 'start', toNodeId: 'question' },
      { id: 'question-answer', fromNodeId: 'question', toNodeId: 'answer' },
    ],
    adjacency: new Map([
      ['start', ['question']],
      ['question', ['answer']],
    ]),
    reverseAdjacency: new Map([
      ['question', ['start']],
      ['answer', ['question']],
    ]),
    startNodeId: 'start',
  };
}

describe('GraphValidator — free-text Answer prompt', () => {
  it('rejects a flagged Answer when its effective prompt is blank', () => {
    const errors = new GraphValidator().validate(graphWithFreeTextAnswer({
      answerText: '   ',
      displayLabel: undefined,
      freeText: true,
    }));

    expect(errors).toContain(
      'Free-text Answer "answer" needs a nonblank display label or answer text to use as its prompt.',
    );
  });

  it('validates displayLabel ?? answerText exactly, including whitespace masking', () => {
    const errors = new GraphValidator().validate(graphWithFreeTextAnswer({
      answerText: 'Nonblank fallback',
      displayLabel: ' \n ',
      freeText: true,
    }));

    expect(errors.some(error => error.includes('Free-text Answer "answer"'))).toBe(true);
  });

  it('accepts a nonblank answerText fallback or displayLabel', () => {
    expect(new GraphValidator().validate(graphWithFreeTextAnswer({
      answerText: 'Describe the finding',
      displayLabel: undefined,
      freeText: true,
    }))).toEqual([]);
    expect(new GraphValidator().validate(graphWithFreeTextAnswer({
      answerText: '',
      displayLabel: 'Other finding',
      freeText: true,
    }))).toEqual([]);
  });

  it('keeps blank preset Answers valid', () => {
    expect(new GraphValidator().validate(graphWithFreeTextAnswer({
      answerText: '',
      displayLabel: undefined,
      freeText: false,
    }))).toEqual([]);
  });
});
```

#### 10. src/__tests__/runner/protocol-runner-free-text-answer.test.ts
```ts
import { describe, expect, it } from 'vitest';
import type { ProtocolGraph, RPNode, RPEdge } from '../../graph/graph-model';
import { ProtocolRunner } from '../../runner/protocol-runner';

function makeGraph(): ProtocolGraph {
  const nodes = new Map<string, RPNode>([
    ['start', { id: 'start', kind: 'start', x: 0, y: 0, width: 100, height: 60 }],
    ['seed', {
      id: 'seed', kind: 'text-block', content: 'Before',
      x: 0, y: 60, width: 100, height: 60,
    }],
    ['question', {
      id: 'question', kind: 'question', questionText: 'Choose',
      x: 0, y: 120, width: 100, height: 60,
    }],
    ['free', {
      id: 'free', kind: 'answer', answerText: 'Describe the finding', freeText: true,
      radiprotocol_separator: 'space', x: 0, y: 180, width: 100, height: 60,
    }],
    ['tail', {
      id: 'tail', kind: 'text-block', content: 'Tail', radiprotocol_separator: 'newline',
      x: 0, y: 240, width: 100, height: 60,
    }],
    ['preset', {
      id: 'preset', kind: 'answer', answerText: 'Preset', freeText: false,
      x: 120, y: 180, width: 100, height: 60,
    }],
    ['auto-free', {
      id: 'auto-free', kind: 'answer', answerText: 'Prompt only', freeText: true,
      x: 120, y: 240, width: 100, height: 60,
    }],
    ['next', {
      id: 'next', kind: 'question', questionText: 'Next',
      x: 0, y: 320, width: 100, height: 60,
    }],
  ]);
  const edges: RPEdge[] = [
    { id: 'e-start-seed', fromNodeId: 'start', toNodeId: 'seed' },
    { id: 'e-seed-question', fromNodeId: 'seed', toNodeId: 'question' },
    { id: 'e-question-free', fromNodeId: 'question', toNodeId: 'free' },
    { id: 'e-free-tail', fromNodeId: 'free', toNodeId: 'tail' },
    { id: 'e-tail-next', fromNodeId: 'tail', toNodeId: 'next' },
    { id: 'e-question-preset', fromNodeId: 'question', toNodeId: 'preset' },
    { id: 'e-preset-auto-free', fromNodeId: 'preset', toNodeId: 'auto-free' },
    { id: 'e-auto-free-next', fromNodeId: 'auto-free', toNodeId: 'next' },
  ];
  const adjacency = new Map<string, string[]>();
  const reverseAdjacency = new Map<string, string[]>();
  for (const edge of edges) {
    adjacency.set(edge.fromNodeId, [...(adjacency.get(edge.fromNodeId) ?? []), edge.toNodeId]);
    reverseAdjacency.set(edge.toNodeId, [...(reverseAdjacency.get(edge.toNodeId) ?? []), edge.fromNodeId]);
  }
  return {
    canvasFilePath: 'free-text-answer.rp.json',
    nodes,
    edges,
    adjacency,
    reverseAdjacency,
    startNodeId: 'start',
  };
}

describe('ProtocolRunner free-text Answers', () => {
  it('preserves accepted whitespace, applies the Answer separator, and includes automatic output', () => {
    const runner = new ProtocolRunner();
    runner.start(makeGraph());

    expect(runner.chooseAnswer('free', '  custom\nvalue  ')).toBe(true);

    expect(runner.getState()).toMatchObject({
      status: 'at-node',
      currentNodeId: 'next',
      accumulatedText: 'Before   custom\nvalue  \nTail',
    });
  });

  it.each([undefined, '', '   ', '\n\t '])(
    'rejects blank payload %p without clearing redo or mutating history/state',
    (payload) => {
      const runner = new ProtocolRunner();
      runner.start(makeGraph());
      expect(runner.chooseAnswer('preset')).toBe(true);
      runner.stepBack();
      const before = runner.getState();
      expect(before).toMatchObject({
        status: 'at-node',
        currentNodeId: 'question',
        accumulatedText: 'Before',
        canStepBack: false,
        canRedo: true,
      });

      expect(runner.chooseAnswer('free', payload)).toBe(false);
      expect(runner.getState()).toEqual(before);

      runner.redo();
      expect(runner.getState()).toMatchObject({
        status: 'at-node',
        currentNodeId: 'next',
        accumulatedText: 'Before\nPreset',
      });
    },
  );

  it('undoes and redoes the submitted payload plus automatic traversal as one snapshot', () => {
    const runner = new ProtocolRunner();
    runner.start(makeGraph());
    runner.chooseAnswer('free', 'finding');

    runner.stepBack();
    expect(runner.getState()).toMatchObject({
      status: 'at-node',
      currentNodeId: 'question',
      accumulatedText: 'Before',
      canRedo: true,
    });

    runner.redo();
    expect(runner.getState()).toMatchObject({
      status: 'at-node',
      currentNodeId: 'next',
      accumulatedText: 'Before finding\nTail',
      canRedo: false,
    });
  });

  it('ignores a submitted payload for preset Answers and never inserts an auto-traversed free-text prompt', () => {
    const runner = new ProtocolRunner();
    runner.start(makeGraph());

    expect(runner.chooseAnswer('preset', 'Injected')).toBe(true);

    expect(runner.getState()).toMatchObject({
      status: 'at-node',
      currentNodeId: 'next',
      accumulatedText: 'Before\nPreset',
    });
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] Focused parser, validator, and runner behavior passes: `npx vitest run src/__tests__/protocol-document-parser.test.ts src/__tests__/graph-validator.test.ts src/__tests__/runner/protocol-runner-free-text-answer.test.ts`
- [x] Phase-owned TypeScript and locale edits satisfy lint: `npx eslint src/graph/graph-model.ts src/protocol/protocol-document.ts src/protocol/protocol-document-parser.ts src/graph/graph-validator.ts src/runner/protocol-runner.ts src/__tests__/protocol-document-parser.test.ts src/__tests__/graph-validator.test.ts src/__tests__/runner/protocol-runner-free-text-answer.test.ts`
- [x] Strict TypeScript checking remains green: `npx tsc --noEmit --pretty false`

#### Manual Verification:
- [ ] Confirm an existing Answer with no `freeText` field still parses and behaves as a preset Answer.
- [ ] Confirm the accepted-whitespace assertion visibly retains both outer spaces and the embedded newline.
- [ ] Confirm no schema-version or migration code changed for the additive field.

## Phase 2: Shared Session Host with Floating Parity

### Overview
Extracts session behavior into a reusable host and remounts it in the existing floating shell; depends on Phase 1.

### Changes Required:

#### 1. src/views/runner-session-host.ts
**File**: src/views/runner-session-host.ts
**Changes**: NEW — implement session bootstrap, common DOM/render dispatch, note deltas, snippets, progress/self-check, generation guards, and disposal.

```ts
import { TFile, setIcon, type App, type EventRef } from 'obsidian';
import { GraphValidator } from '../graph/graph-validator';
import type { AnswerNode, ProtocolGraph, RPEdge } from '../graph/graph-model';
import type { Translator } from '../i18n';
import type { ProtocolDocumentParser } from '../protocol/protocol-document-parser';
import type { ProtocolDocumentStore } from '../protocol/protocol-document-store';
import { ProtocolRunner } from '../runner/protocol-runner';
import { renderCompleteHeading } from '../runner/render/render-complete';
import { renderErrorList } from '../runner/render/render-error';
import { renderLoopPicker } from '../runner/render/render-loop-picker';
import { renderQuestionAtNode } from '../runner/render/render-question';
import {
  renderSnippetFillLoading,
  renderSnippetFillNotFound,
  renderSnippetFillUnsupportedFormat,
} from '../runner/render/render-snippet-fill';
import { renderSnippetPicker } from '../runner/render/render-snippet-picker';
import type { RunnerState } from '../runner/runner-state';
import type { Snippet } from '../snippets/snippet-model';
import type { SnippetResolution, SnippetService } from '../snippets/snippet-service';
import { CSS_CLASS } from '../constants/css-classes';
import { createButton } from '../utils/dom-helpers';
import { SnippetFillInModal } from './snippet-fill-in-modal';
import { SnippetTreePicker } from './snippet-tree-picker';

interface AccumulatorDelta {
  text: string;
  hasSyntheticLeadingSeparator: boolean;
}

export interface RunnerSessionHostOptions {
  app: App;
  protocolPath: string;
  targetNote: TFile;
  startNodeId?: string;
  protocolDocumentStore: Pick<ProtocolDocumentStore, 'read'>;
  protocolDocumentParser: Pick<ProtocolDocumentParser, 'parse'>;
  snippetService: SnippetService;
  getTextSeparator(): 'newline' | 'space';
  getSnippetFolderPath(): string;
  withTargetNoteLock(path: string, operation: () => Promise<void>): Promise<void>;
  t: Translator;
  notify(message: string): void;
  onRequestClose(): void;
}

/**
 * Presentation-neutral owner of one transient protocol execution session.
 * Construction is inert; mount() creates DOM and starts asynchronous bootstrap.
 */
export class RunnerSessionHost {
  private readonly options: RunnerSessionHostOptions;
  private readonly runner: ProtocolRunner;

  private mounted = false;
  /** Mount/dispose ownership: bootstrap and accepted note writes. */
  private lifecycleGeneration = 0;
  /** Render/dispose ownership: picker/resolution/fill UI, errors, and timers. */
  private operationGeneration = 0;
  private graph: ProtocolGraph | null = null;
  private selfCheckItems: string[] = [];
  private selfCheckEnabled = false;

  private rootEl: HTMLElement | null = null;
  private headerEl: HTMLElement | null = null;
  private progressEl: HTMLElement | null = null;
  private progressFillEl: HTMLElement | null = null;
  private progressTextEl: HTMLElement | null = null;
  private contentEl: HTMLElement | null = null;
  private actionsEl: HTMLElement | null = null;
  private footerBtnRowEl: HTMLElement | null = null;

  private targetDeleteEventRef: EventRef | null = null;
  private snippetTreePicker: SnippetTreePicker | null = null;
  private fillModal: SnippetFillInModal | null = null;
  private completionTimer: ReturnType<typeof globalThis.setTimeout> | null = null;

  constructor(options: RunnerSessionHostOptions) {
    this.options = options;
    this.runner = new ProtocolRunner({
      defaultSeparator: options.getTextSeparator(),
      t: options.t,
    });
  }

  isMounted(): boolean {
    return this.mounted;
  }

  hasOpenChildModal(): boolean {
    return this.fillModal !== null;
  }

  getHeaderElement(): HTMLElement | null {
    return this.headerEl;
  }

  async mount(rootEl: HTMLElement): Promise<boolean> {
    if (this.mounted) return false;

    this.mounted = true;
    const lifecycleGeneration = ++this.lifecycleGeneration;
    this.rootEl = rootEl;
    this.buildDom(rootEl);
    this.targetDeleteEventRef = this.options.app.vault.on('delete', (deletedFile) => {
      if (
        !this.mounted
        || !(deletedFile instanceof TFile)
        || deletedFile.path !== this.options.targetNote.path
      ) return;

      // Invalidate every owned continuation before requesting shell close.
      this.dispose();
      this.options.onRequestClose();
    });

    const protocolFile = this.options.app.vault.getAbstractFileByPath(this.options.protocolPath);
    if (!(protocolFile instanceof TFile)) {
      this.failBootstrap(this.options.t('inlineRunner.protocolFileNotFound', {
        path: this.options.protocolPath,
      }), lifecycleGeneration);
      return false;
    }

    let content: string;
    try {
      const canonicalDocument = await this.options.protocolDocumentStore.read(this.options.protocolPath);
      if (!this.isLifecycleCurrent(lifecycleGeneration)) return false;
      if (canonicalDocument === null) {
        this.failBootstrap(this.options.t('inlineRunner.couldNotReadProtocol', {
          path: this.options.protocolPath,
        }), lifecycleGeneration);
        return false;
      }

      content = await this.options.app.vault.read(protocolFile);
      if (!this.isLifecycleCurrent(lifecycleGeneration)) return false;
    } catch {
      this.failBootstrap(this.options.t('inlineRunner.couldNotReadProtocol', {
        path: this.options.protocolPath,
      }), lifecycleGeneration);
      return false;
    }

    this.readSelfCheckConfiguration(content);
    const parseResult = this.options.protocolDocumentParser.parse(content, this.options.protocolPath);
    if (!parseResult.success) {
      this.failBootstrap(parseResult.error, lifecycleGeneration);
      return false;
    }

    const validator = new GraphValidator({
      snippetFileProbe: (absolutePath) =>
        this.options.app.vault.getAbstractFileByPath(absolutePath) !== null,
      snippetFolderPath: this.options.getSnippetFolderPath(),
      t: this.options.t,
    });
    const validationErrors = validator.validate(parseResult.graph);
    if (validationErrors.length > 0) {
      this.failBootstrap(validationErrors.join('\n'), lifecycleGeneration);
      return false;
    }
    if (!this.isLifecycleCurrent(lifecycleGeneration)) return false;

    this.graph = parseResult.graph;
    this.runner.start(this.graph, this.options.startNodeId);
    this.render();
    return this.mounted;
  }

  dispose(): void {
    if (!this.mounted && this.rootEl === null) return;

    this.mounted = false;
    ++this.lifecycleGeneration;
    ++this.operationGeneration;
    this.clearCompletionTimer();
    this.disposeSnippetPicker();
    this.closeFillModal();
    if (this.targetDeleteEventRef !== null) {
      this.options.app.vault.offref(this.targetDeleteEventRef);
      this.targetDeleteEventRef = null;
    }

    if (this.rootEl !== null) {
      this.rootEl.removeClass('rp-runner-session-root');
      this.rootEl.removeClass('rp-state-actions');
      this.rootEl.removeClass('rp-state-content-only');
      this.rootEl.empty();
    }
    this.rootEl = null;
    this.headerEl = null;
    this.progressEl = null;
    this.progressFillEl = null;
    this.progressTextEl = null;
    this.contentEl = null;
    this.actionsEl = null;
    this.footerBtnRowEl = null;
    this.graph = null;
    this.selfCheckItems = [];
    this.selfCheckEnabled = false;
  }

  handleKeydown(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement | null;
    if (target !== null && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      return false;
    }
    if ((event.ctrlKey || event.altKey) && event.key === 'ArrowLeft') {
      event.preventDefault();
      this.runner.stepBack();
      this.render();
      return true;
    }
    if ((event.ctrlKey || event.altKey) && event.key === 'ArrowRight') {
      event.preventDefault();
      this.runner.redo();
      this.render();
      return true;
    }
    return false;
  }

  private isLifecycleCurrent(generation: number): boolean {
    return this.mounted && generation === this.lifecycleGeneration;
  }

  private isOperationCurrent(
    lifecycleGeneration: number,
    operationGeneration: number,
  ): boolean {
    return this.isLifecycleCurrent(lifecycleGeneration)
      && operationGeneration === this.operationGeneration;
  }

  private failBootstrap(message: string, lifecycleGeneration: number): void {
    if (!this.isLifecycleCurrent(lifecycleGeneration)) return;
    this.options.notify(message);
    this.dispose();
    this.options.onRequestClose();
  }

  private closeFillModal(): void {
    if (this.fillModal === null) return;
    const modal = this.fillModal;
    this.fillModal = null;
    modal.close();
  }

  private buildDom(rootEl: HTMLElement): void {
    rootEl.empty();
    rootEl.addClass('rp-runner-session-root');

    const header = rootEl.createDiv({ cls: 'rp-runner-session-header' });
    this.headerEl = header;
    const progress = header.createDiv({
      cls: 'rp-runner-session-progress',
      attr: {
        role: 'progressbar',
        'aria-valuemin': '0',
        'aria-valuemax': '100',
      },
    });
    this.progressEl = progress;
    const track = progress.createDiv({ cls: 'rp-runner-session-progress-track' });
    this.progressFillEl = track.createDiv({ cls: 'rp-runner-session-progress-fill' });
    this.progressTextEl = progress.createDiv({ cls: 'rp-runner-session-progress-text' });

    this.contentEl = rootEl.createDiv({ cls: 'rp-runner-session-content' });
    this.contentEl.createEl('p', {
      text: this.options.t('protocolRunner.starting'),
      cls: CSS_CLASS.EMPTY_STATE_BODY,
    });
    this.actionsEl = rootEl.createDiv({ cls: 'rp-runner-session-actions' });
    const footer = rootEl.createDiv({ cls: 'rp-runner-session-footer' });
    this.footerBtnRowEl = footer.createDiv({ cls: 'rp-runner-session-footer-btn-row' });
    this.renderFooterCloseButton();
  }

  private render(): void {
    if (!this.mounted || this.contentEl === null || this.actionsEl === null) return;

    const lifecycleGeneration = this.lifecycleGeneration;
    const operationGeneration = ++this.operationGeneration;
    this.clearCompletionTimer();
    this.disposeSnippetPicker();
    this.closeFillModal();

    const state = this.runner.getState();
    this.updateProgress(state);
    this.contentEl.empty();
    this.actionsEl.empty();

    const hasActions = state.status === 'at-node' || state.status === 'awaiting-loop-pick';
    this.rootEl?.toggleClass('rp-state-actions', hasActions);
    this.rootEl?.toggleClass('rp-state-content-only', !hasActions);

    if (this.footerBtnRowEl !== null) {
      this.footerBtnRowEl.empty();
      this.renderFooterCloseButton();
    }

    switch (state.status) {
      case 'idle':
        this.contentEl.createEl('p', {
          text: this.options.t('protocolRunner.starting'),
          cls: CSS_CLASS.EMPTY_STATE_BODY,
        });
        return;

      case 'at-node': {
        const result = renderQuestionAtNode(
          this.contentEl,
          this.actionsEl,
          this.graph,
          state,
          {
            bindClick: (element, handler) => element.addEventListener('click', handler),
            renderError: (messages) => this.renderError(messages),
            onChooseAnswer: (answerNode) => this.handleAnswerClick(answerNode),
            onChooseQuestionBranch: (edge) => {
              this.runner.chooseQuestionBranch(edge.id);
              this.render();
            },
            onChooseSnippetBranch: (snippetNode, isFileBound) => {
              if (isFileBound) {
                this.runner.pickFileBoundSnippet(
                  state.currentNodeId,
                  snippetNode.id,
                  snippetNode.radiprotocol_snippetPath as string,
                );
              } else {
                this.runner.chooseSnippetBranch(snippetNode.id);
              }
              this.render();
            },
          },
        );
        if (result === 'error') return;
        if (result === 'not-question') {
          this.contentEl.createEl('p', {
            text: this.options.t('protocolRunner.processing'),
            cls: CSS_CLASS.EMPTY_STATE_BODY,
          });
        }

        const node = this.graph?.nodes.get(state.currentNodeId);
        if (node?.kind === 'question') {
          const hasAnswers = (this.graph?.adjacency.get(state.currentNodeId) ?? [])
            .some((nodeId) => this.graph?.nodes.get(nodeId)?.kind === 'answer');
          this.renderFooterIcons(
            state.canStepBack,
            hasAnswers && typeof this.runner.skip === 'function',
            state.canRedo,
          );
        }
        return;
      }

      case 'awaiting-snippet-pick':
        this.contentEl.createEl('p', {
          text: this.options.t('protocolRunner.loadingSnippets'),
          cls: CSS_CLASS.EMPTY_STATE_BODY,
        });
        this.mountSnippetPicker(state, lifecycleGeneration, operationGeneration);
        return;

      case 'awaiting-loop-pick': {
        const rendered = renderLoopPicker(
          this.contentEl,
          this.actionsEl,
          this.graph,
          state,
          {
            bindClick: (element, handler) => element.addEventListener('click', handler),
            renderError: (messages) => this.renderError(messages),
            onChooseLoopBranch: (edge) => this.handleLoopBranchClick(edge),
          },
        );
        if (rendered) this.renderFooterIcons(state.canStepBack, false, state.canRedo);
        return;
      }

      case 'awaiting-snippet-fill':
        renderSnippetFillLoading(this.contentEl);
        this.renderFooterIcons(state.canStepBack, false, state.canRedo);
        void this.handleSnippetFill(
          state.snippetId,
          this.contentEl,
          lifecycleGeneration,
          operationGeneration,
        );
        return;

      case 'complete':
        if (!this.selfCheckEnabled || this.selfCheckItems.length === 0) {
          this.scheduleCompletionClose(lifecycleGeneration, operationGeneration);
        } else {
          this.renderSelfCheckCompletion(
            this.contentEl,
            lifecycleGeneration,
            operationGeneration,
          );
        }
        return;

      case 'error':
        this.renderError([state.message]);
        return;

      default: {
        const exhaustive: never = state;
        return exhaustive;
      }
    }
  }

  private renderFooterCloseButton(): void {
    if (this.footerBtnRowEl === null) return;
    const closeButton = this.footerBtnRowEl.createEl('button', {
      cls: 'rp-runner-session-close-btn rp-runner-icon-btn',
    });
    setIcon(closeButton, 'x');
    closeButton.setAttribute('aria-label', this.options.t('protocolRunner.closeProtocol'));
    closeButton.addEventListener('click', () => this.options.onRequestClose());
  }

  private renderFooterIcons(showBack: boolean, showSkip: boolean, showRedo: boolean): void {
    if (this.footerBtnRowEl === null || (!showBack && !showSkip && !showRedo)) return;
    const group = this.footerBtnRowEl.createDiv({ cls: 'rp-runner-footer-row' });
    if (showBack) {
      const backButton = createButton(group, {
        cls: 'rp-step-back-btn rp-runner-icon-btn',
        attr: { 'aria-label': this.options.t('protocolRunner.stepBack') },
      });
      setIcon(backButton, 'arrow-left');
      backButton.addEventListener('click', () => {
        backButton.disabled = true;
        this.runner.stepBack();
        this.render();
      });
    }
    if (showRedo) {
      const redoButton = createButton(group, {
        cls: 'rp-step-redo-btn rp-runner-icon-btn',
        attr: { 'aria-label': this.options.t('protocolRunner.stepRedo') },
      });
      setIcon(redoButton, 'redo');
      redoButton.addEventListener('click', () => {
        redoButton.disabled = true;
        this.runner.redo();
        this.render();
      });
    }
    if (showSkip) {
      const skipButton = createButton(group, {
        cls: 'rp-skip-btn rp-runner-icon-btn',
        attr: { 'aria-label': this.options.t('protocolRunner.stepSkip') },
      });
      setIcon(skipButton, 'skip-forward');
      skipButton.addEventListener('click', () => {
        skipButton.disabled = true;
        void this.handleSkipClick();
      });
    }
  }

  private readSelfCheckConfiguration(content: string): void {
    this.selfCheckItems = [];
    this.selfCheckEnabled = false;
    try {
      const raw = JSON.parse(content) as {
        selfCheckItems?: unknown;
        selfCheckEnabled?: unknown;
      };
      if (Array.isArray(raw.selfCheckItems)) {
        this.selfCheckItems = raw.selfCheckItems
          .filter((item): item is string => typeof item === 'string')
          .map((item) => item.trim())
          .filter((item) => item.length > 0);
      }
      this.selfCheckEnabled = raw.selfCheckEnabled === true;
    } catch {
      this.selfCheckItems = [];
      this.selfCheckEnabled = false;
    }
  }

  private calculateProgressPercent(state: RunnerState): number {
    if (this.graph === null) return 0;
    if (state.status === 'complete') return 100;
    if (state.status === 'idle' || state.status === 'error') return 0;

    const currentNodeId = state.status === 'at-node' ? state.currentNodeId : state.nodeId;
    const globalDistances = this.calculateShortestDistances(this.graph.startNodeId);
    const globalMaxDistance = Math.max(1, ...globalDistances.values());
    const sessionStartNodeId = this.options.startNodeId ?? this.graph.startNodeId;
    const baselineDistance = globalDistances.get(sessionStartNodeId) ?? 0;
    const baselinePercent = Math.round((baselineDistance / globalMaxDistance) * 99);

    const sessionDistances = this.calculateShortestDistances(sessionStartNodeId);
    const currentSessionDistance = sessionDistances.get(currentNodeId);
    if (currentSessionDistance === undefined) {
      return Math.min(99, Math.max(0, baselinePercent));
    }
    const sessionMaxDistance = Math.max(1, ...sessionDistances.values());
    const sessionPercent = Math.round(
      (currentSessionDistance / sessionMaxDistance) * (99 - baselinePercent),
    );
    return Math.min(99, Math.max(0, baselinePercent + sessionPercent));
  }

  private calculateShortestDistances(startNodeId: string): Map<string, number> {
    const distances = new Map<string, number>();
    if (this.graph === null) return distances;
    const queue = [startNodeId];
    distances.set(startNodeId, 0);
    while (queue.length > 0) {
      const current = queue.shift();
      if (current === undefined) break;
      const distance = distances.get(current) ?? 0;
      for (const next of this.graph.adjacency.get(current) ?? []) {
        if (distances.has(next)) continue;
        distances.set(next, distance + 1);
        queue.push(next);
      }
    }
    return distances;
  }

  private updateProgress(state: RunnerState): void {
    if (
      this.progressEl === null
      || this.progressFillEl === null
      || this.progressTextEl === null
    ) return;
    const percent = this.calculateProgressPercent(state);
    this.progressFillEl.style.width = `${percent}%`;
    this.progressTextEl.setText(`${percent}%`);
    this.progressEl.setAttribute('aria-valuenow', String(percent));
    this.progressEl.setAttribute('aria-label', this.options.t('protocolRunner.progressLabel', {
      percent: String(percent),
    }));
  }

  private scheduleCompletionClose(
    lifecycleGeneration: number,
    operationGeneration: number,
  ): void {
    this.clearCompletionTimer();
    this.completionTimer = globalThis.setTimeout(() => {
      this.completionTimer = null;
      if (this.isOperationCurrent(lifecycleGeneration, operationGeneration)) {
        this.options.onRequestClose();
      }
    }, 0);
  }

  private clearCompletionTimer(): void {
    if (this.completionTimer === null) return;
    globalThis.clearTimeout(this.completionTimer);
    this.completionTimer = null;
  }

  private renderSelfCheckCompletion(
    container: HTMLElement,
    lifecycleGeneration: number,
    operationGeneration: number,
  ): void {
    renderCompleteHeading(container);
    const checklist = container.createDiv({ cls: 'rp-runner-session-self-check' });
    checklist.createEl('h4', { text: this.options.t('selfCheck.title') });
    const checked = new Set<number>();
    this.selfCheckItems.forEach((item, index) => {
      const label = checklist.createEl('label', {
        cls: 'rp-runner-session-self-check-item',
      });
      const checkbox = label.createEl('input', { type: 'checkbox' });
      label.createSpan({ text: item });
      checkbox.addEventListener('change', () => {
        if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
        if (checkbox.checked) checked.add(index);
        else checked.delete(index);
        if (checked.size === this.selfCheckItems.length) this.options.onRequestClose();
      });
    });
  }

  private async handleAnswerClick(answerNode: AnswerNode): Promise<void> {
    const lifecycleGeneration = this.lifecycleGeneration;
    const operationGeneration = this.operationGeneration;
    const beforeText = this.extractAccumulatedText(this.runner.getState());
    const accepted = this.runner.chooseAnswer(answerNode.id);
    if (!accepted) return;
    const delta = this.captureAccumulatorDelta(beforeText);
    await this.appendToTargetNote(delta, lifecycleGeneration);
    if (this.isOperationCurrent(lifecycleGeneration, operationGeneration)) this.render();
  }

  private async handleLoopBranchClick(edge: RPEdge): Promise<void> {
    const lifecycleGeneration = this.lifecycleGeneration;
    const operationGeneration = this.operationGeneration;
    const beforeText = this.extractAccumulatedText(this.runner.getState());
    this.runner.chooseLoopBranch(edge.id);
    const delta = this.captureAccumulatorDelta(beforeText);
    await this.appendToTargetNote(delta, lifecycleGeneration);
    if (this.isOperationCurrent(lifecycleGeneration, operationGeneration)) this.render();
  }

  private async handleSkipClick(): Promise<void> {
    const lifecycleGeneration = this.lifecycleGeneration;
    const operationGeneration = this.operationGeneration;
    const beforeText = this.extractAccumulatedText(this.runner.getState());
    this.runner.skip();
    const delta = this.captureAccumulatorDelta(beforeText);
    await this.appendToTargetNote(delta, lifecycleGeneration);
    if (this.isOperationCurrent(lifecycleGeneration, operationGeneration)) this.render();
  }

  private extractAccumulatedText(state: RunnerState): string {
    switch (state.status) {
      case 'at-node':
      case 'awaiting-loop-pick':
      case 'awaiting-snippet-pick':
      case 'awaiting-snippet-fill':
        return state.accumulatedText;
      case 'complete':
        return state.finalText;
      case 'idle':
      case 'error':
        return '';
      default: {
        const exhaustive: never = state;
        return exhaustive;
      }
    }
  }

  private captureAccumulatorDelta(beforeText: string): AccumulatorDelta {
    const afterText = this.extractAccumulatedText(this.runner.getState());
    if (afterText.length <= beforeText.length) {
      return { text: '', hasSyntheticLeadingSeparator: false };
    }
    if (!afterText.startsWith(beforeText)) {
      console.warn('[RadiProtocol] Text changed non-monotonically, skipping append');
      return { text: '', hasSyntheticLeadingSeparator: false };
    }
    return {
      text: afterText.slice(beforeText.length),
      // TextAccumulator prefixes every non-first chunk with its effective
      // separator. A first chunk has no generated prefix, so any leading
      // whitespace there is authored and must never be de-duplicated.
      hasSyntheticLeadingSeparator: beforeText.length > 0,
    };
  }

  private async appendToTargetNote(
    delta: AccumulatorDelta,
    lifecycleGeneration: number,
  ): Promise<void> {
    const { text } = delta;
    if (text.length === 0 || !this.isLifecycleCurrent(lifecycleGeneration)) return;
    try {
      await this.options.withTargetNoteLock(this.options.targetNote.path, async () => {
        if (!this.isLifecycleCurrent(lifecycleGeneration)) return;
        const currentContent = await this.options.app.vault.read(this.options.targetNote);
        if (!this.isLifecycleCurrent(lifecycleGeneration)) return;
        const separator = this.options.getTextSeparator() === 'newline' ? '\n' : ' ';
        const toAppend = delta.hasSyntheticLeadingSeparator
          && currentContent.endsWith(separator)
          && text.startsWith(separator)
          ? text.slice(separator.length)
          : text;
        if (!this.isLifecycleCurrent(lifecycleGeneration)) return;
        await this.options.app.vault.modify(
          this.options.targetNote,
          currentContent + toAppend,
        );
      });
    } catch (error) {
      if (!this.isLifecycleCurrent(lifecycleGeneration)) return;
      console.error('[RadiProtocol] Failed to append runner output to bound note', error);
      this.options.notify(this.options.t('inlineRunner.noteWriteFailed'));
    }
  }

  private mountSnippetPicker(
    state: Extract<RunnerState, { status: 'awaiting-snippet-pick' }>,
    lifecycleGeneration: number,
    operationGeneration: number,
  ): void {
    if (
      this.contentEl === null
      || !this.isOperationCurrent(lifecycleGeneration, operationGeneration)
    ) return;
    this.snippetTreePicker = renderSnippetPicker(this.contentEl, state, {
      app: this.options.app,
      snippetService: this.options.snippetService,
      rootPath: this.options.getSnippetFolderPath(),
      hostClass: CSS_CLASS.STP_RUNNER_SESSION_HOST,
      copy: {
        notFound: (relativePath) => this.options.t('inlineRunner.snippetNotFound', {
          path: relativePath,
        }),
      },
      t: this.options.t,
      bindClick: (element, handler) => element.addEventListener('click', handler),
      getCurrentNodeId: () => {
        if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return null;
        const current = this.runner.getState();
        return current.status === 'awaiting-snippet-pick' ? current.nodeId : null;
      },
      isStillMounted: () => this.isOperationCurrent(
        lifecycleGeneration,
        operationGeneration,
      ),
      presentAsyncError: (message) => {
        if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
        // Invalidate sibling loads, then recreate the current picker/footer before
        // adding the error, preserving the existing floating-host recovery flow.
        ++this.operationGeneration;
        this.disposeSnippetPicker();
        this.render();
        this.contentEl?.createEl('p', {
          cls: CSS_CLASS.EMPTY_STATE_BODY,
          text: message,
        });
      },
      onSnippetReady: (snippet) => this.handleSnippetPickerSelection(
        snippet,
        lifecycleGeneration,
        operationGeneration,
      ),
      onBack: () => {
        if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
        this.runner.stepBack();
        this.render();
      },
      onRedo: () => {
        if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
        this.runner.redo();
        this.render();
      },
    });
  }

  private disposeSnippetPicker(): void {
    if (this.snippetTreePicker === null) return;
    this.snippetTreePicker.unmount();
    this.snippetTreePicker = null;
  }

  private async handleSnippetPickerSelection(
    snippet: Snippet,
    lifecycleGeneration: number,
    operationGeneration: number,
  ): Promise<void> {
    if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
    this.runner.pickSnippet(snippet.path);

    if (snippet.kind === 'md') {
      const beforeText = this.extractAccumulatedText(this.runner.getState());
      if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
      this.runner.completeSnippet(snippet.content);
      const delta = this.captureAccumulatorDelta(beforeText);
      await this.appendToTargetNote(delta, lifecycleGeneration);
      if (this.isOperationCurrent(lifecycleGeneration, operationGeneration)) this.render();
      return;
    }

    if (snippet.placeholders.length === 0) {
      const beforeText = this.extractAccumulatedText(this.runner.getState());
      if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
      this.runner.completeSnippet(snippet.template);
      const delta = this.captureAccumulatorDelta(beforeText);
      await this.appendToTargetNote(delta, lifecycleGeneration);
      if (this.isOperationCurrent(lifecycleGeneration, operationGeneration)) this.render();
      return;
    }

    if (this.isOperationCurrent(lifecycleGeneration, operationGeneration)) this.render();
  }

  private async handleSnippetFill(
    snippetId: string,
    questionZone: HTMLElement,
    lifecycleGeneration: number,
    operationGeneration: number,
  ): Promise<void> {
    if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
    let resolution: SnippetResolution;
    try {
      resolution = await this.options.snippetService.resolveSnippet(snippetId);
    } catch (error) {
      if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
      console.error('[RadiProtocol] Failed to resolve runner snippet', error);
      this.renderError([this.options.t('inlineRunner.snippetLoadFailed')]);
      return;
    }
    if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;

    if (resolution.status === 'missing') {
      renderSnippetFillNotFound(questionZone, snippetId);
      return;
    }
    if (resolution.status === 'legacy-json') {
      renderSnippetFillUnsupportedFormat(questionZone, resolution.path, this.options.t);
      this.runner.stepBack();
      this.render();
      return;
    }

    const snippet = resolution.snippet;
    const beforeText = this.extractAccumulatedText(this.runner.getState());
    if (snippet.kind === 'md') {
      if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
      this.runner.completeSnippet(snippet.content);
      const delta = this.captureAccumulatorDelta(beforeText);
      await this.appendToTargetNote(delta, lifecycleGeneration);
      if (this.isOperationCurrent(lifecycleGeneration, operationGeneration)) this.render();
      return;
    }
    if (snippet.placeholders.length === 0) {
      if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
      this.runner.completeSnippet(snippet.template);
      const delta = this.captureAccumulatorDelta(beforeText);
      await this.appendToTargetNote(delta, lifecycleGeneration);
      if (this.isOperationCurrent(lifecycleGeneration, operationGeneration)) this.render();
      return;
    }

    const modal = new SnippetFillInModal(this.options.app, snippet, this.options.t);
    this.fillModal = modal;
    modal.open();
    let rendered: string | null;
    try {
      rendered = await modal.result;
    } finally {
      if (this.fillModal === modal) this.fillModal = null;
    }
    if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
    this.runner.completeSnippet(rendered ?? '');
    const delta = this.captureAccumulatorDelta(beforeText);
    await this.appendToTargetNote(delta, lifecycleGeneration);
    if (this.isOperationCurrent(lifecycleGeneration, operationGeneration)) this.render();
  }

  private renderError(errors: string[]): void {
    if (this.contentEl === null) return;
    this.contentEl.empty();
    const errorPanel = this.contentEl.createDiv({ cls: 'rp-error-panel' });
    renderErrorList(errorPanel, errors, { titleClass: CSS_CLASS.ERROR_TITLE });
  }
}
```

#### 2. src/views/inline-runner-modal.ts
**File**: src/views/inline-runner-modal.ts
**Changes**: MODIFY — reduce to floating container/layout/visibility/registry policy and delegate session work.

```ts
// A floating, non-blocking shell around the presentation-neutral runner session host.
import { App, Notice, TFile, type EventRef } from 'obsidian';
import type RadiProtocolPlugin from '../main';
import type { InlineRunnerLayout } from '../settings';
import { InlineRunnerLayoutManager } from './inline-runner-layout';
import { RunnerSessionHost } from './runner-session-host';

// Re-export clamp functions for backward compatibility (tests import from this module).
export { clampInlineRunnerPosition, clampInlineRunnerLayout } from './inline-runner-layout';

export function inlineRunnerRegistryKey(
  protocolPath: string,
  notePath: string,
  startNodeId?: string,
): string {
  const startSuffix = startNodeId === undefined
    ? ''
    : `#start=${encodeURIComponent(startNodeId)}`;
  return `${protocolPath}#${notePath}${startSuffix}`;
}

export class InlineRunnerModal {
  private readonly app: App;
  private readonly plugin: RadiProtocolPlugin;
  private readonly protocolPath: string;
  private readonly targetNote: TFile;
  private readonly startNodeId: string | undefined;

  private containerEl: HTMLElement | null = null;
  /** Shared session header used as the floating drag handle. */
  private headerEl: HTMLElement | null = null;
  private sessionHost: RunnerSessionHost | null = null;
  private layoutManager: InlineRunnerLayoutManager | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private activeFileEventRef: EventRef | null = null;
  private workspaceLayoutRef: EventRef | null = null;
  private boundKeyHandler: ((event: KeyboardEvent) => void) | null = null;
  private isHidden = false;
  private openedSuccessfully = false;
  private closed = false;

  constructor(
    app: App,
    plugin: RadiProtocolPlugin,
    protocolPath: string,
    targetNote: TFile,
    startNodeId?: string,
  ) {
    this.app = app;
    this.plugin = plugin;
    this.protocolPath = protocolPath;
    this.targetNote = targetNote;
    this.startNodeId = startNodeId;
  }

  getCanvasFilePath(): string {
    return this.protocolPath;
  }

  getTargetNote(): TFile {
    return this.targetNote;
  }

  isOpen(): boolean {
    return this.openedSuccessfully && this.containerEl !== null;
  }

  focus(): void {
    if (this.containerEl === null) return;
    document.body.appendChild(this.containerEl);
    this.containerEl.removeClass('is-hidden');
    this.isHidden = false;
  }

  async open(): Promise<void> {
    if (this.containerEl !== null || this.closed) return;
    this.buildContainer();
    if (this.containerEl === null) return;

    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    const sessionHost = new RunnerSessionHost({
      app: this.app,
      protocolPath: this.protocolPath,
      targetNote: this.targetNote,
      startNodeId: this.startNodeId,
      protocolDocumentStore: this.plugin.protocolDocumentStore,
      protocolDocumentParser: this.plugin.protocolDocumentParser,
      snippetService: this.plugin.snippetService,
      getTextSeparator: () => this.plugin.settings.textSeparator,
      getSnippetFolderPath: () => this.plugin.settings.snippetFolderPath,
      withTargetNoteLock: (path, operation) =>
        this.plugin['insertMutex'].runExclusive(path, operation),
      t,
      notify: (message) => new Notice(message),
      onRequestClose: () => this.close(),
    });
    this.sessionHost = sessionHost;

    // mount() builds the shared DOM synchronously before its first protocol read,
    // so floating drag policy can bind to the real shared header during loading.
    const mounting = sessionHost.mount(this.containerEl);
    const header = sessionHost.getHeaderElement();
    if (header !== null) {
      this.headerEl = header;
      this.layoutManager?.enableDragging(header);
    }

    const mounted = await mounting;
    if (!mounted || this.closed || this.containerEl === null) {
      this.close();
      return;
    }

    this.openedSuccessfully = true;
    this.activeFileEventRef = this.app.workspace.on('active-leaf-change', () => {
      this.handleActiveLeafChange();
    });
    this.handleActiveLeafChange();
    if (!this.openedSuccessfully || this.containerEl === null || this.closed) return;

    this.layoutManager?.applyInitialLayout();
    this.workspaceLayoutRef = this.app.workspace.on('layout-change', () => {
      void this.layoutManager?.reclampCurrentPosition(true);
    });
    this.layoutManager?.startWindowResizeListener();

    this.resizeObserver = new ResizeObserver(() => this.layoutManager?.handleResizeTick());
    this.resizeObserver.observe(this.containerEl);

    this.boundKeyHandler = (event) => this.handleKeydown(event);
    this.containerEl.addEventListener('keydown', this.boundKeyHandler);
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    this.openedSuccessfully = false;

    this.sessionHost?.dispose();
    this.sessionHost = null;

    if (this.boundKeyHandler !== null && this.containerEl !== null) {
      this.containerEl.removeEventListener('keydown', this.boundKeyHandler);
    }
    this.boundKeyHandler = null;
    if (this.activeFileEventRef !== null) {
      this.app.workspace.offref(this.activeFileEventRef);
      this.activeFileEventRef = null;
    }
    if (this.workspaceLayoutRef !== null) {
      this.app.workspace.offref(this.workspaceLayoutRef);
      this.workspaceLayoutRef = null;
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.layoutManager?.destroy();
    this.layoutManager = null;

    this.plugin.unregisterInlineRunner(inlineRunnerRegistryKey(
      this.protocolPath,
      this.targetNote.path,
      this.startNodeId,
    ));
    this.containerEl?.remove();
    this.containerEl = null;
    this.headerEl = null;
  }

  getAppliedLayout(): InlineRunnerLayout | null {
    return this.layoutManager?.getAppliedLayout() ?? null;
  }

  restoreOrDefaultPosition(): void {
    this.layoutManager?.restoreOrDefaultPosition();
  }

  applyInitialLayout(): void {
    this.layoutManager?.applyInitialLayout();
  }

  async reclampCurrentPosition(persistIfChanged: boolean): Promise<void> {
    await this.layoutManager?.reclampCurrentPosition(persistIfChanged);
  }

  handleResizeTick(): void {
    this.layoutManager?.handleResizeTick();
  }

  private buildContainer(): void {
    const container = document.body.createDiv({
      cls: 'rp-inline-runner-container rp-runner-session-root',
    });
    this.containerEl = container;
    this.layoutManager = new InlineRunnerLayoutManager({
      containerEl: container,
      getSavedLayout: () => this.plugin.getInlineRunnerPosition(),
      saveLayout: (layout) => this.plugin.saveInlineRunnerPosition(layout),
      getOpenLayouts: () => this.plugin.getOpenInlineRunners().map((runner) =>
        runner.getAppliedLayout()),
    });
    // Preserve the established buildContainer()/layout test seam and make the
    // loading shell draggable before the session host replaces its contents.
    this.headerEl = container.createDiv({ cls: 'rp-runner-session-header' });
    this.layoutManager.enableDragging(this.headerEl);
  }

  private handleActiveLeafChange(): void {
    if (this.containerEl === null) return;
    if (this.sessionHost?.hasOpenChildModal() === true) return;

    const activeFile = this.app.workspace.getActiveFile();
    const isTargetActive = activeFile?.path === this.targetNote.path;
    let targetHasOpenLeaves = false;
    this.app.workspace.iterateAllLeaves((leaf) => {
      const view = leaf.view;
      if ('file' in view && view.file instanceof TFile && view.file.path === this.targetNote.path) {
        targetHasOpenLeaves = true;
      }
    });

    if (!targetHasOpenLeaves) {
      this.close();
      return;
    }
    if (isTargetActive) {
      if (this.isHidden) {
        this.containerEl.removeClass('is-hidden');
        this.isHidden = false;
      }
    } else if (!this.isHidden) {
      this.containerEl.addClass('is-hidden');
      this.isHidden = true;
    }
  }

  private handleKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target !== null && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }
    this.sessionHost?.handleKeydown(event);
  }
}
```

#### 3. src/constants/css-classes.ts
**File**: src/constants/css-classes.ts
**Changes**: MODIFY — add presentation-neutral runner-session picker host hooks.

```ts
// src/constants/css-classes.ts
// Phase 79 EXTRACT-TYPES-01 — typed constants for shared CSS class names.
// Only classes referenced in 2+ production TS files are included.

export const CSS_CLASS = {
  // Runner / inline shared
  EMPTY_STATE_BODY: 'rp-empty-state-body',
  ERROR_TITLE: 'rp-error-title',

  // Snippet tree picker host wrappers
  STP_RUNNER_SESSION_HOST: 'rp-stp-runner-session-host',
  STP_INLINE_HOST: 'rp-stp-inline-host',
  STP_EDITOR_HOST: 'rp-stp-editor-host',
} as const;

export type CssClass = typeof CSS_CLASS[keyof typeof CSS_CLASS];
```

#### 4. src/runner/render/render-snippet-picker.ts
**File**: src/runner/render/render-snippet-picker.ts
**Changes**: MODIFY — accept the shared session picker class while retaining host-owned picker lifetime.

Modification fence: change only the host-class union and its adjacent comments. Keep picker loading, stale-node checks, footer wiring, and every other line unchanged.

```ts
type SnippetPickerHostClass =
  | typeof CSS_CLASS.STP_RUNNER_SESSION_HOST
  | typeof CSS_CLASS.STP_INLINE_HOST;
```

```ts
  /** Host wrapper CSS hook for either the extracted session host or legacy inline host. */
  hostClass: SnippetPickerHostClass;
```

```ts
  /** Optional host-ownership guard. The session host supplies its render-operation check. */
  isStillMounted?(): boolean;
```

#### 5. src/styles/runner-session.css
**File**: src/styles/runner-session.css
**Changes**: NEW — own shared session zones, controls, footer, progress, self-check, picker, and error layout.

```css
/* Presentation-neutral runner session layout and controls. */

.rp-runner-session-root {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--background-primary);
}

.rp-runner-session-header {
  flex-shrink: 0;
  user-select: none;
  background: var(--background-primary);
}

.rp-runner-session-progress {
  display: flex;
  align-items: center;
  gap: var(--size-2-2);
  padding: var(--size-2-2) var(--size-4-2);
  border-bottom: 1px solid var(--background-modifier-border);
}

.rp-runner-session-progress-track {
  flex: 1 1 auto;
  min-width: 32px;
  height: 6px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--background-modifier-border);
}

.rp-runner-session-progress-fill {
  width: 0%;
  height: 100%;
  border-radius: inherit;
  background: var(--interactive-accent);
  transition: width 0.16s ease;
}

.rp-runner-session-progress-text {
  flex: 0 0 auto;
  min-width: 3ch;
  color: var(--text-muted);
  font-size: var(--font-ui-smaller);
  line-height: 1;
  text-align: right;
}

.rp-runner-session-content {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: var(--size-4-2);
}

.rp-runner-session-actions {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  align-items: stretch;
  min-height: 0;
  overflow-y: auto;
  padding: var(--size-2-3) var(--size-4-2);
  border-top: 1px solid var(--background-modifier-border);
}

.rp-runner-session-root.rp-state-actions .rp-runner-session-content {
  flex: 0 0 auto;
}

.rp-runner-session-root.rp-state-actions .rp-runner-session-actions {
  flex: 1 1 auto;
  overflow-y: auto;
}

.rp-runner-session-root.rp-state-content-only .rp-runner-session-content {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}

.rp-runner-session-root.rp-state-content-only .rp-runner-session-actions {
  display: none;
}

.rp-runner-session-actions .rp-answer-list,
.rp-runner-session-actions .rp-question-transition-list,
.rp-runner-session-actions .rp-snippet-branch-list,
.rp-runner-session-actions .rp-loop-picker-list,
.rp-runner-session-actions .rp-option-list {
  display: flex;
  flex-direction: column;
  gap: var(--size-2-3);
  margin-bottom: 0;
}

.rp-runner-session-content .rp-question-text {
  margin: 0 0 var(--size-4-2);
  padding: var(--size-2-3) var(--size-2-2);
  border: 1px solid var(--background-modifier-border);
  border-radius: var(--radius-s);
  background: var(--background-secondary);
  font-size: var(--font-ui-normal);
  line-height: var(--line-height-tight);
  text-align: center;
}

.rp-runner-session-actions .rp-answer-btn,
.rp-runner-session-actions .rp-question-transition-btn,
.rp-runner-session-actions .rp-snippet-branch-btn,
.rp-runner-session-actions .rp-loop-body-btn,
.rp-runner-session-actions .rp-loop-exit-btn {
  align-items: flex-start;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-height: 36px;
  height: auto;
  padding: var(--size-2-3) var(--size-4-2);
  overflow-wrap: anywhere;
  white-space: normal;
  word-break: break-word;
  text-align: left;
}

.rp-runner-session-actions .rp-question-transition-list {
  margin-top: var(--size-4-3);
}

.rp-runner-session-actions .rp-question-transition-btn {
  border-left: 3px solid var(--interactive-accent);
  background: var(--background-secondary);
}

.rp-runner-session-footer {
  flex-shrink: 0;
  padding: var(--size-2-3) var(--size-4-2);
  border-top: 1px solid var(--background-modifier-border);
  background: var(--background-primary);
}

.rp-runner-session-footer-btn-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--size-2-2);
}

.rp-runner-session-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--background-modifier-border);
  border-radius: var(--radius-s);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.rp-runner-session-close-btn:hover {
  background: var(--background-modifier-hover);
  color: var(--text-normal);
}

.rp-stp-runner-session-host {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 0;
  height: 100%;
  overflow: hidden;
}

.rp-runner-session-content .rp-error-panel {
  padding: var(--size-4-3);
  border-radius: var(--radius-s);
  background: var(--background-modifier-error);
}

.rp-runner-session-content .rp-error-title {
  margin: 0 0 var(--size-4-2);
  color: var(--text-error);
  font-weight: var(--font-semibold);
}

.rp-runner-session-content .rp-error-list {
  margin: 0;
  padding-left: var(--size-4-4);
}

.rp-runner-footer-row {
  display: flex;
  justify-content: flex-end;
  gap: var(--size-4-2);
}

.rp-complete-heading {
  margin: 0 0 var(--size-4-2);
  font-size: var(--font-ui-medium);
  font-weight: var(--font-semibold);
}

.rp-runner-icon-btn {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--background-modifier-border);
  border-radius: var(--radius-s);
  background: transparent;
  color: var(--text-muted);
  cursor: pointer;
}

.rp-runner-icon-btn:hover {
  background: var(--background-modifier-hover);
  color: var(--text-normal);
}

.rp-runner-icon-btn svg {
  width: 14px;
  height: 14px;
}

.rp-runner-icon-btn:disabled,
.rp-runner-icon-btn:disabled:hover {
  background: transparent;
  color: var(--text-muted);
  opacity: 0.4;
  cursor: not-allowed;
}

.rp-runner-session-root.rp-state-content-only
  .rp-runner-session-content > .rp-runner-footer-row {
  flex: 0 0 auto;
  margin-top: var(--size-2-3);
}

.rp-runner-session-self-check {
  display: flex;
  flex-direction: column;
  gap: var(--size-2-2);
}

.rp-runner-session-self-check-item {
  display: flex;
  align-items: flex-start;
  gap: var(--size-2-2);
  line-height: 1.4;
}
```

#### 6. src/styles/inline-runner.css
**File**: src/styles/inline-runner.css
**Changes**: MODIFY — retain floating-only layout and overrides after shared rules move out.

```css
/* Floating presentation overrides for the shared runner session host. */

.rp-inline-runner-container {
  position: fixed;
  right: auto;
  bottom: auto;
  z-index: var(--layer-modal);
  box-sizing: border-box;
  width: min(360px, calc(100vw - var(--size-4-8)));
  max-width: calc(100vw - var(--size-4-8));
  min-width: 240px;
  height: min(45vh, 480px);
  max-height: calc(100vh - var(--size-4-8));
  min-height: 120px;
  overflow: hidden;
  resize: both;
  border: 1px solid var(--background-modifier-border);
  border-radius: var(--radius-m);
  box-shadow: var(--shadow-l);
  transition: box-shadow 0.12s ease;
}

.rp-inline-runner-container.is-hidden {
  display: none;
}

.rp-inline-runner-container .rp-runner-session-header {
  cursor: grab;
}

.rp-inline-runner-container.is-dragging .rp-runner-session-header {
  cursor: grabbing;
}

.rp-inline-runner-container.is-dragging,
.rp-inline-runner-container.is-resizing {
  box-shadow: var(--shadow-xl);
}

.rp-inline-runner-container.rp-inline-runner-applied-position {
  right: auto;
  bottom: auto;
  max-width: none;
  transform: none;
}
```

#### 7. src/styles/snippet-tree-picker.css
**File**: src/styles/snippet-tree-picker.css
**Changes**: MODIFY — support the presentation-neutral session picker host selector.

Modification fence: add `rp-stp-runner-session-host` only to the existing internal picker selector lists below. Do not add outer host width, box, overflow, or flex ownership here; `runner-session.css` owns the outer host.

```css
.rp-stp-inline-host .rp-stp-body,
.rp-stp-runner-session-host .rp-stp-body {
  flex: 1 1 auto;
  min-height: 0;
  height: 100%;
}
```

```css
.rp-stp-inline-host .rp-stp-root,
.rp-stp-runner-session-host .rp-stp-root {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}
```

```css
.rp-stp-inline-host .rp-stp-list,
.rp-stp-runner-session-host .rp-stp-list {
  flex: 1 1 auto;
  min-height: 0;
  max-height: none;
  overflow-y: auto;
}
```

#### 8. esbuild.config.mjs
**File**: esbuild.config.mjs
**Changes**: MODIFY — register runner-session CSS before inline-runner CSS.

Modification fence: insert one entry immediately before `inline-runner`; keep the rest of the build configuration unchanged.

```js
  'snippet-tree-picker',
  'runner-session',
  'inline-runner',
```

#### 9. src/__tests__/runner/runner-renderer-host-fixtures.ts
**File**: src/__tests__/runner/runner-renderer-host-fixtures.ts
**Changes**: MODIFY — add shared-host DOM/lifecycle/vault fixtures while preserving focused renderer tests.

```ts
// Shared host fixtures for inline runner modal tests.
import { vi } from 'vitest';
import { I18nService } from '../../i18n';

// MockEl harness
export interface MockEl {
  tagName: string;
  children: MockEl[];
  parent: MockEl | null;
  _text: string;
  classList: Set<string>;
  _attrs: Record<string, string>;
  _style: Record<string, string>;
  _value: string;
  _disabled: boolean;
  _type: string;
  _checked: boolean;
  _listeners: Map<string, Array<(ev: unknown) => void>>;
  textContent: string;
  value: string;
  disabled: boolean;
  type: string;
  checked: boolean;
  style: Record<string, string>;
  name: string;
  inputMode: string;
  readOnly: boolean;
  dataset: Record<string, string>;
  createEl: (tag: string, opts?: { text?: string; cls?: string; type?: string; attr?: Record<string, string> }) => MockEl;
  createDiv: (opts?: { cls?: string; text?: string; attr?: Record<string, string> }) => MockEl;
  createSpan: (opts?: { cls?: string; text?: string }) => MockEl;
  empty: () => void;
  setText: (t: string) => void;
  addClass: (c: string) => void;
  removeClass: (c: string) => void;
  toggleClass: (c: string, on?: boolean) => void;
  hasClass: (c: string) => boolean;
  setAttribute: (k: string, v: string) => void;
  getAttribute: (k: string) => string | null;
  removeAttribute: (k: string) => void;
  focus: () => void;
  remove: () => void;
  addEventListener: (type: string, handler: (ev: unknown) => void) => void;
  removeEventListener: (type: string, handler: (ev: unknown) => void) => void;
  dispatchEvent: (event: { type: string; target?: MockEl }) => void;
  querySelector: (sel: string) => MockEl | null;
  querySelectorAll: (sel: string) => MockEl[];
  prepend: (el: MockEl) => void;
  setCssProps: (props: Record<string, string>) => void;
}

export function makeEl(tag = 'div'): MockEl {
  const listeners = new Map<string, Array<(ev: unknown) => void>>();
  const children: MockEl[] = [];
  const attrs: Record<string, string> = {};
  const style: Record<string, string> = {};
  const classSet = new Set<string>();
  const dataset: Record<string, string> = {};

  const el = {
    tagName: tag.toUpperCase(),
    children,
    parent: null as MockEl | null,
    _text: '',
    classList: classSet,
    _attrs: attrs,
    _style: style,
    _value: '',
    _disabled: false,
    _type: '',
    _checked: false,
    _listeners: listeners,
    name: '',
    inputMode: '',
    readOnly: false,
    dataset,
    createEl(subtag: string, opts?: { text?: string; cls?: string; type?: string; attr?: Record<string, string> }): MockEl {
      const child = makeEl(subtag);
      child.parent = el as unknown as MockEl;
      if (opts?.text !== undefined) (child as unknown as { _text: string })._text = opts.text;
      if (opts?.cls) {
        for (const cls of opts.cls.split(/\s+/).filter(Boolean)) child.classList.add(cls);
      }
      if (opts?.type) (child as unknown as { _type: string })._type = opts.type;
      if (opts?.attr) {
        for (const [k, v] of Object.entries(opts.attr)) {
          child.setAttribute(k, v);
        }
      }
      children.push(child);
      return child;
    },
    createDiv(opts?: { cls?: string; text?: string; attr?: Record<string, string> }): MockEl {
      return (this as unknown as MockEl).createEl('div', opts);
    },
    createSpan(opts?: { cls?: string; text?: string }): MockEl {
      return (this as unknown as MockEl).createEl('span', opts);
    },
    empty(): void { children.length = 0; },
    setText(text: string): void { (el as unknown as { _text: string })._text = text; },
    addClass(cls: string): void { classSet.add(cls); },
    removeClass(cls: string): void { classSet.delete(cls); },
    toggleClass(cls: string, on?: boolean): void {
      if (on ?? !classSet.has(cls)) classSet.add(cls); else classSet.delete(cls);
    },
    hasClass(cls: string): boolean { return classSet.has(cls); },
    setAttribute(k: string, v: string): void { attrs[k] = v; },
    getAttribute(k: string): string | null { return attrs[k] ?? null; },
    removeAttribute(k: string): void { delete attrs[k]; },
    focus(): void {},
    remove(): void {
      const parent = (el as unknown as MockEl).parent;
      if (parent === null) return;
      const index = parent.children.indexOf(el as unknown as MockEl);
      if (index >= 0) parent.children.splice(index, 1);
      (el as unknown as MockEl).parent = null;
    },
    addEventListener(type: string, handler: (ev: unknown) => void): void {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type)!.push(handler);
    },
    removeEventListener(type: string, handler: (ev: unknown) => void): void {
      const arr = listeners.get(type); if (!arr) return;
      const i = arr.indexOf(handler); if (i >= 0) arr.splice(i, 1);
    },
    dispatchEvent(event: { type: string; target?: MockEl }): void {
      const arr = listeners.get(event.type); if (!arr) return;
      const evt = { ...event, target: event.target ?? (el as unknown as MockEl) };
      for (const h of arr.slice()) h(evt);
    },
    querySelector(sel: string): MockEl | null { return walk(el as unknown as MockEl, sel)[0] ?? null; },
    querySelectorAll(sel: string): MockEl[] { return walk(el as unknown as MockEl, sel); },
    prepend(child: MockEl): void { children.unshift(child); child.parent = el as unknown as MockEl; },
    setCssProps(props: Record<string, string>): void {
      for (const [k, v] of Object.entries(props)) (style as Record<string, string>)[k] = v;
    },
    style,
  } as unknown as MockEl;

  Object.defineProperty(el, 'textContent', {
    get(): string { return (el as unknown as { _text: string })._text; },
    set(v: string): void { (el as unknown as { _text: string })._text = String(v); },
  });
  Object.defineProperty(el, 'value', {
    get(): string { return (el as unknown as { _value: string })._value; },
    set(v: string): void { (el as unknown as { _value: string })._value = String(v); },
  });
  Object.defineProperty(el, 'disabled', {
    get(): boolean { return (el as unknown as { _disabled: boolean })._disabled; },
    set(v: boolean): void { (el as unknown as { _disabled: boolean })._disabled = Boolean(v); },
  });
  Object.defineProperty(el, 'type', {
    get(): string { return (el as unknown as { _type: string })._type; },
    set(v: string): void { (el as unknown as { _type: string })._type = String(v); },
  });
  Object.defineProperty(el, 'checked', {
    get(): boolean { return (el as unknown as { _checked: boolean })._checked; },
    set(v: boolean): void { (el as unknown as { _checked: boolean })._checked = Boolean(v); },
  });

  return el;
}

function walk(root: MockEl, sel: string): MockEl[] {
  const out: MockEl[] = [];
  const match = buildMatcher(sel);
  const stack: MockEl[] = [...root.children];
  while (stack.length > 0) {
    const cur = stack.shift()!;
    if (match(cur)) out.push(cur);
    for (const c of cur.children) stack.push(c);
  }
  return out;
}

function buildMatcher(sel: string): (el: MockEl) => boolean {
  if (sel.startsWith('.')) {
    const cls = sel.slice(1);
    return (el) => el.classList.has(cls);
  }
  const tagAttrMatch = /^([a-zA-Z]+)\[([a-zA-Z-]+)="([^"]+)"\]$/.exec(sel);
  if (tagAttrMatch) {
    const [, tag, attr, val] = tagAttrMatch;
    return (el) => {
      if (el.tagName !== tag!.toUpperCase()) return false;
      if (attr === 'type') return (el as unknown as { _type: string })._type === val;
      return el.getAttribute(attr!) === val;
    };
  }
  return (el) => el.tagName === sel.toUpperCase();
}

export function findByClass(root: MockEl, cls: string): MockEl[] {
  return walk(root, '.' + cls);
}

// Module mock factories

export function createObsidianModuleMock(): Record<string, unknown> {
  class Modal {
    app: unknown;
    contentEl: MockEl;
    titleEl: MockEl;
    modalEl: { style: Record<string, string> };
    constructor(app: unknown) {
      this.app = app;
      this.contentEl = makeEl('div');
      this.titleEl = makeEl('div');
      this.modalEl = { style: {} };
    }
    open(): void { this.onOpen(); }
    close(): void { this.onClose(); }
    onOpen(): void {}
    onClose(): void {}
  }
  class Notice { constructor(_m: string) {} }
  class Plugin {}
  class ItemView {}
  class WorkspaceLeaf {}
  class PluginSettingTab {}
  class SuggestModal<T> {
    constructor(public app: unknown) {}
    getSuggestions(_q: string): T[] { return []; }
    renderSuggestion(): void {}
    onChooseSuggestion(): void {}
    setPlaceholder(): void {}
    open(): void {}
    close(): void {}
  }
  class Setting {
    constructor(_e: unknown) {}
    setName(): this { return this; }
    setDesc(): this { return this; }
    setHeading(): this { return this; }
    addText(): this { return this; }
    addTextArea(): this { return this; }
    addDropdown(): this { return this; }
    addSlider(): this { return this; }
    addButton(): this { return this; }
  }
  class TFile {
    path: string;
    extension: string;
    basename: string;
    constructor(p = '') {
      this.path = p;
      const parts = p.split('/');
      const leaf = parts[parts.length - 1] ?? '';
      const dot = leaf.lastIndexOf('.');
      this.extension = dot >= 0 ? leaf.slice(dot + 1) : '';
      this.basename = dot >= 0 ? leaf.slice(0, dot) : leaf;
    }
  }
  class TFolder {
    path: string;
    name: string;
    children: Array<TFile | TFolder>;
    constructor(p = '', children: Array<TFile | TFolder> = []) {
      this.path = p;
      this.name = p.split('/').pop() ?? '';
      this.children = children;
    }
  }
  class AbstractInputSuggest<T> {
    app: unknown;
    inputEl: unknown;
    constructor(app: unknown, inputEl: unknown) { this.app = app; this.inputEl = inputEl; }
    setValue(_v: T): void {}
    open(): void {}
    close(): void {}
  }
  return { Modal, Notice, Plugin, ItemView, WorkspaceLeaf, PluginSettingTab, SuggestModal, Setting, TFile, TFolder, AbstractInputSuggest, setIcon: mockSetIcon };
}

// Minimal setIcon mock for tests that import render-runner-footer
function mockSetIcon(_el: unknown, _iconId: string): void {
  // no-op
}

// ───── SnippetFillInModal mock ─────────────────────────────────────────────

interface FillModalInstance {
  snippet: unknown;
  result: Promise<string | null>;
  __resolve(value: string | null): void;
  open(): void;
  close(): void;
  opened: boolean;
  closed: boolean;
}

const fillModalInstances: FillModalInstance[] = [];

export function getFillModalInstances(): FillModalInstance[] {
  return fillModalInstances;
}

export function resetFillModalInstances(): void {
  fillModalInstances.length = 0;
}

export function createSnippetFillInModalMock(): Record<string, unknown> {
  class SnippetFillInModal {
    readonly result: Promise<string | null>;
    readonly snippet: unknown;
    opened = false;
    closed = false;
    private settled = false;
    private resolveFn!: (value: string | null) => void;

    constructor(_app: unknown, snippet: unknown) {
      this.snippet = snippet;
      this.result = new Promise<string | null>((resolve) => { this.resolveFn = resolve; });
      fillModalInstances.push(this as unknown as FillModalInstance);
    }

    private settle(value: string | null): void {
      if (this.settled) return;
      this.settled = true;
      this.resolveFn(value);
    }

    __resolve(value: string | null): void { this.settle(value); }
    open(): void { this.opened = true; }
    close(): void {
      if (this.closed) return;
      this.closed = true;
      this.settle(null);
    }
  }
  return { SnippetFillInModal, __fillModalInstances: fillModalInstances };
}

export interface PickerMockInstance {
  options: Record<string, unknown>;
  mounted: boolean;
  unmounted: boolean;
}

const pickerMockInstances: PickerMockInstance[] = [];

export function getPickerMockInstances(): PickerMockInstance[] {
  return pickerMockInstances;
}

export function resetPickerMockInstances(): void {
  pickerMockInstances.length = 0;
}

export function createSnippetTreePickerMock(
  mountSpy: (instance: PickerMockInstance) => void | Promise<void> = () => {},
): Record<string, unknown> {
  class SnippetTreePicker {
    private readonly instance: PickerMockInstance;
    constructor(options: Record<string, unknown>) {
      this.instance = { options, mounted: false, unmounted: false };
      pickerMockInstances.push(this.instance);
    }
    async mount(): Promise<void> {
      this.instance.mounted = true;
      await mountSpy(this.instance);
    }
    unmount(): void { this.instance.unmounted = true; }
  }
  return { SnippetTreePicker };
}

export function deferred<T>(): {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

type FileLike = { path: string };
type LeafLike = { view: Record<string, unknown> };
type VaultHandler = (file: FileLike) => void;
type WorkspaceHandler = (leaf: LeafLike | null) => void;
type EventRefLike<T> = { event: string; handler: T };

export function makeBasePlugin(
  opts: { textSeparator?: 'newline' | 'space'; snippetFolderPath?: string } = {},
) {
  const inlineRunners = new Map<string, unknown>();
  return {
    settings: {
      textSeparator: opts.textSeparator ?? 'newline',
      snippetFolderPath: opts.snippetFolderPath ?? 'Snippets',
      protocolFolderPath: 'Protocols',
      locale: 'ru',
    },
    snippetService: {
      load: vi.fn<(absolutePath: string) => Promise<unknown | null>>(async () => null),
      resolveSnippet: vi.fn<(id: string) => Promise<unknown>>(async () => ({ status: 'missing' })),
    },
    protocolDocumentStore: {
      read: vi.fn<(path: string) => Promise<unknown | null>>(async () => ({
        schema: 'radiprotocol.protocol', version: 1,
      })),
    },
    protocolDocumentParser: {
      parse: vi.fn<(content: string, path: string) => unknown>(),
    },
    insertMutex: {
      runExclusive: vi.fn<(
        path: string,
        operation: () => Promise<void>,
      ) => Promise<void>>(async (_path, operation) => operation()),
    },
    canvasLiveEditor: { getCanvasJSON: () => null },
    _vaultModifyCalls: [] as Array<[string, string]>,
    i18n: new I18nService('ru'),
    inlineRunners,
    registerInlineRunner: vi.fn<(key: string, modal: unknown) => void>((key, modal) => {
      inlineRunners.set(key, modal);
    }),
    unregisterInlineRunner: vi.fn<(key: string) => void>((key) => {
      inlineRunners.delete(key);
    }),
    getInlineRunner: vi.fn<(key: string) => unknown>((key) => inlineRunners.get(key) ?? null),
    getOpenInlineRunners: vi.fn<() => unknown[]>(() => Array.from(inlineRunners.values())),
    getInlineRunnerPosition: vi.fn<() => null>(() => null),
    saveInlineRunnerPosition: vi.fn<(layout: unknown) => Promise<void>>(async () => {}),
  };
}

export function makeBaseApp(
  plugin: ReturnType<typeof makeBasePlugin>,
  opts: { vaultContent?: string } = {},
) {
  const vaultContent = opts.vaultContent ?? '';
  const modifyCalls: Array<[string, string]> = [];
  const vaultHandlers = new Map<string, VaultHandler[]>();
  const workspaceHandlers = new Map<string, WorkspaceHandler[]>();

  const app = {
    vault: {
      getAbstractFileByPath: vi.fn<(path: string) => FileLike | null>((path) =>
        path === 'Snippets/report.md' ? { path } : null),
      read: vi.fn<(file: FileLike) => Promise<string>>(async () => vaultContent),
      modify: vi.fn<(file: FileLike, content: string) => Promise<void>>(async (file, content) => {
        modifyCalls.push([file.path, content]);
        plugin._vaultModifyCalls.push([file.path, content]);
      }),
      getFiles: vi.fn<() => FileLike[]>(() => []),
      on: vi.fn<(event: string, handler: VaultHandler) => EventRefLike<VaultHandler>>(
        (event, handler) => {
          vaultHandlers.set(event, [...(vaultHandlers.get(event) ?? []), handler]);
          return { event, handler };
        },
      ),
      offref: vi.fn<(ref: EventRefLike<VaultHandler>) => void>((ref) => {
        vaultHandlers.set(
          ref.event,
          (vaultHandlers.get(ref.event) ?? []).filter((handler) => handler !== ref.handler),
        );
      }),
    },
    workspace: {
      on: vi.fn<(
        event: string,
        handler: WorkspaceHandler,
      ) => EventRefLike<WorkspaceHandler>>((event, handler) => {
        workspaceHandlers.set(event, [...(workspaceHandlers.get(event) ?? []), handler]);
        return { event, handler };
      }),
      offref: vi.fn<(ref: EventRefLike<WorkspaceHandler>) => void>((ref) => {
        workspaceHandlers.set(
          ref.event,
          (workspaceHandlers.get(ref.event) ?? []).filter((handler) => handler !== ref.handler),
        );
      }),
      getActiveFile: vi.fn<() => FileLike | null>(() => null),
      iterateAllLeaves: vi.fn<(callback: (leaf: LeafLike) => void) => void>(() => {}),
    },
    _modifyCalls: modifyCalls,
    _emitVault(event: string, file: FileLike): void {
      for (const handler of vaultHandlers.get(event) ?? []) handler(file);
    },
    _emitWorkspace(event: string, leaf: LeafLike | null = null): void {
      for (const handler of workspaceHandlers.get(event) ?? []) handler(leaf);
    },
    _vaultHandlerCount(event: string): number {
      return vaultHandlers.get(event)?.length ?? 0;
    },
    _workspaceHandlerCount(event: string): number {
      return workspaceHandlers.get(event)?.length ?? 0;
    },
  };
  return app;
}
```

#### 10. src/__tests__/views/runner-session-host.test.ts
**File**: src/__tests__/views/runner-session-host.test.ts
**Changes**: NEW — verify bootstrap, render dispatch, deltas, snippets, fixed-note mutex use, completion, and stale async suppression.

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  deferred,
  getFillModalInstances,
  getPickerMockInstances,
  makeBaseApp,
  makeBasePlugin,
  makeEl,
  resetFillModalInstances,
  resetPickerMockInstances,
  type MockEl,
} from '../runner/runner-renderer-host-fixtures';

vi.mock('obsidian', async () => {
  const fixtures = await import('../runner/runner-renderer-host-fixtures');
  return fixtures.createObsidianModuleMock();
});
vi.mock('../../views/snippet-tree-picker', async () => {
  const fixtures = await import('../runner/runner-renderer-host-fixtures');
  return fixtures.createSnippetTreePickerMock();
});
vi.mock('../../views/snippet-fill-in-modal', async () => {
  const fixtures = await import('../runner/runner-renderer-host-fixtures');
  return fixtures.createSnippetFillInModalMock();
});

import { TFile } from 'obsidian';
import type { ProtocolGraph, RPEdge, RPNode } from '../../graph/graph-model';
import { RunnerSessionHost, type RunnerSessionHostOptions } from '../../views/runner-session-host';
import { WriteMutex } from '../../utils/write-mutex';

function graph(nodes: RPNode[], edges: RPEdge[]): ProtocolGraph {
  const adjacency = new Map<string, string[]>();
  const reverseAdjacency = new Map<string, string[]>();
  for (const edge of edges) {
    adjacency.set(edge.fromNodeId, [...(adjacency.get(edge.fromNodeId) ?? []), edge.toNodeId]);
    reverseAdjacency.set(edge.toNodeId, [...(reverseAdjacency.get(edge.toNodeId) ?? []), edge.fromNodeId]);
  }
  return {
    canvasFilePath: 'Protocols/test.rp.json',
    nodes: new Map(nodes.map((node) => [node.id, node])),
    edges,
    adjacency,
    reverseAdjacency,
    startNodeId: 'start',
  };
}

const base = { x: 0, y: 0, width: 100, height: 60 };

function answerGraph(): ProtocolGraph {
  return graph([
    { ...base, id: 'start', kind: 'start' },
    { ...base, id: 'seed', kind: 'text-block', content: 'Seed' },
    { ...base, id: 'question', kind: 'question', questionText: 'Choose' },
    { ...base, id: 'answer', kind: 'answer', answerText: 'Finding' },
  ], [
    { id: 'start-seed', fromNodeId: 'start', toNodeId: 'seed' },
    { id: 'seed-question', fromNodeId: 'seed', toNodeId: 'question' },
    { id: 'question-answer', fromNodeId: 'question', toNodeId: 'answer' },
  ]);
}

function answerWithDownstreamTextGraph(answerText = 'Finding'): ProtocolGraph {
  return graph([
    { ...base, id: 'start', kind: 'start' },
    { ...base, id: 'question', kind: 'question', questionText: 'Choose' },
    { ...base, id: 'answer', kind: 'answer', answerText },
    { ...base, id: 'tail', kind: 'text-block', content: 'Tail' },
  ], [
    { id: 'start-question', fromNodeId: 'start', toNodeId: 'question' },
    { id: 'question-answer', fromNodeId: 'question', toNodeId: 'answer' },
    { id: 'answer-tail', fromNodeId: 'answer', toNodeId: 'tail' },
  ]);
}

function loopGraph(): ProtocolGraph {
  return graph([
    { ...base, id: 'start', kind: 'start' },
    { ...base, id: 'loop', kind: 'question', questionText: 'Repeat?', loop: true },
    { ...base, id: 'body', kind: 'answer', answerText: 'Body' },
    { ...base, id: 'end', kind: 'text-block', content: 'End' },
  ], [
    { id: 'start-loop', fromNodeId: 'start', toNodeId: 'loop' },
    { id: 'loop-body', fromNodeId: 'loop', toNodeId: 'body' },
    { id: 'body-loop', fromNodeId: 'body', toNodeId: 'loop' },
    { id: 'loop-exit', fromNodeId: 'loop', toNodeId: 'end', label: 'Finish', isLoopExit: true },
  ]);
}

function snippetGraph(fileBound: boolean): ProtocolGraph {
  return graph([
    { ...base, id: 'start', kind: 'start' },
    {
      ...base,
      id: 'snippet',
      kind: 'snippet',
      ...(fileBound ? { radiprotocol_snippetPath: 'report.md' } : { subfolderPath: 'Chest' }),
    },
  ], [
    { id: 'start-snippet', fromNodeId: 'start', toNodeId: 'snippet' },
  ]);
}

interface Harness {
  host: RunnerSessionHost;
  root: MockEl;
  app: ReturnType<typeof makeBaseApp>;
  plugin: ReturnType<typeof makeBasePlugin>;
  protocolFile: TFile;
  targetNote: TFile;
  onRequestClose: ReturnType<typeof vi.fn>;
  notify: ReturnType<typeof vi.fn>;
  withTargetNoteLock: ReturnType<typeof vi.fn>;
}

function harness(runtimeGraph: ProtocolGraph, rawDocument = '{}'): Harness {
  const plugin = makeBasePlugin();
  const app = makeBaseApp(plugin);
  const protocolFile = new (TFile as any)('Protocols/test.rp.json') as TFile;
  const targetNote = new (TFile as any)('notes/target.md') as TFile;
  app.vault.getAbstractFileByPath.mockImplementation((path: string) => {
    if (path === protocolFile.path) return protocolFile;
    if (path === 'Snippets/report.md') return new (TFile as any)(path) as TFile;
    return null;
  });
  app.vault.read.mockImplementation(async (file: { path: string }) =>
    file.path === protocolFile.path ? rawDocument : 'Seed\n');
  plugin.protocolDocumentParser.parse.mockReturnValue({ success: true, graph: runtimeGraph });
  const onRequestClose = vi.fn();
  const notify = vi.fn();
  const withTargetNoteLock = vi.fn(async (_path: string, operation: () => Promise<void>) => operation());
  const options: RunnerSessionHostOptions = {
    app: app as any,
    protocolPath: protocolFile.path,
    targetNote,
    protocolDocumentStore: plugin.protocolDocumentStore as any,
    protocolDocumentParser: plugin.protocolDocumentParser as any,
    snippetService: plugin.snippetService as any,
    getTextSeparator: () => 'newline',
    getSnippetFolderPath: () => 'Snippets',
    withTargetNoteLock,
    t: plugin.i18n.t.bind(plugin.i18n),
    notify,
    onRequestClose,
  };
  return {
    host: new RunnerSessionHost(options),
    root: makeEl('div'),
    app,
    plugin,
    protocolFile,
    targetNote,
    onRequestClose,
    notify,
    withTargetNoteLock,
  };
}

async function flushMicrotasks(turns = 8): Promise<void> {
  for (let index = 0; index < turns; index += 1) await Promise.resolve();
}

beforeEach(() => {
  resetFillModalInstances();
  resetPickerMockInstances();
});

describe('RunnerSessionHost bootstrap and projection', () => {
  it('has an inert constructor and crosses migration read before raw read and parse', async () => {
    const h = harness(answerGraph());
    const order: string[] = [];
    h.plugin.protocolDocumentStore.read.mockImplementation(async () => { order.push('store'); return {}; });
    h.app.vault.read.mockImplementation(async () => { order.push('vault'); return '{}'; });
    h.plugin.protocolDocumentParser.parse.mockImplementation(() => {
      order.push('parse');
      return { success: true, graph: answerGraph() };
    });

    expect(h.root.children).toHaveLength(0);
    expect(h.plugin.protocolDocumentStore.read).not.toHaveBeenCalled();
    expect(await h.host.mount(h.root as unknown as HTMLElement)).toBe(true);

    expect(order).toEqual(['store', 'vault', 'parse']);
    expect(h.root.hasClass('rp-runner-session-root')).toBe(true);
    expect(h.root.querySelector('.rp-question-text')?._text).toBe('Choose');
    expect(h.root.querySelector('.rp-runner-session-progress')).not.toBeNull();
  });

  it('dispatches loop and snippet-picker states into common zones', async () => {
    const loop = harness(loopGraph());
    expect(await loop.host.mount(loop.root as unknown as HTMLElement)).toBe(true);
    expect(loop.root.querySelectorAll('.rp-loop-body-btn')).toHaveLength(1);
    expect(loop.root.querySelectorAll('.rp-loop-exit-btn')).toHaveLength(1);
    loop.host.dispose();

    const snippet = harness(snippetGraph(false));
    expect(await snippet.host.mount(snippet.root as unknown as HTMLElement)).toBe(true);
    expect(getPickerMockInstances()).toHaveLength(1);
    expect(snippet.root.querySelector('.rp-stp-runner-session-host')).not.toBeNull();
    expect(snippet.root.hasClass('rp-state-content-only')).toBe(true);
  });
});

describe('RunnerSessionHost note deltas and snippets', () => {
  it('writes an append-only accumulator delta to the fixed note through the path mutex', async () => {
    const h = harness(answerGraph(), JSON.stringify({ selfCheckEnabled: true, selfCheckItems: ['Review'] }));
    expect(await h.host.mount(h.root as unknown as HTMLElement)).toBe(true);

    h.root.querySelector('.rp-answer-btn')?.dispatchEvent({ type: 'click' });
    await flushMicrotasks();

    expect(h.withTargetNoteLock).toHaveBeenCalledWith(h.targetNote.path, expect.any(Function));
    expect(h.app.vault.modify).toHaveBeenCalledWith(h.targetNote, 'Seed\nFinding');
    expect(h.app.vault.modify.mock.calls[0]?.[0]).toBe(h.targetNote);
    expect(h.root.querySelector('.rp-runner-session-self-check')).not.toBeNull();
  });

  it('keeps an accepted delta alive across Back and unrelated rerender while note read is pending', async () => {
    const h = harness(answerGraph(), JSON.stringify({
      selfCheckEnabled: true,
      selfCheckItems: ['Review'],
    }));
    const pendingRead = deferred<string>();
    h.app.vault.read.mockImplementation((file: { path: string }) =>
      file.path === h.protocolFile.path ? Promise.resolve('{}') : pendingRead.promise);
    expect(await h.host.mount(h.root as unknown as HTMLElement)).toBe(true);

    h.root.querySelector('.rp-answer-btn')?.dispatchEvent({ type: 'click' });
    await flushMicrotasks(2);
    const event = {
      key: 'ArrowLeft', ctrlKey: true, altKey: false, target: null,
      preventDefault: vi.fn(),
    } as unknown as KeyboardEvent;
    expect(h.host.handleKeydown(event)).toBe(true);
    expect(h.root.querySelector('.rp-question-text')?._text).toBe('Choose');

    pendingRead.resolve('Seed\n');
    await flushMicrotasks();

    expect(h.app.vault.modify).toHaveBeenCalledWith(h.targetNote, 'Seed\nFinding');
    expect(h.root.querySelector('.rp-question-text')?._text).toBe('Choose');
  });

  it('notifies and reprojects current runner state after a bound-note write failure', async () => {
    const h = harness(answerGraph(), JSON.stringify({
      selfCheckEnabled: true,
      selfCheckItems: ['Review'],
    }));
    h.app.vault.read.mockImplementation((file: { path: string }) => {
      if (file.path === h.protocolFile.path) return Promise.resolve('{}');
      return Promise.reject(new Error('write target unavailable'));
    });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(await h.host.mount(h.root as unknown as HTMLElement)).toBe(true);
      h.root.querySelector('.rp-answer-btn')?.dispatchEvent({ type: 'click' });
      await flushMicrotasks();

      expect(h.notify).toHaveBeenCalledWith(
        'Не удалось записать результат протокола в связанную заметку.',
      );
      expect(h.app.vault.modify).not.toHaveBeenCalled();
      expect(h.root.querySelector('.rp-runner-session-self-check')).not.toBeNull();
    } finally {
      consoleError.mockRestore();
    }
  });

  it('writes Answer text and automatically traversed downstream text as one delta', async () => {
    const h = harness(answerWithDownstreamTextGraph(), JSON.stringify({
      selfCheckEnabled: true,
      selfCheckItems: ['Review'],
    }));
    h.app.vault.read.mockImplementation((file: { path: string }) =>
      Promise.resolve(file.path === h.protocolFile.path ? '{}' : ''));
    expect(await h.host.mount(h.root as unknown as HTMLElement)).toBe(true);

    h.root.querySelector('.rp-answer-btn')?.dispatchEvent({ type: 'click' });
    await flushMicrotasks();

    expect(h.app.vault.modify).toHaveBeenCalledTimes(1);
    expect(h.app.vault.modify).toHaveBeenCalledWith(h.targetNote, 'Finding\nTail');
  });

  it('writes automatically traversed output produced by Skip through the same delta sink', async () => {
    const h = harness(answerWithDownstreamTextGraph(), JSON.stringify({
      selfCheckEnabled: true,
      selfCheckItems: ['Review'],
    }));
    h.app.vault.read.mockImplementation((file: { path: string }) =>
      Promise.resolve(file.path === h.protocolFile.path ? '{}' : ''));
    expect(await h.host.mount(h.root as unknown as HTMLElement)).toBe(true);

    h.root.querySelector('.rp-skip-btn')?.dispatchEvent({ type: 'click' });
    await flushMicrotasks();

    expect(h.app.vault.modify).toHaveBeenCalledTimes(1);
    expect(h.app.vault.modify).toHaveBeenCalledWith(h.targetNote, 'Tail');
  });

  it('serializes same-path writes through a real WriteMutex', async () => {
    const raw = JSON.stringify({ selfCheckEnabled: true, selfCheckItems: ['Review'] });
    const first = harness(answerWithDownstreamTextGraph('A'), raw);
    const second = harness(answerWithDownstreamTextGraph('B'), raw);
    const mutex = new WriteMutex();
    first.withTargetNoteLock.mockImplementation((path, operation) =>
      mutex.runExclusive(path, operation));
    second.withTargetNoteLock.mockImplementation((path, operation) =>
      mutex.runExclusive(path, operation));
    expect(await first.host.mount(first.root as unknown as HTMLElement)).toBe(true);
    expect(await second.host.mount(second.root as unknown as HTMLElement)).toBe(true);

    const firstRead = deferred<string>();
    let noteContent = '';
    let targetReads = 0;
    const installVault = (h: Harness): void => {
      h.app.vault.read.mockImplementation((file: { path: string }) => {
        if (file.path === h.protocolFile.path) return Promise.resolve('{}');
        targetReads += 1;
        return targetReads === 1 ? firstRead.promise : Promise.resolve(noteContent);
      });
      h.app.vault.modify.mockImplementation(async (_file: { path: string }, content: string) => {
        noteContent = content;
      });
    };
    installVault(first);
    installVault(second);

    first.root.querySelector('.rp-answer-btn')?.dispatchEvent({ type: 'click' });
    second.root.querySelector('.rp-answer-btn')?.dispatchEvent({ type: 'click' });
    await flushMicrotasks();
    expect(targetReads).toBe(1);

    firstRead.resolve('');
    await flushMicrotasks(12);
    expect(targetReads).toBe(2);
    expect(noteContent).toBe('A\nTailB\nTail');
  });

  it('keeps picker selection on the accumulator path and preserves first-chunk behavior', async () => {
    const h = harness(snippetGraph(false), JSON.stringify({ selfCheckEnabled: true, selfCheckItems: ['Review'] }));
    h.app.vault.read.mockImplementation(async (file: { path: string }) =>
      file.path === h.protocolFile.path ? '{}' : '');
    expect(await h.host.mount(h.root as unknown as HTMLElement)).toBe(true);
    const picker = getPickerMockInstances()[0]!;
    const onSelect = picker.options.onSelect as (result: { relativePath: string }) => void;
    h.plugin.snippetService.load.mockResolvedValue({
      kind: 'md', path: 'Snippets/Chest/report.md', name: 'report', content: 'Report',
    });

    onSelect({ relativePath: 'report.md' });
    await flushMicrotasks();

    expect(h.app.vault.modify).toHaveBeenCalledWith(h.targetNote, 'Report');
    expect(picker.unmounted).toBe(true);
  });

  it('renders a recoverable error with Back when snippet resolution rejects', async () => {
    const runtimeGraph = graph([
      { ...base, id: 'start', kind: 'start' },
      { ...base, id: 'question', kind: 'question', questionText: 'Choose' },
      {
        ...base,
        id: 'snippet',
        kind: 'snippet',
        radiprotocol_snippetPath: 'report.md',
      },
    ], [
      { id: 'start-question', fromNodeId: 'start', toNodeId: 'question' },
      { id: 'question-snippet', fromNodeId: 'question', toNodeId: 'snippet' },
    ]);
    const h = harness(runtimeGraph);
    h.plugin.snippetService.resolveSnippet.mockRejectedValue(new Error('vault unavailable'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(await h.host.mount(h.root as unknown as HTMLElement)).toBe(true);
      h.root.querySelector('.rp-snippet-branch-btn')?.dispatchEvent({ type: 'click' });
      await flushMicrotasks();

      expect(h.root.querySelector('.rp-error-panel')).not.toBeNull();
      expect(h.root.querySelector('.rp-step-back-btn')).not.toBeNull();
      expect(h.app.vault.modify).not.toHaveBeenCalled();
      expect(h.host.isMounted()).toBe(true);
    } finally {
      consoleError.mockRestore();
    }
  });

  it('treats fill cancellation as completeSnippet("") without writing output', async () => {
    const h = harness(snippetGraph(true), JSON.stringify({ selfCheckEnabled: true, selfCheckItems: ['Review'] }));
    h.plugin.snippetService.resolveSnippet.mockResolvedValue({
      status: 'found',
      snippet: {
        kind: 'md-template', path: 'Snippets/report.md', name: 'report',
        template: 'Value: {{value}}', validationError: null,
        placeholders: [{ id: 'value', label: 'Value', type: 'free-text' }],
      },
    });
    expect(await h.host.mount(h.root as unknown as HTMLElement)).toBe(true);
    await flushMicrotasks();
    const modal = getFillModalInstances()[0]!;
    expect(h.host.hasOpenChildModal()).toBe(true);

    modal.__resolve(null);
    await flushMicrotasks();

    expect(h.app.vault.modify).not.toHaveBeenCalled();
    expect(h.host.hasOpenChildModal()).toBe(false);
    expect(h.root.querySelector('.rp-runner-session-self-check')).not.toBeNull();
  });
});

describe('RunnerSessionHost completion and stale async suppression', () => {
  it('closes only after timer advancement and cancels a scheduled close on dispose', async () => {
    vi.useFakeTimers();
    try {
      const immediate = harness(answerGraph());
      expect(await immediate.host.mount(immediate.root as unknown as HTMLElement)).toBe(true);
      immediate.root.querySelector('.rp-answer-btn')?.dispatchEvent({ type: 'click' });
      await flushMicrotasks();
      expect(immediate.onRequestClose).not.toHaveBeenCalled();
      vi.advanceTimersByTime(0);
      expect(immediate.onRequestClose).toHaveBeenCalledTimes(1);

      const canceled = harness(answerGraph());
      expect(await canceled.host.mount(canceled.root as unknown as HTMLElement)).toBe(true);
      canceled.root.querySelector('.rp-answer-btn')?.dispatchEvent({ type: 'click' });
      await flushMicrotasks();
      expect(canceled.onRequestClose).not.toHaveBeenCalled();
      canceled.host.dispose();
      vi.advanceTimersByTime(0);
      expect(canceled.onRequestClose).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('requests close after the final self-check item', async () => {
    const checked = harness(answerGraph(), JSON.stringify({
      selfCheckEnabled: true,
      selfCheckItems: ['One'],
    }));
    expect(await checked.host.mount(checked.root as unknown as HTMLElement)).toBe(true);
    checked.root.querySelector('.rp-answer-btn')?.dispatchEvent({ type: 'click' });
    await flushMicrotasks();
    const checkbox = checked.root.querySelector('input[type="checkbox"]')!;
    checkbox.checked = true;
    checkbox.dispatchEvent({ type: 'change' });
    expect(checked.onRequestClose).toHaveBeenCalledTimes(1);
  });

  it('suppresses bootstrap continuation after dispose', async () => {
    const h = harness(answerGraph());
    const pending = deferred<unknown>();
    h.plugin.protocolDocumentStore.read.mockReturnValue(pending.promise);
    const mounting = h.host.mount(h.root as unknown as HTMLElement);

    h.host.dispose();
    pending.resolve({});
    expect(await mounting).toBe(false);

    expect(h.app.vault.read).not.toHaveBeenCalled();
    expect(h.plugin.protocolDocumentParser.parse).not.toHaveBeenCalled();
    expect(h.root.children).toHaveLength(0);
  });

  it('suppresses a target-note modify and follow-up render when disposed during the read', async () => {
    const h = harness(answerGraph(), JSON.stringify({ selfCheckEnabled: true, selfCheckItems: ['Review'] }));
    const pendingRead = deferred<string>();
    h.app.vault.read.mockImplementation((file: { path: string }) => {
      if (file.path === h.protocolFile.path) return Promise.resolve('{}');
      return pendingRead.promise;
    });
    expect(await h.host.mount(h.root as unknown as HTMLElement)).toBe(true);
    h.root.querySelector('.rp-answer-btn')?.dispatchEvent({ type: 'click' });
    await Promise.resolve();

    h.host.dispose();
    pendingRead.resolve('Seed\n');
    await flushMicrotasks();

    expect(h.app.vault.modify).not.toHaveBeenCalled();
    expect(h.root.children).toHaveLength(0);
  });

  it('suppresses stale snippet resolution after dispose', async () => {
    const h = harness(snippetGraph(true));
    const resolution = deferred<any>();
    h.plugin.snippetService.resolveSnippet.mockReturnValue(resolution.promise);
    expect(await h.host.mount(h.root as unknown as HTMLElement)).toBe(true);
    h.host.dispose();
    resolution.resolve({
      status: 'found',
      snippet: {
        kind: 'md-template', path: 'Snippets/report.md', name: 'report',
        template: '{{value}}', validationError: null,
        placeholders: [{ id: 'value', label: 'Value', type: 'free-text' }],
      },
    });
    await flushMicrotasks();

    expect(getFillModalInstances()).toHaveLength(0);
    expect(h.app.vault.modify).not.toHaveBeenCalled();
  });

  it('suppresses a pending picker load after dispose', async () => {
    const h = harness(snippetGraph(false));
    expect(await h.host.mount(h.root as unknown as HTMLElement)).toBe(true);
    const picker = getPickerMockInstances()[0]!;
    const load = deferred<any>();
    h.plugin.snippetService.load.mockReturnValue(load.promise);

    (picker.options.onSelect as (result: { relativePath: string }) => void)({
      relativePath: 'report.md',
    });
    await flushMicrotasks(2);
    h.host.dispose();
    load.resolve({
      kind: 'md', path: 'Snippets/Chest/report.md', name: 'report', content: 'Late',
    });
    await flushMicrotasks();

    expect(picker.unmounted).toBe(true);
    expect(h.app.vault.modify).not.toHaveBeenCalled();
    expect(h.root.children).toHaveLength(0);
  });

  it('invalidates sibling picker loads when one missing result replaces the picker with an error', async () => {
    const h = harness(snippetGraph(false));
    expect(await h.host.mount(h.root as unknown as HTMLElement)).toBe(true);
    const picker = getPickerMockInstances()[0]!;
    const firstLoad = deferred<any>();
    const secondLoad = deferred<any>();
    h.plugin.snippetService.load
      .mockReturnValueOnce(firstLoad.promise)
      .mockReturnValueOnce(secondLoad.promise);
    const onSelect = picker.options.onSelect as (result: { relativePath: string }) => void;

    onSelect({ relativePath: 'missing.md' });
    onSelect({ relativePath: 'late.md' });
    firstLoad.resolve(null);
    await flushMicrotasks();
    expect(picker.unmounted).toBe(true);
    expect(getPickerMockInstances()).toHaveLength(2);
    expect(h.root.querySelector('.rp-stp-runner-session-host')).not.toBeNull();
    expect(h.root.querySelector('.rp-empty-state-body')).not.toBeNull();

    secondLoad.resolve({
      kind: 'md', path: 'Snippets/Chest/late.md', name: 'late', content: 'Late',
    });
    await flushMicrotasks();

    expect(h.app.vault.modify).not.toHaveBeenCalled();
  });

  it('closes an opened fill modal on dispose and suppresses its late result', async () => {
    const h = harness(snippetGraph(true));
    h.plugin.snippetService.resolveSnippet.mockResolvedValue({
      status: 'found',
      snippet: {
        kind: 'md-template', path: 'Snippets/report.md', name: 'report',
        template: '{{value}}', validationError: null,
        placeholders: [{ id: 'value', label: 'Value', type: 'free-text' }],
      },
    });
    expect(await h.host.mount(h.root as unknown as HTMLElement)).toBe(true);
    await flushMicrotasks();
    const modal = getFillModalInstances()[0]!;
    expect(modal.opened).toBe(true);

    h.host.dispose();
    modal.__resolve('Late value');
    await flushMicrotasks();

    expect(modal.closed).toBe(true);
    expect(h.app.vault.modify).not.toHaveBeenCalled();
    expect(h.root.children).toHaveLength(0);
  });

  it('ignores unrelated deletion, but matching deletion invalidates writes and removes listener', async () => {
    const h = harness(answerGraph(), JSON.stringify({
      selfCheckEnabled: true,
      selfCheckItems: ['Review'],
    }));
    const pendingRead = deferred<string>();
    h.app.vault.read.mockImplementation((file: { path: string }) =>
      file.path === h.protocolFile.path ? Promise.resolve('{}') : pendingRead.promise);
    expect(await h.host.mount(h.root as unknown as HTMLElement)).toBe(true);
    expect(h.app._vaultHandlerCount('delete')).toBe(1);

    h.root.querySelector('.rp-answer-btn')?.dispatchEvent({ type: 'click' });
    await flushMicrotasks(2);
    h.app._emitVault('delete', new (TFile as any)('notes/unrelated.md'));
    expect(h.host.isMounted()).toBe(true);
    expect(h.onRequestClose).not.toHaveBeenCalled();
    expect(h.app._vaultHandlerCount('delete')).toBe(1);

    h.app._emitVault('delete', h.targetNote);
    expect(h.host.isMounted()).toBe(false);
    expect(h.onRequestClose).toHaveBeenCalledTimes(1);
    expect(h.app._vaultHandlerCount('delete')).toBe(0);
    expect(h.app.vault.offref).toHaveBeenCalledTimes(1);

    pendingRead.resolve('Seed\n');
    await flushMicrotasks();
    expect(h.app.vault.modify).not.toHaveBeenCalled();
  });
});
```

#### 11. src/__tests__/views/inline-runner-modal.test.ts
**File**: src/__tests__/views/inline-runner-modal.test.ts
**Changes**: MODIFY — move shared behavior assertions to the host and retain floating registry/visibility/teardown integration.

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeBaseApp, makeBasePlugin, makeEl, type MockEl } from '../runner/runner-renderer-host-fixtures';

const hostInstances = vi.hoisted(() => [] as Array<{
  options: Record<string, unknown>;
  disposed: boolean;
  childOpen: boolean;
  keydown: ReturnType<typeof vi.fn>;
  header: MockEl | null;
}>);
const layoutInstances = vi.hoisted(() => [] as Array<{
  enableDragging: ReturnType<typeof vi.fn>;
  applyInitialLayout: ReturnType<typeof vi.fn>;
  reclampCurrentPosition: ReturnType<typeof vi.fn>;
  startWindowResizeListener: ReturnType<typeof vi.fn>;
  handleResizeTick: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}>);
const resizeObservers = vi.hoisted(() => [] as Array<{
  observed: unknown[];
  disconnected: boolean;
}>);

vi.mock('obsidian', async () => {
  const fixtures = await import('../runner/runner-renderer-host-fixtures');
  return fixtures.createObsidianModuleMock();
});
vi.mock('../../views/runner-session-host', () => ({
  RunnerSessionHost: class {
    private readonly instance: (typeof hostInstances)[number];
    constructor(options: Record<string, unknown>) {
      this.instance = {
        options,
        disposed: false,
        childOpen: false,
        keydown: vi.fn(),
        header: null,
      };
      hostInstances.push(this.instance);
    }
    async mount(root: MockEl): Promise<boolean> {
      root.empty();
      root.addClass('rp-runner-session-root');
      this.instance.header = root.createDiv({ cls: 'rp-runner-session-header' });
      return true;
    }
    dispose(): void { this.instance.disposed = true; }
    hasOpenChildModal(): boolean { return this.instance.childOpen; }
    getHeaderElement(): MockEl | null { return this.instance.header; }
    handleKeydown(event: KeyboardEvent): boolean {
      this.instance.keydown(event);
      return true;
    }
  },
}));
vi.mock('../../views/inline-runner-layout', () => ({
  clampInlineRunnerPosition: vi.fn(),
  clampInlineRunnerLayout: vi.fn(),
  InlineRunnerLayoutManager: class {
    private readonly instance: (typeof layoutInstances)[number];
    constructor() {
      this.instance = {
        enableDragging: vi.fn(),
        applyInitialLayout: vi.fn(),
        reclampCurrentPosition: vi.fn(async () => {}),
        startWindowResizeListener: vi.fn(),
        handleResizeTick: vi.fn(),
        destroy: vi.fn(),
      };
      layoutInstances.push(this.instance);
    }
    enableDragging(header: HTMLElement): void { this.instance.enableDragging(header); }
    applyInitialLayout(): void { this.instance.applyInitialLayout(); }
    async reclampCurrentPosition(value: boolean): Promise<void> {
      await this.instance.reclampCurrentPosition(value);
    }
    startWindowResizeListener(): void { this.instance.startWindowResizeListener(); }
    handleResizeTick(): void { this.instance.handleResizeTick(); }
    destroy(): void { this.instance.destroy(); }
    getAppliedLayout(): null { return null; }
    restoreOrDefaultPosition(): void {}
  },
}));

import { TFile } from 'obsidian';
import {
  InlineRunnerModal,
  inlineRunnerRegistryKey,
} from '../../views/inline-runner-modal';

function target(path = 'notes/target.md'): TFile {
  return new (TFile as any)(path) as TFile;
}

function installDom(): MockEl {
  const body = makeEl('body');
  (body as any).appendChild = vi.fn((child: MockEl) => {
    child.parent = body;
    if (!body.children.includes(child)) body.children.push(child);
  });
  const originalCreateDiv = body.createDiv.bind(body);
  body.createDiv = (options) => {
    const child = originalCreateDiv(options);
    (child as any).getBoundingClientRect = () => ({ width: 420, height: 320 });
    return child;
  };
  vi.stubGlobal('document', {
    body,
    documentElement: { clientWidth: 1024, clientHeight: 768 },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    querySelectorAll: vi.fn(() => []),
  });
  vi.stubGlobal('window', {
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
  });
  vi.stubGlobal('ResizeObserver', class {
    private readonly state = { observed: [] as unknown[], disconnected: false };
    constructor() { resizeObservers.push(this.state); }
    observe(target: unknown): void { this.state.observed.push(target); }
    disconnect(): void { this.state.disconnected = true; }
  });
  return body;
}

beforeEach(() => {
  hostInstances.length = 0;
  layoutInstances.length = 0;
  resizeObservers.length = 0;
  installDom();
});

afterEach(() => vi.unstubAllGlobals());

describe('InlineRunnerModal floating shell', () => {
  it('mounts a shared host, preserves registry identity, and disposes it on close', async () => {
    const plugin = makeBasePlugin();
    const app = makeBaseApp(plugin);
    const note = target();
    app.workspace.getActiveFile.mockReturnValue(note as never);
    app.workspace.iterateAllLeaves.mockImplementation((callback: (leaf: unknown) => void) => {
      callback({ view: { file: note } });
    });
    const modal = new InlineRunnerModal(app as any, plugin as any, 'Protocols/test.rp.json', note, 'q2');

    await modal.open();
    expect(modal.isOpen()).toBe(true);
    expect(hostInstances).toHaveLength(1);
    expect(hostInstances[0]!.options).toMatchObject({
      protocolPath: 'Protocols/test.rp.json',
      targetNote: note,
      startNodeId: 'q2',
    });
    const container = (modal as any).containerEl as MockEl;
    const layout = layoutInstances[0]!;
    const provisionalHeader = layout.enableDragging.mock.calls[0]?.[0];
    expect(layout.enableDragging).toHaveBeenCalledTimes(2);
    expect(provisionalHeader).not.toBe(hostInstances[0]!.header);
    expect(layout.enableDragging.mock.calls[1]?.[0]).toBe(hostInstances[0]!.header);
    expect(container.querySelector('.rp-runner-session-header')).toBe(hostInstances[0]!.header);
    expect(layout.applyInitialLayout).toHaveBeenCalledTimes(1);
    expect(layout.startWindowResizeListener).toHaveBeenCalledTimes(1);
    expect(resizeObservers[0]!.observed).toEqual([container]);
    expect(container._listeners.get('keydown')).toHaveLength(1);

    const key = inlineRunnerRegistryKey(
      'Protocols/test.rp.json',
      'notes/target.md',
      'q2',
    );
    plugin.registerInlineRunner(key, modal);
    modal.close();
    modal.close();
    expect(hostInstances[0]!.disposed).toBe(true);
    expect(container._listeners.get('keydown')).toHaveLength(0);
    expect(app._workspaceHandlerCount('active-leaf-change')).toBe(0);
    expect(app._workspaceHandlerCount('layout-change')).toBe(0);
    expect(resizeObservers[0]!.disconnected).toBe(true);
    expect(layout.destroy).toHaveBeenCalledTimes(1);
    expect(plugin.unregisterInlineRunner).toHaveBeenCalledWith(key);
    expect(plugin.unregisterInlineRunner).toHaveBeenCalledTimes(1);
    expect(plugin.inlineRunners.size).toBe(0);
  });

  it('hides on active-note mismatch, shows on return, and closes when the target leaf is gone', async () => {
    const plugin = makeBasePlugin();
    const app = makeBaseApp(plugin);
    const note = target();
    let targetOpen = true;
    app.workspace.getActiveFile.mockReturnValue(target('notes/other.md') as never);
    app.workspace.iterateAllLeaves.mockImplementation((callback: (leaf: unknown) => void) => {
      if (targetOpen) callback({ view: { file: note } });
    });
    const modal = new InlineRunnerModal(app as any, plugin as any, 'Protocols/test.rp.json', note);
    await modal.open();
    const container = (modal as any).containerEl as MockEl;
    expect(container.hasClass('is-hidden')).toBe(true);

    app.workspace.getActiveFile.mockReturnValue(note as never);
    app._emitWorkspace('active-leaf-change');
    expect(container.hasClass('is-hidden')).toBe(false);

    targetOpen = false;
    app._emitWorkspace('active-leaf-change');
    expect(modal.isOpen()).toBe(false);
    expect(hostInstances[0]!.disposed).toBe(true);
  });

  it('gates active-leaf visibility while the host owns a child modal', async () => {
    const plugin = makeBasePlugin();
    const app = makeBaseApp(plugin);
    const note = target();
    app.workspace.getActiveFile.mockReturnValue(note as never);
    app.workspace.iterateAllLeaves.mockImplementation((callback: (leaf: unknown) => void) => {
      callback({ view: { file: note } });
    });
    const modal = new InlineRunnerModal(app as any, plugin as any, 'Protocols/test.rp.json', note);
    await modal.open();
    const container = (modal as any).containerEl as MockEl;

    hostInstances[0]!.childOpen = true;
    app.workspace.getActiveFile.mockReturnValue(target('notes/other.md') as never);
    app._emitWorkspace('active-leaf-change');
    expect(container.hasClass('is-hidden')).toBe(false);
  });

  it('focus reattaches and unhides the floating container', async () => {
    const body = document.body as unknown as MockEl & { appendChild: ReturnType<typeof vi.fn> };
    const plugin = makeBasePlugin();
    const app = makeBaseApp(plugin);
    const note = target();
    app.workspace.getActiveFile.mockReturnValue(note as never);
    app.workspace.iterateAllLeaves.mockImplementation((callback: (leaf: unknown) => void) => {
      callback({ view: { file: note } });
    });
    const modal = new InlineRunnerModal(app as any, plugin as any, 'Protocols/test.rp.json', note);
    await modal.open();
    const container = (modal as any).containerEl as MockEl;
    container.addClass('is-hidden');

    modal.focus();
    expect(body.appendChild).toHaveBeenCalledWith(container);
    expect(container.hasClass('is-hidden')).toBe(false);
  });
});
```

#### 12. src/__tests__/views/inline-runner-modal-keyboard.test.ts
**File**: src/__tests__/views/inline-runner-modal-keyboard.test.ts
**Changes**: MODIFY — assert shell Escape policy and shared-host Back/Redo keyboard delegation after extraction.

```ts
import { describe, expect, it, vi } from 'vitest';
import { makeBaseApp, makeBasePlugin } from '../runner/runner-renderer-host-fixtures';

vi.mock('obsidian', async () => {
  const fixtures = await import('../runner/runner-renderer-host-fixtures');
  return fixtures.createObsidianModuleMock();
});

import { TFile } from 'obsidian';
import { InlineRunnerModal } from '../../views/inline-runner-modal';

function event(options: {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  target?: { tagName: string } | null;
}): KeyboardEvent {
  return {
    key: options.key,
    ctrlKey: options.ctrlKey ?? false,
    altKey: options.altKey ?? false,
    target: options.target ?? null,
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent;
}

function setup() {
  const plugin = makeBasePlugin();
  const app = makeBaseApp(plugin);
  const modal = new InlineRunnerModal(
    app as any,
    plugin as any,
    'Protocols/test.rp.json',
    new (TFile as any)('notes/target.md'),
  );
  const handleKeydown = vi.fn();
  (modal as any).sessionHost = { handleKeydown, dispose: vi.fn(), hasOpenChildModal: () => false };
  const close = vi.spyOn(modal, 'close').mockImplementation(() => {});
  return { modal, handleKeydown, close };
}

describe('InlineRunnerModal keyboard policy', () => {
  it.each([
    { key: 'ArrowLeft', ctrlKey: true },
    { key: 'ArrowLeft', altKey: true },
    { key: 'ArrowRight', ctrlKey: true },
    { key: 'ArrowRight', altKey: true },
  ])('delegates $key with a navigation modifier to the shared host', (keys) => {
    const h = setup();
    const keyboardEvent = event(keys);
    (h.modal as any).handleKeydown(keyboardEvent);
    expect(h.handleKeydown).toHaveBeenCalledWith(keyboardEvent);
    expect(h.close).not.toHaveBeenCalled();
  });

  it('keeps Escape as floating-shell close policy', () => {
    const h = setup();
    const keyboardEvent = event({ key: 'Escape' });
    (h.modal as any).handleKeydown(keyboardEvent);
    expect(keyboardEvent.preventDefault).toHaveBeenCalled();
    expect(h.close).toHaveBeenCalledTimes(1);
    expect(h.handleKeydown).not.toHaveBeenCalled();
  });

  it.each(['INPUT', 'TEXTAREA'])('ignores every shell shortcut from %s', (tagName) => {
    const h = setup();
    (h.modal as any).handleKeydown(event({
      key: 'Escape',
      target: { tagName },
    }));
    expect(h.close).not.toHaveBeenCalled();
    expect(h.handleKeydown).not.toHaveBeenCalled();
  });
});
```

#### 13. src/__tests__/views/inline-runner-modal-loop-body-file-bound.test.ts
**File**: src/__tests__/views/inline-runner-modal-loop-body-file-bound.test.ts
**Changes**: MODIFY — retarget loop/snippet parity coverage to the shared host mounted by the floating shell.

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getPickerMockInstances,
  makeBaseApp,
  makeBasePlugin,
  makeEl,
  resetPickerMockInstances,
} from '../runner/runner-renderer-host-fixtures';

vi.mock('obsidian', async () => {
  const fixtures = await import('../runner/runner-renderer-host-fixtures');
  return fixtures.createObsidianModuleMock();
});
vi.mock('../../views/snippet-tree-picker', async () => {
  const fixtures = await import('../runner/runner-renderer-host-fixtures');
  return fixtures.createSnippetTreePickerMock();
});
vi.mock('../../views/snippet-fill-in-modal', async () => {
  const fixtures = await import('../runner/runner-renderer-host-fixtures');
  return fixtures.createSnippetFillInModalMock();
});

import { TFile } from 'obsidian';
import type { ProtocolGraph, RPEdge, RPNode } from '../../graph/graph-model';
import { RunnerSessionHost } from '../../views/runner-session-host';

const box = { x: 0, y: 0, width: 100, height: 60 };

function makeGraph(fileBound: boolean): ProtocolGraph {
  const nodes = new Map<string, RPNode>([
    ['start', { ...box, id: 'start', kind: 'start' }],
    ['loop', { ...box, id: 'loop', kind: 'question', questionText: 'Repeat?', loop: true }],
    ['snippet', {
      ...box,
      id: 'snippet',
      kind: 'snippet',
      ...(fileBound
        ? { radiprotocol_snippetPath: 'abdomen/ct.md', snippetLabel: 'Abd CT' }
        : { subfolderPath: 'Findings/Chest' }),
    }],
    ['end', { ...box, id: 'end', kind: 'text-block', content: 'Done' }],
  ]);
  const edges: RPEdge[] = [
    { id: 'start-loop', fromNodeId: 'start', toNodeId: 'loop' },
    { id: 'loop-snippet', fromNodeId: 'loop', toNodeId: 'snippet' },
    { id: 'snippet-loop', fromNodeId: 'snippet', toNodeId: 'loop' },
    { id: 'loop-end', fromNodeId: 'loop', toNodeId: 'end', label: 'Finish', isLoopExit: true },
  ];
  const adjacency = new Map<string, string[]>();
  const reverseAdjacency = new Map<string, string[]>();
  for (const edge of edges) {
    adjacency.set(edge.fromNodeId, [...(adjacency.get(edge.fromNodeId) ?? []), edge.toNodeId]);
    reverseAdjacency.set(edge.toNodeId, [...(reverseAdjacency.get(edge.toNodeId) ?? []), edge.fromNodeId]);
  }
  return {
    canvasFilePath: 'Protocols/test.rp.json',
    nodes,
    edges,
    adjacency,
    reverseAdjacency,
    startNodeId: 'start',
  };
}

async function mount(fileBound: boolean) {
  const plugin = makeBasePlugin();
  const app = makeBaseApp(plugin);
  const protocol = new (TFile as any)('Protocols/test.rp.json');
  const target = new (TFile as any)('notes/target.md');
  app.vault.getAbstractFileByPath.mockImplementation((path: string) => {
    if (path === protocol.path) return protocol;
    if (path === 'Snippets/abdomen/ct.md' || path === 'Snippets/report.md') {
      return new (TFile as any)(path);
    }
    return null;
  });
  app.vault.read.mockImplementation(async (file: { path: string }) =>
    file.path === protocol.path ? '{}' : '');
  plugin.protocolDocumentParser.parse.mockReturnValue({ success: true, graph: makeGraph(fileBound) });
  const host = new RunnerSessionHost({
    app: app as any,
    protocolPath: protocol.path,
    targetNote: target,
    protocolDocumentStore: plugin.protocolDocumentStore as any,
    protocolDocumentParser: plugin.protocolDocumentParser as any,
    snippetService: plugin.snippetService as any,
    getTextSeparator: () => 'newline',
    getSnippetFolderPath: () => 'Snippets',
    withTargetNoteLock: async (_path, operation) => operation(),
    t: plugin.i18n.t.bind(plugin.i18n),
    notify: vi.fn(),
    onRequestClose: vi.fn(),
  });
  const root = makeEl('div');
  expect(await host.mount(root as unknown as HTMLElement)).toBe(true);
  return { host, root, plugin };
}

beforeEach(() => resetPickerMockInstances());

describe('floating parity through RunnerSessionHost loop branches', () => {
  it('routes a file-bound loop body to snippet resolution, never the tree picker', async () => {
    const h = await mount(true);
    h.plugin.snippetService.resolveSnippet.mockResolvedValue({ status: 'missing' });
    const body = h.root.querySelector('.rp-loop-body-btn')!;
    expect(body._text).toBe('📄 Abd CT');

    body.dispatchEvent({ type: 'click' });
    await Promise.resolve();
    await Promise.resolve();

    expect(h.plugin.snippetService.resolveSnippet).toHaveBeenCalledWith('abdomen/ct.md');
    expect(getPickerMockInstances()).toHaveLength(0);
  });

  it('keeps a directory-bound loop body on the neutral tree picker path', async () => {
    const h = await mount(false);
    const body = h.root.querySelector('.rp-loop-body-btn')!;
    expect(body._text).toBe('snippet (Findings/Chest)');

    body.dispatchEvent({ type: 'click' });
    await Promise.resolve();

    expect(getPickerMockInstances()).toHaveLength(1);
    expect(h.root.querySelector('.rp-stp-runner-session-host')).not.toBeNull();
    expect(h.plugin.snippetService.resolveSnippet).not.toHaveBeenCalled();
  });
});
```

#### 14. src/__tests__/views/inline-runner-modal-output-toolbar.test.ts
**File**: src/__tests__/views/inline-runner-modal-output-toolbar.test.ts
**Changes**: MODIFY — retarget footer/progress/self-check projection assertions to the shared host.

```ts
import { describe, expect, it, vi } from 'vitest';
import { makeBaseApp, makeBasePlugin, makeEl, type MockEl } from '../runner/runner-renderer-host-fixtures';

vi.mock('obsidian', async () => {
  const fixtures = await import('../runner/runner-renderer-host-fixtures');
  return fixtures.createObsidianModuleMock();
});
vi.mock('../../views/snippet-tree-picker', async () => {
  const fixtures = await import('../runner/runner-renderer-host-fixtures');
  return fixtures.createSnippetTreePickerMock();
});
vi.mock('../../views/snippet-fill-in-modal', async () => {
  const fixtures = await import('../runner/runner-renderer-host-fixtures');
  return fixtures.createSnippetFillInModalMock();
});

import { TFile } from 'obsidian';
import type { ProtocolGraph, RPNode } from '../../graph/graph-model';
import type { RunnerState } from '../../runner/runner-state';
import { RunnerSessionHost } from '../../views/runner-session-host';

function makeGraph(): ProtocolGraph {
  const nodes = new Map<string, RPNode>([
    ['start', { id: 'start', kind: 'start', x: 0, y: 0, width: 100, height: 60 }],
    ['question', {
      id: 'question', kind: 'question', questionText: 'Choose',
      x: 0, y: 60, width: 100, height: 60,
    }],
    ['answer', {
      id: 'answer', kind: 'answer', answerText: 'Finding',
      x: 0, y: 120, width: 100, height: 60,
    }],
    ['loop', {
      id: 'loop', kind: 'question', questionText: 'Repeat?', loop: true,
      x: 0, y: 180, width: 100, height: 60,
    }],
    ['body', {
      id: 'body', kind: 'answer', answerText: 'Again',
      x: 0, y: 240, width: 100, height: 60,
    }],
    ['end', {
      id: 'end', kind: 'text-block', content: 'Done',
      x: 120, y: 240, width: 100, height: 60,
    }],
  ]);
  const edges = [
    { id: 'start-question', fromNodeId: 'start', toNodeId: 'question' },
    { id: 'question-answer', fromNodeId: 'question', toNodeId: 'answer' },
    { id: 'answer-loop', fromNodeId: 'answer', toNodeId: 'loop' },
    { id: 'loop-body', fromNodeId: 'loop', toNodeId: 'body' },
    { id: 'body-loop', fromNodeId: 'body', toNodeId: 'loop' },
    { id: 'loop-exit', fromNodeId: 'loop', toNodeId: 'end', label: 'Exit', isLoopExit: true },
  ];
  return {
    canvasFilePath: 'Protocols/test.rp.json',
    nodes,
    edges,
    adjacency: new Map([
      ['start', ['question']],
      ['question', ['answer']],
      ['answer', ['loop']],
      ['loop', ['body', 'end']],
      ['body', ['loop']],
    ]),
    reverseAdjacency: new Map([
      ['question', ['start']],
      ['answer', ['question']],
      ['loop', ['answer', 'body']],
      ['body', ['loop']],
      ['end', ['loop']],
    ]),
    startNodeId: 'start',
  };
}

async function mountedHost() {
  const plugin = makeBasePlugin();
  const app = makeBaseApp(plugin);
  const protocol = new (TFile as any)('Protocols/test.rp.json');
  const target = new (TFile as any)('notes/target.md');
  app.vault.getAbstractFileByPath.mockImplementation((path: string) => {
    if (path === protocol.path) return protocol;
    if (path === 'Snippets/report.md') return new (TFile as any)(path);
    return null;
  });
  app.vault.read.mockImplementation(async (file: { path: string }) =>
    file.path === protocol.path
      ? JSON.stringify({ selfCheckEnabled: true, selfCheckItems: ['Review'] })
      : '');
  plugin.protocolDocumentParser.parse.mockReturnValue({ success: true, graph: makeGraph() });
  const host = new RunnerSessionHost({
    app: app as any,
    protocolPath: protocol.path,
    targetNote: target,
    protocolDocumentStore: plugin.protocolDocumentStore as any,
    protocolDocumentParser: plugin.protocolDocumentParser as any,
    snippetService: plugin.snippetService as any,
    getTextSeparator: () => 'newline',
    getSnippetFolderPath: () => 'Snippets',
    withTargetNoteLock: async (_path, operation) => operation(),
    t: plugin.i18n.t.bind(plugin.i18n),
    notify: vi.fn(),
    onRequestClose: vi.fn(),
  });
  const root = makeEl('div');
  expect(await host.mount(root as unknown as HTMLElement)).toBe(true);
  return { host, root };
}

const forbidden = ['.rp-copy-btn', '.rp-save-btn', '.rp-insert-btn', '.rp-output-toolbar'];

function expectToolbarAbsent(root: MockEl): void {
  for (const selector of forbidden) expect(root.querySelectorAll(selector)).toHaveLength(0);
}

describe('RunnerSessionHost common output projection', () => {
  it('keeps the legacy output toolbar absent in every runner state', async () => {
    const h = await mountedHost();
    const states: RunnerState[] = [
      { status: 'idle' },
      { status: 'at-node', currentNodeId: 'question', accumulatedText: '', canStepBack: false, canRedo: false, undoStackSize: 0 },
      { status: 'awaiting-snippet-pick', nodeId: 'question', subfolderPath: undefined, accumulatedText: '', canStepBack: false, canRedo: false, undoStackSize: 0 },
      { status: 'awaiting-loop-pick', nodeId: 'loop', accumulatedText: '', canStepBack: true, canRedo: false, undoStackSize: 1 },
      { status: 'awaiting-snippet-fill', nodeId: 'question', snippetId: 'missing', accumulatedText: '', canStepBack: true, canRedo: false, undoStackSize: 1 },
      { status: 'complete', finalText: 'Done' },
      { status: 'error', message: 'Broken' },
    ];
    vi.spyOn((h.host as any).options.snippetService, 'resolveSnippet').mockResolvedValue({ status: 'missing' });
    const stateSpy = vi.spyOn((h.host as any).runner, 'getState');
    for (const state of states) {
      stateSpy.mockReturnValue(state);
      (h.host as any).render();
      expectToolbarAbsent(h.root);
    }
  });

  it('projects neutral progress, footer controls, self-check, and error classes', async () => {
    const h = await mountedHost();
    expect(h.root.querySelector('.rp-runner-session-progress')).not.toBeNull();
    expect(h.root.querySelector('.rp-runner-session-footer')).not.toBeNull();
    expect(h.root.querySelector('.rp-runner-session-close-btn')).not.toBeNull();

    vi.spyOn((h.host as any).runner, 'getState').mockReturnValue({
      status: 'complete', finalText: 'Done',
    });
    (h.host as any).render();
    expect(h.root.querySelector('.rp-runner-session-self-check')).not.toBeNull();

    vi.spyOn((h.host as any).runner, 'getState').mockReturnValue({
      status: 'error', message: 'Broken',
    });
    (h.host as any).render();
    expect(h.root.querySelector('.rp-error-panel')).not.toBeNull();
    expectToolbarAbsent(h.root);
  });
});
```

#### 15. src/i18n/locales/en.json
**File**: src/i18n/locales/en.json
**Changes**: MODIFY — add localized bound-note write failure copy used by the shared session host.

```json
    "noteWriteFailed": "Could not write protocol output to the bound note.",
    "snippetLoadFailed": "Could not load the selected snippet. Go back and try again."
```

#### 16. src/i18n/locales/ru.json
**File**: src/i18n/locales/ru.json
**Changes**: MODIFY — add matching Russian bound-note write failure copy.

```json
    "noteWriteFailed": "Не удалось записать результат протокола в связанную заметку.",
    "snippetLoadFailed": "Не удалось загрузить выбранный сниппет. Вернитесь назад и попробуйте снова."
```

### Success Criteria:

#### Automated Verification:
- [x] Phase 1 is applied first, then focused Phase 2 suites pass: `npx vitest run src/__tests__/views/runner-session-host.test.ts src/__tests__/views/inline-runner-modal.test.ts src/__tests__/views/inline-runner-modal-keyboard.test.ts src/__tests__/views/inline-runner-modal-loop-body-file-bound.test.ts src/__tests__/views/inline-runner-modal-output-toolbar.test.ts src/__tests__/runner/render-snippet-picker.test.ts src/__tests__/inline-runner-layout.test.ts src/__tests__/views/inline-runner-position.test.ts`
- [x] Strict TypeScript checking passes: `npx tsc --noEmit --pretty false`
- [x] Phase-owned TypeScript and CSS pass scoped lint: `npx eslint src/views/runner-session-host.ts src/views/inline-runner-modal.ts src/constants/css-classes.ts src/runner/render/render-snippet-picker.ts src/__tests__/runner/runner-renderer-host-fixtures.ts src/__tests__/views/runner-session-host.test.ts src/__tests__/views/inline-runner-modal.test.ts src/__tests__/views/inline-runner-modal-keyboard.test.ts src/__tests__/views/inline-runner-modal-loop-body-file-bound.test.ts src/__tests__/views/inline-runner-modal-output-toolbar.test.ts esbuild.config.mjs && npx stylelint src/styles/runner-session.css src/styles/inline-runner.css src/styles/snippet-tree-picker.css`
- [x] Locale catalogs retain parity and the shared write-failure key: `node --input-type=module -e "import fs from 'node:fs'; import assert from 'node:assert/strict'; const en=JSON.parse(fs.readFileSync('src/i18n/locales/en.json','utf8')); const ru=JSON.parse(fs.readFileSync('src/i18n/locales/ru.json','utf8')); const leaves=(value,prefix='',out=[])=>{for(const [key,child] of Object.entries(value)){const path=prefix?prefix+'.'+key:key;if(child!==null&&typeof child==='object')leaves(child,path,out);else out.push(path);}return out.sort();}; assert.deepEqual(leaves(en),leaves(ru)); for(const key of ['noteWriteFailed','snippetLoadFailed']){assert.equal(typeof en.inlineRunner[key],'string');assert.equal(typeof ru.inlineRunner[key],'string');}"`
- [x] Read-only deterministic CSS registration/source check passes: `node --input-type=module -e "import fs from 'node:fs'; import assert from 'node:assert/strict'; const config=fs.readFileSync('esbuild.config.mjs','utf8'); const body=/const CSS_FILES = \\[([\\s\\S]*?)\\];/.exec(config)?.[1]; assert.ok(body); const names=[...body.matchAll(/'([^']+)'/g)].map(match=>match[1]); assert.ok(names.indexOf('runner-session')>=0); assert.ok(names.indexOf('runner-session')<names.indexOf('inline-runner')); for (const name of ['runner-session','inline-runner']) assert.ok(fs.existsSync('src/styles/'+name+'.css')); const session=fs.readFileSync('src/styles/runner-session.css','utf8'); const picker=fs.readFileSync('src/styles/snippet-tree-picker.css','utf8'); assert.match(session,/\\.rp-runner-session-root/); assert.match(session,/\\.rp-stp-runner-session-host/); assert.match(picker,/\\.rp-stp-runner-session-host \\.rp-stp-root/); assert.match(picker,/\\.rp-stp-runner-session-host \\.rp-stp-body/); assert.match(picker,/\\.rp-stp-runner-session-host \\.rp-stp-list/);"`

#### Manual Verification:
- [ ] Launch a floating run and confirm question, loop, directory-snippet picker, file-bound snippet fill, Back, Redo, Skip, progress, errors, and self-check match the pre-extraction behavior.
- [ ] Confirm the floating panel still restores/cascades, drags, resizes, reclamps, focuses, hides when another note is active, reappears on the bound note, and closes when the bound note leaf closes.
- [ ] Open a placeholder fill modal, switch active leaves, and confirm the floating panel remains visible until the child modal resolves; cancel and Escape advance with empty snippet output.
- [ ] Run against a note whose saved content already ends in the configured separator and confirm the first appended delta does not duplicate that separator.
- [ ] Delete the bound target note and confirm the host requests shell close immediately with no subsequent render or note write.
- [ ] Close during protocol loading, snippet loading/resolution, fill completion, a pending note read, and scheduled completion; confirm no stale UI, write, modal, or close callback is committed.
- [ ] Confirm no output toolbar appears in any runner state and no Phase 3 textarea/free-text draft controls appear.
- [ ] Inspect the diff and confirm only the 14 Phase 2 owned source/test files changed; `main.js`, `styles.css`, settings, sidebar routing, editor behavior, and locales remain untouched.

## Phase 3: Free-text Runner Controls and Drafts

### Overview
Adds the complete free-text interaction to the shared runtime UI and therefore to the floating shell; depends on Phases 1 and 2.

### Changes Required:

#### 1. src/runner/render/render-question.ts
**File**: src/runner/render/render-question.ts
**Changes**: MODIFY — render preset buttons or free-text controls in authored position with draft, submit, alert, auto-grow, and focus ports.

Replace the file with the complete Phase 3 renderer below. The preset-only `appendAnswerButton()` implementation is unchanged; the new wrapper dispatches flagged Answers to the free-text projection.

```ts
// runner/render/render-question.ts
// Phase 87 — 2-zone render: textZone (question text, choices text, errors) + actionZone (answer/snippet buttons).
import { orderedOutgoingEdges } from '../../graph/edge-order';
import { nodeLabel } from '../../graph/node-label';
import type { AnswerNode, ProtocolGraph, RPEdge, SnippetNode } from '../../graph/graph-model';
import type { Translator } from '../../i18n';
import { createButton, createTextarea } from '../../utils/dom-helpers';
import type { RunnerState } from '../runner-state';
import { isFileBoundSnippetNode, snippetBranchLabel } from '../snippet-label';

type AtNodeState = Extract<RunnerState, { status: 'at-node' }>;

type RenderQuestionResult = 'rendered' | 'not-question' | 'error';

interface FreeTextControl {
  answerId: string;
  textarea: HTMLTextAreaElement;
}

export interface QuestionBranchHost {
  bindClick(el: HTMLElement, handler: (ev: MouseEvent) => void): void;
  bindInput(el: HTMLTextAreaElement, handler: (ev: Event) => void): void;
  bindKeydown(el: HTMLTextAreaElement, handler: (ev: KeyboardEvent) => void): void;
  scheduleTextareaResize(textarea: HTMLTextAreaElement, resize: () => void): void;
  renderError(messages: string[]): void;
  getAnswerDraft(answerId: string): string;
  onAnswerDraftChange(answerNode: AnswerNode, value: string): boolean;
  getAnswerError(answerId: string): string | undefined;
  onSubmitFreeText(answerNode: AnswerNode, value: string): void | Promise<void>;
  getAnswerFocusRequest(): string | null;
  requestAnswerFocus(
    answerId: string,
    textarea: HTMLTextAreaElement,
    explicitRequest: boolean,
  ): void;
  onChooseAnswer(answerNode: AnswerNode): void | Promise<void>;
  onChooseSnippetBranch(snippetNode: SnippetNode, isFileBound: boolean): void | Promise<void>;
  onChooseQuestionBranch(edge: RPEdge): void | Promise<void>;
  t: Translator;
}

// Shared per-kind button construction for both the grouped fallback and the
// interleaved authored-order path so the CSS class, caption source, and
// callback payload are byte-for-byte identical — only the container/iteration
// order differs between the two render paths.
function appendAnswerButton(parent: HTMLElement, answerNode: AnswerNode, host: QuestionBranchHost): void {
  const btn = createButton(parent, {
    cls: 'rp-answer-btn',
    text: answerNode.displayLabel ?? answerNode.answerText,
  });
  host.bindClick(btn, () => {
    void host.onChooseAnswer(answerNode);
  });
}

function growTextarea(textarea: HTMLTextAreaElement): void {
  textarea.setCssProps({ height: 'auto' });
  textarea.setCssProps({ height: `${textarea.scrollHeight}px` });
}

function appendFreeTextAnswer(
  parent: HTMLElement,
  answerNode: AnswerNode,
  host: QuestionBranchHost,
): FreeTextControl {
  const row = parent.createDiv({ cls: 'rp-free-text-answer' });
  const label = row.createEl('label', { cls: 'rp-free-text-answer-label' });
  label.createSpan({
    cls: 'rp-free-text-answer-prompt',
    text: answerNode.displayLabel ?? answerNode.answerText,
  });

  const textarea = createTextarea(label, {
    cls: 'rp-free-text-answer-textarea',
  });
  textarea.value = host.getAnswerDraft(answerNode.id);

  let alertElement: HTMLElement | null = null;
  const error = host.getAnswerError(answerNode.id);
  if (error !== undefined) {
    textarea.setAttribute('aria-invalid', 'true');
    alertElement = row.createEl('p', {
      cls: 'rp-free-text-answer-error',
      text: error,
      attr: { role: 'alert' },
    });
  }

  const controls = row.createDiv({ cls: 'rp-free-text-answer-controls' });
  const submitButton = createButton(controls, {
    cls: 'rp-free-text-answer-submit',
    text: host.t('protocolRunner.freeTextSubmit'),
    attr: { type: 'button' },
  });

  host.bindInput(textarea, () => {
    const value = textarea.value;
    if (!host.onAnswerDraftChange(answerNode, value)) return;
    textarea.removeAttribute('aria-invalid');
    if (alertElement !== null) {
      alertElement.remove();
      alertElement = null;
    }
    growTextarea(textarea);
  });
  host.bindKeydown(textarea, (event) => {
    if (event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey)) return;
    event.preventDefault();
    void host.onSubmitFreeText(answerNode, textarea.value);
  });
  host.bindClick(submitButton, () => {
    void host.onSubmitFreeText(answerNode, textarea.value);
  });

  host.scheduleTextareaResize(textarea, () => growTextarea(textarea));
  return { answerId: answerNode.id, textarea };
}

function appendAnswerOption(
  parent: HTMLElement,
  answerNode: AnswerNode,
  host: QuestionBranchHost,
): FreeTextControl | null {
  if (answerNode.freeText === true) {
    return appendFreeTextAnswer(parent, answerNode, host);
  }
  appendAnswerButton(parent, answerNode, host);
  return null;
}

function appendQuestionTransitionButton(parent: HTMLElement, edge: RPEdge, graph: ProtocolGraph, host: QuestionBranchHost): void {
  const target = graph.nodes.get(edge.toNodeId);
  const fallbackCaption = target !== undefined
    ? nodeLabel(target).trim() || edge.toNodeId
    : edge.toNodeId;
  const caption = edge.label !== undefined && edge.label.trim() !== ''
    ? edge.label
    : fallbackCaption;
  const btn = createButton(parent, {
    cls: 'rp-question-transition-btn',
    text: caption,
  });
  host.bindClick(btn, () => {
    void host.onChooseQuestionBranch(edge);
  });
}

function appendSnippetBranchButton(parent: HTMLElement, snippetNode: SnippetNode, host: QuestionBranchHost): void {
  const isFileBound = isFileBoundSnippetNode(snippetNode);
  const btn = createButton(parent, {
    cls: 'rp-snippet-branch-btn',
    text: snippetBranchLabel(snippetNode),
  });
  host.bindClick(btn, () => {
    void host.onChooseSnippetBranch(snippetNode, isFileBound);
  });
}

function requestProjectedAnswerFocus(
  controls: FreeTextControl[],
  actionableOptionCount: number,
  host: QuestionBranchHost,
): void {
  const requestedAnswerId = host.getAnswerFocusRequest();
  for (const control of controls) {
    const isExplicitRequest = requestedAnswerId === control.answerId;
    const isSoleFreeTextAction = requestedAnswerId === null
      && actionableOptionCount === 1;
    if (isExplicitRequest || isSoleFreeTextAction) {
      host.requestAnswerFocus(
        control.answerId,
        control.textarea,
        isExplicitRequest,
      );
    }
  }
}

export function renderQuestionAtNode(
  textZone: HTMLElement,
  actionZone: HTMLElement,
  graph: ProtocolGraph | null,
  state: AtNodeState,
  host: QuestionBranchHost,
): RenderQuestionResult {
  if (graph === null) {
    host.renderError(['Internal error: graph not loaded.']);
    return 'error';
  }

  const node = graph.nodes.get(state.currentNodeId);
  if (node === undefined) {
    host.renderError([`Node "${state.currentNodeId}" not found in graph.`]);
    return 'error';
  }
  if (node.kind !== 'question') {
    return 'not-question';
  }

  textZone.createEl('p', {
    text: node.questionText,
    cls: 'rp-question-text',
  });

  let actionableOptionCount = 0;
  const freeTextControls: FreeTextControl[] = [];

  // Authored display order: when the question carries an `optionOrder`, render
  // its outgoing options as a single interleaved stack in that order (answers,
  // question transitions, snippet branches interleaved). Per-kind preset button
  // construction stays shared with the grouped fallback; a free-text Answer is
  // one direct child at the same authored position.
  if (node.optionOrder !== undefined) {
    const orderedEdges = orderedOutgoingEdges(graph, state.currentNodeId);
    if (orderedEdges.length > 0) {
      const optionList = actionZone.createDiv({ cls: 'rp-option-list rp-stack' });
      optionList.setCssProps({ 'margin-top': 'var(--size-4-3)' });
      for (const edge of orderedEdges) {
        const target = graph.nodes.get(edge.toNodeId);
        if (target === undefined) continue;
        if (target.kind === 'answer') {
          actionableOptionCount += 1;
          const control = appendAnswerOption(optionList, target, host);
          if (control !== null) freeTextControls.push(control);
        } else if (target.kind === 'question') {
          actionableOptionCount += 1;
          appendQuestionTransitionButton(optionList, edge, graph, host);
        } else if (target.kind === 'snippet') {
          actionableOptionCount += 1;
          appendSnippetBranchButton(optionList, target, host);
        }
      }
    }
    requestProjectedAnswerFocus(freeTextControls, actionableOptionCount, host);
    return 'rendered';
  }

  // Phase 31: partition outgoing neighbors into answer + snippet branches.
  const neighborIds = graph.adjacency.get(state.currentNodeId) ?? [];
  const answerNeighbors: AnswerNode[] = [];
  const snippetNeighbors: SnippetNode[] = [];
  for (const nid of neighborIds) {
    const neighbor = graph.nodes.get(nid);
    if (neighbor === undefined) continue;
    if (neighbor.kind === 'answer') answerNeighbors.push(neighbor);
    else if (neighbor.kind === 'snippet') snippetNeighbors.push(neighbor);
  }

  if (answerNeighbors.length > 0) {
    const answerList = actionZone.createDiv({ cls: 'rp-answer-list rp-stack' });
    answerList.setCssProps({ 'margin-top': 'var(--size-4-3)' });
    for (const answerNode of answerNeighbors) {
      actionableOptionCount += 1;
      const control = appendAnswerOption(answerList, answerNode, host);
      if (control !== null) freeTextControls.push(control);
    }
  }

  // Direct Question transitions are edge-sensitive: preserve persisted edge
  // order, caption, and identity rather than reducing them to adjacency IDs.
  const questionEdges = graph.edges.filter((edge) => {
    if (edge.fromNodeId !== state.currentNodeId) return false;
    return graph.nodes.get(edge.toNodeId)?.kind === 'question';
  });

  if (questionEdges.length > 0) {
    const transitionList = actionZone.createDiv({ cls: 'rp-question-transition-list' });
    if (answerNeighbors.length === 0) {
      transitionList.setCssProps({ 'margin-top': 'var(--size-4-3)' });
    }
    for (const edge of questionEdges) {
      actionableOptionCount += 1;
      appendQuestionTransitionButton(transitionList, edge, graph, host);
    }
  }

  if (snippetNeighbors.length > 0) {
    // Phase 31 D-02: snippet branches render below answers, visually distinct.
    const snippetList = actionZone.createDiv({ cls: 'rp-snippet-branch-list' });
    if (answerNeighbors.length === 0) {
      snippetList.setCssProps({ 'margin-top': 'var(--size-4-3)' });
    }
    for (const snippetNode of snippetNeighbors) {
      actionableOptionCount += 1;
      appendSnippetBranchButton(snippetList, snippetNode, host);
    }
  }

  requestProjectedAnswerFocus(freeTextControls, actionableOptionCount, host);
  return 'rendered';
}
```

#### 2. src/views/runner-session-host.ts
**File**: src/views/runner-session-host.ts
**Changes**: MODIFY — own Answer drafts/errors, submit payloads through the runner, append deltas, and preserve drafts across rerenders.

Add the session-owned transient state beside the existing Phase 2 timers:

```ts
  private readonly answerDrafts = new Map<string, string>();
  private readonly answerErrors = new Map<string, string>();
  private answerFocusRequest: string | null = null;
  private answerFocusTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
  private readonly initiallyFocusedAnswers = new Set<string>();
  private readonly textareaResizeTimers = new Set<ReturnType<typeof globalThis.setTimeout>>();
```

In `dispose()`, replace the timer/child cleanup block and append the map cleanup before the method returns. This keeps drafts alive across every render but not beyond the session lifetime:

```ts
    this.mounted = false;
    ++this.lifecycleGeneration;
    ++this.operationGeneration;
    this.clearCompletionTimer();
    this.clearAnswerFocusTimer();
    this.clearTextareaResizeTimers();
    this.disposeSnippetPicker();
    this.closeFillModal();
```

```ts
    this.graph = null;
    this.selfCheckItems = [];
    this.selfCheckEnabled = false;
    this.answerDrafts.clear();
    this.answerErrors.clear();
    this.answerFocusRequest = null;
    this.initiallyFocusedAnswers.clear();
```

At the start of `render()`, extend the existing operation setup so every destructive render cancels the preceding deferred focus without changing Phase 2 lifecycle or operation generation semantics:

```ts
    const lifecycleGeneration = this.lifecycleGeneration;
    const operationGeneration = ++this.operationGeneration;
    this.clearCompletionTimer();
    this.clearAnswerFocusTimer();
    this.clearTextareaResizeTimers();
    this.disposeSnippetPicker();
    this.closeFillModal();
```

Immediately after the existing `const state = this.runner.getState();` line, reconcile any explicit error-focus request with the newly projected question before rendering controls:

```ts
    const state = this.runner.getState();
    this.reconcileAnswerFocusRequest(state);
```

Inside the `at-node` renderer host object, replace the existing object with this complete Phase 3 port wiring:

```ts
          {
            bindClick: (element, handler) => element.addEventListener('click', handler),
            bindInput: (element, handler) => element.addEventListener('input', handler),
            bindKeydown: (element, handler) => element.addEventListener('keydown', handler),
            scheduleTextareaResize: (textarea, resize) => {
              this.deferTextareaResize(
                textarea,
                resize,
                lifecycleGeneration,
                operationGeneration,
              );
            },
            renderError: (messages) => this.renderError(messages),
            getAnswerDraft: (answerId) => this.answerDrafts.get(answerId) ?? '',
            onAnswerDraftChange: (answerNode, value) => {
              if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return false;
              this.handleAnswerDraftChange(answerNode.id, value);
              return true;
            },
            getAnswerError: (answerId) => this.answerErrors.get(answerId),
            onSubmitFreeText: (answerNode, submittedText) => {
              if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
              return this.handleAnswerClick(answerNode, submittedText);
            },
            getAnswerFocusRequest: () => this.answerFocusRequest,
            requestAnswerFocus: (answerId, textarea, explicitRequest) => {
              this.deferAnswerFocus(
                answerId,
                textarea,
                explicitRequest,
                lifecycleGeneration,
                operationGeneration,
              );
            },
            onChooseAnswer: (answerNode) => {
              if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
              return this.handleAnswerClick(answerNode);
            },
            onChooseQuestionBranch: (edge) => {
              if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
              this.runner.chooseQuestionBranch(edge.id);
              this.render();
            },
            onChooseSnippetBranch: (snippetNode, isFileBound) => {
              if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
              if (isFileBound) {
                this.runner.pickFileBoundSnippet(
                  state.currentNodeId,
                  snippetNode.id,
                  snippetNode.radiprotocol_snippetPath as string,
                );
              } else {
                this.runner.chooseSnippetBranch(snippetNode.id);
              }
              this.render();
            },
            t: this.options.t,
          },
```

Replace the Phase 2 `handleAnswerClick()` with the following methods. The accepted write remains lifecycle-owned, while only the follow-up render is operation-current:

```ts
  private handleAnswerDraftChange(answerId: string, value: string): void {
    this.answerDrafts.set(answerId, value);
    this.answerErrors.delete(answerId);
    if (this.answerFocusRequest === answerId) this.answerFocusRequest = null;
    this.initiallyFocusedAnswers.add(answerId);
    this.clearAnswerFocusTimer();
  }

  private async handleAnswerClick(
    answerNode: AnswerNode,
    submittedText?: string,
  ): Promise<void> {
    const lifecycleGeneration = this.lifecycleGeneration;
    const operationGeneration = this.operationGeneration;
    this.clearAnswerFocusTimer();
    this.answerFocusRequest = null;

    if (
      answerNode.freeText === true
      && (submittedText === undefined || submittedText.trim() === '')
    ) {
      this.answerErrors.set(
        answerNode.id,
        this.options.t('protocolRunner.freeTextBlankError'),
      );
      this.answerFocusRequest = answerNode.id;
      this.render();
      return;
    }

    const beforeText = this.extractAccumulatedText(this.runner.getState());
    const accepted = this.runner.chooseAnswer(answerNode.id, submittedText);
    if (!accepted) return;

    if (answerNode.freeText === true) {
      this.answerDrafts.delete(answerNode.id);
      this.answerErrors.delete(answerNode.id);
      if (this.answerFocusRequest === answerNode.id) this.answerFocusRequest = null;
    }

    const delta = this.captureAccumulatorDelta(beforeText);
    await this.appendToTargetNote(delta, lifecycleGeneration);
    if (this.isOperationCurrent(lifecycleGeneration, operationGeneration)) this.render();
  }

  private reconcileAnswerFocusRequest(state: RunnerState): void {
    if (this.answerFocusRequest === null) return;
    if (state.status !== 'at-node') {
      this.answerFocusRequest = null;
      return;
    }
    const outgoing = this.graph?.adjacency.get(state.currentNodeId) ?? [];
    if (!outgoing.includes(this.answerFocusRequest)) this.answerFocusRequest = null;
  }

  private deferAnswerFocus(
    answerId: string,
    textarea: HTMLTextAreaElement,
    explicitRequest: boolean,
    lifecycleGeneration: number,
    operationGeneration: number,
  ): void {
    if (explicitRequest) {
      if (this.answerFocusRequest !== answerId) return;
    } else if (this.initiallyFocusedAnswers.has(answerId)) {
      return;
    }

    this.clearAnswerFocusTimer();
    this.answerFocusTimer = globalThis.setTimeout(() => {
      this.answerFocusTimer = null;
      if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
      if (this.rootEl === null || !this.rootEl.contains(textarea)) return;
      if (explicitRequest && this.answerFocusRequest !== answerId) return;
      textarea.focus();
      if (explicitRequest && this.answerFocusRequest === answerId) {
        this.answerFocusRequest = null;
      }
      this.initiallyFocusedAnswers.add(answerId);
    }, 0);
  }

  private deferTextareaResize(
    textarea: HTMLTextAreaElement,
    resize: () => void,
    lifecycleGeneration: number,
    operationGeneration: number,
  ): void {
    const timer = globalThis.setTimeout(() => {
      this.textareaResizeTimers.delete(timer);
      if (!this.isOperationCurrent(lifecycleGeneration, operationGeneration)) return;
      if (this.rootEl === null || !this.rootEl.contains(textarea)) return;
      resize();
    }, 0);
    this.textareaResizeTimers.add(timer);
  }

  private clearTextareaResizeTimers(): void {
    for (const timer of this.textareaResizeTimers) globalThis.clearTimeout(timer);
    this.textareaResizeTimers.clear();
  }

  private clearAnswerFocusTimer(): void {
    if (this.answerFocusTimer === null) return;
    globalThis.clearTimeout(this.answerFocusTimer);
    this.answerFocusTimer = null;
  }
```

#### 3. src/styles/runner-session.css
**File**: src/styles/runner-session.css
**Changes**: MODIFY — style full-height textarea rows, Submit controls, alerts, and outer host scrolling.

Append these Phase 3 rules to the approved Phase 2 shared session stylesheet:

```css
.rp-runner-session-actions .rp-free-text-answer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: end;
  gap: var(--size-2-2);
  box-sizing: border-box;
  width: 100%;
  max-width: 100%;
  padding: var(--size-4-2);
  border: 1px solid var(--background-modifier-border);
  border-radius: var(--radius-s);
  background: var(--background-secondary);
}

.rp-runner-session-actions .rp-free-text-answer-label {
  display: flex;
  grid-column: 1;
  flex-direction: column;
  gap: var(--size-2-2);
  min-width: 0;
}

.rp-runner-session-actions .rp-free-text-answer-prompt {
  overflow-wrap: anywhere;
  color: var(--text-normal);
  font-weight: var(--font-medium);
  line-height: var(--line-height-tight);
  white-space: pre-wrap;
}

.rp-runner-session-actions .rp-free-text-answer-textarea {
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  min-height: 72px;
  height: auto;
  overflow-y: hidden;
  resize: none;
  white-space: pre-wrap;
}

.rp-runner-session-actions .rp-free-text-answer-textarea[aria-invalid="true"] {
  border-color: var(--text-error);
}

.rp-runner-session-actions .rp-free-text-answer-controls {
  display: flex;
  grid-column: 2;
  justify-content: flex-end;
}

.rp-runner-session-actions .rp-free-text-answer-submit {
  flex: 0 0 auto;
  min-height: 32px;
  padding-inline: var(--size-4-3);
}

.rp-runner-session-actions .rp-free-text-answer-error {
  grid-column: 1 / -1;
  margin: 0;
  color: var(--text-error);
  font-size: var(--font-ui-smaller);
  line-height: var(--line-height-tight);
}
```

#### 4. src/i18n/locales/en.json
**File**: src/i18n/locales/en.json
**Changes**: MODIFY — add English Submit and blank-entry copy.

Add these matching leaves inside the existing `protocolRunner` object:

```json
    "freeTextSubmit": "Submit",
    "freeTextBlankError": "Enter a value before submitting."
```

#### 5. src/i18n/locales/ru.json
**File**: src/i18n/locales/ru.json
**Changes**: MODIFY — add matching Russian Submit and blank-entry copy.

Add the same leaves inside the existing `protocolRunner` object:

```json
    "freeTextSubmit": "Отправить",
    "freeTextBlankError": "Введите текст перед отправкой."
```

#### 6. src/__tests__/runner/render-question.test.ts
**File**: src/__tests__/runner/render-question.test.ts
**Changes**: MODIFY — cover mixed order, ARIA, draft callbacks, resize, Mod+Enter, blank alert, and sole-action focus.

Replace the file with this complete updated renderer suite. It uses the approved Phase 2 shared `MockEl` and retains grouped, interleaved, and error/not-question coverage.

```ts
import { describe, expect, it, vi } from 'vitest';
import type { ProtocolGraph, RPEdge, RPNode } from '../../graph/graph-model';
import {
  renderQuestionAtNode,
  type QuestionBranchHost,
} from '../../runner/render/render-question';
import {
  findByClass,
  makeEl,
  type MockEl,
} from './runner-renderer-host-fixtures';

const state = {
  status: 'at-node' as const,
  currentNodeId: 'q',
  accumulatedText: 'before',
  canStepBack: true,
  canRedo: false,
  undoStackSize: 0,
};

function asHtml(element: MockEl): HTMLElement {
  return element as unknown as HTMLElement;
}

function className(element: MockEl): string {
  return Array.from(element.classList).join(' ');
}

function baseNode(id: string, kind: RPNode['kind'], extra: Partial<RPNode> = {}): RPNode {
  return {
    id,
    kind,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    ...(kind === 'question' ? { questionText: 'Pick one' } : {}),
    ...(kind === 'answer' ? { answerText: 'Answer text' } : {}),
    ...(kind === 'text-block' ? { content: 'Text' } : {}),
    ...(kind === 'loop-start' ? { loopLabel: 'Loop', exitLabel: 'Exit' } : {}),
    ...(kind === 'loop-end' ? { loopStartId: 'loop' } : {}),
    ...extra,
  } as RPNode;
}

function graphFrom(nodes: RPNode[], edges: RPEdge[]): ProtocolGraph {
  const adjacency = new Map<string, string[]>();
  const reverseAdjacency = new Map<string, string[]>();
  for (const edge of edges) {
    adjacency.set(edge.fromNodeId, [
      ...(adjacency.get(edge.fromNodeId) ?? []),
      edge.toNodeId,
    ]);
    reverseAdjacency.set(edge.toNodeId, [
      ...(reverseAdjacency.get(edge.toNodeId) ?? []),
      edge.fromNodeId,
    ]);
  }
  return {
    canvasFilePath: 'test.rp.json',
    nodes: new Map(nodes.map((node) => [node.id, node])),
    edges,
    adjacency,
    reverseAdjacency,
    startNodeId: 'q',
  };
}

function groupedGraph(current: RPNode = baseNode('q', 'question')): ProtocolGraph {
  const nodes = [
    current,
    baseNode('a1', 'answer', {
      answerText: 'Raw answer',
      displayLabel: 'Shown answer',
    }),
    baseNode('s-file', 'snippet', {
      radiprotocol_snippetPath: 'Chest/report.json',
    }),
    baseNode('s-dir', 'snippet', { snippetLabel: 'Folder label' }),
    baseNode('q-labeled', 'question', { questionText: 'Labeled target' }),
    baseNode('q-fallback', 'question', { questionText: 'Fallback question' }),
    baseNode('q-id', 'question', { questionText: '   ' }),
  ];
  return graphFrom(nodes, [
    { id: 'e-answer', fromNodeId: current.id, toNodeId: 'a1' },
    { id: 'e-file', fromNodeId: current.id, toNodeId: 's-file' },
    { id: 'e-dir', fromNodeId: current.id, toNodeId: 's-dir' },
    { id: 'e-fallback', fromNodeId: current.id, toNodeId: 'q-fallback' },
    {
      id: 'e-labeled',
      fromNodeId: current.id,
      toNodeId: 'q-labeled',
      label: 'Direct label',
    },
    {
      id: 'e-id',
      fromNodeId: current.id,
      toNodeId: 'q-id',
      label: '   ',
    },
  ]);
}

interface HostHarness {
  host: QuestionBranchHost;
  onChooseAnswer: ReturnType<typeof vi.fn>;
  onChooseSnippetBranch: ReturnType<typeof vi.fn>;
  onChooseQuestionBranch: ReturnType<typeof vi.fn>;
  onAnswerDraftChange: ReturnType<typeof vi.fn>;
  onSubmitFreeText: ReturnType<typeof vi.fn>;
  requestAnswerFocus: ReturnType<typeof vi.fn>;
  renderError: ReturnType<typeof vi.fn>;
}

function hostHarness(options: {
  drafts?: Record<string, string>;
  errors?: Record<string, string>;
  focusRequest?: string | null;
} = {}): HostHarness {
  const onChooseAnswer = vi.fn();
  const onChooseSnippetBranch = vi.fn();
  const onChooseQuestionBranch = vi.fn();
  const onAnswerDraftChange = vi.fn(() => true);
  const onSubmitFreeText = vi.fn();
  const requestAnswerFocus = vi.fn();
  const renderError = vi.fn();
  return {
    host: {
      bindClick: (element, handler) => element.addEventListener('click', handler),
      bindInput: (element, handler) => element.addEventListener('input', handler),
      bindKeydown: (element, handler) => element.addEventListener('keydown', handler),
      scheduleTextareaResize: (_textarea, resize) => resize(),
      renderError,
      getAnswerDraft: (answerId) => options.drafts?.[answerId] ?? '',
      onAnswerDraftChange,
      getAnswerError: (answerId) => options.errors?.[answerId],
      onSubmitFreeText,
      getAnswerFocusRequest: () => options.focusRequest ?? null,
      requestAnswerFocus,
      onChooseAnswer,
      onChooseSnippetBranch,
      onChooseQuestionBranch,
      t: (key) => key === 'protocolRunner.freeTextSubmit' ? 'Submit' : key,
    },
    onChooseAnswer,
    onChooseSnippetBranch,
    onChooseQuestionBranch,
    onAnswerDraftChange,
    onSubmitFreeText,
    requestAnswerFocus,
    renderError,
  };
}

function render(
  runtimeGraph: ProtocolGraph | null,
  harness: HostHarness,
): { textZone: MockEl; actionZone: MockEl; result: ReturnType<typeof renderQuestionAtNode> } {
  const textZone = makeEl('div');
  const actionZone = makeEl('div');
  const result = renderQuestionAtNode(
    asHtml(textZone),
    asHtml(actionZone),
    runtimeGraph,
    state,
    harness.host,
  );
  return { textZone, actionZone, result };
}

describe('shared question branch renderer', () => {
  it('preserves grouped preset/question/snippet projection and callback identity', () => {
    const harness = hostHarness();
    const { textZone, actionZone, result } = render(groupedGraph(), harness);

    expect(result).toBe('rendered');
    expect(findByClass(textZone, 'rp-question-text')[0]?._text).toBe('Pick one');
    expect(actionZone.children.map(className)).toEqual([
      'rp-answer-list rp-stack',
      'rp-question-transition-list',
      'rp-snippet-branch-list',
    ]);
    expect(findByClass(actionZone, 'rp-answer-btn')[0]?._text).toBe('Shown answer');
    expect(findByClass(actionZone, 'rp-question-transition-btn').map((button) => button._text)).toEqual([
      'Fallback question',
      'Direct label',
      'q-id',
    ]);
    expect(findByClass(actionZone, 'rp-snippet-branch-btn').map((button) => button._text)).toEqual([
      '📄 report',
      '📁 Folder label',
    ]);

    findByClass(actionZone, 'rp-answer-btn')[0]!.dispatchEvent({ type: 'click' });
    for (const button of findByClass(actionZone, 'rp-question-transition-btn')) {
      button.dispatchEvent({ type: 'click' });
    }
    for (const button of findByClass(actionZone, 'rp-snippet-branch-btn')) {
      button.dispatchEvent({ type: 'click' });
    }

    expect(harness.onChooseAnswer.mock.calls[0]?.[0].id).toBe('a1');
    expect(harness.onChooseQuestionBranch.mock.calls.map((call) => call[0].id)).toEqual([
      'e-fallback',
      'e-labeled',
      'e-id',
    ]);
    expect(harness.onChooseSnippetBranch.mock.calls.map((call) => [
      call[0].id,
      call[1],
    ])).toEqual([
      ['s-file', true],
      ['s-dir', false],
    ]);
  });

  it('renders a free-text row at its exact mixed authored position', () => {
    const question = baseNode('q', 'question', {
      optionOrder: ['e-snippet', 'e-free', 'e-next', 'e-preset'],
    });
    const runtimeGraph = graphFrom([
      question,
      baseNode('free', 'answer', {
        answerText: 'Describe',
        freeText: true,
      }),
      baseNode('preset', 'answer', { answerText: 'Preset' }),
      baseNode('snippet', 'snippet', {
        radiprotocol_snippetPath: 'Chest/report.md',
      }),
      baseNode('next', 'question', { questionText: 'Next' }),
    ], [
      { id: 'e-preset', fromNodeId: 'q', toNodeId: 'preset' },
      { id: 'e-next', fromNodeId: 'q', toNodeId: 'next', label: 'Continue' },
      { id: 'e-free', fromNodeId: 'q', toNodeId: 'free' },
      { id: 'e-snippet', fromNodeId: 'q', toNodeId: 'snippet' },
    ]);
    const harness = hostHarness();
    const { actionZone } = render(runtimeGraph, harness);
    const optionList = findByClass(actionZone, 'rp-option-list')[0]!;

    expect(optionList.children.map(className)).toEqual([
      'rp-snippet-branch-btn',
      'rp-free-text-answer',
      'rp-question-transition-btn',
      'rp-answer-btn',
    ]);
    expect(findByClass(optionList, 'rp-free-text-answer-prompt')[0]?._text).toBe('Describe');
    expect(harness.requestAnswerFocus).not.toHaveBeenCalled();
  });

  it('projects authored prompt, draft, implicit label, blank error, and ARIA safely', () => {
    const runtimeGraph = graphFrom([
      baseNode('q', 'question'),
      baseNode('free-label', 'answer', {
        answerText: 'Fallback prompt',
        displayLabel: 'Authored label',
        freeText: true,
      }),
      baseNode('free-fallback', 'answer', {
        answerText: 'Fallback prompt',
        freeText: true,
      }),
    ], [
      { id: 'e-label', fromNodeId: 'q', toNodeId: 'free-label' },
      { id: 'e-fallback', fromNodeId: 'q', toNodeId: 'free-fallback' },
    ]);
    const harness = hostHarness({
      drafts: { 'free-label': 'line one\nline two' },
      errors: { 'free-label': 'Enter a value before submitting.' },
    });
    const { actionZone } = render(runtimeGraph, harness);
    const rows = findByClass(actionZone, 'rp-free-text-answer');
    const labels = findByClass(actionZone, 'rp-free-text-answer-label');
    const prompts = findByClass(actionZone, 'rp-free-text-answer-prompt');
    const textareas = findByClass(actionZone, 'rp-free-text-answer-textarea');
    const alerts = findByClass(actionZone, 'rp-free-text-answer-error');

    expect(rows).toHaveLength(2);
    expect(labels.map((label) => label.tagName)).toEqual(['LABEL', 'LABEL']);
    expect(prompts.map((prompt) => prompt._text)).toEqual([
      'Authored label',
      'Fallback prompt',
    ]);
    expect(textareas[0]!.value).toBe('line one\nline two');
    expect(textareas[1]!.value).toBe('');
    expect(textareas[0]!.getAttribute('aria-invalid')).toBe('true');
    expect(textareas[1]!.getAttribute('aria-invalid')).toBeNull();
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!._text).toBe('Enter a value before submitting.');
    expect(alerts[0]!.getAttribute('role')).toBe('alert');
  });

  it('forwards exact input, clears local error/ARIA, and grows initially and on input', () => {
    const runtimeGraph = graphFrom([
      baseNode('q', 'question'),
      baseNode('free', 'answer', { answerText: 'Describe', freeText: true }),
    ], [
      { id: 'e-free', fromNodeId: 'q', toNodeId: 'free' },
    ]);
    const harness = hostHarness({ errors: { free: 'Blank' } });
    const { actionZone } = render(runtimeGraph, harness);
    const textarea = findByClass(actionZone, 'rp-free-text-answer-textarea')[0]!;

    expect(textarea.style.height).toBe(`${textarea.scrollHeight}px`);
    textarea.scrollHeight = 73;
    textarea.value = '  exact\nvalue  ';
    textarea.dispatchEvent({ type: 'input' });

    expect(harness.onAnswerDraftChange).toHaveBeenCalledTimes(1);
    expect(harness.onAnswerDraftChange.mock.calls[0]?.[0].id).toBe('free');
    expect(harness.onAnswerDraftChange.mock.calls[0]?.[1]).toBe('  exact\nvalue  ');
    expect(textarea.style.height).toBe('73px');
    expect(textarea.getAttribute('aria-invalid')).toBeNull();
    expect(findByClass(actionZone, 'rp-free-text-answer-error')).toHaveLength(0);
  });

  it('submits once per click or Mod+Enter, leaves plain Enter untouched, and binds one listener per event', () => {
    const runtimeGraph = graphFrom([
      baseNode('q', 'question'),
      baseNode('free', 'answer', { answerText: 'Describe', freeText: true }),
    ], [
      { id: 'e-free', fromNodeId: 'q', toNodeId: 'free' },
    ]);
    const harness = hostHarness();
    const { actionZone } = render(runtimeGraph, harness);
    const textarea = findByClass(actionZone, 'rp-free-text-answer-textarea')[0]!;
    const submit = findByClass(actionZone, 'rp-free-text-answer-submit')[0]!;
    textarea.value = 'submitted';

    expect(textarea._listeners.get('input')).toHaveLength(1);
    expect(textarea._listeners.get('keydown')).toHaveLength(1);
    expect(submit._listeners.get('click')).toHaveLength(1);
    expect(submit._text).toBe('Submit');

    submit.dispatchEvent({ type: 'click' });
    const ctrlPreventDefault = vi.fn();
    textarea.dispatchEvent({
      type: 'keydown',
      key: 'Enter',
      ctrlKey: true,
      metaKey: false,
      preventDefault: ctrlPreventDefault,
    });
    const metaPreventDefault = vi.fn();
    textarea.dispatchEvent({
      type: 'keydown',
      key: 'Enter',
      ctrlKey: false,
      metaKey: true,
      preventDefault: metaPreventDefault,
    });
    const plainPreventDefault = vi.fn();
    textarea.dispatchEvent({
      type: 'keydown',
      key: 'Enter',
      ctrlKey: false,
      metaKey: false,
      preventDefault: plainPreventDefault,
    });

    expect(harness.onSubmitFreeText).toHaveBeenCalledTimes(3);
    expect(harness.onSubmitFreeText.mock.calls.map((call) => [
      call[0].id,
      call[1],
    ])).toEqual([
      ['free', 'submitted'],
      ['free', 'submitted'],
      ['free', 'submitted'],
    ]);
    expect(ctrlPreventDefault).toHaveBeenCalledTimes(1);
    expect(metaPreventDefault).toHaveBeenCalledTimes(1);
    expect(plainPreventDefault).not.toHaveBeenCalled();
  });

  it('requests initial focus only for a sole free-text action and honors explicit mixed-question focus', () => {
    const soleGraph = graphFrom([
      baseNode('q', 'question'),
      baseNode('free', 'answer', { answerText: 'Describe', freeText: true }),
    ], [
      { id: 'e-free', fromNodeId: 'q', toNodeId: 'free' },
    ]);
    const sole = hostHarness();
    const soleRender = render(soleGraph, sole);
    expect(sole.requestAnswerFocus).toHaveBeenCalledTimes(1);
    expect(sole.requestAnswerFocus.mock.calls[0]?.[0]).toBe('free');
    expect(sole.requestAnswerFocus.mock.calls[0]?.[1]).toBe(
      findByClass(soleRender.actionZone, 'rp-free-text-answer-textarea')[0],
    );
    expect(sole.requestAnswerFocus.mock.calls[0]?.[2]).toBe(false);

    const mixedGraph = graphFrom([
      baseNode('q', 'question'),
      baseNode('free', 'answer', { answerText: 'Describe', freeText: true }),
      baseNode('preset', 'answer', { answerText: 'Preset' }),
      baseNode('snippet', 'snippet', { snippetLabel: 'Snippet' }),
      baseNode('next', 'question', { questionText: 'Next' }),
    ], [
      { id: 'e-free', fromNodeId: 'q', toNodeId: 'free' },
      { id: 'e-preset', fromNodeId: 'q', toNodeId: 'preset' },
      { id: 'e-snippet', fromNodeId: 'q', toNodeId: 'snippet' },
      { id: 'e-next', fromNodeId: 'q', toNodeId: 'next' },
    ]);
    const mixedInitial = hostHarness();
    render(mixedGraph, mixedInitial);
    expect(mixedInitial.requestAnswerFocus).not.toHaveBeenCalled();

    const mixedError = hostHarness({ focusRequest: 'free' });
    const mixedRender = render(mixedGraph, mixedError);
    expect(mixedError.requestAnswerFocus).toHaveBeenCalledTimes(1);
    expect(mixedError.requestAnswerFocus.mock.calls[0]?.[0]).toBe('free');
    expect(mixedError.requestAnswerFocus.mock.calls[0]?.[1]).toBe(
      findByClass(mixedRender.actionZone, 'rp-free-text-answer-textarea')[0],
    );
    expect(mixedError.requestAnswerFocus.mock.calls[0]?.[2]).toBe(true);
  });

  it('returns error/not-question for host-specific chrome handling', () => {
    const harness = hostHarness();
    expect(render(null, harness).result).toBe('error');
    expect(harness.renderError).toHaveBeenCalledWith([
      'Internal error: graph not loaded.',
    ]);

    const nonQuestion = groupedGraph(baseNode('q', 'text-block'));
    expect(render(nonQuestion, hostHarness()).result).toBe('not-question');
  });
});
```

#### 7. src/__tests__/runner/runner-renderer-host-fixtures.ts
**File**: src/__tests__/runner/runner-renderer-host-fixtures.ts
**Changes**: MODIFY — extend textarea/focus/keyboard/layout behavior needed by free-text renderer and host tests.

Replace the shared fixture event and element interfaces with these widened contracts:

```ts
export interface MockEvent {
  type: string;
  target?: MockEl | null;
  key?: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  preventDefault?: () => void;
}

export interface MockEl {
  tagName: string;
  children: MockEl[];
  parent: MockEl | null;
  _text: string;
  classList: Set<string>;
  _attrs: Record<string, string>;
  _style: Record<string, string>;
  _value: string;
  _disabled: boolean;
  _type: string;
  _checked: boolean;
  _listeners: Map<string, Array<(ev: MockEvent) => void>>;
  textContent: string;
  value: string;
  disabled: boolean;
  type: string;
  checked: boolean;
  style: Record<string, string>;
  name: string;
  inputMode: string;
  readOnly: boolean;
  dataset: Record<string, string>;
  scrollHeight: number;
  focusCount: number;
  createEl: (tag: string, opts?: { text?: string; cls?: string; type?: string; attr?: Record<string, string> }) => MockEl;
  createDiv: (opts?: { cls?: string; text?: string; attr?: Record<string, string> }) => MockEl;
  createSpan: (opts?: { cls?: string; text?: string }) => MockEl;
  empty: () => void;
  setText: (t: string) => void;
  addClass: (c: string) => void;
  removeClass: (c: string) => void;
  toggleClass: (c: string, on?: boolean) => void;
  hasClass: (c: string) => boolean;
  setAttribute: (k: string, v: string) => void;
  getAttribute: (k: string) => string | null;
  removeAttribute: (k: string) => void;
  contains: (candidate: unknown) => boolean;
  focus: () => void;
  remove: () => void;
  addEventListener: (type: string, handler: (ev: MockEvent) => void) => void;
  removeEventListener: (type: string, handler: (ev: MockEvent) => void) => void;
  dispatchEvent: (event: MockEvent) => void;
  querySelector: (sel: string) => MockEl | null;
  querySelectorAll: (sel: string) => MockEl[];
  prepend: (el: MockEl) => void;
  setCssProps: (props: Record<string, string>) => void;
}
```

Replace only `makeEl()` with this containment-, focus-, and keyboard-capable version; the remaining Phase 2 fixture factories stay unchanged:

```ts
export function makeEl(tag = 'div'): MockEl {
  const listeners = new Map<string, Array<(ev: MockEvent) => void>>();
  const children: MockEl[] = [];
  const attrs: Record<string, string> = {};
  const style: Record<string, string> = {};
  const classSet = new Set<string>();
  const dataset: Record<string, string> = {};

  const el = {
    tagName: tag.toUpperCase(),
    children,
    parent: null as MockEl | null,
    _text: '',
    classList: classSet,
    _attrs: attrs,
    _style: style,
    _value: '',
    _disabled: false,
    _type: '',
    _checked: false,
    _listeners: listeners,
    name: '',
    inputMode: '',
    readOnly: false,
    dataset,
    scrollHeight: 24,
    focusCount: 0,
    createEl(subtag: string, opts?: { text?: string; cls?: string; type?: string; attr?: Record<string, string> }): MockEl {
      const child = makeEl(subtag);
      child.parent = el as unknown as MockEl;
      if (opts?.text !== undefined) child._text = opts.text;
      if (opts?.cls) {
        for (const cls of opts.cls.split(/\s+/).filter(Boolean)) child.classList.add(cls);
      }
      if (opts?.type) child._type = opts.type;
      if (opts?.attr) {
        for (const [key, value] of Object.entries(opts.attr)) {
          child.setAttribute(key, value);
        }
      }
      children.push(child);
      return child;
    },
    createDiv(opts?: { cls?: string; text?: string; attr?: Record<string, string> }): MockEl {
      return (this as unknown as MockEl).createEl('div', opts);
    },
    createSpan(opts?: { cls?: string; text?: string }): MockEl {
      return (this as unknown as MockEl).createEl('span', opts);
    },
    empty(): void {
      for (const child of children) child.parent = null;
      children.length = 0;
    },
    setText(text: string): void { (el as unknown as MockEl)._text = text; },
    addClass(cls: string): void { classSet.add(cls); },
    removeClass(cls: string): void { classSet.delete(cls); },
    toggleClass(cls: string, on?: boolean): void {
      if (on ?? !classSet.has(cls)) classSet.add(cls); else classSet.delete(cls);
    },
    hasClass(cls: string): boolean { return classSet.has(cls); },
    setAttribute(key: string, value: string): void {
      attrs[key] = value;
      if (key === 'type') (el as unknown as MockEl)._type = value;
    },
    getAttribute(key: string): string | null { return attrs[key] ?? null; },
    removeAttribute(key: string): void { delete attrs[key]; },
    contains(candidate: unknown): boolean {
      if (candidate === el) return true;
      const stack = [...children];
      while (stack.length > 0) {
        const current = stack.shift()!;
        if (current === candidate) return true;
        stack.push(...current.children);
      }
      return false;
    },
    focus(): void { (el as unknown as MockEl).focusCount += 1; },
    remove(): void {
      const parent = (el as unknown as MockEl).parent;
      if (parent === null) return;
      const index = parent.children.indexOf(el as unknown as MockEl);
      if (index >= 0) parent.children.splice(index, 1);
      (el as unknown as MockEl).parent = null;
    },
    addEventListener(type: string, handler: (ev: MockEvent) => void): void {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type)!.push(handler);
    },
    removeEventListener(type: string, handler: (ev: MockEvent) => void): void {
      const registered = listeners.get(type);
      if (registered === undefined) return;
      const index = registered.indexOf(handler);
      if (index >= 0) registered.splice(index, 1);
    },
    dispatchEvent(event: MockEvent): void {
      const registered = listeners.get(event.type);
      if (registered === undefined) return;
      const dispatched = {
        ...event,
        target: event.target ?? (el as unknown as MockEl),
      };
      for (const handler of registered.slice()) handler(dispatched);
    },
    querySelector(selector: string): MockEl | null {
      return walk(el as unknown as MockEl, selector)[0] ?? null;
    },
    querySelectorAll(selector: string): MockEl[] {
      return walk(el as unknown as MockEl, selector);
    },
    prepend(child: MockEl): void {
      children.unshift(child);
      child.parent = el as unknown as MockEl;
    },
    setCssProps(props: Record<string, string>): void {
      for (const [key, value] of Object.entries(props)) style[key] = value;
    },
    style,
  } as unknown as MockEl;

  Object.defineProperty(el, 'textContent', {
    get(): string { return (el as unknown as MockEl)._text; },
    set(value: string): void { (el as unknown as MockEl)._text = String(value); },
  });
  Object.defineProperty(el, 'value', {
    get(): string { return (el as unknown as MockEl)._value; },
    set(value: string): void { (el as unknown as MockEl)._value = String(value); },
  });
  Object.defineProperty(el, 'disabled', {
    get(): boolean { return (el as unknown as MockEl)._disabled; },
    set(value: boolean): void { (el as unknown as MockEl)._disabled = Boolean(value); },
  });
  Object.defineProperty(el, 'type', {
    get(): string { return (el as unknown as MockEl)._type; },
    set(value: string): void { (el as unknown as MockEl)._type = String(value); },
  });
  Object.defineProperty(el, 'checked', {
    get(): boolean { return (el as unknown as MockEl)._checked; },
    set(value: boolean): void { (el as unknown as MockEl)._checked = Boolean(value); },
  });

  return el;
}
```

#### 8. src/__tests__/views/runner-session-host.test.ts
**File**: src/__tests__/views/runner-session-host.test.ts
**Changes**: MODIFY — verify draft retention, exact payload forwarding, rejection without note writes, and downstream delta inclusion.

Add the real runner import beside the existing Phase 2 imports:

```ts
import { ProtocolRunner } from '../../runner/protocol-runner';
```

Add these graph helpers after `answerWithDownstreamTextGraph()`:

```ts
function freeTextDraftGraph(includePreset = false): ProtocolGraph {
  return graph([
    { ...base, id: 'start', kind: 'start' },
    { ...base, id: 'question', kind: 'question', questionText: 'Describe' },
    {
      ...base,
      id: 'free-a',
      kind: 'answer',
      answerText: 'First free-text prompt',
      freeText: true,
    },
    {
      ...base,
      id: 'free-b',
      kind: 'answer',
      answerText: 'Second free-text prompt',
      freeText: true,
    },
    ...(includePreset
      ? [{ ...base, id: 'preset', kind: 'answer' as const, answerText: 'Preset' }]
      : []),
  ], [
    { id: 'start-question', fromNodeId: 'start', toNodeId: 'question' },
    { id: 'question-free-a', fromNodeId: 'question', toNodeId: 'free-a' },
    { id: 'question-free-b', fromNodeId: 'question', toNodeId: 'free-b' },
    ...(includePreset
      ? [{ id: 'question-preset', fromNodeId: 'question', toNodeId: 'preset' }]
      : []),
  ]);
}

function freeTextWithDownstreamGraph(): ProtocolGraph {
  return graph([
    { ...base, id: 'start', kind: 'start' },
    { ...base, id: 'question', kind: 'question', questionText: 'Describe' },
    {
      ...base,
      id: 'free',
      kind: 'answer',
      answerText: 'Authored prompt only',
      freeText: true,
      radiprotocol_separator: 'space',
    },
    { ...base, id: 'tail', kind: 'text-block', content: 'Tail' },
  ], [
    { id: 'start-question', fromNodeId: 'start', toNodeId: 'question' },
    { id: 'question-free', fromNodeId: 'question', toNodeId: 'free' },
    { id: 'free-tail', fromNodeId: 'free', toNodeId: 'tail' },
  ]);
}

function freeTextMixedGraph(): ProtocolGraph {
  return graph([
    { ...base, id: 'start', kind: 'start' },
    { ...base, id: 'question', kind: 'question', questionText: 'Describe' },
    {
      ...base,
      id: 'free',
      kind: 'answer',
      answerText: 'Free-text prompt',
      freeText: true,
    },
    { ...base, id: 'preset', kind: 'answer', answerText: 'Preset' },
  ], [
    { id: 'start-question', fromNodeId: 'start', toNodeId: 'question' },
    { id: 'question-free', fromNodeId: 'question', toNodeId: 'free' },
    { id: 'question-preset', fromNodeId: 'question', toNodeId: 'preset' },
  ]);
}
```

Append this Phase 3 describe block after the approved Phase 2 host suites:

```ts
describe('RunnerSessionHost free-text drafts and submission', () => {
  it('retains independent Answer-ID drafts across destructive rerenders', async () => {
    const h = harness(freeTextDraftGraph());
    expect(await h.host.mount(h.root as unknown as HTMLElement)).toBe(true);
    let textareas = h.root.querySelectorAll('.rp-free-text-answer-textarea');
    expect(textareas).toHaveLength(2);

    textareas[0]!.value = 'first draft';
    textareas[0]!.dispatchEvent({ type: 'input' });
    textareas[1]!.value = 'second draft';
    textareas[1]!.dispatchEvent({ type: 'input' });

    (h.host as any).render();
    textareas = h.root.querySelectorAll('.rp-free-text-answer-textarea');
    expect(textareas.map((textarea) => textarea.value)).toEqual([
      'first draft',
      'second draft',
    ]);

    textareas[1]!.value = '   ';
    textareas[1]!.dispatchEvent({ type: 'input' });
    h.root.querySelectorAll('.rp-free-text-answer-submit')[1]!
      .dispatchEvent({ type: 'click' });

    textareas = h.root.querySelectorAll('.rp-free-text-answer-textarea');
    expect(textareas.map((textarea) => textarea.value)).toEqual([
      'first draft',
      '   ',
    ]);
    expect(h.root.querySelector('.rp-free-text-answer-error')).not.toBeNull();
    expect(h.app.vault.modify).not.toHaveBeenCalled();
  });

  it('forwards exact whitespace through the actual runner and writes submitted plus downstream output', async () => {
    const h = harness(freeTextWithDownstreamGraph(), JSON.stringify({
      selfCheckEnabled: true,
      selfCheckItems: ['Review'],
    }));
    h.app.vault.read.mockImplementation((file: { path: string }) =>
      Promise.resolve(file.path === h.protocolFile.path ? '{}' : ''));
    const chooseAnswer = vi.spyOn(ProtocolRunner.prototype, 'chooseAnswer');
    try {
      expect(await h.host.mount(h.root as unknown as HTMLElement)).toBe(true);
      const textarea = h.root.querySelector('.rp-free-text-answer-textarea')!;
      textarea.value = '  custom\nvalue  ';
      textarea.dispatchEvent({ type: 'input' });
      h.root.querySelector('.rp-free-text-answer-submit')!
        .dispatchEvent({ type: 'click' });
      await flushMicrotasks();

      expect(chooseAnswer).toHaveBeenCalledWith('free', '  custom\nvalue  ');
      expect(h.app.vault.modify).toHaveBeenCalledTimes(1);
      expect(h.app.vault.modify).toHaveBeenCalledWith(
        h.targetNote,
        '  custom\nvalue  \nTail',
      );
      expect(h.root.querySelector('.rp-runner-session-self-check')).not.toBeNull();
    } finally {
      chooseAnswer.mockRestore();
    }
  });

  it('preserves an authored leading separator on the first free-text chunk', async () => {
    const h = harness(freeTextWithDownstreamGraph(), JSON.stringify({
      selfCheckEnabled: true,
      selfCheckItems: ['Review'],
    }));
    h.app.vault.read.mockImplementation((file: { path: string }) =>
      Promise.resolve(file.path === h.protocolFile.path ? '{}' : 'Existing\n'));
    expect(await h.host.mount(h.root as unknown as HTMLElement)).toBe(true);

    const textarea = h.root.querySelector('.rp-free-text-answer-textarea')!;
    textarea.value = '\nleading';
    textarea.dispatchEvent({ type: 'input' });
    h.root.querySelector('.rp-free-text-answer-submit')!
      .dispatchEvent({ type: 'click' });
    await flushMicrotasks();

    expect(h.app.vault.modify).toHaveBeenCalledWith(
      h.targetNote,
      'Existing\n\nleading\nTail',
    );
  });

  it('rejects blank text without runner state/history, lock, note-read, or note-write mutation', async () => {
    const h = harness(freeTextMixedGraph());
    expect(await h.host.mount(h.root as unknown as HTMLElement)).toBe(true);
    const runner = (h.host as any).runner as ProtocolRunner;
    const stateBefore = runner.getState();
    const historyBefore = runner.getSerializableState();

    h.root.querySelector('.rp-free-text-answer-submit')!
      .dispatchEvent({ type: 'click' });

    expect(runner.getState()).toEqual(stateBefore);
    expect(runner.getSerializableState()).toEqual(historyBefore);
    expect(h.withTargetNoteLock).not.toHaveBeenCalled();
    expect(h.app.vault.read.mock.calls.filter(
      ([file]) => (file as { path: string }).path === h.targetNote.path,
    )).toHaveLength(0);
    expect(h.app.vault.modify).not.toHaveBeenCalled();
  });

  it('renders a localized mixed-question alert, restores focus, and clears error state on exact input', async () => {
    vi.useFakeTimers();
    try {
      const h = harness(freeTextMixedGraph());
      expect(await h.host.mount(h.root as unknown as HTMLElement)).toBe(true);
      expect(h.root.querySelector('.rp-free-text-answer-textarea')!.focusCount).toBe(0);

      h.root.querySelector('.rp-free-text-answer-submit')!
        .dispatchEvent({ type: 'click' });
      const rejectedTextarea = h.root.querySelector('.rp-free-text-answer-textarea')!;
      const alert = h.root.querySelector('.rp-free-text-answer-error')!;
      expect(alert._text).toBe('Введите текст перед отправкой.');
      expect(alert.getAttribute('role')).toBe('alert');
      expect(rejectedTextarea.getAttribute('aria-invalid')).toBe('true');

      vi.advanceTimersByTime(0);
      expect(rejectedTextarea.focusCount).toBe(1);

      rejectedTextarea.value = '  сохранено точно  ';
      rejectedTextarea.dispatchEvent({ type: 'input' });
      expect(rejectedTextarea.getAttribute('aria-invalid')).toBeNull();
      expect(h.root.querySelector('.rp-free-text-answer-error')).toBeNull();

      (h.host as any).render();
      const rerenderedTextarea = h.root.querySelector('.rp-free-text-answer-textarea')!;
      expect(rerenderedTextarea.value).toBe('  сохранено точно  ');
      vi.advanceTimersByTime(0);
      expect(rerenderedTextarea.focusCount).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('ignores input and submission events from controls detached by disposal', async () => {
    const h = harness(freeTextMixedGraph());
    expect(await h.host.mount(h.root as unknown as HTMLElement)).toBe(true);
    const textarea = h.root.querySelector('.rp-free-text-answer-textarea')!;
    const submit = h.root.querySelector('.rp-free-text-answer-submit')!;
    const runner = (h.host as any).runner as ProtocolRunner;
    const stateBefore = runner.getState();

    h.host.dispose();
    textarea.value = 'late detached value';
    textarea.dispatchEvent({ type: 'input' });
    submit.dispatchEvent({ type: 'click' });
    await flushMicrotasks();

    expect((h.host as any).answerDrafts.size).toBe(0);
    expect((h.host as any).answerErrors.size).toBe(0);
    expect(runner.getState()).toEqual(stateBefore);
    expect(h.withTargetNoteLock).not.toHaveBeenCalled();
    expect(h.app.vault.modify).not.toHaveBeenCalled();
  });

  it('applies sole-answer focus only on the initial projection, not every rerender', async () => {
    vi.useFakeTimers();
    try {
      const sole = graph([
        { ...base, id: 'start', kind: 'start' },
        { ...base, id: 'question', kind: 'question', questionText: 'Describe' },
        {
          ...base,
          id: 'free',
          kind: 'answer',
          answerText: 'Free-text prompt',
          freeText: true,
        },
      ], [
        { id: 'start-question', fromNodeId: 'start', toNodeId: 'question' },
        { id: 'question-free', fromNodeId: 'question', toNodeId: 'free' },
      ]);
      const h = harness(sole);
      expect(await h.host.mount(h.root as unknown as HTMLElement)).toBe(true);
      const initialTextarea = h.root.querySelector('.rp-free-text-answer-textarea')!;

      vi.advanceTimersByTime(0);
      expect(initialTextarea.focusCount).toBe(1);

      (h.host as any).render();
      const rerenderedTextarea = h.root.querySelector('.rp-free-text-answer-textarea')!;
      vi.advanceTimersByTime(0);
      expect(rerenderedTextarea.focusCount).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('cancels a deferred sole-answer focus when the session is disposed', async () => {
    vi.useFakeTimers();
    try {
      const sole = graph([
        { ...base, id: 'start', kind: 'start' },
        { ...base, id: 'question', kind: 'question', questionText: 'Describe' },
        {
          ...base,
          id: 'free',
          kind: 'answer',
          answerText: 'Free-text prompt',
          freeText: true,
        },
      ], [
        { id: 'start-question', fromNodeId: 'start', toNodeId: 'question' },
        { id: 'question-free', fromNodeId: 'question', toNodeId: 'free' },
      ]);
      const h = harness(sole);
      expect(await h.host.mount(h.root as unknown as HTMLElement)).toBe(true);
      const textarea = h.root.querySelector('.rp-free-text-answer-textarea')!;

      h.host.dispose();
      vi.advanceTimersByTime(0);

      expect(textarea.focusCount).toBe(0);
      expect(h.root.contains(textarea)).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });
});
```

### Success Criteria:

#### Automated Verification:

- [x] Phase 1 pure free-text behavior, the Phase 3 renderer/host suites, and approved Phase 2 host regressions pass together: `npx vitest run src/__tests__/runner/protocol-runner-free-text-answer.test.ts src/__tests__/runner/render-question.test.ts src/__tests__/views/runner-session-host.test.ts src/__tests__/views/inline-runner-modal.test.ts src/__tests__/views/inline-runner-modal-keyboard.test.ts src/__tests__/views/inline-runner-modal-loop-body-file-bound.test.ts src/__tests__/views/inline-runner-modal-output-toolbar.test.ts`
- [x] Strict TypeScript checking passes without generating assets: `npx tsc --noEmit --pretty false`
- [x] Phase 3 TypeScript files satisfy scoped ESLint: `npx eslint src/runner/render/render-question.ts src/views/runner-session-host.ts src/__tests__/runner/render-question.test.ts src/__tests__/runner/runner-renderer-host-fixtures.ts src/__tests__/views/runner-session-host.test.ts`
- [x] Phase 3 CSS satisfies scoped Stylelint: `npx stylelint src/styles/runner-session.css`
- [x] Locale catalogs retain full leaf-key parity and both new stable keys, using a read-only assertion: `node --input-type=module -e "import { readFileSync } from 'node:fs'; import { deepEqual, equal } from 'node:assert/strict'; const en=JSON.parse(readFileSync('src/i18n/locales/en.json','utf8')); const ru=JSON.parse(readFileSync('src/i18n/locales/ru.json','utf8')); const leaves=(value,prefix='',out=[])=>{ for (const [key,child] of Object.entries(value)) { const path=prefix ? prefix+'.'+key : key; if (child !== null && typeof child === 'object') leaves(child,path,out); else out.push(path); } return out.sort(); }; deepEqual(leaves(en),leaves(ru)); for (const locale of [en,ru]) { equal(typeof locale.protocolRunner.freeTextSubmit,'string'); equal(typeof locale.protocolRunner.freeTextBlankError,'string'); }"`

#### Manual Verification:

- [ ] Run a question containing preset, free-text, direct Question-transition, and Snippet options; confirm authored order is unchanged and preset buttons behave exactly as before.
- [ ] Enter multiline text with leading/trailing spaces; confirm the textarea grows without an internal scrollbar, plain Enter inserts a newline, and click/Ctrl+Enter/Meta+Enter each submit once.
- [ ] Force a destructive rerender before submission; confirm every draft returns under the same Answer ID and does not move to a sibling Answer.
- [ ] Submit blank text in a mixed question; confirm the localized inline alert is announced, `aria-invalid` is present, focus returns to that textarea, and no note bytes are written.
- [ ] Type after a blank rejection; confirm the visible alert and invalid state clear immediately without translating or normalizing the authored prompt or entered text.
- [ ] Submit valid free text followed by automatic downstream output; confirm the fixed launch note receives the exact submitted bytes and the full automatic accumulator delta once.
- [ ] Confirm this phase adds no protocol-editor toggle, sidebar/settings/routing code, schema/migration changes, or generated `main.js`/`styles.css` edits.

## Phase 4: Protocol Authoring Toggle

### Overview
Makes the runtime capability authorable and round-trippable in the visual protocol editor; depends on Phase 1 and follows Phase 3.

### Changes Required:

#### 1. src/views/protocol-editor-view.ts
**File**: src/views/protocol-editor-view.ts
**Changes**: MODIFY — default new Answers to preset mode and add a persisted `freeText` checkbox to Answer properties.

Replace the existing Answer entry in `NODE_KIND_DEFAULTS` with:

```ts
  answer: {
    kind: 'answer',
    fields: { answerText: '', freeText: false },
    color: 'rgba(255, 193, 7, 0.28)',
  },
```

Inside `openEditModal()`, insert this helper immediately after `addLoopToggle` and before `addOptionOrderChips`:

```ts
    const addAnswerFreeTextToggle = (nodeRecord: ProtocolNodeRecord) => {
      const field = body.createDiv({
        cls: 'rp-protocol-editor-modal-field rp-protocol-editor-checkbox-field',
      });
      const label = field.createEl('label');
      const input = label.createEl('input', {
        attr: { type: 'checkbox' },
      }) as HTMLInputElement;
      const canonicalFreeText = nodeRecord.fields['freeText'];
      input.checked = canonicalFreeText === true
        || (canonicalFreeText === undefined
          && nodeRecord.fields['radiprotocol_freeText'] === true);
      label.createSpan({ text: t('protocolEditor.freeTextAnswerLabel') });
      field.createDiv({
        cls: 'rp-protocol-editor-modal-help',
        text: t('protocolEditor.freeTextAnswerHelp'),
      });
      textControls.push({ key: 'freeText', value: () => input.checked });
    };
```

Replace the existing Answer branch in the node-kind switch with:

```ts
      case 'answer':
        addInput('displayLabel', t('protocolEditor.answerButtonLabelLabel'), node.fields['displayLabel']);
        addInput('answerText', t('protocolEditor.answerTextLabel'), node.fields['answerText'] ?? node.text, true);
        addAnswerFreeTextToggle(node);
        addSeparator('separator', t('protocolEditor.answerSeparatorLabel'), node.fields['separator']);
        break;
```

The existing multiline control continues returning `input.value`, including `''`. The existing `isLibraryReadOnly()` check remains immediately before the store update and remains the authoritative mutation guard.

#### 2. src/i18n/locales/en.json
**File**: src/i18n/locales/en.json
**Changes**: MODIFY — add the English editor toggle label/help.

Inside `protocolEditor`, replace the adjacent `answerTextLabel` and `contentLabel` lines with:

```json
    "answerTextLabel": "Answer text",
    "freeTextAnswerLabel": "Collect a free-text response",
    "freeTextAnswerHelp": "Use the Answer label or text as the prompt; the radiologist enters multiline report text during the run.",
    "contentLabel": "Content",
```

#### 3. src/i18n/locales/ru.json
**File**: src/i18n/locales/ru.json
**Changes**: MODIFY — add the matching Russian editor toggle label/help.

Inside `protocolEditor`, replace the adjacent `answerTextLabel` and `contentLabel` lines with:

```json
    "answerTextLabel": "Текст ответа",
    "freeTextAnswerLabel": "Запрашивать свободный текст",
    "freeTextAnswerHelp": "Использовать подпись или текст ответа как подсказку; рентгенолог вводит многострочный текст заключения при запуске.",
    "contentLabel": "Текст блока",
```

#### 4. src/__tests__/protocol-editor-helpers.test.ts
**File**: src/__tests__/protocol-editor-helpers.test.ts
**Changes**: MODIFY — verify new Answer defaults include explicit preset mode without changing other kinds.

Replace the existing `returns kind-specific defaults for node type changes` test with:

```ts
    it('returns explicit Answer preset defaults without changing other node-kind defaults', () => {
      expect(fieldsForProtocolEditorNodeKind(null)).toEqual({});
      expect(fieldsForProtocolEditorNodeKind('start')).toEqual({});
      expect(fieldsForProtocolEditorNodeKind('question')).toEqual({ questionText: '' });
      expect(fieldsForProtocolEditorNodeKind('answer')).toEqual({
        answerText: '',
        freeText: false,
      });
      expect(fieldsForProtocolEditorNodeKind('text-block')).toEqual({ content: '' });
      expect(fieldsForProtocolEditorNodeKind('snippet')).toEqual({});
      expect(defaultColorForProtocolEditorNodeKind('snippet')).toContain('156');
    });
```

#### 5. src/__tests__/views/protocol-editor-keyboard.test.ts
**File**: src/__tests__/views/protocol-editor-keyboard.test.ts
**Changes**: MODIFY — verify checked/unchecked persistence, reopen state, empty Answer compatibility, and read-only guards.

Add these entries to the existing translator map immediately after `protocolEditor.answerTextLabel`:

```ts
    'protocolEditor.freeTextAnswerLabel': 'Collect a free-text response',
    'protocolEditor.freeTextAnswerHelp': 'Use the Answer label or text as the prompt; the radiologist enters multiline report text during the run.',
```

Insert this suite immediately after `openEditModal — empty multiline field regression (1.22.0 bug)` and before the snippet-target-picker suite:

```ts
describe('openEditModal — Answer free-text authoring', () => {
  let savedDocument: unknown;

  beforeEach(() => {
    savedDocument = (globalThis as any).document;
  });

  afterEach(() => {
    (globalThis as any).document = savedDocument;
  });

  interface AnswerModalHarness {
    view: ProtocolEditorView;
    documentBody: MockEl;
    updateSpy: ReturnType<typeof vi.fn>;
    storedDocument(): ProtocolDocumentV1;
  }

  function openAnswerModal(
    initialFields: Record<string, unknown>,
    options: { libraryReadOnly?: boolean } = {},
  ): AnswerModalHarness {
    const documentBody = makeEl('body');
    (globalThis as any).document = { body: documentBody, activeElement: null };

    const fields: Record<string, unknown> = { answerText: 'Answer body' };
    Object.assign(fields, initialFields);
    let stored: ProtocolDocumentV1 = {
      schema: 'radiprotocol.protocol',
      version: 1,
      id: 'answer-authoring',
      title: 'Answer authoring',
      createdAt: '2026-08-20T00:00:00Z',
      updatedAt: '2026-08-20T00:00:00Z',
      nodes: [{
        id: 'answer-1',
        kind: 'answer',
        x: 0,
        y: 0,
        width: 200,
        height: 80,
        text: typeof fields['answerText'] === 'string' ? fields['answerText'] : '',
        fields,
      }],
      edges: [],
    };

    const updateSpy = vi.fn(async (
      _path: string,
      mutator: (document: ProtocolDocumentV1 | null) => ProtocolDocumentV1,
    ): Promise<ProtocolDocumentV1> => {
      stored = mutator(stored);
      return stored;
    });

    const view = new ProtocolEditorView({} as any, {
      i18n: { t },
      settings: {
        protocolFolderPath: 'Protocols',
        snippetFolderPath: '.radiprotocol/snippets',
      },
      protocolDocumentStore: { update: updateSpy },
    } as any);
    const viewportEl = makeEl('div');
    (viewportEl as any).scrollLeft = 15000;
    (viewportEl as any).scrollTop = 12000;
    (view as any).protocolPath = 'Protocols/answer-authoring.rp.json';
    (view as any).doc = stored;
    (view as any).viewportEl = viewportEl;
    (view as any).zoom = 1;
    (view as any).libraryReadOnly = options.libraryReadOnly === true;
    (view as any).restoreEditorFocus = vi.fn();
    (view as any).loadProtocol = vi.fn(async () => {
      (view as any).doc = stored;
    });

    (view as any).openEditModal(stored.nodes[0]);
    return {
      view,
      documentBody,
      updateSpy,
      storedDocument: () => stored,
    };
  }

  function findFreeTextCheckbox(root: MockEl): MockEl {
    const checkbox = findAllByTag(root, 'input').find((input) => {
      if (input._attrs['type'] !== 'checkbox') return false;
      return input.parent?.children.some((child) =>
        child.tagName === 'SPAN'
        && child._text === 'Collect a free-text response') === true;
    });
    expect(checkbox).toBeDefined();
    return checkbox!;
  }

  async function saveAnswerModal(root: MockEl): Promise<void> {
    const saveButton = findAllByTag(root, 'button').find((button) => button._text === 'Save');
    expect(saveButton).toBeDefined();
    const handlers = saveButton!._listeners.get('click') ?? [];
    expect(handlers).toHaveLength(1);
    for (const handler of handlers) await handler({ target: saveButton });
  }

  const initialStateCases: Array<{
    name: string;
    fields: Record<string, unknown>;
    expectedChecked: boolean;
  }> = [
    { name: 'absent', fields: {}, expectedChecked: false },
    { name: 'malformed', fields: { freeText: 'true' }, expectedChecked: false },
    { name: 'false', fields: { freeText: false }, expectedChecked: false },
    { name: 'true', fields: { freeText: true }, expectedChecked: true },
    { name: 'legacy-only true', fields: { radiprotocol_freeText: true }, expectedChecked: true },
    {
      name: 'canonical false wins over legacy true',
      fields: { freeText: false, radiprotocol_freeText: true },
      expectedChecked: false,
    },
    {
      name: 'malformed canonical suppresses legacy true',
      fields: { freeText: 'true', radiprotocol_freeText: true },
      expectedChecked: false,
    },
  ];

  it.each(initialStateCases)(
    'initializes an Answer checkbox from a strictly true freeText value: $name',
    ({ fields, expectedChecked }) => {
      const harness = openAnswerModal(fields);
      const checkbox = findFreeTextCheckbox(harness.documentBody);

      expect((checkbox as any).checked).toBe(expectedChecked);
      expect(findAllByClass(
        harness.documentBody,
        'rp-protocol-editor-modal-help',
      ).some((element) => element._text
        === 'Use the Answer label or text as the prompt; the radiologist enters multiline report text during the run.')).toBe(true);
    },
  );

  const persistenceCases: Array<{
    initialValue: boolean;
    savedValue: boolean;
  }> = [
    { initialValue: false, savedValue: true },
    { initialValue: true, savedValue: false },
  ];

  it.each(persistenceCases)(
    'persists freeText=$savedValue and restores it when the Answer modal reopens',
    async ({ initialValue, savedValue }) => {
      const harness = openAnswerModal({ freeText: initialValue });
      const checkbox = findFreeTextCheckbox(harness.documentBody);
      (checkbox as any).checked = savedValue;

      await saveAnswerModal(harness.documentBody);

      expect(harness.updateSpy).toHaveBeenCalledTimes(1);
      expect(harness.storedDocument().nodes[0]!.fields['freeText']).toBe(savedValue);

      (harness.view as any).openEditModal(harness.storedDocument().nodes[0]);
      const reopenedCheckbox = findFreeTextCheckbox(harness.documentBody);
      expect((reopenedCheckbox as any).checked).toBe(savedValue);
    },
  );

  it('preserves an empty answerText while persisting explicit freeText state', async () => {
    const harness = openAnswerModal({ answerText: 'Answer body', freeText: false });
    const textareas = findAllByTag(harness.documentBody, 'textarea');
    expect(textareas).toHaveLength(1);
    textareas[0]!.value = '';
    const checkbox = findFreeTextCheckbox(harness.documentBody);
    (checkbox as any).checked = true;

    await saveAnswerModal(harness.documentBody);

    const savedFields = harness.storedDocument().nodes[0]!.fields;
    expect(savedFields['answerText']).toBe('');
    expect(savedFields['freeText']).toBe(true);
  });

  it('keeps the existing library read-only guard authoritative for Answer edits', async () => {
    const harness = openAnswerModal(
      { answerText: 'Original answer', freeText: false },
      { libraryReadOnly: true },
    );
    const checkbox = findFreeTextCheckbox(harness.documentBody);
    (checkbox as any).checked = true;
    findAllByTag(harness.documentBody, 'textarea')[0]!.value = 'Changed answer';

    await saveAnswerModal(harness.documentBody);

    expect(harness.updateSpy).not.toHaveBeenCalled();
    expect(harness.storedDocument().nodes[0]!.fields).toEqual({
      answerText: 'Original answer',
      freeText: false,
    });
  });
});
```

### Success Criteria:

#### Automated Verification:

- [x] Focused editor tests pass: `npx vitest run src/__tests__/protocol-editor-helpers.test.ts src/__tests__/views/protocol-editor-keyboard.test.ts`
- [x] Strict TypeScript checking passes without emitting files: `npx tsc --noEmit --pretty false`
- [x] Phase-owned TypeScript satisfies scoped ESLint: `npx eslint src/views/protocol-editor-view.ts src/__tests__/protocol-editor-helpers.test.ts src/__tests__/views/protocol-editor-keyboard.test.ts`
- [x] Locale catalogs retain leaf-key parity and both new editor keys: `node --input-type=module -e "import { readFileSync } from 'node:fs'; import { deepEqual, equal } from 'node:assert/strict'; const en=JSON.parse(readFileSync('src/i18n/locales/en.json','utf8')); const ru=JSON.parse(readFileSync('src/i18n/locales/ru.json','utf8')); const leaves=(value,prefix='',out=[])=>{ for (const [key,child] of Object.entries(value)) { const path=prefix ? prefix+'.'+key : key; if (child !== null && typeof child === 'object') leaves(child,path,out); else out.push(path); } return out.sort(); }; deepEqual(leaves(en),leaves(ru)); for (const locale of [en,ru]) { equal(typeof locale.protocolEditor.freeTextAnswerLabel,'string'); equal(typeof locale.protocolEditor.freeTextAnswerHelp,'string'); }"`

#### Manual Verification:

- [ ] Create a new Answer and confirm its free-text checkbox starts unchecked while its other defaults remain unchanged.
- [ ] Open Answers with absent, malformed, explicit `false`, explicit `true`, legacy-only true, and canonical-over-legacy values; confirm the editor mirrors parser precedence.
- [ ] Switch the interface between English and Russian; confirm both the checkbox label and help text are localized.
- [ ] Save checked and unchecked states, reopen each Answer, and confirm explicit `true` and `false` round-trip.
- [ ] Clear Answer text, save, and confirm the stored `answerText` remains `''` while the checkbox value persists independently.
- [ ] Attempt the same edit on a library-managed protocol and confirm no document update occurs.
- [ ] Confirm the phase changes only the five owned files and adds no renderer, runner, sidebar, settings, CSS, migration, or generated-file work.

## Phase 5: Multi-leaf Sidebar Presentation and Routing

### Overview
Adds the right-sidebar ItemView, setting, bound-note chrome, unified launch selection, and transient lifecycle; depends on Phases 2 through 4 and is the terminal phase.

### Changes Required:

#### 1. src/views/sidebar-runner-view.ts
**File**: src/views/sidebar-runner-view.ts
**Changes**: NEW — mount one session host per leaf, show bound-note/mismatch/focus UI, and detach on close/completion/deletion.

Create this file with the complete implementation:

```ts
import {
  ItemView,
  Notice,
  TFile,
  type EventRef,
  type WorkspaceLeaf,
} from 'obsidian';
import type RadiProtocolPlugin from '../main';
import { RunnerSessionHost } from './runner-session-host';

export const SIDEBAR_RUNNER_VIEW_TYPE = 'radiprotocol-sidebar-runner';
export const SIDEBAR_RUNNER_LAUNCH_MARKER = 'radiprotocol-sidebar-runner-launch';

export interface SidebarRunnerLaunchContext {
  protocolPath: string;
  targetNote: TFile;
  startNodeId?: string;
}

export type SidebarRunnerEphemeralState = Record<string, unknown> & {
  [SIDEBAR_RUNNER_LAUNCH_MARKER]: true;
};

export function createSidebarRunnerEphemeralState(): SidebarRunnerEphemeralState {
  return { [SIDEBAR_RUNNER_LAUNCH_MARKER]: true };
}

/**
 * Transient right-sidebar shell for one RunnerSessionHost. The view owns only
 * workspace/chrome policy; protocol execution and target-note lifetime stay in
 * the shared host.
 */
export class SidebarRunnerView extends ItemView {
  private readonly plugin: RadiProtocolPlugin;

  private launchContext: SidebarRunnerLaunchContext | null = null;
  private sessionHost: RunnerSessionHost | null = null;
  private boundNoteEl: HTMLElement | null = null;
  private mismatchEl: HTMLElement | null = null;
  private sessionEl: HTMLElement | null = null;
  private activeLeafEventRef: EventRef | null = null;
  private targetRenameEventRef: EventRef | null = null;
  private boundKeyHandler: ((event: KeyboardEvent) => void) | null = null;
  private restoreDetachTimer: ReturnType<typeof globalThis.setTimeout> | null = null;
  private generation = 0;
  private initialized = false;
  private closeRequested = false;
  private closed = false;

  constructor(leaf: WorkspaceLeaf, plugin: RadiProtocolPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return SIDEBAR_RUNNER_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.plugin.i18n.t('sidebarRunner.title');
  }

  getIcon(): string {
    return 'list-checks';
  }

  /** No protocol/session data is durable workspace state. */
  getState(): Record<string, unknown> {
    return {};
  }

  async onOpen(): Promise<void> {
    this.closed = false;
    this.contentEl.empty();
    this.contentEl.addClass('rp-sidebar-runner-view');
    this.renderInitializing();

    if (!this.hasLaunchMarker()) {
      this.restoreDetachTimer = globalThis.setTimeout(() => {
        this.restoreDetachTimer = null;
        if (!this.initialized) this.requestClose();
      }, 0);
    }
  }

  /**
   * One-shot post-setViewState handoff. The launch marker is ephemeral and is
   * consumed before any protocol context is retained by this instance.
   */
  async initialize(context: SidebarRunnerLaunchContext): Promise<boolean> {
    if (
      this.closed
      || this.closeRequested
      || this.initialized
      || !this.hasLaunchMarker()
    ) {
      this.requestClose();
      return false;
    }

    this.consumeLaunchMarker();
    this.clearRestoreDetachTimer();
    const generation = ++this.generation;
    this.initialized = true;
    this.launchContext = context;
    this.renderShell(context.targetNote);

    this.activeLeafEventRef = this.app.workspace.on('active-leaf-change', () => {
      this.updateMismatchChrome();
    });
    this.targetRenameEventRef = this.app.vault.on('rename', (file) => {
      if (
        file instanceof TFile
        && (file === context.targetNote || file.path === context.targetNote.path)
      ) this.updateBoundNoteChrome();
    });
    this.boundKeyHandler = (event) => this.handleKeydown(event);
    this.contentEl.addEventListener('keydown', this.boundKeyHandler);
    this.updateMismatchChrome();

    if (this.sessionEl === null) {
      this.requestClose();
      return false;
    }

    const t = this.plugin.i18n.t.bind(this.plugin.i18n);
    const host = new RunnerSessionHost({
      app: this.app,
      protocolPath: context.protocolPath,
      targetNote: context.targetNote,
      startNodeId: context.startNodeId,
      protocolDocumentStore: this.plugin.protocolDocumentStore,
      protocolDocumentParser: this.plugin.protocolDocumentParser,
      snippetService: this.plugin.snippetService,
      getTextSeparator: () => this.plugin.settings.textSeparator,
      getSnippetFolderPath: () => this.plugin.settings.snippetFolderPath,
      withTargetNoteLock: (path, operation) =>
        this.plugin['insertMutex'].runExclusive(path, operation),
      t,
      notify: (message) => new Notice(message),
      onRequestClose: () => this.requestClose(),
    });
    this.sessionHost = host;

    let mounted: boolean;
    try {
      mounted = await host.mount(this.sessionEl);
    } catch (error) {
      console.error('[RadiProtocol] Sidebar runner host failed to mount', error);
      host.dispose();
      this.requestClose();
      return false;
    }
    if (!this.owns(generation) || this.sessionHost !== host) {
      host.dispose();
      return false;
    }
    if (!mounted) {
      this.requestClose();
      return false;
    }
    return true;
  }

  async onClose(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    this.closeRequested = true;
    this.initialized = false;
    ++this.generation;
    this.clearRestoreDetachTimer();

    if (this.boundKeyHandler !== null) {
      this.contentEl.removeEventListener('keydown', this.boundKeyHandler);
      this.boundKeyHandler = null;
    }
    if (this.activeLeafEventRef !== null) {
      this.app.workspace.offref(this.activeLeafEventRef);
      this.activeLeafEventRef = null;
    }
    if (this.targetRenameEventRef !== null) {
      this.app.vault.offref(this.targetRenameEventRef);
      this.targetRenameEventRef = null;
    }

    this.sessionHost?.dispose();
    this.sessionHost = null;
    this.clearLaunchMarker();
    this.launchContext = null;
    this.boundNoteEl = null;
    this.mismatchEl = null;
    this.sessionEl = null;
    this.contentEl.removeClass('rp-sidebar-runner-view');
    this.contentEl.empty();
  }

  private renderInitializing(): void {
    this.contentEl.createEl('p', {
      cls: 'rp-sidebar-runner-initializing',
      text: this.plugin.i18n.t('sidebarRunner.initializing'),
    });
  }

  private renderShell(targetNote: TFile): void {
    this.contentEl.empty();
    const root = this.contentEl.createDiv({ cls: 'rp-sidebar-runner-shell' });
    const chrome = root.createDiv({ cls: 'rp-sidebar-runner-chrome' });
    this.boundNoteEl = chrome.createDiv({ cls: 'rp-sidebar-runner-bound-note' });
    this.updateBoundNoteChrome();
    this.mismatchEl = chrome.createDiv({
      cls: 'rp-sidebar-runner-mismatch is-hidden',
      text: this.plugin.i18n.t('sidebarRunner.activeNoteMismatch'),
      attr: {
        role: 'status',
        'aria-live': 'polite',
      },
    });
    const focusButton = chrome.createEl('button', {
      cls: 'rp-sidebar-runner-focus-note',
      text: this.plugin.i18n.t('sidebarRunner.focusNote'),
      attr: { type: 'button' },
    });
    focusButton.addEventListener('click', () => {
      void this.focusBoundNote();
    });

    this.sessionEl = root.createDiv({ cls: 'rp-sidebar-runner-session' });
  }

  private updateBoundNoteChrome(): void {
    if (this.boundNoteEl === null || this.launchContext === null) return;
    this.boundNoteEl.setText(this.plugin.i18n.t('sidebarRunner.boundNote', {
      path: this.launchContext.targetNote.path,
    }));
  }

  private updateMismatchChrome(): void {
    if (this.mismatchEl === null || this.launchContext === null) return;
    const activeFile = this.app.workspace.getActiveFile();
    const mismatch = activeFile?.path !== this.launchContext.targetNote.path;
    this.mismatchEl.toggleClass('is-hidden', !mismatch);
  }

  private async focusBoundNote(): Promise<void> {
    const targetNote = this.launchContext?.targetNote;
    if (targetNote === undefined) return;
    const generation = this.generation;

    const matchingLeaves: WorkspaceLeaf[] = [];
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (matchingLeaves.length > 0) return;
      const view = leaf.view;
      if (
        'file' in view
        && view.file instanceof TFile
        && view.file.path === targetNote.path
      ) matchingLeaves.push(leaf);
    });

    const matchingLeaf = matchingLeaves[0];
    if (matchingLeaf !== undefined) {
      if (!this.owns(generation)) return;
      this.app.workspace.setActiveLeaf(matchingLeaf, { focus: true });
      await this.app.workspace.revealLeaf(matchingLeaf);
      return;
    }

    const leaf = this.app.workspace.getLeaf(false);
    await leaf.openFile(targetNote);
    if (!this.owns(generation)) return;
    this.app.workspace.setActiveLeaf(leaf, { focus: true });
    await this.app.workspace.revealLeaf(leaf);
  }

  private owns(generation: number): boolean {
    return !this.closed
      && !this.closeRequested
      && this.initialized
      && generation === this.generation;
  }

  private handleKeydown(event: KeyboardEvent): void {
    const target = event.target as HTMLElement | null;
    if (target !== null && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.requestClose();
      return;
    }
    this.sessionHost?.handleKeydown(event);
  }

  private requestClose(): void {
    if (this.closeRequested) return;
    this.closeRequested = true;
    this.leaf.detach();
  }

  private hasLaunchMarker(): boolean {
    return this.leaf.getEphemeralState()?.[SIDEBAR_RUNNER_LAUNCH_MARKER] === true;
  }

  private consumeLaunchMarker(): void {
    this.clearLaunchMarker();
  }

  private clearLaunchMarker(): void {
    const state = this.leaf.getEphemeralState();
    if (state === null || typeof state !== 'object') return;
    const nextState = { ...(state as Record<string, unknown>) };
    if (nextState[SIDEBAR_RUNNER_LAUNCH_MARKER] === undefined) return;
    delete nextState[SIDEBAR_RUNNER_LAUNCH_MARKER];
    this.leaf.setEphemeralState(nextState);
  }

  private clearRestoreDetachTimer(): void {
    if (this.restoreDetachTimer === null) return;
    globalThis.clearTimeout(this.restoreDetachTimer);
    this.restoreDetachTimer = null;
  }
}
```

#### 2. src/main.ts
**File**: src/main.ts
**Changes**: MODIFY — register/detach the view type, centralize presentation routing, create a fresh right leaf, and route both commands.

Add the sidebar import beside the existing runner imports:

```ts
import {
  SidebarRunnerView,
  SIDEBAR_RUNNER_VIEW_TYPE,
  createSidebarRunnerEphemeralState,
} from './views/sidebar-runner-view';
```

Extend the existing floating-runner import with the shared registry-key helper:

```ts
import {
  InlineRunnerModal,
  inlineRunnerRegistryKey,
} from './views/inline-runner-modal';
```

Add this exported launch contract immediately before the plugin class:

```ts
export interface OpenRunnerSessionOptions {
  protocolPath: string;
  targetNote: TFile;
  startNodeId?: string;
}
```

Register the transient view immediately after the existing protocol editor, snippet manager, and library view registrations:

```ts
    this.registerView(
      SIDEBAR_RUNNER_VIEW_TYPE,
      (leaf) => new SidebarRunnerView(leaf, this),
    );
```

Make the existing run command display name presentation-neutral while preserving its stable command ID and callback:

```ts
    this.addCommand({
      id: 'run-protocol-inline',
      name: 'Run protocol',
      callback: () => { void this.handleRunProtocolInline(); },
    });
```

Replace `onunload()` with the complete transient-session cleanup below. The targeted rule exception is attached to the method node reported by the Obsidian ESLint rule; runner leaves intentionally do not preserve workspace placement or state.

```ts
  // eslint-disable-next-line obsidianmd/detach-leaves -- runner leaves are intentionally transient and must not survive plugin unload
  async onunload(): Promise<void> {
    if (this.pickerModal !== null) {
      this.pickerModal.close();
      this.pickerModal = null;
    }
    for (const modal of this.inlineRunners.values()) {
      modal.close();
    }
    this.inlineRunners.clear();
    this.app.workspace.detachLeavesOfType(SIDEBAR_RUNNER_VIEW_TYPE);
    console.debug('[RadiProtocol] Plugin unloaded');
  }
```

Replace the `NodePickerModal` selection callback in `openProtocolStartNodePicker()` with:

```ts
    new NodePickerModal(this.app, options, (opt) => {
      void this.openRunnerSession({
        protocolPath: protocolFile.path,
        targetNote: activeFile,
        startNodeId: opt.id,
      });
    }, this).open();
```

Replace the protocol-picker launch callback in `handleRunProtocolInline()` with:

```ts
      (item) => {
        this.pickerModal = null;
        void this.openRunnerSession({
          protocolPath: item.file.path,
          targetNote: activeFile,
        });
      },
```

Delete the old private `openInlineRunner()` method and insert this public presentation selector in its place:

```ts
  /** Open one transient runner session using the configured presentation. */
  async openRunnerSession(options: OpenRunnerSessionOptions): Promise<void> {
    if (this.settings.useSidebarRunner === true) {
      const leaf = this.app.workspace.getRightLeaf(false);
      if (leaf === null) return;

      const ephemeralState = createSidebarRunnerEphemeralState();
      leaf.setEphemeralState(ephemeralState);
      try {
        await leaf.setViewState({
          type: SIDEBAR_RUNNER_VIEW_TYPE,
          active: true,
          state: {},
        }, ephemeralState);
        if (leaf.isDeferred) await leaf.loadIfDeferred();
        await this.app.workspace.revealLeaf(leaf);

        const view = leaf.view;
        if (!(view instanceof SidebarRunnerView)) {
          leaf.detach();
          return;
        }
        await view.initialize(options);
      } catch (error) {
        leaf.detach();
        console.error('[RadiProtocol] Failed to open sidebar runner', error);
      }
      return;
    }

    const key = inlineRunnerRegistryKey(
      options.protocolPath,
      options.targetNote.path,
      options.startNodeId,
    );
    const existing = this.getInlineRunner(key);
    if (existing !== null) {
      existing.focus();
      return;
    }

    const modal = new InlineRunnerModal(
      this.app,
      this,
      options.protocolPath,
      options.targetNote,
      options.startNodeId,
    );
    await modal.open();
    if (modal.isOpen()) this.registerInlineRunner(key, modal);
  }
```

The resulting `main.ts` must contain exactly one production construction of `InlineRunnerModal`, inside `openRunnerSession()`. Do not change the floating registry, position, cascade, or layout APIs.

#### 3. src/settings.ts
**File**: src/settings.ts
**Changes**: MODIFY — add default-disabled persisted setting and localized toggle.

Add this required field to `RadiProtocolSettings` immediately after `textSeparator`:

```ts
  /** Present runner sessions in independent transient right-sidebar leaves. Absent = false for compatibility. */
  useSidebarRunner?: boolean;
```

Add the default immediately after `textSeparator` in `DEFAULT_SETTINGS`:

```ts
  useSidebarRunner: false,
```

Insert this toggle immediately after the text-separator setting and before the Storage heading:

```ts
    new Setting(containerEl)
      .setName(this.plugin.i18n.t('settings.useSidebarRunner'))
      .setDesc(this.plugin.i18n.t('settings.useSidebarRunnerDesc'))
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.useSidebarRunner === true)
        .onChange(async (value) => {
          this.plugin.settings.useSidebarRunner = value;
          await this.plugin.saveSettings();
        }));
```

#### 4. src/styles/runner-session.css
**File**: src/styles/runner-session.css
**Changes**: MODIFY — add sidebar root, bound-note banner, mismatch, focus action, and responsive host layout.

Append these sidebar-only rules after the approved Phase 3 free-text rules:

```css
.rp-sidebar-runner-view {
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  padding: 0;
  overflow: hidden;
}

.rp-sidebar-runner-shell {
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--background-primary);
}

.rp-sidebar-runner-chrome {
  display: grid;
  flex: 0 0 auto;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--size-2-2) var(--size-4-2);
  padding: var(--size-4-2);
  border-bottom: 1px solid var(--background-modifier-border);
  background: var(--background-secondary);
}

.rp-sidebar-runner-bound-note {
  min-width: 0;
  overflow-wrap: anywhere;
  color: var(--text-normal);
  font-size: var(--font-ui-small);
  font-weight: var(--font-medium);
}

.rp-sidebar-runner-mismatch {
  grid-column: 1 / -1;
  color: var(--text-warning);
  font-size: var(--font-ui-smaller);
  line-height: var(--line-height-tight);
}

.rp-sidebar-runner-mismatch.is-hidden {
  display: none;
}

.rp-sidebar-runner-focus-note {
  grid-column: 2;
  grid-row: 1;
  white-space: nowrap;
}

.rp-sidebar-runner-session {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.rp-sidebar-runner-session.rp-runner-session-root {
  flex: 1 1 auto;
  width: 100%;
  min-height: 0;
  overflow: hidden;
}

.rp-sidebar-runner-initializing {
  margin: 0;
  padding: var(--size-4-3);
  color: var(--text-muted);
}
```

#### 5. src/i18n/locales/en.json
**File**: src/i18n/locales/en.json
**Changes**: MODIFY — add English setting, sidebar title, bound-note, mismatch, and focus-note copy.

Inside the existing `settings` object, add these matching leaves after `textSeparatorDesc`:

```json
    "useSidebarRunner": "Run protocols in the right sidebar",
    "useSidebarRunnerDesc": "Open every protocol run as a new transient right-sidebar session instead of a floating panel.",
```

Add this top-level object immediately after `inlineRunner`:

```json
  "sidebarRunner": {
    "title": "Protocol runner",
    "boundNote": "Bound note: {path}",
    "activeNoteMismatch": "The active note differs from this runner's bound note.",
    "focusNote": "Focus note",
    "initializing": "Initializing protocol runner…"
  },
```

#### 6. src/i18n/locales/ru.json
**File**: src/i18n/locales/ru.json
**Changes**: MODIFY — add matching Russian setting and sidebar copy.

Inside the existing `settings` object, add these matching leaves after `textSeparatorDesc`:

```json
    "useSidebarRunner": "Запускать протоколы в правой боковой панели",
    "useSidebarRunnerDesc": "Открывать каждый запуск протокола как новую временную сессию в правой боковой панели вместо плавающей панели.",
```

Add this top-level object immediately after `inlineRunner`:

```json
  "sidebarRunner": {
    "title": "Запуск протокола",
    "boundNote": "Связанная заметка: {path}",
    "activeNoteMismatch": "Активная заметка отличается от заметки, связанной с этим запуском.",
    "focusNote": "Перейти к заметке",
    "initializing": "Инициализация запуска протокола…"
  },
```

#### 7. src/__mocks__/obsidian.ts
**File**: src/__mocks__/obsidian.ts
**Changes**: MODIFY — support ItemView leaf state/detach, right-leaf creation, focus/open-file behavior, and setting toggles.

Replace the current `makeMockEl()` function and `MockElement` interface with this child-retaining, queryable, event-capable implementation. It preserves every existing property while adding the ItemView lifecycle seams required by Phase 5:

```ts
export interface MockElement {
  recordedCssProps: Record<string, string>[];
  tagName: string;
  children: MockElement[];
  parentElement: MockElement | null;
  classList: Set<string>;
  hidden: boolean;
  createEl: (tag: string, opts?: {
    text?: string;
    cls?: string;
    type?: string;
    attr?: Record<string, string>;
  }) => MockElement;
  createDiv: (opts?: {
    text?: string;
    cls?: string;
    attr?: Record<string, string>;
  }) => MockElement;
  empty: () => void;
  remove: () => void;
  contains: (candidate: unknown) => boolean;
  setText: (text: string) => void;
  setCssProps: (props: Record<string, string>) => void;
  type: string;
  min: string;
  placeholder: string;
  value: string;
  rows: number;
  disabled: boolean;
  title: string;
  textContent: string;
  addEventListener: (type: string, cb: (event: any) => void) => void;
  removeEventListener: (type: string, cb: (event: any) => void) => void;
  dispatchEvent: (event: { type: string; [key: string]: unknown }) => boolean;
  setAttribute: (name: string, value: string) => void;
  setAttr: (name: string, value: string | number | boolean) => void;
  getAttribute: (name: string) => string | null;
  addClass: (cls: string) => void;
  removeClass: (cls: string) => void;
  toggleClass: (cls: string, force?: boolean) => void;
  hasClass: (cls: string) => boolean;
  querySelector: (selector: string) => MockElement | null;
  querySelectorAll: (selector: string) => MockElement[];
  click: () => void;
  setCssStyles: (props: Record<string, string>) => void;
  getCssStyles: () => Record<string, string>;
}

function makeMockEl(tag = 'div'): MockElement {
  const classes = new Set<string>();
  const attrs = new Map<string, string>();
  const listeners = new Map<string, Array<(event: any) => void>>();
  const children: MockElement[] = [];

  const matches = (candidate: MockElement, selector: string): boolean => {
    if (selector.startsWith('.')) return candidate.classList.has(selector.slice(1));
    const attrMatch = /^([a-zA-Z]+)\[([^=]+)="([^"]+)"\]$/.exec(selector);
    if (attrMatch !== null) {
      return candidate.tagName === attrMatch[1]!.toUpperCase()
        && candidate.getAttribute(attrMatch[2]!) === attrMatch[3];
    }
    return candidate.tagName === selector.toUpperCase();
  };

  const descendants = (selector: string): MockElement[] => {
    const found: MockElement[] = [];
    const queue = [...children];
    while (queue.length > 0) {
      const candidate = queue.shift()!;
      if (matches(candidate, selector)) found.push(candidate);
      queue.push(...candidate.children);
    }
    return found;
  };

  const el: MockElement = {
    recordedCssProps: [],
    tagName: tag.toUpperCase(),
    children,
    parentElement: null,
    classList: classes,
    hidden: false,
    createEl: (childTag, opts = {}) => {
      const child = makeMockEl(childTag);
      child.parentElement = el;
      if (opts.text !== undefined) child.textContent = opts.text;
      if (opts.cls !== undefined) {
        for (const cls of opts.cls.split(/\s+/).filter(Boolean)) child.addClass(cls);
      }
      if (opts.type !== undefined) {
        child.type = opts.type;
        child.setAttribute('type', opts.type);
      }
      if (opts.attr !== undefined) {
        for (const [name, value] of Object.entries(opts.attr)) {
          child.setAttribute(name, value);
        }
      }
      children.push(child);
      return child;
    },
    createDiv: (opts = {}) => el.createEl('div', opts),
    empty: () => {
      for (const child of children) child.parentElement = null;
      children.length = 0;
    },
    remove: () => {
      const parent = el.parentElement;
      if (parent === null) return;
      const index = parent.children.indexOf(el);
      if (index >= 0) parent.children.splice(index, 1);
      el.parentElement = null;
    },
    contains: (candidate) => {
      if (candidate === el) return true;
      const queue = [...children];
      while (queue.length > 0) {
        const child = queue.shift()!;
        if (child === candidate) return true;
        queue.push(...child.children);
      }
      return false;
    },
    setText: (text) => { el.textContent = text; },
    setCssProps: (props) => { el.recordedCssProps.push({ ...props }); },
    type: '',
    min: '',
    placeholder: '',
    value: '',
    rows: 10,
    disabled: false,
    title: '',
    textContent: '',
    addEventListener: (type, cb) => {
      listeners.set(type, [...(listeners.get(type) ?? []), cb]);
    },
    removeEventListener: (type, cb) => {
      listeners.set(type, (listeners.get(type) ?? []).filter(listener => listener !== cb));
    },
    dispatchEvent: (event) => {
      const dispatched = { ...event, target: event.target ?? el };
      for (const listener of listeners.get(event.type) ?? []) listener(dispatched);
      return true;
    },
    setAttribute: (name, value) => {
      attrs.set(name, value);
      if (name === 'type') el.type = value;
    },
    setAttr: (name, value) => { attrs.set(name, String(value)); },
    getAttribute: (name) => attrs.get(name) ?? null,
    addClass: (cls) => { classes.add(cls); },
    removeClass: (cls) => { classes.delete(cls); },
    toggleClass: (cls, force) => {
      if (force === true) classes.add(cls);
      else if (force === false) classes.delete(cls);
      else if (classes.has(cls)) classes.delete(cls);
      else classes.add(cls);
    },
    hasClass: (cls) => classes.has(cls),
    querySelector: (selector) => descendants(selector)[0] ?? null,
    querySelectorAll: (selector) => descendants(selector),
    click: () => { el.dispatchEvent({ type: 'click' }); },
    setCssStyles: (props) => { el.recordedCssProps.push({ ...props }); },
    getCssStyles: () => Object.assign({}, ...el.recordedCssProps),
  };

  return el;
}
```

Add toggle capture beside the existing text-component capture:

```ts
const mockToggleComponents: MockToggle[] = [];

export function __getMockToggleComponents(): MockToggle[] {
  return mockToggleComponents;
}
```

Extend `__resetObsidianMocks()` with:

```ts
  mockToggleComponents.length = 0;
```

Replace `makeMockToggle()` and `MockToggle` with:

```ts
export interface MockToggle {
  value: boolean;
  setValue: (value: boolean) => MockToggle;
  onChange: (cb: (value: boolean) => void | Promise<void>) => MockToggle;
  trigger: (value: boolean) => Promise<void>;
}

function makeMockToggle(): MockToggle {
  let onChange: ((value: boolean) => void | Promise<void>) | null = null;
  const toggle: MockToggle = {
    value: false,
    setValue: (value) => {
      toggle.value = value;
      return toggle;
    },
    onChange: (cb) => {
      onChange = cb;
      return toggle;
    },
    trigger: async (value) => {
      toggle.value = value;
      await onChange?.(value);
    },
  };
  mockToggleComponents.push(toggle);
  return toggle;
}
```

Replace the existing `ItemView` and `WorkspaceLeaf` mocks with:

```ts
interface MockEventRef {
  event: string;
  handler: (...args: any[]) => void;
}

export class ItemView {
  app: any;
  leaf: WorkspaceLeaf;
  containerEl: MockElement;
  contentEl: MockElement;
  private readonly eventRefs: MockEventRef[] = [];

  constructor(leaf: WorkspaceLeaf) {
    this.leaf = leaf;
    this.app = leaf.app;
    this.containerEl = makeMockEl();
    this.contentEl = this.containerEl.createDiv();
  }

  getViewType(): string { return ''; }
  getDisplayText(): string { return ''; }
  getIcon(): string { return ''; }
  getState(): Record<string, unknown> { return {}; }
  setState(_state: unknown, _result: unknown): Promise<void> { return Promise.resolve(); }
  getEphemeralState(): Record<string, unknown> { return this.leaf.getEphemeralState(); }
  setEphemeralState(state: unknown): void { this.leaf.setEphemeralState(state); }
  registerEvent(ref: MockEventRef): MockEventRef {
    this.eventRefs.push(ref);
    return ref;
  }
  registerDomEvent(
    element: MockElement,
    event: string,
    callback: (event: any) => void,
  ): void {
    element.addEventListener(event, callback);
  }
  onOpen(): void | Promise<void> {}
  onClose(): void | Promise<void> {}
}

export class WorkspaceLeaf {
  app: any;
  view: any = {};
  isDeferred = false;
  detached = false;
  detachCalls = 0;
  openedFile: TFile | null = null;
  lastViewState: Record<string, unknown> | null = null;
  lastEState: unknown = null;
  private ephemeralState: Record<string, unknown> = {};
  private closed = false;
  private readonly viewFactory?: (leaf: WorkspaceLeaf, type: string) => any;

  constructor(
    app: any = {},
    viewFactory?: (leaf: WorkspaceLeaf, type: string) => any,
  ) {
    this.app = app;
    this.viewFactory = viewFactory;
  }

  getViewState(): Record<string, unknown> {
    return this.lastViewState ?? { type: 'empty' };
  }

  async setViewState(viewState: Record<string, unknown>, eState?: unknown): Promise<void> {
    this.lastViewState = viewState;
    this.lastEState = eState;
    if (eState !== undefined) this.setEphemeralState(eState);
    const type = typeof viewState.type === 'string' ? viewState.type : '';
    if (this.viewFactory !== undefined) {
      this.view = this.viewFactory(this, type);
      await this.view.onOpen?.();
    }
  }

  async loadIfDeferred(): Promise<void> {
    this.isDeferred = false;
  }

  getEphemeralState(): Record<string, unknown> {
    return this.ephemeralState;
  }

  setEphemeralState(state: unknown): void {
    this.ephemeralState = state !== null && typeof state === 'object'
      ? { ...(state as Record<string, unknown>) }
      : {};
  }

  detach(): void {
    this.detachCalls += 1;
    this.detached = true;
    if (this.closed) return;
    this.closed = true;
    void this.view?.onClose?.();
  }

  async openFile(file: TFile): Promise<void> {
    this.openedFile = file;
    this.view = { file };
  }
}
```

Add these runtime exports after the existing `Plugin` mock. They allow tests that import `main.ts` and its ItemView precedents to link against every Obsidian value they use:

```ts
export class App {}

export class MarkdownView {
  file: TFile | null = null;
  editor = {
    replaceSelection: (_value: string): void => {},
    getSelection: (): string => '',
  };
}

export class Menu {
  addItem(callback: (item: {
    setTitle(title: string): any;
    setIcon(icon: string): any;
    onClick(handler: () => void): any;
  }) => void): this {
    const item: any = {
      setTitle: () => item,
      setIcon: () => item,
      onClick: () => item,
    };
    callback(item);
    return this;
  }

  showAtMouseEvent(_event: MouseEvent): void {}
  showAtPosition(_position: { x: number; y: number }): void {}
}
```

No other mock exports or existing text/dropdown/button behavior should change.

#### 8. src/__tests__/settings-tab.test.ts
**File**: src/__tests__/settings-tab.test.ts
**Changes**: MODIFY — verify default false and persisted toggle behavior.

Add the toggle helper to the existing Obsidian mock imports:

```ts
  __getMockToggleComponents,
```

Add this default assertion inside `Settings defaults (RUN-07)`:

```ts
  it('defaults sidebar presentation to disabled for new and migrated installs', () => {
    expect(DEFAULT_SETTINGS.useSidebarRunner).toBe(false);
  });
```

Extend the object returned by `renderSettings()` with:

```ts
    toggleComponents: __getMockToggleComponents(),
```

Append this suite:

```ts
describe('Settings sidebar runner toggle', () => {
  it.each([false, true])(
    'renders the persisted initial value %s',
    (useSidebarRunner) => {
      const { toggleComponents } = renderSettings({ useSidebarRunner });

      expect(toggleComponents).toHaveLength(1);
      expect(toggleComponents[0]!.value).toBe(useSidebarRunner);
    },
  );

  it('persists toggle changes through saveSettings', async () => {
    const { plugin, toggleComponents } = renderSettings({ useSidebarRunner: false });

    await toggleComponents[0]!.trigger(true);
    expect(plugin.settings.useSidebarRunner).toBe(true);
    expect(plugin.saveSettingsCalls).toBe(1);

    await toggleComponents[0]!.trigger(false);
    expect(plugin.settings.useSidebarRunner).toBe(false);
    expect(plugin.saveSettingsCalls).toBe(2);
  });
});
```

#### 9. src/__tests__/runner-commands.test.ts
**File**: src/__tests__/runner-commands.test.ts
**Changes**: MODIFY — preserve command registration and assert both launch paths use the unified selector.

Replace the file with this complete suite. It preserves the existing command IDs and graph checks while adding source tripwires for the unified selector:

```ts
import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';
import { GraphValidator } from '../graph/graph-validator';
import { CanvasParser } from './helpers/canvas-parser';

const mainSource = fs.readFileSync(path.join(__dirname, '..', 'main.ts'), 'utf8');

function methodSource(name: string, nextName: string): string {
  const start = mainSource.indexOf(name);
  const end = mainSource.indexOf(nextName, start + name.length);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return mainSource.slice(start, end);
}

describe('Runner commands (RUN-10, UI-04)', () => {
  it('RUN-10: node-picker-modal exports NodePickerModal', async () => {
    await expect(import('../views/node-picker-modal')).resolves.toHaveProperty('NodePickerModal');
  });

  it('UI-04: GraphValidator.validate() returns non-empty errors for a dead-end canvas', () => {
    const fixturesDir = path.join(__dirname, 'fixtures');
    const json = fs.readFileSync(path.join(fixturesDir, 'dead-end.canvas'), 'utf8');
    const result = new CanvasParser().parse(json, 'dead-end.canvas');
    if (!result.success) {
      expect(result.error).toBeTruthy();
      return;
    }
    const errors = new GraphValidator().validate(result.graph);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('LOOP-06: buildNodeOptions returns a question option for a looped question', async () => {
    const { buildNodeOptions } = await import('../views/node-picker-modal');
    const loopedQuestion = {
      id: 'loop-1',
      kind: 'question' as const,
      questionText: 'Lesion loop',
      loop: true,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    };
    const graph = {
      canvasFilePath: 'test.canvas',
      nodes: new Map([[loopedQuestion.id, loopedQuestion]]),
      edges: [],
      adjacency: new Map<string, string[]>(),
      reverseAdjacency: new Map<string, string[]>(),
      startNodeId: loopedQuestion.id,
    };

    const options = buildNodeOptions(
      graph as unknown as import('../graph/graph-model').ProtocolGraph,
    );
    const question = options.find(option => option.kind === 'question');
    expect(question).toMatchObject({ id: 'loop-1', label: 'Lesion loop' });
    expect(options.map(option => option.kind)).not.toContain('loop');
  });

  it('preserves unprefixed runner command IDs', () => {
    expect(mainSource).toContain(`id: 'start-from-node'`);
    expect(mainSource).toContain(`id: 'run-protocol-inline'`);
    expect(mainSource).toContain(`name: 'Run protocol'`);
    expect(mainSource).not.toContain(`name: 'Run protocol in inline'`);
    expect(mainSource).not.toContain(`id: 'radiprotocol-start-from-node'`);
    expect(mainSource).not.toContain(`id: 'radiprotocol-run-protocol-inline'`);
  });

  it('routes the normal Run callback through openRunnerSession', () => {
    const source = methodSource(
      'private async handleRunProtocolInline()',
      'async openRunnerSession(',
    );
    expect(source).toContain('void this.openRunnerSession({');
    expect(source).toContain('protocolPath: item.file.path');
    expect(source).toContain('targetNote: activeFile');
    expect(source).not.toContain('new InlineRunnerModal');
  });

  it('routes Start from node through the same selector with the selected node ID', () => {
    const source = methodSource(
      'private async openProtocolStartNodePicker(',
      'private async handleInsertSnippet()',
    );
    expect(source).toContain('void this.openRunnerSession({');
    expect(source).toContain('protocolPath: protocolFile.path');
    expect(source).toContain('targetNote: activeFile');
    expect(source).toContain('startNodeId: opt.id');
    expect(source).not.toContain('new InlineRunnerModal');
  });

  it('constructs InlineRunnerModal only inside the unified presentation selector', () => {
    expect(mainSource.match(/new InlineRunnerModal\(/g)).toHaveLength(1);
    const selector = mainSource.slice(mainSource.indexOf('async openRunnerSession('));
    expect(selector).toContain('new InlineRunnerModal(');
  });
});
```

#### 10. src/__tests__/views/sidebar-runner-view.test.ts
**File**: src/__tests__/views/sidebar-runner-view.test.ts
**Changes**: NEW — verify bound note, mismatch, focus action, deletion/completion detach, close cleanup, and isolated leaves.

Create this file with the complete suite:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const hostState = vi.hoisted(() => ({
  mountResult: true,
  requestCloseDuringMount: false,
  instances: [] as Array<{
    options: Record<string, any>;
    root: unknown;
    disposed: boolean;
    disposeCalls: number;
    handleKeydown: ReturnType<typeof vi.fn>;
  }>,
}));

vi.mock('../../views/runner-session-host', () => ({
  RunnerSessionHost: class {
    private readonly instance: (typeof hostState.instances)[number];

    constructor(options: Record<string, any>) {
      this.instance = {
        options,
        root: null,
        disposed: false,
        disposeCalls: 0,
        handleKeydown: vi.fn(() => true),
      };
      hostState.instances.push(this.instance);
    }

    async mount(root: unknown): Promise<boolean> {
      this.instance.root = root;
      if (hostState.requestCloseDuringMount) this.instance.options.onRequestClose();
      return hostState.mountResult;
    }

    dispose(): void {
      if (this.instance.disposed) return;
      this.instance.disposed = true;
      this.instance.disposeCalls += 1;
    }

    handleKeydown(event: KeyboardEvent): boolean {
      this.instance.handleKeydown(event);
      return true;
    }
  },
}));

import { TFile, WorkspaceLeaf } from 'obsidian';
import {
  SidebarRunnerView,
  createSidebarRunnerEphemeralState,
} from '../../views/sidebar-runner-view';

type WorkspaceEventRef = {
  event: string;
  handler: (...args: any[]) => void;
};

function translator(key: string, params?: Record<string, string>): string {
  const copy: Record<string, string> = {
    'sidebarRunner.title': 'Protocol runner',
    'sidebarRunner.boundNote': `Bound note: ${params?.path ?? ''}`,
    'sidebarRunner.activeNoteMismatch': 'The active note differs.',
    'sidebarRunner.focusNote': 'Focus note',
    'sidebarRunner.initializing': 'Initializing protocol runner',
  };
  return copy[key] ?? key;
}

function makeEnvironment(initialActivePath = 'notes/target.md') {
  let activeFile: TFile | null = new TFile(initialActivePath);
  const handlers = new Map<string, Array<(...args: any[]) => void>>();
  const vaultHandlers = new Map<string, Array<(...args: any[]) => void>>();
  const allLeaves: WorkspaceLeaf[] = [];
  const activated: WorkspaceLeaf[] = [];
  const revealed: WorkspaceLeaf[] = [];
  const openedLeaves: WorkspaceLeaf[] = [];

  const app: any = {
    vault: {
      on: vi.fn((event: string, handler: (...args: any[]) => void) => {
        vaultHandlers.set(event, [...(vaultHandlers.get(event) ?? []), handler]);
        return { event, handler } satisfies WorkspaceEventRef;
      }),
      offref: vi.fn((ref: WorkspaceEventRef) => {
        vaultHandlers.set(
          ref.event,
          (vaultHandlers.get(ref.event) ?? []).filter(handler => handler !== ref.handler),
        );
      }),
    },
    workspace: {
      on: vi.fn((event: string, handler: (...args: any[]) => void) => {
        handlers.set(event, [...(handlers.get(event) ?? []), handler]);
        return { event, handler } satisfies WorkspaceEventRef;
      }),
      offref: vi.fn((ref: WorkspaceEventRef) => {
        handlers.set(
          ref.event,
          (handlers.get(ref.event) ?? []).filter(handler => handler !== ref.handler),
        );
      }),
      getActiveFile: vi.fn(() => activeFile),
      iterateAllLeaves: vi.fn((callback: (leaf: WorkspaceLeaf) => void) => {
        for (const leaf of allLeaves) callback(leaf);
      }),
      getLeaf: vi.fn(() => {
        const leaf = new WorkspaceLeaf(app);
        openedLeaves.push(leaf);
        allLeaves.push(leaf);
        return leaf;
      }),
      setActiveLeaf: vi.fn((leaf: WorkspaceLeaf) => {
        activated.push(leaf);
        const file = (leaf.view as { file?: TFile }).file;
        if (file instanceof TFile) activeFile = file;
      }),
      revealLeaf: vi.fn(async (leaf: WorkspaceLeaf) => {
        revealed.push(leaf);
      }),
    },
  };
  const plugin: any = {
    app,
    i18n: { t: translator },
    settings: {
      textSeparator: 'newline',
      snippetFolderPath: 'Snippets',
    },
    protocolDocumentStore: {},
    protocolDocumentParser: {},
    snippetService: {},
    insertMutex: { runExclusive: vi.fn(async (_path: string, operation: () => Promise<void>) => operation()) },
  };

  return {
    app,
    plugin,
    allLeaves,
    activated,
    revealed,
    openedLeaves,
    setActiveFile(file: TFile | null): void {
      activeFile = file;
    },
    emit(event: string): void {
      for (const handler of handlers.get(event) ?? []) handler(null);
    },
    emitVault(event: string, ...args: unknown[]): void {
      for (const handler of vaultHandlers.get(event) ?? []) handler(...args);
    },
    handlerCount(event: string): number {
      return handlers.get(event)?.length ?? 0;
    },
    vaultHandlerCount(event: string): number {
      return vaultHandlers.get(event)?.length ?? 0;
    },
  };
}

async function openMarkedView(
  environment = makeEnvironment(),
  context: {
    protocolPath: string;
    targetNote: TFile;
    startNodeId?: string;
  } = {
    protocolPath: 'Protocols/test.rp.json',
    targetNote: new TFile('notes/target.md'),
  },
) {
  const leaf = new WorkspaceLeaf(environment.app);
  leaf.setEphemeralState(createSidebarRunnerEphemeralState());
  const view = new SidebarRunnerView(leaf, environment.plugin);
  leaf.view = view;
  environment.allLeaves.push(leaf);
  await view.onOpen();
  const initialized = await view.initialize(context);
  return { environment, leaf, view, context, initialized };
}

function keyboardEvent(
  key: string,
  target: { tagName: string } | null = null,
): KeyboardEvent {
  return {
    type: 'keydown',
    key,
    target,
    ctrlKey: key === 'ArrowLeft' || key === 'ArrowRight',
    altKey: false,
    preventDefault: vi.fn(),
  } as unknown as KeyboardEvent;
}

beforeEach(() => {
  hostState.mountResult = true;
  hostState.requestCloseDuringMount = false;
  hostState.instances.length = 0;
});

describe('SidebarRunnerView transient initialization', () => {
  it('consumes a marked launch, keeps durable state empty, and mounts one approved host', async () => {
    const context = {
      protocolPath: 'Protocols/chest.rp.json',
      targetNote: new TFile('reports/chest.md'),
      startNodeId: 'question-2',
    };
    const harness = await openMarkedView(makeEnvironment(context.targetNote.path), context);

    expect(harness.initialized).toBe(true);
    expect(harness.view.getState()).toEqual({});
    expect(harness.leaf.getEphemeralState()).toEqual({});
    expect(hostState.instances).toHaveLength(1);
    expect(hostState.instances[0]!.options).toMatchObject(context);
    expect(hostState.instances[0]!.root).toBe(
      harness.view.contentEl.querySelector('.rp-sidebar-runner-session'),
    );
  });

  it('detaches an unmarked restored view on the scheduled turn', async () => {
    vi.useFakeTimers();
    try {
      const environment = makeEnvironment();
      const leaf = new WorkspaceLeaf(environment.app);
      const view = new SidebarRunnerView(leaf, environment.plugin);
      leaf.view = view;

      await view.onOpen();
      expect(leaf.detachCalls).toBe(0);
      vi.advanceTimersByTime(0);

      expect(leaf.detachCalls).toBe(1);
      expect(hostState.instances).toHaveLength(0);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('SidebarRunnerView bound-note chrome and focus policy', () => {
  it('shows the authored note path safely and updates only mismatch chrome', async () => {
    const harness = await openMarkedView();
    const bound = harness.view.contentEl.querySelector('.rp-sidebar-runner-bound-note')!;
    const mismatch = harness.view.contentEl.querySelector('.rp-sidebar-runner-mismatch')!;

    expect(bound.textContent).toBe('Bound note: notes/target.md');
    expect(mismatch.getAttribute('role')).toBe('status');
    expect(mismatch.getAttribute('aria-live')).toBe('polite');
    expect(mismatch.hasClass('is-hidden')).toBe(true);

    const oldPath = harness.context.targetNote.path;
    harness.context.targetNote.path = 'notes/renamed.md';
    harness.environment.emitVault('rename', harness.context.targetNote, oldPath);
    expect(bound.textContent).toBe('Bound note: notes/renamed.md');
    expect(hostState.instances[0]!.options.targetNote).toBe(harness.context.targetNote);

    harness.environment.setActiveFile(new TFile('notes/other.md'));
    harness.environment.emit('active-leaf-change');
    expect(mismatch.hasClass('is-hidden')).toBe(false);
    expect(hostState.instances).toHaveLength(1);
    expect(hostState.instances[0]!.disposed).toBe(false);

    harness.environment.setActiveFile(harness.context.targetNote);
    harness.environment.emit('active-leaf-change');
    expect(mismatch.hasClass('is-hidden')).toBe(true);
  });

  it('focuses an existing file leaf without retargeting the runner', async () => {
    const harness = await openMarkedView(makeEnvironment('notes/other.md'));
    const noteLeaf = new WorkspaceLeaf(harness.environment.app);
    noteLeaf.view = { file: harness.context.targetNote };
    harness.environment.allLeaves.push(noteLeaf);

    harness.view.contentEl.querySelector('.rp-sidebar-runner-focus-note')!.click();
    await Promise.resolve();

    expect(harness.environment.app.workspace.getLeaf).not.toHaveBeenCalled();
    expect(harness.environment.activated).toEqual([noteLeaf]);
    expect(harness.environment.revealed).toEqual([noteLeaf]);
    expect(hostState.instances[0]!.options.targetNote).toBe(harness.context.targetNote);
  });

  it('suppresses post-open focus effects when the sidebar closes during openFile', async () => {
    const harness = await openMarkedView(makeEnvironment('notes/other.md'));
    let resolveOpen!: () => void;
    const pendingOpen = new Promise<void>((resolve) => { resolveOpen = resolve; });
    const openingLeaf = new WorkspaceLeaf(harness.environment.app);
    openingLeaf.openFile = vi.fn(() => pendingOpen);
    harness.environment.app.workspace.getLeaf.mockReturnValueOnce(openingLeaf);

    harness.view.contentEl.querySelector('.rp-sidebar-runner-focus-note')!.click();
    await Promise.resolve();
    await harness.view.onClose();
    resolveOpen();
    await Promise.resolve();
    await Promise.resolve();

    expect(openingLeaf.openFile).toHaveBeenCalledWith(harness.context.targetNote);
    expect(harness.environment.activated).toEqual([]);
    expect(harness.environment.revealed).toEqual([]);
  });

  it('opens the bound file in a normal leaf when no existing file leaf matches', async () => {
    const harness = await openMarkedView(makeEnvironment('notes/other.md'));

    harness.view.contentEl.querySelector('.rp-sidebar-runner-focus-note')!.click();
    await Promise.resolve();
    await Promise.resolve();

    expect(harness.environment.openedLeaves).toHaveLength(1);
    const opened = harness.environment.openedLeaves[0]!;
    expect(opened.openedFile).toBe(harness.context.targetNote);
    expect(harness.environment.activated).toEqual([opened]);
    expect(harness.environment.revealed).toEqual([opened]);
    expect(hostState.instances[0]!.options.targetNote).toBe(harness.context.targetNote);
  });
});

describe('SidebarRunnerView close and keyboard policy', () => {
  it.each(['completion', 'target deletion'])(
    'detaches exactly once when the host requests close for %s',
    async () => {
      const harness = await openMarkedView();
      const requestClose = hostState.instances[0]!.options.onRequestClose as () => void;

      requestClose();
      requestClose();

      expect(harness.leaf.detachCalls).toBe(1);
      expect(hostState.instances[0]!.disposeCalls).toBe(1);
    },
  );

  it('detaches once when bootstrap requests close and mount reports failure', async () => {
    hostState.mountResult = false;
    hostState.requestCloseDuringMount = true;

    const harness = await openMarkedView();

    expect(harness.initialized).toBe(false);
    expect(harness.leaf.detachCalls).toBe(1);
    expect(hostState.instances[0]!.disposeCalls).toBe(1);
  });

  it('delegates Back/Redo keys, detaches on non-input Escape, and ignores input Escape', async () => {
    const harness = await openMarkedView();
    const back = keyboardEvent('ArrowLeft');
    const redo = keyboardEvent('ArrowRight');
    harness.view.contentEl.dispatchEvent(back as any);
    harness.view.contentEl.dispatchEvent(redo as any);
    expect(hostState.instances[0]!.handleKeydown).toHaveBeenNthCalledWith(1, back);
    expect(hostState.instances[0]!.handleKeydown).toHaveBeenNthCalledWith(2, redo);

    const inputEscape = keyboardEvent('Escape', { tagName: 'TEXTAREA' });
    harness.view.contentEl.dispatchEvent(inputEscape as any);
    expect(harness.leaf.detachCalls).toBe(0);

    const escape = keyboardEvent('Escape');
    harness.view.contentEl.dispatchEvent(escape as any);
    expect(escape.preventDefault).toHaveBeenCalledTimes(1);
    expect(harness.leaf.detachCalls).toBe(1);
  });

  it('cleans host, timer, event, keyboard, marker, DOM, and context idempotently', async () => {
    const harness = await openMarkedView();
    expect(harness.environment.handlerCount('active-leaf-change')).toBe(1);
    expect(harness.environment.vaultHandlerCount('rename')).toBe(1);

    await harness.view.onClose();
    await harness.view.onClose();

    expect(hostState.instances[0]!.disposeCalls).toBe(1);
    expect(harness.environment.handlerCount('active-leaf-change')).toBe(0);
    expect(harness.environment.vaultHandlerCount('rename')).toBe(0);
    expect(harness.view.contentEl.children).toHaveLength(0);
    expect(harness.view.contentEl.hasClass('rp-sidebar-runner-view')).toBe(false);
    expect((harness.view as any).launchContext).toBeNull();
    expect((harness.view as any).restoreDetachTimer).toBeNull();
    expect(harness.leaf.getEphemeralState()).toEqual({});

    const afterClose = keyboardEvent('ArrowLeft');
    harness.view.contentEl.dispatchEvent(afterClose as any);
    expect(hostState.instances[0]!.handleKeydown).not.toHaveBeenCalled();
  });

  it('keeps two leaf/view contexts and hosts isolated', async () => {
    const environment = makeEnvironment('notes/one.md');
    const firstContext = {
      protocolPath: 'Protocols/one.rp.json',
      targetNote: new TFile('notes/one.md'),
      startNodeId: 'one-start',
    };
    const secondContext = {
      protocolPath: 'Protocols/two.rp.json',
      targetNote: new TFile('notes/two.md'),
      startNodeId: 'two-start',
    };

    const first = await openMarkedView(environment, firstContext);
    const second = await openMarkedView(environment, secondContext);

    expect(first.leaf).not.toBe(second.leaf);
    expect(hostState.instances).toHaveLength(2);
    expect(hostState.instances[0]!.options).toMatchObject(firstContext);
    expect(hostState.instances[1]!.options).toMatchObject(secondContext);
    expect(hostState.instances[0]!.root).not.toBe(hostState.instances[1]!.root);

    hostState.instances[0]!.options.onRequestClose();
    expect(first.leaf.detachCalls).toBe(1);
    expect(second.leaf.detachCalls).toBe(0);
    expect(hostState.instances[1]!.disposed).toBe(false);
  });
});
```

#### 11. src/__tests__/views/runner-presentation-routing.test.ts
**File**: src/__tests__/views/runner-presentation-routing.test.ts
**Changes**: NEW — verify false/absent setting keeps floating dedup, true creates independent right leaves, and optional start node is preserved.

Create this file with the complete suite:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const floatingInstances = vi.hoisted(() => [] as Array<{
  args: unknown[];
  open: ReturnType<typeof vi.fn>;
  focus: ReturnType<typeof vi.fn>;
  isOpen: ReturnType<typeof vi.fn>;
}>);

vi.mock('../../views/inline-runner-modal', () => ({
  InlineRunnerModal: class {
    private readonly instance: (typeof floatingInstances)[number];

    constructor(...args: unknown[]) {
      this.instance = {
        args,
        open: vi.fn(async () => {}),
        focus: vi.fn(),
        isOpen: vi.fn(() => true),
      };
      floatingInstances.push(this.instance);
    }

    async open(): Promise<void> { await this.instance.open(); }
    focus(): void { this.instance.focus(); }
    isOpen(): boolean { return this.instance.isOpen(); }
    close(): void {}
  },
}));

const sidebarInstances = vi.hoisted(() => [] as Array<{
  order: string[];
  initialize: ReturnType<typeof vi.fn>;
}>);

vi.mock('../../views/sidebar-runner-view', () => {
  const marker = 'radiprotocol-sidebar-runner-launch';
  class SidebarRunnerView {
    order: string[] = [];
    initialize = vi.fn(async (_context: unknown) => {
      this.order.push('initialize');
      return true;
    });

    constructor() {
      sidebarInstances.push(this);
    }
  }
  return {
    SidebarRunnerView,
    SIDEBAR_RUNNER_VIEW_TYPE: 'radiprotocol-sidebar-runner',
    SIDEBAR_RUNNER_LAUNCH_MARKER: marker,
    createSidebarRunnerEphemeralState: () => ({ [marker]: true }),
  };
});

import { TFile } from 'obsidian';
import RadiProtocolPlugin from '../../main';
import {
  SIDEBAR_RUNNER_LAUNCH_MARKER,
  SIDEBAR_RUNNER_VIEW_TYPE,
  SidebarRunnerView,
} from '../../views/sidebar-runner-view';

interface SidebarLeafHarness {
  leaf: any;
  order: string[];
  viewState: Record<string, unknown> | null;
  eState: Record<string, unknown> | null;
  ephemeralState: Record<string, unknown>;
}

function makeSidebarLeaf(deferred = false): SidebarLeafHarness {
  const order: string[] = [];
  const harness: SidebarLeafHarness = {
    order,
    viewState: null,
    eState: null,
    ephemeralState: {},
    leaf: null,
  };
  const leaf: any = {
    view: {},
    isDeferred: deferred,
    detached: false,
    detachCalls: 0,
    setEphemeralState: vi.fn((state: Record<string, unknown>) => {
      harness.ephemeralState = { ...state };
    }),
    getEphemeralState: vi.fn(() => harness.ephemeralState),
    setViewState: vi.fn(async (
      state: Record<string, unknown>,
      eState: Record<string, unknown>,
    ) => {
      order.push('setViewState');
      harness.viewState = state;
      harness.eState = eState;
      const view = new SidebarRunnerView({} as never, {} as never) as any;
      view.order = order;
      leaf.view = view;
    }),
    loadIfDeferred: vi.fn(async () => {
      order.push('loadIfDeferred');
      leaf.isDeferred = false;
    }),
    detach: vi.fn(() => {
      leaf.detachCalls += 1;
      leaf.detached = true;
    }),
  };
  harness.leaf = leaf;
  return harness;
}

function makePlugin(
  settings: Record<string, unknown>,
  sidebarLeaves: SidebarLeafHarness[] = [],
) {
  const rightLeafQueue = [...sidebarLeaves];
  const workspace = {
    getRightLeaf: vi.fn(() => rightLeafQueue.shift()?.leaf ?? null),
    getLeavesOfType: vi.fn(() => []),
    revealLeaf: vi.fn(async (leaf: any) => {
      const harness = sidebarLeaves.find(candidate => candidate.leaf === leaf);
      harness?.order.push('revealLeaf');
    }),
    detachLeavesOfType: vi.fn(),
  };
  const plugin = Object.create(RadiProtocolPlugin.prototype) as any;
  plugin.app = { workspace };
  plugin.settings = settings;
  plugin.inlineRunners = new Map();
  plugin.pickerModal = null;
  return { plugin, workspace };
}

function launch(startNodeId?: string) {
  return {
    protocolPath: 'Protocols/chest.rp.json',
    targetNote: new TFile('notes/report.md'),
    ...(startNodeId === undefined ? {} : { startNodeId }),
  };
}

beforeEach(() => {
  floatingInstances.length = 0;
  sidebarInstances.length = 0;
});

describe('floating runner presentation routing', () => {
  it.each([
    ['absent', {}],
    ['false', { useSidebarRunner: false }],
  ])('keeps floating dedup when the setting is %s', async (_name, settings) => {
    const { plugin, workspace } = makePlugin(settings);
    const context = launch('question-2');

    await plugin.openRunnerSession(context);
    await plugin.openRunnerSession(context);

    expect(workspace.getRightLeaf).not.toHaveBeenCalled();
    expect(floatingInstances).toHaveLength(1);
    expect(floatingInstances[0]!.args.slice(2)).toEqual([
      context.protocolPath,
      context.targetNote,
      'question-2',
    ]);
    expect(floatingInstances[0]!.open).toHaveBeenCalledTimes(1);
    expect(floatingInstances[0]!.focus).toHaveBeenCalledTimes(1);
    expect(plugin.getOpenInlineRunners()).toHaveLength(1);
  });

  it('keeps floating sessions with different explicit start nodes distinct', async () => {
    const { plugin } = makePlugin({ useSidebarRunner: false });
    const first = launch('question-1');
    const second = launch('question-2');

    await plugin.openRunnerSession(first);
    await plugin.openRunnerSession(second);
    await plugin.openRunnerSession(first);

    expect(floatingInstances).toHaveLength(2);
    expect(floatingInstances[0]!.args.slice(2)).toEqual([
      first.protocolPath,
      first.targetNote,
      'question-1',
    ]);
    expect(floatingInstances[1]!.args.slice(2)).toEqual([
      second.protocolPath,
      second.targetNote,
      'question-2',
    ]);
    expect(floatingInstances[0]!.focus).toHaveBeenCalledTimes(1);
    expect(floatingInstances[1]!.focus).not.toHaveBeenCalled();
  });
});

describe('sidebar runner presentation routing', () => {
  it('creates independent fresh right leaves for identical launches without singleton lookup', async () => {
    const first = makeSidebarLeaf();
    const second = makeSidebarLeaf();
    const { plugin, workspace } = makePlugin(
      { useSidebarRunner: true },
      [first, second],
    );
    const context = launch();

    await plugin.openRunnerSession(context);
    await plugin.openRunnerSession(context);

    expect(workspace.getRightLeaf).toHaveBeenNthCalledWith(1, false);
    expect(workspace.getRightLeaf).toHaveBeenNthCalledWith(2, false);
    expect(workspace.getLeavesOfType).not.toHaveBeenCalled();
    expect(floatingInstances).toHaveLength(0);
    expect(sidebarInstances).toHaveLength(2);
    expect(first.leaf).not.toBe(second.leaf);
    expect((first.leaf.view as SidebarRunnerView).initialize).toHaveBeenCalledWith(context);
    expect((second.leaf.view as SidebarRunnerView).initialize).toHaveBeenCalledWith(context);
  });

  it('passes an empty durable state and one-shot marker through leaf state and eState', async () => {
    const leaf = makeSidebarLeaf();
    const { plugin } = makePlugin({ useSidebarRunner: true }, [leaf]);

    await plugin.openRunnerSession(launch());

    expect(leaf.viewState).toEqual({
      type: SIDEBAR_RUNNER_VIEW_TYPE,
      active: true,
      state: {},
    });
    expect(leaf.eState).toEqual({ [SIDEBAR_RUNNER_LAUNCH_MARKER]: true });
    expect(leaf.leaf.setEphemeralState).toHaveBeenCalledWith(
      { [SIDEBAR_RUNNER_LAUNCH_MARKER]: true },
    );
  });

  it('awaits set, deferred load, reveal, concrete verification, and initialization in order', async () => {
    const leaf = makeSidebarLeaf(true);
    const { plugin } = makePlugin({ useSidebarRunner: true }, [leaf]);

    await plugin.openRunnerSession(launch('start-here'));

    expect(leaf.order).toEqual([
      'setViewState',
      'loadIfDeferred',
      'revealLeaf',
      'initialize',
    ]);
    expect(leaf.leaf.loadIfDeferred).toHaveBeenCalledTimes(1);
    expect((leaf.leaf.view as SidebarRunnerView).initialize).toHaveBeenCalledWith(
      launch('start-here'),
    );
  });

  it('skips deferred loading when the concrete view is already loaded', async () => {
    const leaf = makeSidebarLeaf(false);
    const { plugin } = makePlugin({ useSidebarRunner: true }, [leaf]);

    await plugin.openRunnerSession(launch());

    expect(leaf.order).toEqual(['setViewState', 'revealLeaf', 'initialize']);
    expect(leaf.leaf.loadIfDeferred).not.toHaveBeenCalled();
  });

  it('detaches the handoff leaf when setViewState does not produce the registered view', async () => {
    const leaf = makeSidebarLeaf();
    leaf.leaf.setViewState.mockImplementationOnce(async () => {
      leaf.order.push('setViewState');
      leaf.leaf.view = {};
    });
    const { plugin } = makePlugin({ useSidebarRunner: true }, [leaf]);

    await plugin.openRunnerSession(launch());

    expect(leaf.leaf.detach).toHaveBeenCalledTimes(1);
  });
});

describe('runner presentation unload wiring', () => {
  it('closes floating sessions and detaches every transient sidebar leaf', async () => {
    const { plugin, workspace } = makePlugin({ useSidebarRunner: true });
    const firstClose = vi.fn();
    const secondClose = vi.fn();
    plugin.inlineRunners.set('one', { close: firstClose });
    plugin.inlineRunners.set('two', { close: secondClose });

    await plugin.onunload();

    expect(firstClose).toHaveBeenCalledTimes(1);
    expect(secondClose).toHaveBeenCalledTimes(1);
    expect(plugin.inlineRunners.size).toBe(0);
    expect(workspace.detachLeavesOfType).toHaveBeenCalledWith(
      SIDEBAR_RUNNER_VIEW_TYPE,
    );
  });
});
```

### Success Criteria:

#### Automated Verification:

- [x] Focused Phase 5 behavior and prior floating/host/settings regressions pass: `npx vitest run src/__tests__/settings-tab.test.ts src/__tests__/runner-commands.test.ts src/__tests__/views/sidebar-runner-view.test.ts src/__tests__/views/runner-presentation-routing.test.ts src/__tests__/views/runner-session-host.test.ts src/__tests__/views/inline-runner-modal.test.ts src/__tests__/views/inline-runner-modal-keyboard.test.ts src/__tests__/views/inline-runner-modal-loop-body-file-bound.test.ts src/__tests__/views/inline-runner-modal-output-toolbar.test.ts src/__tests__/inline-runner-layout.test.ts src/__tests__/views/inline-runner-position.test.ts`
- [x] Strict TypeScript checking passes without emitting generated assets: `npx tsc --noEmit --pretty false`
- [x] Phase-owned TypeScript satisfies scoped ESLint without auto-fix: `npx eslint src/views/sidebar-runner-view.ts src/main.ts src/settings.ts src/__mocks__/obsidian.ts src/__tests__/settings-tab.test.ts src/__tests__/runner-commands.test.ts src/__tests__/views/sidebar-runner-view.test.ts src/__tests__/views/runner-presentation-routing.test.ts`
- [x] Phase-owned CSS satisfies scoped Stylelint without auto-fix: `npx stylelint src/styles/runner-session.css`
- [x] Read-only locale, registration, unload, transient-state, fresh-leaf, and unified-routing assertion passes: `node --input-type=module -e "import fs from 'node:fs'; import assert from 'node:assert/strict'; const main=fs.readFileSync('src/main.ts','utf8'); const view=fs.readFileSync('src/views/sidebar-runner-view.ts','utf8'); const en=JSON.parse(fs.readFileSync('src/i18n/locales/en.json','utf8')); const ru=JSON.parse(fs.readFileSync('src/i18n/locales/ru.json','utf8')); const leaves=(value,prefix='',out=[])=>{for(const [key,child] of Object.entries(value)){const path=prefix?prefix+'.'+key:key;if(child!==null&&typeof child==='object')leaves(child,path,out);else out.push(path);}return out.sort();}; assert.deepEqual(leaves(en),leaves(ru)); for(const locale of [en,ru]){assert.equal(typeof locale.settings.useSidebarRunner,'string');assert.equal(typeof locale.settings.useSidebarRunnerDesc,'string');for(const key of ['title','boundNote','activeNoteMismatch','focusNote','initializing'])assert.equal(typeof locale.sidebarRunner[key],'string');assert.match(locale.sidebarRunner.boundNote,/\{path\}/);} assert.match(main,/registerView\([\s\S]*SIDEBAR_RUNNER_VIEW_TYPE/); assert.match(main,/detachLeavesOfType\(SIDEBAR_RUNNER_VIEW_TYPE\)/); assert.match(main,/getRightLeaf\(false\)/); assert.doesNotMatch(main,/getLeavesOfType\(SIDEBAR_RUNNER_VIEW_TYPE\)/); assert.equal((main.match(/void this\.openRunnerSession\(\{/g)||[]).length,2); assert.equal((main.match(/new InlineRunnerModal\(/g)||[]).length,1); assert.match(main,/state:\s*\{\}/); assert.match(view,/getState\(\): Record<string, unknown> \{\s*return \{\};\s*\}/); assert.doesNotMatch(view,/getState[\s\S]{0,200}(protocolPath|targetNote|startNodeId)/);"`

#### Manual Verification:

- [ ] With the setting absent or disabled, launch the same protocol/note twice and confirm the existing floating panel is focused, its saved layout/cascade behavior is unchanged, and Start from node opens at the selected node.
- [ ] Enable the sidebar setting and launch the same protocol/note twice; confirm two independent right-sidebar leaves remain open and interactive.
- [ ] Reload Obsidian with a sidebar leaf present in workspace layout data; confirm the empty restored leaf detaches and no protocol path, note, start node, draft, or runner state resumes.
- [ ] Switch to another active note; confirm the sidebar session remains interactive, the localized mismatch status appears, and all output still targets the path shown in the bound-note chrome.
- [ ] Use Focus note with the target already open and then with it closed; confirm the existing Markdown leaf is revealed in the first case and a normal Markdown leaf opens in the second, without retargeting the runner.
- [ ] Verify Back and Redo delegation, input-safe Escape handling, sidebar Escape/Close detachment, completion auto-close, bootstrap-failure close, and immediate close when the bound note is deleted.
- [ ] Unload or disable the plugin with floating and sidebar sessions open; confirm floating DOM, sidebar leaves, host listeners, child pickers/modals, timers, and transient context are all released.
- [ ] Inspect the diff and confirm only the 11 Phase 5 plan-owned files changed; root `main.js` and `styles.css` are generated verification outputs rather than hand-authored phase changes.

## Final Whole-Plan Verification

_Owned by `/skill:validate` after all five phases are implemented. These repo-wide checks are intentionally outside phase-scoped verification because `npm run build` regenerates shared root assets._

### Automated Verification:
- [ ] Production build and generated bundles succeed: `npm run build`
- [ ] Repository lint passes: `npm run lint`
- [ ] Full Vitest suite passes: `npm test`
- [ ] Complete repository check passes: `npm run check`

## Ordering Constraints
- Phase 1 is the type/parser/runner foundation and must land first.
- Phase 2 depends on Phase 1 and establishes the shared host before either new runtime controls or sidebar mounting.
- Phase 3 depends on Phases 1-2 because renderer ports submit through the new runner API and host-owned draft maps.
- Phase 4 depends directly on Phase 1; it follows Phase 3 in execution so authored protocols immediately have a working runtime projection.
- Phase 5 depends on Phases 2-4 and is the only phase that registers/routes the sidebar presentation.
- No phases run in parallel in this blueprint; later phases may revisit host, CSS, locale, fixture, and test files only with incremental changes.

## Verification Notes
- Verify absent, explicit false, explicit true, malformed, and canonical-over-legacy flag projection.
- Verify only flagged Answers require a nonblank effective prompt; whitespace-only `displayLabel` masks `answerText` because it is the actual prompt expression.
- Verify blank submission returns before redo clearing, undo snapshot creation, accumulator mutation, successor traversal, and vault writes.
- Verify accepted input retains leading/trailing/internal whitespace exactly and uses the selected Answer's separator.
- Verify one undo restores the pre-command state and redo restores the complete submitted/downstream state without payload replay.
- Verify accumulator deltas include submitted text plus synchronous automatic Answer/text-block traversal.
- Verify destructive rerenders retain independent drafts by Answer ID and do not leak drafts across sessions.
- Verify sole-action focus counts all emitted Answer, Question-transition, and Snippet controls.
- Verify textarea input does not accumulate listeners/observers and the field has no internal scrollbar.
- Verify same-note writes serialize through the shared mutex and every write uses the captured target `TFile`.
- Verify two sidebar launches create two independent right leaves, even for the same protocol/note pair.
- Verify active-note changes do not disable the sidebar or retarget writes, and focus-note acts on a separate Markdown leaf.
- Verify completion/self-check and target-note deletion close/detach both shells according to the fixed policy.
- Verify absent/false setting preserves current floating dedup and both command paths preserve optional start-node context.
- Verify plugin unload detaches transient sidebar leaves and closes floating sessions without orphaned picker/fill/timer work.
- Verify source CSS registration/order; do not edit generated assets directly.
- Final whole-plan validation must run `npm run build`, `npm run lint`, `npm test`, and `npm run check`.

## Performance Considerations
- Resize a free-text textarea only on initial mount and its own `input` events using the established `height = auto; height = scrollHeight` pattern; do not add a `ResizeObserver` per field.
- Store drafts/errors in O(number of free-text Answers visited) session maps and release them on dispose.
- Keep protocol parsing/validation once per session start; active-note mismatch updates must only update sidebar chrome, not reload protocol state.
- Reuse path-keyed mutex concurrency: same-note writes serialize while independent notes remain concurrent.
- Generation checks are constant-time and prevent expensive stale render/modal/write follow-up work.

## Migration Notes
No schema-version migration is required. Existing V1 node fields are open-ended, and the parser normalizes absent or malformed `freeText` to runtime `false`; existing documents therefore retain preset behavior. New/edited Answers may persist explicit `false`. Rollback consists of removing/ignoring the additive field; older builds already preserve unknown node metadata at the document layer.

## Precedents & Lessons
- Preserve the accumulator-delta/fixed-note/mutex invariant from floating-runner commits `b03dc6a`, `88c8f84`, and follow-up fixes; raw submitted text must never bypass the delta path.
- Historical shared extraction `e516943` correctly kept vault/layout/lifecycle effects out of renderers, but its persisted singleton RunnerView was later removed by `b899821`; reuse the boundary, not the persistence/cardinality policy.
- The `optionOrder` field change (`6cb79e2`) demonstrates additive field propagation through model, parser, editor, renderer, i18n, CSS, and tests without a schema bump.
- Empty preset Answers are intentional compatibility behavior (`b043169`, `72b1106`); blank rejection is strictly flag-specific.
- The standalone free-text node removal (`a633de8`) is a negative precedent: extend Answer semantics rather than adding a node kind.
- Auto-growing textareas have required deferred layout and explicit overflow ownership (`a7c322b`, `a8cb5cc`); test both height updates and host scrolling.
- ItemView and picker precedents require idempotent teardown, generation guards, and detached-result suppression (`src/views/snippet-manager-view.ts:118-204`; `src/runner/render/render-snippet-picker.ts:81-111`).

## Pattern References
- `src/views/inline-runner-modal.ts:130-307,413-614,751-1041` — source behavior to extract without changing semantics.
- `src/views/snippet-manager-view.ts:194-300` — mounted/generation guard and close invalidation.
- `src/views/library-view.ts:84-244` — ItemView lifecycle, scoped events, and generation-guarded refresh.
- `src/runner/render/render-question.ts:14-165` — narrow renderer ports and authored/grouped ordering.
- `src/runner/render/render-snippet-picker.ts:38-126` — host-owned async child with stale and detached guards.
- `src/views/option-order-chip-editor.ts:37-119` — tracked raw listeners plus explicit destroy handle.
- `src/views/snippet-fill-in-modal.ts:231-267` and `src/styles/snippet-fill-modal.css:76-89` — scrollHeight-based textarea growth with hidden internal overflow.
- `src/main.ts:208-223` — post-`setViewState` concrete view handoff; do not copy singleton reuse.
- `src/main.ts:516-527` — floating protocol/note dedup retained only for the floating branch.
- `src/utils/write-mutex.ts:10-24` — path-keyed note write serialization.
- `e516943:src/runner/runner-host.ts` — historical narrow host contract and shell-owned lifecycle boundary.

## Developer Context

### Inherited fixed decisions from discover/research
- Primary user: radiologist; outcome combines persistent context with case-specific nuance.
- Keep the floating runner and add the sidebar.
- Free text remains an Answer selection with identical traversal/undo/separator/note-output flow.
- Every run stays bound to its start note.
- The normal Run command opens the sidebar when the preference is enabled.
- Sidebar cardinality is multiple leaves; sessions/drafts are transient.
- Active-note mismatch keeps the sidebar interactive, prominent, and focusable back to the bound note.
- Answer schema shape is a boolean toggle; authored Answer text is prompt-only.
- Submit is localized visible text; Mod+Enter submits and Enter inserts a newline.
- Blank input is rejected with an inline accessible alert and focus restoration.
- Textarea grows to natural full height; initial focus occurs only for the sole actionable option.
- Mixed preset/free-text Answers render inline in authored order.
- Shared host owns drafts keyed by Answer ID and both presentations share session behavior.
- A missing nonblank free-text prompt is a graph validation error.
- Accepted whitespace is preserved exactly.
- Start from specific node uses the same selected presentation.

### Blueprint checkpoint
**Q:** About to apply the mounted + monotonic-generation guard used by `SnippetManagerView` (`src/views/snippet-manager-view.ts:194-300`) to the new shared session host and sidebar ItemView so protocol reads, snippet fills, note writes, and completion timers cannot commit after close or rerender. Confirm that direction, or should this feature use a different async-ownership model?
**A:** Follow generation guards.

**Q:** The canonical Answer fields use concise camelCase nouns (`answerText`, `displayLabel`, `separator`) and existing booleans omit an `is` prefix (`loop` at `src/protocol/protocol-document-parser.ts:220-221`; `startPointEnabled` at `src/views/protocol-editor-view.ts:2355-2362`). Which exact boolean name should mark a user-entered Answer across `.rp.json`, `AnswerNode`, editor, renderer, and tests?
**A:** `freeText`.

**Q:** The floating runner currently closes on completion when self-check is disabled/empty, and closes after the final self-check item (`src/views/inline-runner-modal.ts:522-553`). The removed sidebar `RunnerView` instead remained open on a completion screen (`e516943:src/views/runner-view.ts:546-565`). What should a sidebar runner leaf do when its protocol is complete?
**A:** Auto-close like floating.

**Q:** A session writes only to its constructor-bound `TFile` (`src/views/inline-runner-modal.ts:775-792`), and the floating shell closes when that file is deleted (`src/views/inline-runner-modal.ts:665-684`). If a bound note is deleted while a sidebar session is open, what should its leaf do?
**A:** Close leaf.

**Design confirmation:** Proceed with shared session host, `freeText`, generation guards, auto-close terminal policy, and fixed-note sidebar scope.

**Decomposition confirmation:** Approved five sequential slices: contract, shared host, runtime controls, authoring, and sidebar routing.

## Plan History
- Phase 1: Free-text Answer contract and pure command — approved as generated
- Phase 2: Shared session host with floating parity — revised during Step 9: localized note-write recovery, recoverable snippet-resolution errors, and synthetic-separator provenance
- Phase 3: Free-text runner controls and drafts — revised during Step 9: first-chunk authored-leading-whitespace integration coverage
- Phase 4: Protocol authoring toggle — approved as generated
- Phase 5: Multi-leaf sidebar presentation and routing — revised during Step 9: bound-note rename chrome, presentation-neutral command name, and start-node-aware floating identity

## Plan Review (Step 8)

_Independent post-finalization review by artifact-code-reviewer and artifact-coverage-reviewer subagents. Findings triaged at Step 9._

| source | plan-loc | codebase-loc | severity | dimension | finding | recommendation | resolution |
| --- | --- | --- | --- | --- | --- | --- | --- |
| coverage | ## Verification Notes §17 | <n/a> | blocker | verification-coverage | Final whole-plan validation commands are not routed to any phase Success Criteria or visible code. | Add a final Phase 5 Automated Verification bullet running `npm run build && npm run lint && npm test && npm run check`. | applied: added a dedicated validate-owned final whole-plan verification block outside write-scoped phases with all four commands |
| code | Phase 1 §5 (`protocol-runner.ts`) | `src/runner/protocol-runner.ts:833` | concern | code-quality | Automatic traversal turns a flagged free-text Answer into an empty pass-through, so supported Answer chains and loop-body Answers can skip the prompt without rendering an input. | Reject automatically reachable free-text Answers or add a runner state that halts and renders their control. | dismissed: prompt-only pass-through for non-actionable automatic chains was an explicit approved Phase 1 decision with focused coverage |
| code | Phase 2 §1 (`runner-session-host.ts`) | `src/views/inline-runner-modal.ts:791` | concern | code-quality | Vault read/modify failures can reject through `void` callbacks, leaving the runner advanced while the DOM remains on stale pre-selection state. | Catch write failures, notify the user, and render current runner state in a `finally` path. | applied: caught lifecycle-current write failures, logged/localized a notice, allowed current-state reprojection, and added focused coverage |
| code | Phase 2 §1 (`runner-session-host.ts`) | `src/views/inline-runner-modal.ts:986` | concern | code-quality | `resolveSnippet()` rejection can become unhandled and leave the session indefinitely on the loading projection. | Catch resolution failures under the operation-generation guard and render a recoverable error with Back available. | applied: caught generation-current resolution failures, logged/localized an inline error, exposed Back/Redo, and added rejection coverage |
| code | Phase 3 §2 (`runner-session-host.ts`) | `src/runner/text-accumulator.ts:26` | concern | code-quality | Note separator de-duplication can strip authored leading whitespace from a first free-text chunk because that chunk has no synthetic separator. | Track whether the delta has a synthetic leading separator and de-duplicate only in that case. | applied: accumulator deltas now carry synthetic-prefix provenance; only generated separators are de-duplicated, with first-chunk whitespace coverage |
| code | Phase 5 §1 (`sidebar-runner-view.ts`) | <n/a> | concern | code-quality | Bound-note chrome renders the path once, so a bound `TFile` rename can leave displayed destination text stale. | Subscribe to vault rename and refresh the bound-note banner for the target file. | applied: added target-file rename subscription, bound-note rerendering, cleanup, and focused test coverage |
| code | Phase 5 §2 (`main.ts`) | `src/main.ts:517` | concern | code-quality | Floating dedup identity remains `protocolPath#notePath`, so Start from node may focus an existing run and discard a different requested `startNodeId`. | Include `startNodeId` in floating registry identity and unregister with the same identity. | applied: added one shared registry-key helper with optional encoded start-node suffix, used for lookup/register/unregister, plus collision coverage |
| code | Phase 5 §2 (`main.ts`) | `src/main.ts:139` | concern | codebase-fit | The command remains named “Run protocol in inline” even when the setting routes it to the sidebar. | Rename the command display text to the presentation-neutral “Run protocol”. | applied: changed display name to “Run protocol” while preserving the command ID and added a source assertion |

## References
- `.rpiv/artifacts/research/2026-08-19_23-13-03_sidebar-runner-and-free-text-answers.md`
- `.rpiv/artifacts/discover/2026-08-19_22-22-49_sidebar-runner-and-free-text-answers.md`
- [Obsidian Workspace.getRightLeaf](https://docs.obsidian.md/Reference/TypeScript+API/Workspace/getRightLeaf)
- [Obsidian custom views](https://docs.obsidian.md/Plugins/User+interface/Views)
- [Obsidian WorkspaceLeaf.setViewState](https://docs.obsidian.md/Reference/TypeScript+API/WorkspaceLeaf/setViewState)
- [Obsidian WorkspaceLeaf.detach](https://docs.obsidian.md/Reference/TypeScript+API/WorkspaceLeaf/detach)
- Historical commits: `e516943`, `b899821`, `6cb79e2`, `a633de8`, `a7c322b`, `a8cb5cc`.
