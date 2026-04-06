// main.ts
import { Plugin, Notice, Menu } from 'obsidian';
import { RadiProtocolSettings, DEFAULT_SETTINGS, RadiProtocolSettingsTab } from './settings';
import { CanvasParser } from './graph/canvas-parser';
import { EditorPanelView, EDITOR_PANEL_VIEW_TYPE } from './views/editor-panel-view';

export default class RadiProtocolPlugin extends Plugin {
  settings!: RadiProtocolSettings;
  canvasParser!: CanvasParser;

  async onload(): Promise<void> {
    // Load settings with defaults guard (NFR-08)
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    // Instantiate pure modules (no Obsidian dependency)
    this.canvasParser = new CanvasParser();

    // Ribbon icon (Phase 3 will open the runner view)
    this.addRibbonIcon('activity', 'Radiprotocol', () => {
      new Notice('Radiprotocol loaded. Open a canvas file to run a protocol.');
    });

    // Commands — IDs intentionally omit plugin name prefix (NFR-06)
    this.addCommand({
      id: 'run-protocol',
      name: 'Run protocol',
      callback: () => {
        new Notice('Protocol runner coming in phase 3.');
      },
    });

    this.addCommand({
      id: 'validate-protocol',
      name: 'Validate protocol',
      callback: () => {
        new Notice('Protocol validator coming in phase 3.');
      },
    });

    // Register EditorPanelView ItemView (EDIT-01)
    this.registerView(EDITOR_PANEL_VIEW_TYPE, (leaf) => new EditorPanelView(leaf, this));

    // Command: open-node-editor (EDIT-01 — opens editor panel; NFR-06: no plugin name prefix)
    this.addCommand({
      id: 'open-node-editor',
      name: 'Open node editor',
      callback: () => { void this.activateEditorPanelView(); },
    });

    // Settings tab
    this.addSettingTab(new RadiProtocolSettingsTab(this.app, this));

    // Context menu integration — EDIT-05
    // 'canvas:node-menu' is undocumented but confirmed in multiple community plugins.
    // Use typed cast to unknown then minimal interface to avoid 'any' (eslint no-explicit-any).
    type CanvasNodeMenuHandler = (menu: Menu, node: { id: string; canvas?: unknown }) => void;
    type EventRef = import('obsidian').EventRef;
    this.registerEvent(
      (this.app.workspace as unknown as {
        on(event: 'canvas:node-menu', handler: CanvasNodeMenuHandler): EventRef;
      }).on('canvas:node-menu', (menu: Menu, node: { id: string; canvas?: unknown }) => {
        const nodeId = node.id;

        // Derive canvas file path from the active canvas leaf
        const canvasLeaves = this.app.workspace.getLeavesOfType('canvas');
        // The node object's 'canvas' property is the internal CanvasView instance —
        // use it only to match the leaf; extract only id and file path, nothing else.
        const activeLeaf = canvasLeaves.find(leaf => {
          const view = leaf.view as unknown as { canvas?: unknown };
          return view.canvas === node.canvas;
        });
        const filePath = (activeLeaf?.view as { file?: { path: string } } | undefined)?.file?.path;

        if (!filePath) return; // Not triggered from a canvas leaf — skip

        menu.addSeparator();
        menu.addItem(item =>
          item
            .setTitle('Edit RadiProtocol properties')
            .setSection('radiprotocol')
            .onClick(() => {
              void this.openEditorPanelForNode(filePath, nodeId);
            })
        );
      })
    );

    console.debug('[RadiProtocol] Plugin loaded');
  }

  async onunload(): Promise<void> {
    console.debug('[RadiProtocol] Plugin unloaded');
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async activateEditorPanelView(): Promise<void> {
    const { workspace } = this.app;
    workspace.detachLeavesOfType(EDITOR_PANEL_VIEW_TYPE);
    const leaf = workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: EDITOR_PANEL_VIEW_TYPE, active: true });
      const activeLeaf = workspace.getLeavesOfType(EDITOR_PANEL_VIEW_TYPE)[0];
      if (activeLeaf !== undefined) {
        workspace.revealLeaf(activeLeaf);
      }
    }
  }

  async openEditorPanelForNode(filePath: string, nodeId: string): Promise<void> {
    await this.activateEditorPanelView();
    const leaves = this.app.workspace.getLeavesOfType(EDITOR_PANEL_VIEW_TYPE);
    const leaf = leaves[0];
    if (leaf === undefined) return;
    const view = leaf.view;
    if (view instanceof EditorPanelView) {
      view.loadNode(filePath, nodeId);
    }
  }
}
