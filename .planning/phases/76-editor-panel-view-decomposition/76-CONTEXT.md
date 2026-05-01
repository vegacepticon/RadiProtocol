# Phase 76 Context — editor-panel-view.ts Decomposition

## Goal
Decompose `src/views/editor-panel-view.ts` into per-node-kind form modules under `src/views/editor-panel/forms/`. Keep `editor-panel-view.ts` under 400 LOC as a dispatcher that owns shared concerns only:

- view lifecycle and canvas listener wiring
- Phase 63 canvas-sync subscription and `registerFieldRef` surface
- Phase 64 quick-create / duplicate toolbar
- save/autosave pipeline
- high-level node-form dispatch

## Requirements

- **SPLIT-01** — per-kind form modules exist and `editor-panel-view.ts` is <400 LOC.
- **SPLIT-02** — existing editor-panel tests continue to pass with unchanged assertion semantics.

## Baseline

- `src/views/editor-panel-view.ts`: 1230 LOC
- Relevant tests:
  - `src/__tests__/editor-panel-create.test.ts`
  - `src/__tests__/editor-panel-forms.test.ts`
  - `src/__tests__/editor-panel-loop-form.test.ts`
  - `src/__tests__/editor-panel.test.ts`
  - `src/__tests__/views/editor-panel-canvas-sync.test.ts`
  - `src/__tests__/views/editor-panel-snippet-picker.test.ts`
- Current gate after Phase 78:
  - `npm run build` exits 0
  - `npm run lint` exits 0 with 2 documented warnings
  - `npm test` exits 0 (818 passed, 1 skipped)

## Module boundary

Create `src/views/editor-panel/forms/`:

- `_shared.ts` — `FormContext` interface only.
- `start-form.ts` — start-node informational form.
- `question-form.ts` — question text form, dual write to `radiprotocol_questionText` and `text`, Phase 63 field registration.
- `answer-form.ts` — answer display label, answer text, separator override.
- `text-block-form.ts` — text-block content, separator override.
- `loop-form.ts` — loop header form plus legacy `loop-start` / `loop-end` informational arms.
- `snippet-form.ts` — snippet picker, snippet label, separator override.

Keep in `editor-panel-view.ts`:

- `EditorPanelView` class lifecycle and Obsidian `ItemView` boilerplate.
- `attachCanvasListener`, `handleNodeClick`, active-canvas path helpers.
- `renderIdle`, `renderError`, `renderForm` shell.
- Slim `buildKindForm` switch that delegates by kind.
- `makeFormContext` factory.
- `renderGrowableTextarea` helper.
- `registerFieldRef`, `patchTextareaValue`, `applyCanvasPatch`, `formFieldRefs`, `pendingCanvasUpdate`.
- `saveNodeEdits`, `scheduleAutoSave`, saved indicator.
- `renderToolbar`, `onQuickCreate`, `onDuplicate`.
- `snippetTreePicker` field and old-picker unmount at the head of `buildKindForm`.

## FormContext contract

Form modules must be synchronous DOM builders. They receive only a constrained context:

```ts
export interface FormContext {
  pendingEdits: Record<string, unknown>;
  registerFieldRef: (key: string, el: HTMLInputElement | HTMLTextAreaElement) => void;
  scheduleAutoSave: () => void;
  renderGrowableTextarea: (container: HTMLElement, opts: GrowableTextareaOptions) => HTMLTextAreaElement;
  plugin: RadiProtocolPlugin;
  app: App;
  setSnippetTreePicker: (picker: SnippetTreePicker | null) => void;
}
```

Form modules must not import or mutate `EditorPanelView` directly.

## Threat model

- **T-76-01 field-key drift**: changing `registerFieldRef` keys breaks Phase 63 canvas → form patches. Mitigation: preserve string keys verbatim and run `editor-panel-canvas-sync` tests after every extraction.
- **T-76-02 SnippetTreePicker leak**: old picker must be unmounted before any new form is rendered. Mitigation: unmount block stays at the head of dispatcher `buildKindForm`.
- **T-76-03 quick-create divergence**: `onQuickCreate` re-renders from in-memory node data; form modules must not introduce new I/O or async dependencies.
- **T-76-04 LOC miss**: dispatcher may stay over 400 if shared helpers are not reduced enough. Mitigation: extract all per-kind `Setting` bodies and verify with `wc -l` in final plan.
- **T-76-05 test-surface breakage**: tests use private methods via bracket access. Mitigation: preserve `buildKindForm`, `renderForm`, `renderToolbar`, `onQuickCreate`, `handleNodeClick`, and map fields on the class.

## Out of scope

- No user-facing changes.
- No model changes (`RPNodeKind`, graph parser/validator, runner state machine).
- No CSS changes.
- No dependency changes.
- No test assertion rewrites unless strictly mechanical.
