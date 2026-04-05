// settings.ts
import type { App } from 'obsidian';
import { PluginSettingTab } from 'obsidian';
import type RadiProtocolPlugin from './main';

export interface RadiProtocolSettings {
  outputDestination: 'clipboard' | 'new-note' | 'both';
  outputFolderPath: string;
  maxLoopIterations: number;
}

export const DEFAULT_SETTINGS: RadiProtocolSettings = {
  outputDestination: 'clipboard',
  outputFolderPath: 'RadiProtocol Output',
  maxLoopIterations: 50,
};

// Phase 3 will implement the full settings tab UI
export class RadiProtocolSettingsTab extends PluginSettingTab {
  private plugin: RadiProtocolPlugin;

  constructor(app: App, plugin: RadiProtocolPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.createEl('h2', { text: 'RadiProtocol settings' });
    // TODO: Phase 3 — add setting controls
    containerEl.createEl('p', { text: 'Settings UI coming in Phase 3.' });
  }
}
