// views/canvas-selector-widget.ts
// Drill-down canvas selector widget rendered in RunnerView.headerEl (SELECTOR-01, SELECTOR-02)
import { App, TFile, TFolder, setIcon } from 'obsidian';
import type RadiProtocolPlugin from '../main';

/**
 * CanvasSelectorWidget renders a custom drill-down dropdown into a container element.
 * The trigger button shows the current canvas basename or placeholder text.
 * Opening the popover lists the contents of plugin.settings.protocolFolderPath.
 * Subfolders can be drilled into; .canvas files are selectable.
 *
 * Lifecycle: call destroy() before the parent view closes to remove document listeners.
 */
export class CanvasSelectorWidget {
  private readonly app: App;
  private readonly plugin: RadiProtocolPlugin;
  private readonly container: HTMLElement;
  private readonly onSelect: (filePath: string) => void;

  private triggerBtn!: HTMLButtonElement;
  private popover: HTMLElement | null = null;
  private currentPath: string[] = []; // drill-down stack; [] = root folder
  private selectedFilePath: string | null = null;
  private outsideClickHandler: ((e: MouseEvent) => void) | null = null;

  constructor(
    app: App,
    plugin: RadiProtocolPlugin,
    container: HTMLElement,
    onSelect: (filePath: string) => void,
  ) {
    this.app = app;
    this.plugin = plugin;
    this.container = container;
    this.onSelect = onSelect;
    this.render();
  }

  /** Call when the owning view is unmounted to clean up document listeners. */
  destroy(): void {
    this.closePopover();
  }

  /** Update the trigger button label to reflect a newly selected canvas. */
  setSelectedPath(filePath: string | null): void {
    this.selectedFilePath = filePath;
    this.updateTriggerLabel();
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private render(): void {
    const wrapper = this.container.createDiv({ cls: 'rp-selector-wrapper' });

    this.triggerBtn = wrapper.createEl('button', { cls: 'rp-selector-trigger' });
    this.updateTriggerLabel();

    this.triggerBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.popover !== null) {
        this.closePopover();
      } else {
        this.openPopover(wrapper);
      }
    });
  }

  private updateTriggerLabel(): void {
    this.triggerBtn.empty();
    const labelEl = this.triggerBtn.createSpan({ cls: 'rp-selector-trigger-label' });
    if (this.selectedFilePath !== null) {
      // Basename without extension (D-06)
      const parts = this.selectedFilePath.split('/');
      const filename = parts[parts.length - 1] ?? this.selectedFilePath;
      labelEl.setText(filename.replace(/\.canvas$/, ''));
    } else {
      labelEl.setText('Select a protocol\u2026');
      labelEl.addClass('rp-selector-placeholder');
    }
    const chevron = this.triggerBtn.createSpan({ cls: 'rp-selector-chevron' });
    setIcon(chevron, 'chevron-down');
  }

  private openPopover(anchor: HTMLElement): void {
    this.currentPath = []; // Reset to root on each open (D-10)
    const popover = anchor.createDiv({ cls: 'rp-selector-popover' });
    this.popover = popover;
    this.renderPopoverContent(popover);

    // Close on outside click (document listener)
    this.outsideClickHandler = (e: MouseEvent) => {
      if (!popover.contains(e.target as Node) && e.target !== this.triggerBtn) {
        this.closePopover();
      }
    };
    document.addEventListener('click', this.outsideClickHandler);
  }

  private closePopover(): void {
    if (this.popover !== null) {
      this.popover.remove();
      this.popover = null;
    }
    if (this.outsideClickHandler !== null) {
      document.removeEventListener('click', this.outsideClickHandler);
      this.outsideClickHandler = null;
    }
  }

  private renderPopoverContent(popover: HTMLElement): void {
    popover.empty();

    const folderPath = this.plugin.settings.protocolFolderPath.trim();

    // D-03: empty setting -> show hint
    if (folderPath === '') {
      popover.createDiv({ cls: 'rp-selector-empty-hint', text: 'Set a protocol folder in settings to get started.' });
      return;
    }

    // Resolve the current drill-down folder
    const rootFolder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!(rootFolder instanceof TFolder)) {
      // Folder does not exist yet
      popover.createDiv({ cls: 'rp-selector-empty-hint', text: 'Set a protocol folder in settings to get started.' });
      return;
    }

    // Navigate to current drill-down path
    let currentFolder: TFolder = rootFolder;
    for (const segment of this.currentPath) {
      const child = currentFolder.children.find(
        c => c instanceof TFolder && c.name === segment
      );
      if (!(child instanceof TFolder)) {
        // Path became invalid (folder deleted while popover open); reset to root
        this.currentPath = [];
        currentFolder = rootFolder;
        break;
      }
      currentFolder = child;
    }

    // Back row (D-07) - shown when not at root
    if (this.currentPath.length > 0) {
      const backRow = popover.createDiv({ cls: 'rp-selector-row rp-selector-back-row rp-row-sm' });
      const backIcon = backRow.createSpan({ cls: 'rp-selector-row-icon' });
      setIcon(backIcon, 'arrow-left');
      backRow.createSpan({ cls: 'rp-selector-row-label', text: 'Back' });
      backRow.addEventListener('click', (e) => {
        e.stopPropagation();
        this.currentPath.pop();
        this.renderPopoverContent(popover);
      });
    }

    // Sort: folders first, then files; alphabetically within each group
    const folders = currentFolder.children
      .filter((c): c is TFolder => c instanceof TFolder)
      .sort((a, b) => a.name.localeCompare(b.name));
    const files = currentFolder.children
      .filter((c): c is TFile => c instanceof TFile && c.extension === 'canvas')
      .sort((a, b) => a.name.localeCompare(b.name));

    if (folders.length === 0 && files.length === 0) {
      popover.createDiv({ cls: 'rp-selector-empty-hint', text: 'No protocols found in this folder.' });
      return;
    }

    // Folder rows (D-07)
    for (const folder of folders) {
      const row = popover.createDiv({ cls: 'rp-selector-row rp-selector-folder-row rp-row-sm' });
      const iconEl = row.createSpan({ cls: 'rp-selector-row-icon' });
      setIcon(iconEl, 'folder');
      row.createSpan({ cls: 'rp-selector-row-label', text: folder.name });
      const arrowEl = row.createSpan({ cls: 'rp-selector-row-arrow' });
      setIcon(arrowEl, 'chevron-right');
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        this.currentPath.push(folder.name);
        this.renderPopoverContent(popover);
      });
    }

    // File rows (D-08, D-09)
    for (const file of files) {
      const row = popover.createDiv({ cls: 'rp-selector-row rp-selector-file-row rp-row-sm' });
      if (file.path === this.selectedFilePath) {
        row.addClass('is-selected');
      }
      const iconEl = row.createSpan({ cls: 'rp-selector-row-icon' });
      setIcon(iconEl, 'file-text');
      // D-09: basename without .canvas extension
      row.createSpan({ cls: 'rp-selector-row-label', text: file.basename });
      row.addEventListener('click', () => {
        this.selectedFilePath = file.path;
        this.updateTriggerLabel();
        this.closePopover();
        this.onSelect(file.path);
      });
    }
  }

  /** Rebuild popover contents in-place (called on vault file events). */
  rebuildIfOpen(): void {
    if (this.popover !== null) {
      this.renderPopoverContent(this.popover);
    }
  }
}
