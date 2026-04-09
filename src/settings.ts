// settings.ts
import type { App } from 'obsidian';
import { PluginSettingTab, Setting } from 'obsidian';
import type RadiProtocolPlugin from './main';

export interface RadiProtocolSettings {
  outputDestination: 'clipboard' | 'new-note' | 'both';
  outputFolderPath: string;
  maxLoopIterations: number;
  /** Vault-relative path for snippet JSON files (D-15, SNIP-08). Default: .radiprotocol/snippets */
  snippetFolderPath: string;
  /** Vault-relative path for session JSON files (SESSION-01). Default: .radiprotocol/sessions */
  sessionFolderPath: string;
  /** Separator inserted before each new text chunk in the runner (D-08, SEP-01). Default: 'newline'. */
  textSeparator: 'newline' | 'space';
}

export const DEFAULT_SETTINGS: RadiProtocolSettings = {
  outputDestination: 'clipboard',
  outputFolderPath: 'RadiProtocol Output',
  maxLoopIterations: 50,
  snippetFolderPath: '.radiprotocol/snippets',
  sessionFolderPath: '.radiprotocol/sessions',
  textSeparator: 'newline',
};

export class RadiProtocolSettingsTab extends PluginSettingTab {
  private plugin: RadiProtocolPlugin;

  constructor(app: App, plugin: RadiProtocolPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // Runner section (D-07: use Setting.setHeading() — no manual HTML headings)
    new Setting(containerEl).setHeading().setName('Runner');

    new Setting(containerEl)
      .setName('Max loop iterations')
      .setDesc('Hard cap on loop repetitions to prevent infinite loops. Default: 50.')
      .addText(t => {
        const inputEl = t.inputEl;
        inputEl.type = 'number';
        inputEl.min = '1';
        t.setValue(String(this.plugin.settings.maxLoopIterations))
          .onChange(v => {
            const n = parseInt(v, 10);
            this.plugin.settings.maxLoopIterations = isNaN(n) ? 50 : Math.max(1, n);
            void this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName('Text separator')
      .setDesc('How accumulated report text is joined between nodes. "Newline" adds a line break before each new chunk; "Space" adds a single space.')
      .addDropdown(drop => {
        drop
          .addOption('newline', 'Newline (default)')
          .addOption('space', 'Space')
          .setValue(this.plugin.settings.textSeparator)
          .onChange(value => {
            this.plugin.settings.textSeparator = value as 'newline' | 'space';
            void this.plugin.saveSettings();
          });
      });
  }
}
