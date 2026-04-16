// main.ts
import { Plugin, Notice, Menu, TFile } from 'obsidian';
import type { WorkspaceLeaf } from 'obsidian';
import { RadiProtocolSettings, DEFAULT_SETTINGS, RadiProtocolSettingsTab } from './settings';
import { CanvasParser } from './graph/canvas-parser';
import { EditorPanelView, EDITOR_PANEL_VIEW_TYPE } from './views/editor-panel-view';
import { RunnerView, RUNNER_VIEW_TYPE } from './views/runner-view';
import { SnippetManagerView, SNIPPET_MANAGER_VIEW_TYPE } from './views/snippet-manager-view';
import { SnippetService } from './snippets/snippet-service';
import { SessionService } from './sessions/session-service';
import { WriteMutex } from './utils/write-mutex';
import { CanvasLiveEditor } from './canvas/canvas-live-editor';
import { CanvasNodeFactory } from './canvas/canvas-node-factory';

export default class RadiProtocolPlugin extends Plugin {
  settings!: RadiProtocolSettings;
  canvasParser!: CanvasParser;
  snippetService!: SnippetService;
  sessionService!: SessionService;
  canvasLiveEditor!: CanvasLiveEditor;
  canvasNodeFactory!: CanvasNodeFactory;
  private readonly insertMutex = new WriteMutex();

  async onload(): Promise<void> {
    // Load settings with defaults guard (NFR-08)
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

    // Instantiate pure modules (no Obsidian dependency)
    this.canvasParser = new CanvasParser();

    // Instantiate services
    this.snippetService = new SnippetService(this.app, this.settings);

    // Instantiate session persistence service (SESSION-01)
    this.sessionService = new SessionService(this.app, this.settings.sessionFolderPath);

    // Instantiate live canvas editor (LIVE-01)
    this.canvasLiveEditor = new CanvasLiveEditor(this.app);

    // Instantiate canvas node factory (CANVAS-01)
    this.canvasNodeFactory = new CanvasNodeFactory(this.app);

    this.addRibbonIcon('activity', 'Radiprotocol', () => { void this.activateRunnerView(); });

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
    this.canvasLiveEditor.destroy();
    this.canvasNodeFactory.destroy();
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

  async ensureEditorPanelVisible(): Promise<void> {
    const { workspace } = this.app;
    const leaves = workspace.getLeavesOfType(EDITOR_PANEL_VIEW_TYPE);
    if (leaves.length > 0 && leaves[0] !== undefined) {
      workspace.revealLeaf(leaves[0]);
      return;
    }
    // No existing leaf — create one in the right sidebar
    const leaf = workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: EDITOR_PANEL_VIEW_TYPE, active: true });
      const newLeaves = workspace.getLeavesOfType(EDITOR_PANEL_VIEW_TYPE);
      if (newLeaves[0] !== undefined) {
        workspace.revealLeaf(newLeaves[0]);
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
    const existingLeaves = workspace.getLeavesOfType(RUNNER_VIEW_TYPE);

    if (existingLeaves.length > 0 && existingLeaves[0] !== undefined) {
      const existingLeaf = existingLeaves[0];
      // Detect whether the existing leaf is in the sidebar or main tab area.
      // leaf.getRoot() === workspace.rightSplit is true for sidebar leaves.
      // Do NOT use leaf.parent instanceof WorkspaceSidedock — parent is WorkspaceTabs.
      const leafIsInSidebar = existingLeaf.getRoot() === workspace.rightSplit;
      const targetIsSidebar = this.settings.runnerViewMode === 'sidebar';

      if (leafIsInSidebar === targetIsSidebar) {
        // RUNTAB-03: mode unchanged — reveal existing leaf, no duplicate
        workspace.revealLeaf(existingLeaf);
        return;
      }

      // Mode changed — close the old leaf, fall through to open fresh in new mode
      existingLeaf.detach();
    }

    // Open in the configured mode
    let leaf: WorkspaceLeaf | null;
    if (this.settings.runnerViewMode === 'tab') {
      // RUNTAB-02: open in main workspace tab strip
      leaf = workspace.getLeaf('tab');
    } else {
      // RUNTAB-01 sidebar default: v1.0 behavior preserved
      leaf = workspace.getRightLeaf(false);
    }

    if (leaf !== null) {
      await leaf.setViewState({ type: RUNNER_VIEW_TYPE, active: true });
      workspace.revealLeaf(leaf);
    } else {
      new Notice('Could not open runner view: no available leaf.');
    }

    // After opening, trigger openCanvas on the active canvas file if any (preserved from v1.0)
    const canvasLeaves = workspace.getLeavesOfType('canvas');
    // Prefer the most-recently-active canvas leaf; fall back to the first in the list (WR-03)
    const mostRecentCanvasLeaf = canvasLeaves.find(l => l === workspace.getMostRecentLeaf());
    const activeCanvas = mostRecentCanvasLeaf ?? canvasLeaves[0];
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
    if (file instanceof TFile) {
      await workspace.getLeaf('tab').openFile(file);
    }
  }

  async insertIntoCurrentNote(text: string, file: TFile): Promise<void> {
    const { vault } = this.app;
    try {
      await this.insertMutex.runExclusive(file.path, async () => {
        const existing = await vault.read(file);
        const separator = existing.trim().length === 0 ? '' : '\n\n---\n\n';
        await vault.modify(file, existing + separator + text);
      });
      new Notice(`Inserted into ${file.name}.`);
    } catch (err) {
      console.error('[RadiProtocol] insertIntoCurrentNote failed:', err);
      new Notice(`Failed to insert into ${file.name}. See console for details.`);
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
