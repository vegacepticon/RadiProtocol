// Phase 76 (SPLIT-01 G8) — extracted scheduleAutoSave / onTypeDropdownChange /
// showSavedIndicator implementations. The dispatcher (EditorPanelView) keeps
// thin private wrappers because:
//   - `scheduleAutoSave` is exposed through FormContext to per-kind form
//     modules and the snippet-picker test suite reassigns it on the instance
//     (`view.scheduleAutoSave = spy`). The wrapper preserves dynamic dispatch.
//   - `onTypeDropdownChange` and `showSavedIndicator` are referenced by name
//     from `renderForm` and the regression suite asserts those identifiers
//     appear in `editor-panel-view.ts` (TS regression: editor-panel-view.ts —
//     auto-save).
//
// State mutation rules (R5 from the SPLIT-01 plan):
//   - The `state` slice IS the EditorPanelView instance (narrowed via cast).
//     Writes such as `state.pendingEdits[key] = value` mutate the same object
//     the dispatcher and form modules already share, preserving the
//     `view['pendingEdits'][key]` test surface.
//   - `state._debounceTimer` / `state._indicatorTimer` reassignments flow back
//     to the class fields so handler ordering matches the original methods.

export interface AutosaveState {
  currentFilePath: string | null;
  currentNodeId: string | null;
  pendingEdits: Record<string, unknown>;
  _debounceTimer: ReturnType<typeof setTimeout> | null;
  _savedIndicatorEl: HTMLElement | null;
  _indicatorTimer: ReturnType<typeof setTimeout> | null;
}

export interface AutosaveDeps {
  state: AutosaveState;
  saveNodeEdits: (filePath: string, nodeId: string, edits: Record<string, unknown>) => Promise<void>;
  showSavedIndicator: () => void;
}

export function scheduleAutoSave(deps: AutosaveDeps): void {
  const { state, saveNodeEdits, showSavedIndicator } = deps;
  if (state._debounceTimer !== null) {
    clearTimeout(state._debounceTimer);
  }
  // Snapshot at schedule time — NOT at fire time (critical correctness invariant)
  const filePath = state.currentFilePath;
  const nodeId = state.currentNodeId;
  const edits = { ...state.pendingEdits };

  if (!filePath || !nodeId) return;

  state._debounceTimer = setTimeout(() => {
    state._debounceTimer = null;
    void saveNodeEdits(filePath, nodeId, edits)
      .then(() => { showSavedIndicator(); })
      .catch(err => {
        console.error('[RadiProtocol] auto-save failed:', err);
      });
  }, 800);
}

export function onTypeDropdownChange(value: string, deps: AutosaveDeps): void {
  const { state, saveNodeEdits, showSavedIndicator } = deps;
  state.pendingEdits['radiprotocol_nodeType'] = value || undefined;
  // Cancel any pending debounce
  if (state._debounceTimer !== null) {
    clearTimeout(state._debounceTimer);
    state._debounceTimer = null;
  }
  if (state.currentFilePath && state.currentNodeId) {
    const edits = { ...state.pendingEdits };
    // Color injection and color-clearing are handled entirely inside saveNodeEdits
    // (D-04, D-06). Do not duplicate the NODE_COLOR_MAP lookup here — divergence risk.
    void saveNodeEdits(state.currentFilePath, state.currentNodeId, edits)
      .then(() => { showSavedIndicator(); })
      .catch(err => {
        console.error('[RadiProtocol] type-change save failed:', err);
      });
  }
}

export function showSavedIndicator(state: AutosaveState): void {
  if (!state._savedIndicatorEl) return;
  state._savedIndicatorEl.addClass('is-visible');
  if (state._indicatorTimer !== null) clearTimeout(state._indicatorTimer);
  state._indicatorTimer = setTimeout(() => {
    state._savedIndicatorEl?.removeClass('is-visible');
    state._indicatorTimer = null;
  }, 2000);
}
