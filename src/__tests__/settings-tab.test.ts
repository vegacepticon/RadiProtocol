import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, RadiProtocolSettingsTab, type RadiProtocolSettings } from '../settings';
import {
  __getMockAbstractInputSuggestInstances,
  __getMockTextComponents,
  __resetObsidianMocks,
} from '../__mocks__/obsidian';

describe('Settings defaults (RUN-07)', () => {
  it('RUN-07: no legacy loop-iteration-cap field on DEFAULT_SETTINGS', () => {
    expect('maxLoopIterations' in DEFAULT_SETTINGS).toBe(false);
  });


  it('SettingsTab has display method (stub check)', async () => {
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
    i18n: {
      t: (key: string, _params?: Record<string, string>, fallback?: string) => fallback ?? key,
      setLocale: () => {},
      getLocale: () => 'en' as const,
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

  it('attaches folder suggesters to Protocol and Snippet fields only', () => {
    const { textComponents, suggesters } = renderSettings();

    expect(textComponents).toHaveLength(3);
    expect(suggesters).toHaveLength(2);
    expect(suggesters.map((suggester: { textInputEl: unknown }) => suggester.textInputEl)).toEqual([
      textComponents[0]!.inputEl,
      textComponents[1]!.inputEl,
    ]);
    expect(suggesters.map((suggester: { textInputEl: unknown }) => suggester.textInputEl)).not.toContain(textComponents[2]!.inputEl);
  });

  it('typing wired fields still persists through field-specific save handlers', async () => {
    const { plugin, textComponents } = renderSettings({
      protocolFolderPath: 'Old Protocols',
      snippetFolderPath: 'Old Snippets',
    });
    const [protocolText, snippetText] = textComponents;

    protocolText!.inputEl.value = ' Protocols/CT ';
    protocolText!.inputEl.dispatchEvent({ type: 'input', bubbles: true });
    snippetText!.inputEl.value = '';
    snippetText!.inputEl.dispatchEvent({ type: 'input', bubbles: true });
    await Promise.resolve();

    expect(plugin.settings.protocolFolderPath).toBe('Protocols/CT');
    expect(plugin.settings.snippetFolderPath).toBe('.radiprotocol/snippets');
    expect(plugin.saveSettingsCalls).toBe(2);
  });

  it('selecting suggestions reaches the same save-on-change pathway as typing', async () => {
    const { plugin, suggesters } = renderSettings();

    suggesters[0]!.selectSuggestion('Protocols/MR', {} as KeyboardEvent);
    suggesters[1]!.selectSuggestion('.radiprotocol/snippets/CT', {} as KeyboardEvent);
    await Promise.resolve();

    expect(plugin.settings.protocolFolderPath).toBe('Protocols/MR');
    expect(plugin.settings.snippetFolderPath).toBe('.radiprotocol/snippets/CT');
    expect(plugin.saveSettingsCalls).toBe(2);
  });
});
