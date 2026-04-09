// settings.ts
import type { App } from 'obsidian';
import { PluginSettingTab } from 'obsidian';
import type RadiProtocolPlugin from './main';

export interface RadiProtocolSettings {
  outputDestination: 'clipboard' | 'new-note' | 'both';
  outputFolderPath: string;
  maxLoopIterations: number;
  /** Vault-relative path for snippet JSON files (D-15, SNIP-08). Default: .radiprotocol/snippets */
  snippetFolderPath: string;
  /** Vault-relative path for session JSON files (SESSION-01). Default: .radiprotocol/sessions */
  sessionFolderPath: string;
}

export const DEFAULT_SETTINGS: RadiProtocolSettings = {
  outputDestination: 'clipboard',
  outputFolderPath: 'RadiProtocol Output',
  maxLoopIterations: 50,
  snippetFolderPath: '.radiprotocol/snippets',
  sessionFolderPath: '.radiprotocol/sessions',
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
    // TODO: Phase 3 — add setting controls (no-manual-html-headings: use Setting.setHeading())
    containerEl.createEl('p', { text: 'Settings UI coming in phase 3.' });
  }
}
