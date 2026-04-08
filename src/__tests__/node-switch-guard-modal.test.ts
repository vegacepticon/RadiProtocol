import { describe, it, expect, vi } from 'vitest';

vi.mock('obsidian');
vi.mock('../main', () => ({ default: class RadiProtocolPlugin {} }));

// This import will fail RED until node-switch-guard-modal.ts is created in Task 2.
import { NodeSwitchGuardModal } from '../views/node-switch-guard-modal';

// This import is used only for the structural guard test at the bottom.
import { EditorPanelView } from '../views/editor-panel-view';

describe('NodeSwitchGuardModal (EDITOR-02)', () => {
  it('is importable and constructable', () => {
    // The obsidian mock provides App and Modal stubs.
    // NodeSwitchGuardModal extends Modal — constructor receives app.
    const mockApp = {} as import('obsidian').App;
    expect(() => new NodeSwitchGuardModal(mockApp)).not.toThrow();
  });

  it('exposes result as a Promise', () => {
    const mockApp = {} as import('obsidian').App;
    const modal = new NodeSwitchGuardModal(mockApp);
    expect(modal.result).toBeInstanceOf(Promise);
  });

  it('result resolves with false when onClose() is called before any button click', async () => {
    const mockApp = {} as import('obsidian').App;
    const modal = new NodeSwitchGuardModal(mockApp);
    modal.onClose();
    const result = await modal.result;
    expect(result).toBe(false);
  });

  it('result does not double-resolve (calling onClose() twice is safe)', async () => {
    const mockApp = {} as import('obsidian').App;
    const modal = new NodeSwitchGuardModal(mockApp);
    modal.onClose();
    modal.onClose(); // second call should be a no-op
    const result = await modal.result;
    expect(result).toBe(false);
  });

  it('has onOpen method on prototype', () => {
    expect(typeof NodeSwitchGuardModal.prototype.onOpen).toBe('function');
  });

  it('has onClose method on prototype', () => {
    expect(typeof NodeSwitchGuardModal.prototype.onClose).toBe('function');
  });
});

describe('EditorPanelView auto-switch integration guard (EDITOR-01)', () => {
  it('handleNodeClick method exists on EditorPanelView prototype', () => {
    // This test is RED until Plan 02 adds handleNodeClick.
    expect(
      typeof (EditorPanelView.prototype as unknown as Record<string, unknown>)['handleNodeClick']
    ).toBe('function');
  });
});
