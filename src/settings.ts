// settings.ts
import type { App } from 'obsidian';
import { PluginSettingTab, Setting } from 'obsidian';
import type RadiProtocolPlugin from './main';

export interface InlineRunnerPosition {
  left: number;
  top: number;
}

export interface RadiProtocolSettings {
  outputDestination: 'clipboard' | 'new-note' | 'both';
  outputFolderPath: string;
  /** Vault-relative path for snippet JSON files (D-15, SNIP-08). Default: .radiprotocol/snippets */
  snippetFolderPath: string;
  /** Phase 33 (D-17): Tree-view expanded-folder paths, persisted across sessions. */
  snippetTreeExpandedPaths: string[];
  /** Vault-relative path for session JSON files (SESSION-01). Default: .radiprotocol/sessions */
  sessionFolderPath: string;
  /** Runner opens in sidebar panel or full editor tab (RUNTAB-01). Default: 'sidebar' */
  runnerViewMode: 'sidebar' | 'tab';
  /** Vault-relative folder scanned for .canvas protocol files (SELECTOR-01). Default: '' (empty) */
  protocolFolderPath: string;
  /** Separator inserted before each new text chunk in the runner (D-08, SEP-01). Default: 'newline'. */
  textSeparator: 'newline' | 'space';
  /** Phase 60 (D-01): Last dragged inline runner position, persisted across reloads. */
  inlineRunnerPosition?: InlineRunnerPosition | null;
}

export const DEFAULT_SETTINGS: RadiProtocolSettings = {
  outputDestination: 'clipboard',
  outputFolderPath: 'RadiProtocol Output',
  snippetFolderPath: '.radiprotocol/snippets',
  snippetTreeExpandedPaths: [],
  sessionFolderPath: '.radiprotocol/sessions',
  runnerViewMode: 'sidebar',
  protocolFolderPath: '',
  textSeparator: 'newline',
  inlineRunnerPosition: null,
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

    // Group 1 — Runner
    new Setting(containerEl).setName('Runner').setHeading();

    new Setting(containerEl)
      .setName('Runner view mode')
      .setDesc('Choose where the protocol runner opens. Changes take effect the next time you invoke the runner.')
      .addDropdown(drop => drop
        .addOption('sidebar', 'Sidebar panel')
        .addOption('tab', 'Editor tab')
        .setValue(this.plugin.settings.runnerViewMode)
        .onChange(async (value) => {
          this.plugin.settings.runnerViewMode = value as 'sidebar' | 'tab';
          await this.plugin.saveSettings();
        })
      );

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

    // Group 2 — Protocol
    new Setting(containerEl).setName('Protocol').setHeading();

    new Setting(containerEl)
      .setName('Protocol canvas folder')
      .setDesc(
        'Vault-relative folder containing your .canvas protocol files. ' +
        'The canvas selector in the runner panel scans this folder. ' +
        'Leave empty to disable the selector.'
      )
      .addText(text => text
        .setPlaceholder('e.g. Protocols')
        .setValue(this.plugin.settings.protocolFolderPath)
        .onChange(async (value) => {
          this.plugin.settings.protocolFolderPath = value.trim();
          await this.plugin.saveSettings();
        })
      );

    // Group 3 — Output
    new Setting(containerEl).setName('Output').setHeading();

    new Setting(containerEl)
      .setName('Output destination')
      .setDesc('Where to send the completed protocol report.')
      .addDropdown(drop => drop
        .addOption('clipboard', 'Copy to clipboard')
        .addOption('new-note', 'Save to note')
        .addOption('both', 'Both')
        .setValue(this.plugin.settings.outputDestination)
        .onChange(async (value) => {
          this.plugin.settings.outputDestination = value as RadiProtocolSettings['outputDestination'];
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('Output folder')
      .setDesc("Vault-relative folder for saved reports. Used when destination is 'Save to note' or 'Both'.")
      .addText(text => text
        .setPlaceholder('RadiProtocol Output')
        .setValue(this.plugin.settings.outputFolderPath)
        .onChange(async (value) => {
          this.plugin.settings.outputFolderPath = value.trim() || 'RadiProtocol Output';
          await this.plugin.saveSettings();
        })
      );

    // Group 5 — Storage
    new Setting(containerEl).setName('Storage').setHeading();

    new Setting(containerEl)
      .setName('Snippet folder')
      .setDesc('Vault-relative path for snippet JSON files. Default: .radiprotocol/snippets')
      .addText(text => text
        .setPlaceholder('.radiprotocol/snippets')
        .setValue(this.plugin.settings.snippetFolderPath)
        .onChange(async (value) => {
          this.plugin.settings.snippetFolderPath = value.trim() || '.radiprotocol/snippets';
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName('Session folder')
      .setDesc('Vault-relative path for session JSON files. Default: .radiprotocol/sessions')
      .addText(text => text
        .setPlaceholder('.radiprotocol/sessions')
        .setValue(this.plugin.settings.sessionFolderPath)
        .onChange(async (value) => {
          this.plugin.settings.sessionFolderPath = value.trim() || '.radiprotocol/sessions';
          await this.plugin.saveSettings();
        })
      );
  }
}
