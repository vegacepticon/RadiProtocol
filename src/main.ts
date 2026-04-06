// main.ts
import { Plugin, Notice } from 'obsidian';
import { RadiProtocolSettings, DEFAULT_SETTINGS, RadiProtocolSettingsTab } from './settings';
import { CanvasParser } from './graph/canvas-parser';

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
}
