// views/runner-view.ts — TODO: Phase 3
import { ItemView, WorkspaceLeaf } from 'obsidian';

export const RUNNER_VIEW_TYPE = 'radiprotocol-runner';

export class RunnerView extends ItemView {
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType(): string { return RUNNER_VIEW_TYPE; }
  getDisplayText(): string { return 'RadiProtocol Runner'; }

  async onOpen(): Promise<void> {
    this.contentEl.createEl('p', { text: 'Runner UI coming in Phase 3.' });
  }

  async onClose(): Promise<void> {
    this.contentEl.empty();
  }
}
