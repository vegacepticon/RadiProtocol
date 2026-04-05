// views/snippet-manager-view.ts — TODO: Phase 5
import { ItemView, WorkspaceLeaf } from 'obsidian';

export const SNIPPET_MANAGER_VIEW_TYPE = 'radiprotocol-snippet-manager';

export class SnippetManagerView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string { return SNIPPET_MANAGER_VIEW_TYPE; }
  getDisplayText(): string { return 'Radiprotocol snippet manager'; }

  async onOpen(): Promise<void> {
    this.contentEl.createEl('p', { text: 'Snippet manager coming in phase 5.' });
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }
}
