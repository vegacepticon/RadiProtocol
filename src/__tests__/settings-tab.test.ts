import { describe, it, expect } from 'vitest';
import { DEFAULT_SETTINGS } from '../settings';

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
