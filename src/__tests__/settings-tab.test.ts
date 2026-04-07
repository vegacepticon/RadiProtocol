import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS, RadiProtocolSettings } from '../settings';

describe('Settings defaults (UI-10, UI-11, D-10)', () => {
  it('UI-10: DEFAULT_SETTINGS.outputDestination is clipboard', () => {
    expect(DEFAULT_SETTINGS.outputDestination).toBe('clipboard');
  });

  it('UI-11: DEFAULT_SETTINGS.outputFolderPath is RadiProtocol Output', () => {
    expect(DEFAULT_SETTINGS.outputFolderPath).toBe('RadiProtocol Output');
  });

  it('D-10: DEFAULT_SETTINGS.maxLoopIterations is 50', () => {
    expect(DEFAULT_SETTINGS.maxLoopIterations).toBe(50);
  });

  it('UI-10/D-10: RadiProtocolSettingsTab has display method (stub check)', async () => {
    // Full settings tab test requires Obsidian environment — manual only.
    // This stub verifies the class is importable and has the display method.
    const { RadiProtocolSettingsTab } = await import('../settings');
    expect(typeof RadiProtocolSettingsTab.prototype.display).toBe('function');
  });

  it('RUNTAB-01: DEFAULT_SETTINGS.runnerViewMode is sidebar', () => {
    expect(DEFAULT_SETTINGS.runnerViewMode).toBe('sidebar');
  });

  it('RUNTAB-01: RadiProtocolSettings.runnerViewMode type is sidebar | tab', () => {
    // Type-level check: valid values must be assignable
    const sidebarVal: RadiProtocolSettings['runnerViewMode'] = 'sidebar';
    const tabVal: RadiProtocolSettings['runnerViewMode'] = 'tab';
    expect(sidebarVal).toBe('sidebar');
    expect(tabVal).toBe('tab');
  });

  it('RUNTAB-01: display() stub text is replaced', async () => {
    const { RadiProtocolSettingsTab } = await import('../settings');
    const src = RadiProtocolSettingsTab.prototype.display.toString();
    expect(src).not.toContain('Settings UI coming in phase 3.');
  });
});
