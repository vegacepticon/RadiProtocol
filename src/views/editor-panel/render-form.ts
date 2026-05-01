// Phase 76 (SPLIT-01 G7) — extracted renderNodeForm / renderForm bodies. The
// dispatcher (EditorPanelView) keeps thin private wrappers because:
//   - `renderForm` is accessed as `view['renderForm']` by editor-panel tests
//     (canvas-sync, editor-panel-forms) and called by the quick-create
//     controller through the host wrapper.
//   - `renderNodeForm` is invoked from `loadNode` and `applyCanvasPatch`; the
//     wrapper preserves the in-class call site without leaking helper details.
//
// State mutation rules (R5 from the SPLIT-01 plan):
//   - `host.resetPendingEdits()` reassigns the class field to a fresh `{}` so
//     subsequent reads through `view['pendingEdits']` observe the new object,
//     matching the original `this.pendingEdits = {}` semantics verbatim.
//   - `host.formFieldRefs` and `host.pendingCanvasUpdate` are passed by
//     reference; `.clear()` calls mutate the same Maps the dispatcher and
//     other helpers (canvas-patch, autosave) share.
//   - `host.setKindFormSection` / `host.setSavedIndicatorEl` reassign the
//     class fields so canvas-patch and autosave keep observing the latest
//     DOM elements after every render.
import { Setting, TFile } from 'obsidian';
import type { RPNodeKind } from '../../graph/graph-model';
import type RadiProtocolPlugin from '../../main';
import { getCanvasForPath } from './quick-create-controller';

export interface RenderHost {
  contentEl: HTMLElement;
  plugin: RadiProtocolPlugin;
  formFieldRefs: Map<string, HTMLInputElement | HTMLTextAreaElement>;
  pendingCanvasUpdate: Map<string, string | undefined>;
  getPendingEdits(): Record<string, unknown>;
  resetPendingEdits(): void;
  setKindFormSection(el: HTMLElement | null): void;
  setSavedIndicatorEl(el: HTMLElement | null): void;
  renderError(message: string): void;
  renderIdle(): void;
  renderToolbar(container: HTMLElement): void;
  renderForm(nodeRecord: Record<string, unknown>, currentKind: RPNodeKind | null): void;
  buildKindForm(
    container: HTMLElement,
    nodeRecord: Record<string, unknown>,
    kind: RPNodeKind | null,
  ): void;
  onTypeDropdownChange(value: string): void;
}

export async function renderNodeFormImpl(
  host: RenderHost,
  filePath: string,
  nodeId: string,
): Promise<void> {
  // Guard: contentEl may not be initialized if the view is not yet mounted
  if (!host.contentEl) return;
  host.contentEl.empty();
  host.resetPendingEdits();
  // Phase 63 — clear DOM refs before re-rendering the form. renderForm /
  // buildKindForm rebuilds the textarea DOM; the previous render's refs are
  // about to be detached. Pending canvas patches are also dropped since they
  // targeted the now-stale field set.
  host.formFieldRefs.clear();
  host.pendingCanvasUpdate.clear();

  const file = host.plugin.app.vault.getAbstractFileByPath(filePath);
  if (!(file instanceof TFile)) {
    host.renderError('Canvas file not found in vault.');
    return;
  }

  let raw: string;
  try {
    raw = await host.plugin.app.vault.read(file);
  } catch {
    host.renderError('Could not read canvas file.');
    return;
  }

  let canvasData: { nodes: Array<Record<string, unknown>>; edges: unknown[] };
  try {
    canvasData = JSON.parse(raw) as typeof canvasData;
  } catch {
    host.renderError('Canvas file contains invalid JSON — cannot save.');
    return;
  }

  let nodeRecord: Record<string, unknown> | undefined = canvasData.nodes.find(n => n['id'] === nodeId);

  // Phase 42: double-click-created nodes may not yet be flushed to disk by Obsidian's
  // async save cycle. When the disk read misses the node, fall back to the live in-memory
  // canvas state (same pattern Phase 39 Plan 02 uses inside onQuickCreate).
  if (!nodeRecord) {
    const canvas = getCanvasForPath(host.plugin, filePath);
    if (canvas) {
      const liveNode = canvas.nodes.get(nodeId);
      if (liveNode) {
        nodeRecord = liveNode.getData();
      }
    }
  }

  if (!nodeRecord) {
    host.renderError('Node not found in canvas — it may have been deleted.');
    return;
  }

  const currentKind = (nodeRecord['radiprotocol_nodeType'] as RPNodeKind | undefined) ?? null;
  host.renderForm(nodeRecord, currentKind);
}

export function renderFormImpl(
  host: RenderHost,
  nodeRecord: Record<string, unknown>,
  currentKind: RPNodeKind | null,
): void {
  host.contentEl.empty();
  const panel = host.contentEl.createDiv({ cls: 'rp-editor-panel' });
  const formArea = panel.createDiv({ cls: 'rp-editor-form' });

  // Node type dropdown — always first
  new Setting(formArea)
    .setName('Node type')
    .setDesc('The protocol role of this canvas node. Changing this will update the fields below.')
    .addDropdown(drop => {
      drop
        .addOption('', '— unset —')
        .addOption('start', 'Start')
        .addOption('question', 'Question')
        .addOption('answer', 'Answer')
        .addOption('text-block', 'Text block')
        .addOption('snippet', 'Snippet')         // Phase 29: D-06
        .addOption('loop', 'Loop')               // Phase 44 UAT-fix: expose unified loop
        // Phase 46 CLEAN-03: free-text-input excised entirely from RPNodeKind (46-01 D-46-01-A).
        // Phase 44 UAT-fix: legacy kinds (loop-start, loop-end) are NOT offered here — they
        // remain in RPNodeKind only so the parser can emit MIGRATE-01 on legacy canvases
        // (Phase 43 D-03). New nodes should use `loop` instead.
        .setValue(currentKind ?? '')
        .onChange(value => {
          // Immediate save with color + cancel debounce (D-04) — must run first so
          // the new type is in-flight before the re-render.
          host.onTypeDropdownChange(value);
          // Phase 42 (post-review WR-01/WR-02): re-render the whole form so the
          // empty-type hint (which lives outside kindFormSection) is re-evaluated.
          // Defer via queueMicrotask so the dropdown handler fully unwinds before
          // contentEl is torn down (avoids re-entrancy on the live <select> element).
          // Merge pendingEdits into the record copy so buildKindForm sees the newly
          // picked type in field defaults instead of stale data from nodeRecord.
          const mergedRecord = { ...nodeRecord, ...host.getPendingEdits() };
          const nextKind = value ? (value as RPNodeKind) : null;
          queueMicrotask(() => {
            renderFormImpl(host, mergedRecord, nextKind);
          });
        });
    });

  // Phase 42: empty-type helper hint — copy locked by UI-SPEC
  if (currentKind === null) {
    formArea.createEl('p', {
      cls: 'rp-editor-type-hint',
      text: 'Select a node type to configure this node',
    });
  }

  // Kind-specific fields section
  const kindFormSection = formArea.createDiv();
  host.setKindFormSection(kindFormSection);
  host.buildKindForm(kindFormSection, nodeRecord, currentKind);

  // "Saved ✓" indicator — replaces Save button slot (D-01)
  const indicatorRow = panel.createDiv({ cls: 'rp-editor-saved-indicator' });
  indicatorRow.setText('Saved ✓');
  host.setSavedIndicatorEl(indicatorRow);
  // Reset indicator visibility on each form render (Pitfall 2 fix)
  indicatorRow.removeClass('is-visible');
  // Phase 48 NODEUI-05: toolbar moved to bottom (was Phase 39 top-of-panel).
  host.renderToolbar(host.contentEl);
}
