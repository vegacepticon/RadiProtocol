---
date: 2026-06-04T11:30:58+0300
author: Roman Shulgha
commit: b7f9626
branch: main
repository: RadiProtocol
topic: "Protocol Editor node creation flicker root-cause fix"
tags: [plan, protocol-editor, node-creation, flicker, modal, ux]
status: ready
parent: null
phase_count: 2
unresolved_phase_count: 0
last_updated: 2026-06-04T11:30:58+0300
last_updated_by: Roman Shulgha
---

# Protocol Editor Node Creation Flicker Root-Cause Fix Implementation Plan

## Overview

Fix the persistent single flash during Protocol Editor node creation by preserving visual continuity between the node-kind picker and the edit modal. Current code already avoids full canvas reloads after creation; this plan targets the remaining one-frame picker/backdrop teardown gap while keeping node creation persistence and incremental rendering unchanged.

## Requirements

- Reproduce or reason through the full node creation flow before fixing.
- Identify the exact likely cause of the single flash/flicker.
- Implement the smallest clean fix only after diagnosis.
- Ensure a newly created node is rendered in its final intended visual state on first visible paint.
- Cover both standalone empty-canvas node creation and drag-edge-to-empty-canvas connected creation.
- Do not make broad cosmetic changes or rewrite the editor architecture.
- Remove any temporary instrumentation before finishing.
- Run relevant build, tests, linting, and/or validation checks.

## Current State Analysis

The previous successful incremental-creation fix removed the old full `loadProtocol()` canvas teardown from node creation, but the current working tree still closes the node-kind picker before async persistence completes. The canvas is therefore briefly exposed without either the picker backdrop or the edit modal backdrop, which is consistent with a single visible flash at creation time.

### Key Discoveries

- `src/views/protocol-editor-view.ts:728-730` closes/removes the standalone node-kind picker before calling `addNodeAtWorldPoint()`.
- `src/views/protocol-editor-view.ts:755-757` closes/removes the connected node-kind picker before calling `addNodeAndConnectAtWorldPoint()`.
- `src/views/protocol-editor-view.ts:696-703` appends/persists the standalone node asynchronously, then applies the updated document and opens the edit modal only in the `.then()` continuation.
- `src/views/protocol-editor-view.ts:770-799` does the same for connected node creation plus edge creation.
- `src/views/protocol-editor-view.ts:889-908` already applies created documents incrementally via `applyCreatedProtocolDocument()`, so the old full-canvas reload/teardown root cause is not the current primary suspect.
- `src/views/protocol-editor-view.ts:831-887` renders the created node synchronously in one task and calls `applyNodePosition()` before control returns to the browser, making a painted temporary/default node position unlikely.
- `src/styles/protocol-editor.css:132-142` has no node mount transition/animation/opacity rule, so CSS animation is not the likely source of the creation flash.
- `src/styles/protocol-editor.css:449-450` and `:678` define transitions for resize handles and floating actions, not node creation.
- `src/__tests__/views/protocol-editor-keyboard.test.ts:1` demonstrates the project's hand-rolled Node-environment DOM mock pattern for Protocol Editor view tests.
- `.rpiv/artifacts/validation/2026-06-04_11-07-53_protocol-editor-canvas-ux-follow-up-node-creation-flash-live-edge-dragging-orthogonal-corners.md` confirms prior automated validation proved no node creation continuation still reloads the protocol, while manual visual QA remained required.

## Desired End State

```typescript
// Picker click keeps the picker/backdrop alive while the async create runs.
btn.addEventListener('click', () => {
  markNodeKindPickerBusy(modalEl);
  this.addNodeAtWorldPoint(kind, x, y, {
    onEditModalOpened: () => closeModal({ restoreFocus: false }),
    onCreateFailed: () => restoreNodeKindPicker(modalEl),
  });
});
```

```typescript
// Creation still persists first and renders incrementally, but the edit modal is
// opened before the picker backdrop is removed, so the user never sees a bare
// intermediate canvas frame.
const createdNode = this.applyCreatedProtocolDocument(updated, newNode.id) ?? newNode;
this.openEditModal(createdNode, { autofocusFirstTextField: true });
options?.onEditModalOpened?.();
```

## What We're NOT Doing

- No optimistic node insertion before the vault write completes.
- No rollback system for failed optimistic creates.
- No full Protocol Editor renderer rewrite.
- No React/StrictMode-related changes; this view is imperative DOM code, not React.
- No changes to protocol schema, parser, node kinds, edge semantics, or auto-layout.
- No broad CSS animation/transition workaround.
- No change to the established incremental `applyCreatedProtocolDocument()` creation path except adding lifecycle callbacks for modal handoff.

## Decisions

### Root cause is the async picker-to-edit-modal lifecycle gap

The old full-canvas teardown cause was addressed by incremental creation (`src/views/protocol-editor-view.ts:889-908`). Current creation still removes the picker backdrop before async persistence and edit-modal creation (`src/views/protocol-editor-view.ts:728-730`, `:755-757`, `:696-703`, `:770-799`). The single flash is therefore most consistent with the visible gap between two modal backdrops, not with a temporary node position, remount, delayed layout effect, React batching, or CSS node animation.

### Keep persistence-before-render and use continuous modal handoff

Optimistic insertion could eliminate the async gap but would add rollback and stale-write complexity. The chosen fix preserves the existing persistence-first flow and simply keeps the picker/backdrop mounted until `openEditModal()` has created the next backdrop. Developer confirmed this direction during the Step 4 checkpoint.

### Test callback ordering instead of visual pixels

The visual flash itself requires Obsidian manual QA, but the root condition is testable: successful creation handoff should fire only after the edit modal has been opened. Stale creation should use an abandonment callback without opening the edit modal or invoking the successful handoff callback; failed persistence should use a failure callback so the picker can be re-enabled. Tests will use the existing Protocol Editor private-method/view-mock style.

## Phase 1: Continuous Creation Modal Handoff

### Overview

Adds node-creation lifecycle callbacks and changes both node-kind pickers to keep their backdrop mounted until the edit modal is opened. Foundation phase; no dependency on later tests.

### Changes Required:

#### 1. src/views/protocol-editor-view.ts:689-800,709-757
**File**: src/views/protocol-editor-view.ts
**Changes**: MODIFY — add creation callback options, delay picker removal until after edit modal creation, and avoid restoring canvas focus during successful picker-to-edit handoff.

```typescript
// Add near the other Protocol Editor helper interfaces, after ProtocolEditorLayoutOptions.
interface ProtocolEditorCreateNodeOptions {
  onEditModalOpened?: () => void;
  onCreateAbandoned?: () => void;
  onCreateFailed?: () => void;
}

// Add near the picker/create helpers.
private setNodeKindPickerBusy(modalEl: HTMLElement, busy: boolean): void {
  modalEl.toggleClass('is-saving', busy);
  for (const button of Array.from(modalEl.querySelectorAll('button'))) {
    (button as HTMLButtonElement).disabled = busy;
  }
}

// Replace addNodeAtWorldPoint() with:
private addNodeAtWorldPoint(
  kind: RPNodeKind | null,
  x: number,
  y: number,
  options: ProtocolEditorCreateNodeOptions = {},
): void {
  if (this.doc === null || this.protocolPath === null) {
    options.onCreateAbandoned?.();
    return;
  }

  const newNode = this.createProtocolEditorNode(kind, x, y);
  const protocolPath = this.protocolPath;
  const generation = this.loadGeneration;

  void this.plugin.protocolDocumentStore.update(protocolPath, (existing) => {
    if (existing === null) protocolMissingFileError();
    return { ...existing, nodes: [...existing.nodes, newNode], viewport: this.currentViewportState(), updatedAt: new Date().toISOString() };
  }).then((updated) => {
    try {
      if (this.protocolPath !== protocolPath || this.loadGeneration !== generation) {
        options.onCreateAbandoned?.();
        return;
      }
      const createdNode = this.applyCreatedProtocolDocument(updated, newNode.id) ?? newNode;
      this.openEditModal(createdNode, { autofocusFirstTextField: true });
      options.onEditModalOpened?.();
      new Notice(this.plugin.i18n.t('protocolEditor.nodeCreated'));
    } catch (err) {
      console.error('[RadiProtocol] Failed to update Protocol Editor UI after creating node:', err);
      new Notice(this.plugin.i18n.t('protocolEditor.saveFailed', { error: String(err) }));
    }
  }, (err) => {
    options.onCreateFailed?.();
    new Notice(this.plugin.i18n.t('protocolEditor.saveFailed', { error: String(err) }));
  });
}

// Replace openNodeKindPickerAtWorldPoint() with:
private openNodeKindPickerAtWorldPoint(x: number, y: number): void {
  if (this.doc === null || this.protocolPath === null) return;
  const t = this.plugin.i18n.t.bind(this.plugin.i18n);
  const modalEl = document.body.createDiv({ cls: 'rp-protocol-editor-modal-backdrop' });
  const modal = modalEl.createDiv({ cls: 'rp-protocol-editor-modal rp-protocol-editor-node-kind-modal' });
  const header = modal.createDiv({ cls: 'rp-protocol-editor-modal-header' });
  header.createEl('h3', { text: t('protocolEditor.chooseNodeType') });
  const closeBtn = header.createEl('button', { cls: 'rp-protocol-editor-modal-close', text: '✕', attr: { 'aria-label': t('protocolEditor.close') } });
  let isCreating = false;
  const closeModal = (options?: { restoreFocus?: boolean }) => {
    modalEl.remove();
    if (options?.restoreFocus !== false) this.restoreEditorFocus();
  };
  const beginCreate = () => {
    isCreating = true;
    this.setNodeKindPickerBusy(modalEl, true);
  };
  const restorePicker = () => {
    isCreating = false;
    this.setNodeKindPickerBusy(modalEl, false);
  };
  closeBtn.addEventListener('click', () => {
    if (isCreating) return;
    closeModal();
  });

  const body = modal.createDiv({ cls: 'rp-protocol-editor-modal-body' });
  const grid = body.createDiv({ cls: 'rp-protocol-editor-node-kind-grid' });
  for (const kind of EDITABLE_NODE_KINDS) {
    const btn = grid.createEl('button', {
      cls: 'rp-protocol-editor-node-kind-choice',
      text: t(`protocolEditor.nodeKind.${kind}`),
    });
    btn.setAttr('data-node-kind', kind);
    btn.addEventListener('click', () => {
      if (isCreating) return;
      beginCreate();
      this.addNodeAtWorldPoint(kind, x, y, {
        onEditModalOpened: () => closeModal({ restoreFocus: false }),
        onCreateAbandoned: () => closeModal(),
        onCreateFailed: restorePicker,
      });
    });
  }
  modalEl.addEventListener('click', (e) => {
    if (isCreating) return;
    if (e.target === modalEl) closeModal();
  });
}

// Replace openNodeKindPickerAndConnectAtWorldPoint() with:
private openNodeKindPickerAndConnectAtWorldPoint(fromNodeId: string, x: number, y: number): void {
  if (this.doc === null || this.protocolPath === null) return;
  const t = this.plugin.i18n.t.bind(this.plugin.i18n);
  const modalEl = document.body.createDiv({ cls: 'rp-protocol-editor-modal-backdrop' });
  const modal = modalEl.createDiv({ cls: 'rp-protocol-editor-modal rp-protocol-editor-node-kind-modal' });
  const header = modal.createDiv({ cls: 'rp-protocol-editor-modal-header' });
  header.createEl('h3', { text: t('protocolEditor.chooseNodeType') });
  const closeBtn = header.createEl('button', { cls: 'rp-protocol-editor-modal-close', text: '✕', attr: { 'aria-label': t('protocolEditor.close') } });
  let isCreating = false;
  const closeModal = (options?: { restoreFocus?: boolean }) => {
    modalEl.remove();
    if (options?.restoreFocus !== false) this.restoreEditorFocus();
  };
  const beginCreate = () => {
    isCreating = true;
    this.setNodeKindPickerBusy(modalEl, true);
  };
  const restorePicker = () => {
    isCreating = false;
    this.setNodeKindPickerBusy(modalEl, false);
  };
  closeBtn.addEventListener('click', () => {
    if (isCreating) return;
    closeModal();
  });

  const body = modal.createDiv({ cls: 'rp-protocol-editor-modal-body' });
  const grid = body.createDiv({ cls: 'rp-protocol-editor-node-kind-grid' });
  for (const kind of EDITABLE_NODE_KINDS) {
    const btn = grid.createEl('button', {
      cls: 'rp-protocol-editor-node-kind-choice',
      text: t(`protocolEditor.nodeKind.${kind}`),
    });
    btn.setAttr('data-node-kind', kind);
    btn.addEventListener('click', () => {
      if (isCreating) return;
      beginCreate();
      this.addNodeAndConnectAtWorldPoint(fromNodeId, kind, x, y, {
        onEditModalOpened: () => closeModal({ restoreFocus: false }),
        onCreateAbandoned: () => closeModal(),
        onCreateFailed: restorePicker,
      });
    });
  }
  modalEl.addEventListener('click', (e) => {
    if (isCreating) return;
    if (e.target === modalEl) closeModal();
  });
}

// Replace addNodeAndConnectAtWorldPoint() signature and .then/.catch handling with:
private addNodeAndConnectAtWorldPoint(
  fromNodeId: string,
  kind: RPNodeKind | null,
  x: number,
  y: number,
  options: ProtocolEditorCreateNodeOptions = {},
): void {
  if (this.doc === null || this.protocolPath === null) {
    options.onCreateAbandoned?.();
    return;
  }

  const newNode = this.createProtocolEditorNode(kind, x, y);
  const protocolPath = this.protocolPath;
  const generation = this.loadGeneration;

  void this.plugin.protocolDocumentStore.update(protocolPath, (existing) => {
    if (existing === null) protocolMissingFileError();
    const sourceNode = existing.nodes.find((n) => n.id === fromNodeId);
    const targetNode = { ...newNode };
    const defaultLabel = defaultProtocolEditorEdgeLabelForTarget(targetNode);
    const shouldDisplay = shouldDisplayProtocolEditorEdgeLabel(
      { id: 'preview', fromNodeId, toNodeId: newNode.id, label: defaultLabel },
      sourceNode,
      targetNode,
    );
    const newEdge: ProtocolEdgeRecord = {
      id: edgeUid(),
      fromNodeId,
      toNodeId: newNode.id,
      label: shouldDisplay ? defaultLabel : undefined,
    };
    const edges = canCreateProtocolEditorEdge(existing.edges, fromNodeId, newNode.id) === 'ok'
      ? [...existing.edges, newEdge]
      : existing.edges;
    return {
      ...existing,
      nodes: [...existing.nodes, newNode],
      edges,
      viewport: this.currentViewportState(),
      updatedAt: new Date().toISOString(),
    };
  }).then((updated) => {
    try {
      if (this.protocolPath !== protocolPath || this.loadGeneration !== generation) {
        options.onCreateAbandoned?.();
        return;
      }
      const createdNode = this.applyCreatedProtocolDocument(updated, newNode.id) ?? newNode;
      this.openEditModal(createdNode, { autofocusFirstTextField: true });
      options.onEditModalOpened?.();
      new Notice(this.plugin.i18n.t('protocolEditor.nodeCreated'));
    } catch (err) {
      console.error('[RadiProtocol] Failed to update Protocol Editor UI after creating connected node:', err);
      new Notice(this.plugin.i18n.t('protocolEditor.saveFailed', { error: String(err) }));
    }
  }, (err) => {
    options.onCreateFailed?.();
    new Notice(this.plugin.i18n.t('protocolEditor.saveFailed', { error: String(err) }));
  });
}
```

### Success Criteria:

#### Automated Verification:
- [x] Type checking accepts the creation callback signatures and picker busy helper: `npx tsc --noEmit`
- [x] Creation handoff callbacks are present in both creation paths: `grep -n "onEditModalOpened" src/views/protocol-editor-view.ts` returns at least 4 matches
- [x] Node creation continuations still do not reload the full protocol: `grep -n "await this.loadProtocol(this.protocolPath!)" src/views/protocol-editor-view.ts` does not report the `addNodeAtWorldPoint()` or `addNodeAndConnectAtWorldPoint()` continuations

#### Manual Verification:
- [ ] Create a standalone node from the node-kind picker; the picker remains visually present until the edit modal appears, with no bare-canvas flash between them.
- [ ] Create a connected node by dragging an edge to empty canvas; the picker remains visually present until the edit modal appears, with no bare-canvas flash between them.
- [ ] Trigger a save failure if possible; the picker controls become usable again and a save-failed notice is shown.

## Phase 2: Regression Coverage and Validation

### Overview

Adds focused tests for the creation handoff contract and runs the relevant Protocol Editor and repository validation commands. Depends on Phase 1.

### Changes Required:

#### 1. src/__tests__/views/protocol-editor-save-node-geometry.test.ts
**File**: src/__tests__/views/protocol-editor-save-node-geometry.test.ts
**Changes**: MODIFY — add regression tests for successful creation callback ordering, stale creation abandonment, and failed creation recovery using the existing private-method view test style.

```typescript
// Add after the existing `ProtocolEditorView — saveNodeGeometry` describe block.
describe('ProtocolEditorView — node creation modal handoff', () => {
  it('runs standalone creation handoff only after opening the edit modal', async () => {
    const update = vi.fn<StoreUpdate>(async (_protocolPath, mutator) => mutator(makeDoc(makeNode())));
    const { view } = createView(update);
    const order: string[] = [];

    vi.spyOn(view as any, 'applyCreatedProtocolDocument').mockImplementation((updated: ProtocolDocumentV1, newNodeId: string) => {
      order.push('apply-created');
      (view as any).doc = updated;
      return updated.nodes.find((node) => node.id === newNodeId) ?? null;
    });
    vi.spyOn(view as any, 'openEditModal').mockImplementation(() => {
      order.push('open-edit-modal');
    });

    await new Promise<void>((resolve) => {
      (view as any).addNodeAtWorldPoint('question', 32, 48, {
        onEditModalOpened: () => {
          order.push('handoff');
          resolve();
        },
      });
    });

    expect(order).toEqual(['apply-created', 'open-edit-modal', 'handoff']);
    expect(update).toHaveBeenCalledWith('Protocols/current.rp.json', expect.any(Function));
  });

  it('runs connected creation handoff only after opening the edit modal', async () => {
    const source = makeNode({ id: 'source', kind: 'question' });
    const doc = makeDoc(source);
    const update = vi.fn<StoreUpdate>(async (_protocolPath, mutator) => mutator(doc));
    const { view } = createView(update, doc);
    const order: string[] = [];

    vi.spyOn(view as any, 'applyCreatedProtocolDocument').mockImplementation((updated: ProtocolDocumentV1, newNodeId: string) => {
      order.push('apply-created');
      (view as any).doc = updated;
      return updated.nodes.find((node) => node.id === newNodeId) ?? null;
    });
    vi.spyOn(view as any, 'openEditModal').mockImplementation(() => {
      order.push('open-edit-modal');
    });

    await new Promise<void>((resolve) => {
      (view as any).addNodeAndConnectAtWorldPoint('source', 'answer', 120, 64, {
        onEditModalOpened: () => {
          order.push('handoff');
          resolve();
        },
      });
    });

    expect(order).toEqual(['apply-created', 'open-edit-modal', 'handoff']);
    expect(update).toHaveBeenCalledWith('Protocols/current.rp.json', expect.any(Function));
  });

  it('abandons stale standalone creation without opening the edit modal or successful handoff', async () => {
    let viewRef: ProtocolEditorView | null = null;
    const update = vi.fn<StoreUpdate>(async (_protocolPath, mutator) => {
      if (viewRef === null) throw new Error('view not initialized');
      (viewRef as any).loadGeneration += 1;
      return mutator(makeDoc(makeNode()));
    });
    const { view } = createView(update);
    viewRef = view;
    let handoffCount = 0;
    let abandonedCount = 0;
    const openEditModal = vi.spyOn(view as any, 'openEditModal').mockImplementation(() => {});

    await new Promise<void>((resolve) => {
      (view as any).addNodeAtWorldPoint('question', 0, 0, {
        onEditModalOpened: () => {
          handoffCount += 1;
        },
        onCreateAbandoned: () => {
          abandonedCount += 1;
          resolve();
        },
      });
    });

    expect(handoffCount).toBe(0);
    expect(abandonedCount).toBe(1);
    expect(openEditModal).not.toHaveBeenCalled();
  });

  it('runs failed-creation recovery without opening the edit modal or successful handoff', async () => {
    const update = vi.fn<StoreUpdate>(async () => {
      throw new Error('write failed');
    });
    const { view } = createView(update);
    let handoffCount = 0;
    let failureCount = 0;
    const openEditModal = vi.spyOn(view as any, 'openEditModal').mockImplementation(() => {});

    await new Promise<void>((resolve) => {
      (view as any).addNodeAtWorldPoint('question', 0, 0, {
        onEditModalOpened: () => {
          handoffCount += 1;
        },
        onCreateFailed: () => {
          failureCount += 1;
          resolve();
        },
      });
    });

    expect(handoffCount).toBe(0);
    expect(failureCount).toBe(1);
    expect(openEditModal).not.toHaveBeenCalled();
  });

  it('abandons stale connected creation without opening the edit modal or successful handoff', async () => {
    const source = makeNode({ id: 'source', kind: 'question' });
    const doc = makeDoc(source);
    let viewRef: ProtocolEditorView | null = null;
    const update = vi.fn<StoreUpdate>(async (_protocolPath, mutator) => {
      if (viewRef === null) throw new Error('view not initialized');
      (viewRef as any).loadGeneration += 1;
      return mutator(doc);
    });
    const { view } = createView(update, doc);
    viewRef = view;
    let handoffCount = 0;
    let abandonedCount = 0;
    const openEditModal = vi.spyOn(view as any, 'openEditModal').mockImplementation(() => {});

    await new Promise<void>((resolve) => {
      (view as any).addNodeAndConnectAtWorldPoint('source', 'answer', 0, 0, {
        onEditModalOpened: () => {
          handoffCount += 1;
        },
        onCreateAbandoned: () => {
          abandonedCount += 1;
          resolve();
        },
      });
    });

    expect(handoffCount).toBe(0);
    expect(abandonedCount).toBe(1);
    expect(openEditModal).not.toHaveBeenCalled();
  });

  it('runs failed connected-creation recovery without opening the edit modal or successful handoff', async () => {
    const source = makeNode({ id: 'source', kind: 'question' });
    const doc = makeDoc(source);
    const update = vi.fn<StoreUpdate>(async () => {
      throw new Error('write failed');
    });
    const { view } = createView(update, doc);
    let handoffCount = 0;
    let failureCount = 0;
    const openEditModal = vi.spyOn(view as any, 'openEditModal').mockImplementation(() => {});

    await new Promise<void>((resolve) => {
      (view as any).addNodeAndConnectAtWorldPoint('source', 'answer', 0, 0, {
        onEditModalOpened: () => {
          handoffCount += 1;
        },
        onCreateFailed: () => {
          failureCount += 1;
          resolve();
        },
      });
    });

    expect(handoffCount).toBe(0);
    expect(failureCount).toBe(1);
    expect(openEditModal).not.toHaveBeenCalled();
  });
});
```

### Success Criteria:

#### Automated Verification:
- [x] Focused creation handoff and save geometry tests pass: `npx vitest run src/__tests__/views/protocol-editor-save-node-geometry.test.ts`
- [x] Existing keyboard/modal tests pass: `npx vitest run src/__tests__/views/protocol-editor-keyboard.test.ts`
- [x] Type checking passes: `npx tsc --noEmit`
- [x] Production build passes: `npm run build`
- [x] Full test suite passes: `npm test`
- [ ] Lint passes: `npm run lint` (pre-existing environment issue with missing manifest.json — unrelated to changes)
- [x] Node creation continuations still do not reload the full protocol: `grep -n "await this.loadProtocol(this.protocolPath!)" src/views/protocol-editor-view.ts` does not report the `addNodeAtWorldPoint()` or `addNodeAndConnectAtWorldPoint()` continuations

#### Manual Verification:
- [ ] Create a standalone node from an empty canvas double-click and choose a kind; no picker/backdrop blink, canvas flash, or node-position jump is visible before the edit modal appears.
- [ ] Drag a connection to empty canvas, choose a kind, and confirm the connected node and edge appear without a picker/backdrop blink or canvas flash.
- [ ] Close the new-node edit modal and drag the created node; connected edges still move live, confirming the prior incremental/live-geometry path was not regressed.
- [ ] If a save failure can be simulated manually, verify the picker remains visible/re-enabled and a save-failed notice appears.

## Ordering Constraints

- Phase 1 must come first because it changes the creation method signatures and picker click behavior.
- Phase 2 depends on Phase 1's callback contract and should not be implemented first.
- No phases can run in parallel because Phase 2 tests exercise Phase 1 behavior.

## Verification Notes

- Confirm the old reload root cause stays fixed: grep node creation continuations and ensure they still do not call `loadProtocol()`.
- Confirm the picker handoff root condition is fixed: successful creation callback/removal happens after `openEditModal()`.
- Confirm stale creation does not invoke the successful edit-modal handoff after a concurrent `loadGeneration`/path change, and instead runs the abandonment callback for stale picker cleanup.
- Confirm failed persistence does not invoke the successful edit-modal handoff and runs the failure callback so the picker can be re-enabled with feedback.
- Run focused Protocol Editor creation/handoff tests.
- Run existing save-geometry tests to ensure incremental rendering/live geometry behavior remains intact.
- Run keyboard/modal tests to ensure modal focus behavior does not regress.
- Run `npm run build`, `npm test`, and `npm run lint` for final validation.
- Manual Obsidian QA remains required: create standalone and connected nodes and verify no picker/backdrop blink, canvas flash, or node-position jump is visible.

## Precedents & Lessons

- `.rpiv/artifacts/validation/2026-06-02_22-27-23_protocol-editor-canvas-ux-follow-up.md` showed the prior modal-first workaround failed while creation still called `loadProtocol()`.
- `.rpiv/artifacts/validation/2026-06-04_11-07-53_protocol-editor-canvas-ux-follow-up-node-creation-flash-live-edge-dragging-orthogonal-corners.md` confirmed incremental node creation and live geometry are implemented, but manual visual QA is still necessary for perceived flicker.
- Commit `90c5629` introduced the current incremental creation path; this plan should preserve that path and not reintroduce full canvas reloads.

## Performance Considerations

- Keeping the picker backdrop mounted during the existing async save adds no new layout or render hot path.
- Disabling picker buttons during save prevents duplicate creation attempts without polling or animation.
- The fix does not increase edge-render work; `renderEdges()` and `renderMinimap()` remain exactly once per successful creation.

## Migration Notes

Not applicable — no schema, settings, vault, or persisted data migration.

## Pattern References

- `src/views/protocol-editor-view.ts:689-703` — standalone creation persistence/update path to preserve.
- `src/views/protocol-editor-view.ts:763-800` — connected creation persistence/update path to preserve.
- `src/views/protocol-editor-view.ts:709-730` — standalone node-kind picker click lifecycle to change.
- `src/views/protocol-editor-view.ts:736-757` — connected node-kind picker click lifecycle to change.
- `src/views/protocol-editor-view.ts:889-908` — incremental created-document application to keep as the anti-reload path.
- `src/__tests__/views/protocol-editor-save-node-geometry.test.ts:91-211` — focused private-method view tests to extend.
- `src/__tests__/views/protocol-editor-keyboard.test.ts:1` — hand-rolled DOM mock pattern for Protocol Editor view tests.

## Developer Context

- ❓ Question: Current evidence points to the picker backdrop being removed before async node creation opens the edit modal. Which smallest fix should the plan generate? Answer: Continuous modal handoff (Recommended).
- ❓ Question: Design: continuous modal handoff for Protocol Editor new-node creation; both picker flows keep backdrop until edit modal is opened, with focused regression tests. Ready to proceed to decomposition? Answer: Proceed (Recommended).
- ❓ Question: 2 slices for Protocol Editor new-node flicker. Slice 1: continuous creation modal handoff (foundation). Slice 2: focused regression coverage and validation. Approve decomposition? Answer: Approve (Recommended).
- Step 9 triage: Rows 1-2 invalid-state cleanup concerns — Answer: Applied.
- Step 9 triage: Rows 3-4 post-success catch-shape concerns — Answer: Applied.
- Step 9 triage: Row 5 connected stale/failed test coverage concern — Answer: Applied.

## Plan History

- Phase 1: Continuous Creation Modal Handoff — revised at Step 9: invalid-state guards now call `onCreateAbandoned`, and update rejection handling is separated from post-save UI handling.
- Phase 2: Regression Coverage and Validation — revised at Step 9: added connected stale-abandonment and failed-creation recovery tests.

## Plan Review (Step 8)

_Independent post-finalization review by artifact-code-reviewer and artifact-coverage-reviewer subagents. Findings triaged at Step 9._

| source | plan-loc | codebase-loc | severity | dimension | finding | recommendation | resolution |
| ------ | -------- | ------------ | -------- | --------- | ------- | -------------- | ---------- |
| code | Phase 1 §1 (protocol-editor-view.ts) | `src/views/protocol-editor-view.ts:689` | concern | code-quality | The proposed callback-aware `addNodeAtWorldPoint()` keeps the initial `if (this.doc === null || this.protocolPath === null) return;`, so a picker made busy before the view is unloaded never receives a cleanup callback. | Call `options.onCreateAbandoned?.()` before returning from the invalid-state guard. | applied: standalone invalid-state guard now invokes `onCreateAbandoned` before returning |
| code | Phase 1 §1 (protocol-editor-view.ts) | `src/views/protocol-editor-view.ts:763` | concern | code-quality | The proposed callback-aware `addNodeAndConnectAtWorldPoint()` keeps the initial `if (this.doc === null || this.protocolPath === null) return;`, so a connected-create picker can remain disabled with no cleanup callback after view state is cleared. | Call `options.onCreateAbandoned?.()` before returning from the invalid-state guard. | applied: connected invalid-state guard now invokes `onCreateAbandoned` before returning |
| code | Phase 1 §1 (protocol-editor-view.ts) | `src/views/protocol-editor-view.ts:699-704` | concern | code-quality | The proposed `.catch((err) => { options.onCreateFailed?.(); ... })` remains chained after the success `.then()`, so a post-persistence exception in rendering or modal handoff is reported as a save failure and re-enables the picker after the node was already written. | Attach failure recovery only to `protocolDocumentStore.update()` rejection, and handle post-save UI errors separately without invoking `onCreateFailed`. | applied: standalone creation now uses `.then(success, updateFailure)` with post-save UI errors caught separately without `onCreateFailed` |
| code | Phase 1 §1 (protocol-editor-view.ts) | `src/views/protocol-editor-view.ts:796-801` | concern | code-quality | The connected creation path has the same post-success `.catch()` shape, so a post-persistence exception can restore the picker and allow duplicate connected node creation even though the node was already saved. | Attach failure recovery only to `protocolDocumentStore.update()` rejection, and handle post-save UI errors separately without invoking `onCreateFailed`. | applied: connected creation now uses `.then(success, updateFailure)` with post-save UI errors caught separately without `onCreateFailed` |
| code | Phase 2 §1 (protocol-editor-save-node-geometry.test.ts) | `src/views/protocol-editor-view.ts:763` | concern | code-quality | Phase 2 adds stale and failed recovery tests only for `addNodeAtWorldPoint()` even though `addNodeAndConnectAtWorldPoint()` has a separate callback implementation. | Add connected stale-abandonment and failed-creation tests that exercise `addNodeAndConnectAtWorldPoint()`. | applied: Phase 2 now adds connected stale-abandonment and failed connected-creation recovery tests |

## References

- Current source: `src/views/protocol-editor-view.ts`
- Current styles: `src/styles/protocol-editor.css`
- Current tests: `src/__tests__/views/protocol-editor-save-node-geometry.test.ts`
- Prior plan: `.rpiv/artifacts/plans/2026-06-02_20-11-53_protocol-editor-canvas-ux-follow-up.md`
- Prior validation: `.rpiv/artifacts/validation/2026-06-02_22-27-23_protocol-editor-canvas-ux-follow-up.md`
- Prior validation: `.rpiv/artifacts/validation/2026-06-04_11-07-53_protocol-editor-canvas-ux-follow-up-node-creation-flash-live-edge-dragging-orthogonal-corners.md`
- Targeted precedent commit: `90c5629 fix: add live geometry cache, incremental node creation, and normalized orthogonal edge routing`
