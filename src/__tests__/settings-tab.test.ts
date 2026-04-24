import { beforeEach, describe, expect, it } from 'vitest';
import {
  __getMockAbstractInputSuggestInstances,
  __getMockTextComponents,
  __resetObsidianMocks,
} from 'obsidian';
import { DEFAULT_SETTINGS, RadiProtocolSettingsTab, type RadiProtocolSettings } from '../settings';

describe('Settings defaults (UI-10, UI-11, RUN-07)', () => {
  it('UI-10: DEFAULT_SETTINGS.outputDestination is clipboard', () => {
    expect(DEFAULT_SETTINGS.outputDestination).toBe('clipboard');
  });

  it('UI-11: DEFAULT_SETTINGS.outputFolderPath is RadiProtocol Output', () => {
    expect(DEFAULT_SETTINGS.outputFolderPath).toBe('RadiProtocol Output');
  });

  it('RUN-07: no legacy loop-iteration-cap field on DEFAULT_SETTINGS', () => {
    expect('maxLoopIterations' in DEFAULT_SETTINGS).toBe(false);
  });

  it('UI-10/D-10: RadiProtocolSettingsTab has display method (stub check)', async () => {
    // Full settings tab test requires Obsidian environment — manual only.
    // This stub verifies the class is importable and has the display method.
    const { RadiProtocolSettingsTab } = await import('../settings');
    expect(typeof RadiProtocolSettingsTab.prototype.display).toBe('function');
  });
});

function makePlugin(settings: Partial<RadiProtocolSettings> = {}) {
  return {
    settings: { ...DEFAULT_SETTINGS, ...settings },
    saveSettingsCalls: 0,
    async saveSettings() {
      this.saveSettingsCalls += 1;
    },
  };
}

function makeApp() {
  return {
    vault: {
      getAllFolders: () => [
        { path: '' },
        { path: 'Protocols' },
        { path: 'Protocols/CT' },
        { path: 'RadiProtocol Output' },
        { path: '.radiprotocol/snippets' },
      ],
    },
  };
}

function renderSettings(settings: Partial<RadiProtocolSettings> = {}) {
  __resetObsidianMocks();
  const app = makeApp();
  const plugin = makePlugin(settings);
  const tab = new RadiProtocolSettingsTab(app as never, plugin as never);

  tab.display();

  return {
    app,
    plugin,
    textComponents: __getMockTextComponents(),
    suggesters: __getMockAbstractInputSuggestInstances(),
  };
}

describe('Settings folder autocomplete (SETTINGS-01)', () => {
  beforeEach(() => {
    __resetObsidianMocks();
  });

  it('attaches folder suggesters to Protocol, Output, and Snippet fields only', () => {
    const { textComponents, suggesters } = renderSettings();

    expect(textComponents).toHaveLength(4);
    expect(suggesters).toHaveLength(3);
    expect(suggesters.map(suggester => suggester.textInputEl)).toEqual([
      textComponents[0].inputEl,
      textComponents[1].inputEl,
      textComponents[2].inputEl,
    ]);
    expect(suggesters.map(suggester => suggester.textInputEl)).not.toContain(textComponents[3].inputEl);
  });

  it('typing wired fields still persists through field-specific save handlers', async () => {
    const { plugin, textComponents } = renderSettings({
      protocolFolderPath: 'Old Protocols',
      outputFolderPath: 'Old Output',
      snippetFolderPath: 'Old Snippets',
    });
    const [protocolText, outputText, snippetText] = textComponents;

    protocolText.inputEl.value = ' Protocols/CT ';
    protocolText.inputEl.dispatchEvent({ type: 'input', bubbles: true });
    outputText.inputEl.value = '   ';
    outputText.inputEl.dispatchEvent({ type: 'input', bubbles: true });
    snippetText.inputEl.value = '';
    snippetText.inputEl.dispatchEvent({ type: 'input', bubbles: true });
    await Promise.resolve();

    expect(plugin.settings.protocolFolderPath).toBe('Protocols/CT');
    expect(plugin.settings.outputFolderPath).toBe('RadiProtocol Output');
    expect(plugin.settings.snippetFolderPath).toBe('.radiprotocol/snippets');
    expect(plugin.saveSettingsCalls).toBe(3);
  });
});
