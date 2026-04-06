// main.ts
import { Plugin, Notice, TFile } from 'obsidian';
import { RadiProtocolSettings, DEFAULT_SETTINGS, RadiProtocolSettingsTab } from './settings';
import { CanvasParser } from './graph/canvas-parser';
import { GraphValidator } from './graph/graph-validator';
import { RunnerView, RUNNER_VIEW_TYPE } from './views/runner-view';
import { NodePickerModal, buildNodeOptions } from './views/node-picker-modal';
import type { ProtocolGraph } from './graph/graph-model';

export default class RadiProtocolPlugin extends Plugin {
  settings!: RadiProtocolSettings;
  canvasParser!: CanvasParser;

  async onload(): Promise<void> {
    // Load settings with defaults guard (NFR-08)
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData() as Partial<RadiProtocolSettings>);

    // Instantiate pure modules
    this.canvasParser = new CanvasParser();

    // Register RunnerView ItemView (UI-01)
    this.registerView(RUNNER_VIEW_TYPE, (leaf) => new RunnerView(leaf, this));

    // Ribbon icon (NFR-05 sentence case; UI-SPEC copywriting: 'RadiProtocol runner')
    this.addRibbonIcon('activity', 'RadiProtocol runner', () => {
      void this.activateRunnerView();
    });

    // Command: run-protocol (NFR-06: no plugin name prefix)
    this.addCommand({
      id: 'run-protocol',
      name: 'Run protocol',
      callback: () => { void this.openProtocol(); },
    });

    // Command: start-protocol-from-node (RUN-10 / D-06)
    this.addCommand({
      id: 'start-protocol-from-node',
      name: 'Start protocol from node',
      callback: () => { void this.openNodePickerCommand(); },
    });

    // Settings tab
    this.addSettingTab(new RadiProtocolSettingsTab(this.app, this));

    console.debug('[RadiProtocol] Plugin loaded');
  }

  async onunload(): Promise<void> {
    console.debug('[RadiProtocol] Plugin unloaded');
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  async activateRunnerView(): Promise<void> {
    const { workspace } = this.app;
    workspace.detachLeavesOfType(RUNNER_VIEW_TYPE);
    const leaf = workspace.getRightLeaf(false);
    if (leaf) {
      await leaf.setViewState({ type: RUNNER_VIEW_TYPE, active: true });
      const activeLeaf = workspace.getLeavesOfType(RUNNER_VIEW_TYPE)[0];
      if (activeLeaf !== undefined) {
        workspace.revealLeaf(activeLeaf);
      }
    }
  }

  private async openProtocol(): Promise<void> {
    // Get the currently active file — must be a .canvas file
    const activeFile = this.app.workspace.getActiveFile();
    if (activeFile === null || activeFile.extension !== 'canvas') {
      new Notice('Open a .canvas file first, then run this command.');
      return;
    }
    await this.activateRunnerView();
    // Get the RunnerView instance and tell it to open this canvas
    const leaves = this.app.workspace.getLeavesOfType(RUNNER_VIEW_TYPE);
    const leaf = leaves[0];
    if (leaf === undefined) return;
    const view = leaf.view;
    if (view instanceof RunnerView) {
      await view.openCanvas(activeFile.path);
    }
  }

  private async openNodePickerCommand(): Promise<void> {
    // Must have a canvas loaded in RunnerView to pick a node from
    const leaves = this.app.workspace.getLeavesOfType(RUNNER_VIEW_TYPE);
    const leaf = leaves[0];
    if (leaf === undefined) {
      new Notice('Open a canvas protocol first.');
      return;
    }
    const view = leaf.view;
    if (!(view instanceof RunnerView)) return;

    // Get the current canvas file path from the view's persisted state
    const state = view.getState() as { canvasFilePath?: string | null };
    const filePath = state.canvasFilePath;
    if (!filePath) {
      new Notice('Open a canvas protocol first.');
      return;
    }

    // Parse the canvas to get the graph (for building node options)
    const file = this.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) return;
    const content = await this.app.vault.read(file);
    const parseResult = this.canvasParser.parse(content, filePath);
    if (!parseResult.success) {
      new Notice('Cannot read protocol graph — check the canvas file.');
      return;
    }
    const validator = new GraphValidator();
    const errors = validator.validate(parseResult.graph);
    if (errors.length > 0) {
      new Notice('Canvas has validation errors. Run protocol to see details.');
      return;
    }
    const graph: ProtocolGraph = parseResult.graph;
    const options = buildNodeOptions(graph);
    if (options.length === 0) {
      new Notice('No question or text-block nodes found in this canvas.');
      return;
    }
    new NodePickerModal(this.app, options, (opt) => {
      void view.openCanvas(filePath, opt.id);
    }).open();
  }
}
