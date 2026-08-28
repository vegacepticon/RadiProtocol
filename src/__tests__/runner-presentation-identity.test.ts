import { describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { TFile } from 'obsidian';
import RadiProtocolPlugin from '../main';
import { SidebarRunnerView } from '../views/sidebar-runner-view';

const mainSrc = fs.readFileSync(path.resolve(__dirname, '../main.ts'), 'utf8');
const viewSrc = fs.readFileSync(path.resolve(__dirname, '../views/sidebar-runner-view.ts'), 'utf8');

function makePluginHarness() {
  const revealed: unknown[] = [];
  const workspace = {
    revealLeaf: vi.fn(async (leaf: unknown) => {
      revealed.push(leaf);
    }),
  };
  const plugin = Object.create(RadiProtocolPlugin.prototype) as any;
  plugin.app = { workspace };
  plugin.sidebarRunnersByNote = new Map();
  return { plugin, workspace, revealed };
}

function makeRunnerView(plugin: unknown, notePath: string): SidebarRunnerView {
  const view = new SidebarRunnerView({} as never, plugin as never);
  (view as unknown as { launchContext: unknown }).launchContext = {
    protocolPath: 'Protocols/chest.rp.json',
    targetNote: new (TFile as any)(notePath),
  };
  return view;
}

describe('sidebar runner note-binding registry', () => {
  it('does not reveal when no runner is bound to the active note', async () => {
    const { plugin, workspace } = makePluginHarness();

    await plugin.revealSidebarRunnerForNote(new (TFile as any)('notes/unbound.md'));

    expect(workspace.revealLeaf).not.toHaveBeenCalled();
  });

  it('reveals the bound runner leaf when its note becomes active', async () => {
    const { plugin, workspace } = makePluginHarness();
    const leaf = { view: makeRunnerView(plugin, 'notes/report.md') } as never;
    plugin.sidebarRunnersByNote.set('notes/report.md', leaf);

    await plugin.revealSidebarRunnerForNote(new (TFile as any)('notes/report.md'));

    expect(workspace.revealLeaf).toHaveBeenCalledTimes(1);
    expect(workspace.revealLeaf).toHaveBeenCalledWith(leaf);
  });

  it('repairs a stale registry entry whose leaf no longer hosts a runner view', async () => {
    const { plugin, workspace } = makePluginHarness();
    plugin.sidebarRunnersByNote.set('notes/report.md', { view: {} } as never);

    await plugin.revealSidebarRunnerForNote(new (TFile as any)('notes/report.md'));

    expect(workspace.revealLeaf).not.toHaveBeenCalled();
    expect(plugin.sidebarRunnersByNote.has('notes/report.md')).toBe(false);
  });

  it('rekeys the bound runner when its note is renamed', () => {
    const { plugin } = makePluginHarness();
    const leaf = { view: makeRunnerView(plugin, 'notes/old.md') } as never;
    plugin.sidebarRunnersByNote.set('notes/old.md', leaf);

    const renamed = new (TFile as any)('notes/new.md');
    plugin.rekeySidebarRunnerForRename(renamed, 'notes/old.md');

    expect(plugin.sidebarRunnersByNote.has('notes/old.md')).toBe(false);
    expect(plugin.sidebarRunnersByNote.get('notes/new.md')).toBe(leaf);
  });

  it('ignores renames of notes without bound runners', () => {
    const { plugin } = makePluginHarness();
    const renamed = new (TFile as any)('notes/new.md');

    plugin.rekeySidebarRunnerForRename(renamed, 'notes/unbound.md');

    expect(plugin.sidebarRunnersByNote.size).toBe(0);
  });
});

describe('note-binding registry wiring guards', () => {
  it('dedupes relaunches through the registry before creating a leaf', () => {
    expect(mainSrc).toContain('this.sidebarRunnersByNote.get(options.targetNote.path)');
    expect(mainSrc).toContain('this.revealSidebarRunnerForNote(options.targetNote)');
  });

  it('switches runners on file-open and re-keys on rename, both via registerEvent', () => {
    expect(mainSrc).toContain("this.app.workspace.on('file-open', (file) => {");
    expect(mainSrc).toContain('this.revealSidebarRunnerForNote(file)');
    expect(mainSrc).toContain("this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {");
    expect(mainSrc).toContain('this.rekeySidebarRunnerForRename(file, oldPath)');
  });

  it('frees the note slot when the runner view closes', () => {
    expect(viewSrc).toContain('this.plugin.unregisterSidebarRunnerLeaf');
  });

  it('still clears the registry and detaches transient leaves on unload', () => {
    expect(mainSrc).toContain('this.sidebarRunnersByNote.clear()');
    expect(mainSrc).toContain('this.app.workspace.detachLeavesOfType(SIDEBAR_RUNNER_VIEW_TYPE)');
  });
});
