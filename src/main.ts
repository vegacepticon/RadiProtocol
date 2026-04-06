// main.ts
import { Plugin, Notice, Menu } from 'obsidian';
import type { TFile } from 'obsidian';
import { RadiProtocolSettings, DEFAULT_SETTINGS, RadiProtocolSettingsTab } from './settings';
import { CanvasParser } from './graph/canvas-parser';
import { EditorPanelView, EDITOR_PANEL_VIEW_TYPE } from './views/editor-panel-view';
import { RunnerView, RUNNER_VIEW_TYPE } from './views/runner-view';
import { SnippetManagerView, SNIPPET_MANAGER_VIEW_TYPE } from './views/snippet-manager-view';
import { SnippetService } from './snippets/snippet-service';

export default class RadiProtocolPlugin extends Plugin {
  settings!: RadiProtocolSettings;
  canvasParser!: CanvasParser;
  snippetService!: SnippetService;

  async onload(): Promise<void> {
    // Load settings with defaults guard (NFR-08)
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    // Instantiate pure modules (no Obsidian dependency)
    this.canvasParser = new CanvasParser();

    // Instantiate services
    this.snippetService = new SnippetService(this.app, this.settings);

    // Ribbon icon (Phase 3 will open the runner view)
    this.addRibbonIcon('activity', 'Radiprotocol', () => {
      new Notice('Radiprotocol loaded. Open a canvas file to run a protocol.');
    });

    // Commands — IDs intentionally omit plugin name prefix (NFR-06)
    this.addCommand({
      id: 'run-protocol',
      name: 'Run protocol',
      callback: () => { void this.activateRunnerView(); },
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

    // Register RunnerView ItemView (UI-01)
    this.registerView(RUNNER_VIEW_TYPE, (leaf) => new RunnerView(leaf, this));

    // Register SnippetManagerView ItemView (SNIP-01)
    this.registerView(SNIPPET_MANAGER_VIEW_TYPE, (leaf) => new SnippetManagerView(leaf, this));

    // Command: open-snippet-manager (SNIP-01)
    this.addCommand({
      id: 'open-snippet-manager',
      name: 'Open snippet manager',
      callback: () => { void this.activateSnippetManagerView(); },
    });

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

  async activateSnippetManagerView(): Promise<void> {
    const { workspace } = this.app;
    workspace.detachLeavesOfType(SNIPPET_MANAGER_VIEW_TYPE);
    const leaf = workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: SNIPPET_MANAGER_VIEW_TYPE, active: true });
      const activeLeaf = workspace.getLeavesOfType(SNIPPET_MANAGER_VIEW_TYPE)[0];
      if (activeLeaf !== undefined) {
        workspace.revealLeaf(activeLeaf);
      }
    }
  }

  async activateRunnerView(): Promise<void> {
    const { workspace } = this.app;
    const existing = workspace.getLeavesOfType(RUNNER_VIEW_TYPE);
    if (existing.length > 0 && existing[0] !== undefined) {
      workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = workspace.getRightLeaf(false);
    if (leaf !== null) {
      await leaf.setViewState({ type: RUNNER_VIEW_TYPE, active: true });
      workspace.revealLeaf(leaf);
    }
    // After RunnerView opens, trigger openCanvas on the active canvas file if any
    const canvasLeaves = workspace.getLeavesOfType('canvas');
    const activeCanvas = canvasLeaves[0];
    if (activeCanvas !== undefined) {
      const filePath = (activeCanvas.view as { file?: { path: string } } | undefined)?.file?.path;
      if (filePath !== undefined) {
        const runnerLeaves = workspace.getLeavesOfType(RUNNER_VIEW_TYPE);
        const runnerLeaf = runnerLeaves[0];
        if (runnerLeaf !== undefined) {
          const view = runnerLeaf.view as RunnerView;
          void view.openCanvas(filePath);
        }
      }
    }
  }

  async saveOutputToNote(text: string): Promise<void> {
    const { workspace, vault } = this.app;
    const folderPath = this.settings.outputFolderPath;
    // Ensure output folder exists (T-5-14: vault paths scoped to vault root)
    const folderExists = await vault.adapter.exists(folderPath);
    if (!folderExists) {
      await vault.createFolder(folderPath);
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const notePath = `${folderPath}/Report-${timestamp}.md`;
    await vault.create(notePath, text);
    const file = vault.getAbstractFileByPath(notePath);
    if (file !== null) {
      await workspace.getLeaf('tab').openFile(file as TFile);
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
