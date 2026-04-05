// views/editor-panel-view.ts — TODO: Phase 4
import { ItemView, WorkspaceLeaf } from 'obsidian';

export const EDITOR_PANEL_VIEW_TYPE = 'radiprotocol-editor-panel';

export class EditorPanelView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string { return EDITOR_PANEL_VIEW_TYPE; }
  getDisplayText(): string { return 'Radiprotocol node editor'; }

  async onOpen(): Promise<void> {
    this.contentEl.createEl('p', { text: 'Node editor coming in phase 4.' });
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }
}
