// settings.ts
import type { App } from 'obsidian';
import { PluginSettingTab, Setting } from 'obsidian';
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

    // Heading via Setting.setHeading() — no createEl('h2') (ESLint no-manual-html-headings)
    new Setting(containerEl).setHeading().setName('RadiProtocol');

    // Track the folder path setting for show/hide
    let folderSetting: Setting;

    // Control 1: Output destination (D-10)
    new Setting(containerEl)
      .setName('Output destination')
      .setDesc('Where to send the completed protocol report.')
      .addDropdown(drop => {
        drop
          .addOption('clipboard', 'Clipboard only')
          .addOption('new-note', 'New note only')
          .addOption('both', 'Both')
          .setValue(this.plugin.settings.outputDestination)
          .onChange(async (value) => {
            this.plugin.settings.outputDestination = value as 'clipboard' | 'new-note' | 'both';
            await this.plugin.saveSettings();
            // Show/hide folder setting based on selection (D-10)
            folderSetting.settingEl.toggle(value !== 'clipboard');
          });
      });

    // Control 2: Output folder path (D-10, UI-11) — visible only when not clipboard-only
    folderSetting = new Setting(containerEl)
      .setName('Output folder')
      .setDesc('Vault folder path for saved protocol notes.')
      .addText(text => {
        text
          .setPlaceholder('RadiProtocol Output')
          .setValue(this.plugin.settings.outputFolderPath)
          .onChange(async (value) => {
            this.plugin.settings.outputFolderPath = value;
            await this.plugin.saveSettings();
          });
      });

    // Show or hide based on current setting value on initial render
    folderSetting.settingEl.toggle(this.plugin.settings.outputDestination !== 'clipboard');

    // Control 3: Max loop iterations (D-10)
    new Setting(containerEl)
      .setName('Max loop iterations')
      .setDesc('Hard limit for protocol loop iterations. Prevents infinite loops from misconfigured canvases.')
      .addSlider(slider => {
        slider
          .setLimits(10, 200, 10)
          .setValue(this.plugin.settings.maxLoopIterations)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.maxLoopIterations = value;
            await this.plugin.saveSettings();
          });
      });
  }
}
