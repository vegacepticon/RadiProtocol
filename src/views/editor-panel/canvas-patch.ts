// Phase 76 (SPLIT-01 G3) — extracted applyCanvasPatch / registerFieldRef /
// patchTextareaValue implementations. The dispatcher keeps thin private wrappers
// for `applyCanvasPatch` and `registerFieldRef` so the test surfaces
// (`view['applyCanvasPatch']`, `view['formFieldRefs']`,
// `view['pendingCanvasUpdate']`) and the FormContext entry point both keep
// working unchanged. patchTextareaValue is purely internal — no class wrapper.
//
// Two hard invariants enforced by Task 1 tests under describe block 63-03-02:
//   1. NEVER dispatch synthetic input events (Pitfall 1) — that would re-enter
//      the registered onInput handler, write to pendingEdits, and trigger an
//      autosave loop (saveNodeEdits → modify → reconciler → dispatch → here).
//   2. NEVER write to pendingEdits from this module (Pitfall 6) — canvas patches
//      are DOM-only by design; outbound autosave only flushes user-typed values.
import type { ItemView } from 'obsidian';
import type { CanvasChangedForNodeDetail } from '../../canvas/edge-label-sync-service';

export interface CanvasPatchCtx {
  formFieldRefs: Map<string, HTMLInputElement | HTMLTextAreaElement>;
  pendingCanvasUpdate: Map<string, string | undefined>;
  getCurrentFilePath(): string | null;
  getCurrentNodeId(): string | null;
  setCurrentFilePath(value: string | null): void;
  setCurrentNodeId(value: string | null): void;
  resetPendingEdits(): void;
  renderIdle(): void;
  renderNodeForm(filePath: string, nodeId: string): void;
}

// Phase 63 D-12 — entry point for canvas-changed-for-node events from
// EdgeLabelSyncService (Plan 02 dispatch bus). Branches by changeKind:
// 'fields' patches per-field via patchTextareaValue (D-08) with an in-flight
// focus skip + stash for blur (D-05/D-07); 'nodeType' triggers a full
// renderNodeForm re-render (D-09); 'deleted' returns to renderIdle (D-10).
// Wrapped in queueMicrotask to coexist with the Phase 42 WR-01/WR-02
// re-entrancy guard (re-renderForm via dropdown onChange).
export function applyCanvasPatchImpl(
  detail: CanvasChangedForNodeDetail,
  ctx: CanvasPatchCtx,
): void {
  if (detail.filePath !== ctx.getCurrentFilePath()) return;
  if (detail.nodeId !== ctx.getCurrentNodeId()) return;

  queueMicrotask(() => {
    // Re-check after defer — currentFilePath/currentNodeId may have changed
    // while the microtask was queued (Phase 42 WR-01 race window).
    if (detail.filePath !== ctx.getCurrentFilePath()) return;
    if (detail.nodeId !== ctx.getCurrentNodeId()) return;

    if (detail.changeKind === 'deleted') {
      // D-10 — node removed from canvas; return to idle.
      ctx.resetPendingEdits();
      ctx.setCurrentNodeId(null);
      ctx.setCurrentFilePath(null);
      ctx.formFieldRefs.clear();
      ctx.pendingCanvasUpdate.clear();
      ctx.renderIdle();
      return;
    }
    if (detail.changeKind === 'nodeType') {
      // D-09 — kind changed; full re-render via renderNodeForm path. Capture
      // file/node refs into locals BEFORE clearing state so the re-render
      // targets the correct node even if subsequent dispatches mutate
      // currentFilePath/currentNodeId.
      const fp = ctx.getCurrentFilePath();
      const nid = ctx.getCurrentNodeId();
      ctx.resetPendingEdits();
      ctx.formFieldRefs.clear();
      ctx.pendingCanvasUpdate.clear();
      if (fp !== null && nid !== null) ctx.renderNodeForm(fp, nid);
      return;
    }
    // changeKind === 'fields' — D-08 per-field patch.
    for (const [key, value] of Object.entries(detail.fieldUpdates ?? {})) {
      const el = ctx.formFieldRefs.get(key);
      if (!el) continue;
      // Defensive: skip detached DOM (Pitfall 2 — formFieldRefs may briefly
      // hold a ref to an element whose parent was contentEl.empty()'d during
      // a concurrent re-render). isConnected is undefined on FakeNode stubs
      // unless explicitly set, so accept undefined as "treat as connected".
      if ((el as { isConnected?: boolean }).isConnected === false) continue;
      const focused = el.ownerDocument?.activeElement === el;
      if (focused) {
        // D-05 / D-07 — stash for blur-driven flush; D-06 field-level lock
        // — other non-focused fields in the same payload still patch.
        ctx.pendingCanvasUpdate.set(key, value);
        continue;
      }
      patchTextareaValue(el, value ?? '');
    }
  });
}

// Phase 63 — shared helper for the 6 field capture sites (5 textareas +
// displayLabel addText). Wires (a) the formFieldRefs Map entry, (b) the
// blur handler that flushes pendingCanvasUpdate via queueMicrotask
// (Pitfall 4 — defer DOM mutation until after the browser blur event
// fully unwinds). The registerDomEvent typeof guard mirrors the pattern in
// renderGrowableTextarea so test harnesses that don't patch registerDomEvent
// (e.g. editor-panel-loop-form.test.ts, views/editor-panel-snippet-picker.test.ts)
// keep working unchanged.
export function registerFieldRefImpl(
  key: string,
  el: HTMLInputElement | HTMLTextAreaElement,
  ctx: {
    formFieldRefs: Map<string, HTMLInputElement | HTMLTextAreaElement>;
    pendingCanvasUpdate: Map<string, string | undefined>;
    registerDomEvent?: ItemView['registerDomEvent'];
  },
): void {
  ctx.formFieldRefs.set(key, el);
  const onBlur = (): void => {
    queueMicrotask(() => {
      const pending = ctx.pendingCanvasUpdate.get(key);
      if (pending !== undefined) {
        patchTextareaValue(el, pending);
        ctx.pendingCanvasUpdate.delete(key);
      }
    });
  };
  if (typeof ctx.registerDomEvent === 'function') {
    ctx.registerDomEvent(el, 'blur', onBlur);
  } else if (typeof (el as { addEventListener?: unknown }).addEventListener === 'function') {
    el.addEventListener('blur', onBlur);
  }
}

// Phase 63 — DOM-only patch. The auto-grow resize that the registered input
// handler would have done is mirrored manually so the textarea visually
// matches the new content. NEVER dispatches synthetic input events (Pitfall
// 1) and NEVER writes to pendingEdits (Pitfall 6).
function patchTextareaValue(
  el: HTMLInputElement | HTMLTextAreaElement,
  value: string,
): void {
  el.value = value;
  if (
    typeof HTMLTextAreaElement !== 'undefined' &&
    el instanceof HTMLTextAreaElement &&
    typeof el.setCssProps === 'function'
  ) {
    el.setCssProps({ '--rp-textarea-height': 'auto' });
    el.setCssProps({ '--rp-textarea-height': el.scrollHeight + 'px' });
  }
}
