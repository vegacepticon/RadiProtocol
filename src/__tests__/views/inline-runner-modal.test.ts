import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeBaseApp, makeBasePlugin, makeEl, type MockEl } from '../runner/runner-renderer-host-fixtures';

const hostInstances = vi.hoisted(() => [] as Array<{
  options: Record<string, unknown>;
  disposed: boolean;
  childOpen: boolean;
  keydown: ReturnType<typeof vi.fn>;
  header: MockEl | null;
}>);
const layoutInstances = vi.hoisted(() => [] as Array<{
  enableDragging: ReturnType<typeof vi.fn>;
  applyInitialLayout: ReturnType<typeof vi.fn>;
  reclampCurrentPosition: ReturnType<typeof vi.fn>;
  startWindowResizeListener: ReturnType<typeof vi.fn>;
  handleResizeTick: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}>);
const resizeObservers = vi.hoisted(() => [] as Array<{
  observed: unknown[];
  disconnected: boolean;
}>);

vi.mock('obsidian', async () => {
  const fixtures = await import('../runner/runner-renderer-host-fixtures');
  return fixtures.createObsidianModuleMock();
});
vi.mock('../../views/runner-session-host', () => ({
  RunnerSessionHost: class {
    private readonly instance: (typeof hostInstances)[number];
    constructor(options: Record<string, unknown>) {
      this.instance = {
        options,
        disposed: false,
        childOpen: false,
        keydown: vi.fn(),
        header: null,
      };
      hostInstances.push(this.instance);
    }
    async mount(root: MockEl): Promise<boolean> {
      root.empty();
      root.addClass('rp-runner-session-root');
      this.instance.header = root.createDiv({ cls: 'rp-runner-session-header' });
      return true;
    }
    dispose(): void { this.instance.disposed = true; }
    hasOpenChildModal(): boolean { return this.instance.childOpen; }
    getHeaderElement(): MockEl | null { return this.instance.header; }
    handleKeydown(event: KeyboardEvent): boolean {
      Reflect.apply(this.instance.keydown as unknown as (...args: unknown[]) => void, undefined, [event]);
      return true;
    }
  },
}));
vi.mock('../../views/inline-runner-layout', () => ({
  clampInlineRunnerPosition: vi.fn(),
  clampInlineRunnerLayout: vi.fn(),
  InlineRunnerLayoutManager: class {
    private readonly instance: (typeof layoutInstances)[number];
    constructor() {
      this.instance = {
        enableDragging: vi.fn(),
        applyInitialLayout: vi.fn(),
        reclampCurrentPosition: vi.fn(async () => {}),
        startWindowResizeListener: vi.fn(),
        handleResizeTick: vi.fn(),
        destroy: vi.fn(),
      };
      layoutInstances.push(this.instance);
    }
    enableDragging(header: HTMLElement): void {
      Reflect.apply(this.instance.enableDragging as unknown as (...args: unknown[]) => void, undefined, [header]);
    }
    applyInitialLayout(): void {
      Reflect.apply(this.instance.applyInitialLayout as unknown as (...args: unknown[]) => void, undefined, []);
    }
    async reclampCurrentPosition(value: boolean): Promise<void> {
      await Reflect.apply(
        this.instance.reclampCurrentPosition as unknown as (...args: unknown[]) => Promise<void>,
        undefined,
        [value],
      );
    }
    startWindowResizeListener(): void {
      Reflect.apply(this.instance.startWindowResizeListener as unknown as (...args: unknown[]) => void, undefined, []);
    }
    handleResizeTick(): void {
      Reflect.apply(this.instance.handleResizeTick as unknown as (...args: unknown[]) => void, undefined, []);
    }
    destroy(): void {
      Reflect.apply(this.instance.destroy as unknown as (...args: unknown[]) => void, undefined, []);
    }
    getAppliedLayout(): null { return null; }
    restoreOrDefaultPosition(): void {}
  },
}));

import { TFile } from 'obsidian';
import {
  InlineRunnerModal,
  inlineRunnerRegistryKey,
} from '../../views/inline-runner-modal';

function target(path = 'notes/target.md'): TFile {
  return Object.assign(new TFile(), { path });
}

function installDom(): MockEl {
  const body = makeEl('body');
  (body as any).appendChild = vi.fn((child: MockEl) => {
    child.parent = body;
    if (!body.children.includes(child)) body.children.push(child);
  });
  const originalCreateDiv = body.createDiv.bind(body);
  body.createDiv = (options) => {
    const child = originalCreateDiv(options);
    (child as any).getBoundingClientRect = () => ({ width: 420, height: 320 });
    return child;
  };
  vi.stubGlobal('document', {
    body,
    documentElement: { clientWidth: 1024, clientHeight: 768 },
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    querySelectorAll: vi.fn(() => []),
  });
  vi.stubGlobal('window', {
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
  });
  vi.stubGlobal('ResizeObserver', class {
    private readonly state = { observed: [] as unknown[], disconnected: false };
    constructor() { resizeObservers.push(this.state); }
    observe(target: unknown): void { this.state.observed.push(target); }
    disconnect(): void { this.state.disconnected = true; }
  });
  return body;
}

beforeEach(() => {
  hostInstances.length = 0;
  layoutInstances.length = 0;
  resizeObservers.length = 0;
  installDom();
});

afterEach(() => vi.unstubAllGlobals());

describe('InlineRunnerModal floating shell', () => {
  it('mounts a shared host, preserves registry identity, and disposes it on close', async () => {
    const plugin = makeBasePlugin();
    const app = makeBaseApp(plugin);
    const note = target();
    app.workspace.getActiveFile.mockReturnValue(note as never);
    app.workspace.iterateAllLeaves.mockImplementation((callback: (leaf: unknown) => void) => {
      callback({ view: { file: note } });
    });
    const modal = new InlineRunnerModal(app as any, plugin as any, 'Protocols/test.rp.json', note, 'q2');

    await modal.open();
    expect(modal.isOpen()).toBe(true);
    expect(hostInstances).toHaveLength(1);
    expect(hostInstances[0]!.options).toMatchObject({
      protocolPath: 'Protocols/test.rp.json',
      targetNote: note,
      startNodeId: 'q2',
    });
    const container = (modal as any).containerEl as MockEl;
    const layout = layoutInstances[0]!;
    const provisionalHeader = layout.enableDragging.mock.calls[0]?.[0];
    expect(layout.enableDragging).toHaveBeenCalledTimes(2);
    expect(provisionalHeader).not.toBe(hostInstances[0]!.header);
    expect(layout.enableDragging.mock.calls[1]?.[0]).toBe(hostInstances[0]!.header);
    expect(container.querySelector('.rp-runner-session-header')).toBe(hostInstances[0]!.header);
    expect(layout.applyInitialLayout).toHaveBeenCalledTimes(1);
    expect(layout.startWindowResizeListener).toHaveBeenCalledTimes(1);
    expect(resizeObservers[0]!.observed).toEqual([container]);
    expect(container._listeners.get('keydown')).toHaveLength(1);

    const key = inlineRunnerRegistryKey(
      'Protocols/test.rp.json',
      'notes/target.md',
      'q2',
    );
    plugin.registerInlineRunner(key, modal);
    modal.close();
    modal.close();
    expect(hostInstances[0]!.disposed).toBe(true);
    expect(container._listeners.get('keydown')).toHaveLength(0);
    expect(app._workspaceHandlerCount('active-leaf-change')).toBe(0);
    expect(app._workspaceHandlerCount('layout-change')).toBe(0);
    expect(resizeObservers[0]!.disconnected).toBe(true);
    expect(layout.destroy).toHaveBeenCalledTimes(1);
    expect(plugin.unregisterInlineRunner).toHaveBeenCalledWith(key);
    expect(plugin.unregisterInlineRunner).toHaveBeenCalledTimes(1);
    expect(plugin.inlineRunners.size).toBe(0);
  });

  it('hides on active-note mismatch, shows on return, and closes when the target leaf is gone', async () => {
    const plugin = makeBasePlugin();
    const app = makeBaseApp(plugin);
    const note = target();
    let targetOpen = true;
    app.workspace.getActiveFile.mockReturnValue(target('notes/other.md') as never);
    app.workspace.iterateAllLeaves.mockImplementation((callback: (leaf: unknown) => void) => {
      if (targetOpen) callback({ view: { file: note } });
    });
    const modal = new InlineRunnerModal(app as any, plugin as any, 'Protocols/test.rp.json', note);
    await modal.open();
    const container = (modal as any).containerEl as MockEl;
    expect(container.hasClass('is-hidden')).toBe(true);

    app.workspace.getActiveFile.mockReturnValue(note as never);
    app._emitWorkspace('active-leaf-change');
    expect(container.hasClass('is-hidden')).toBe(false);

    targetOpen = false;
    app._emitWorkspace('active-leaf-change');
    expect(modal.isOpen()).toBe(false);
    expect(hostInstances[0]!.disposed).toBe(true);
  });

  it('gates active-leaf visibility while the host owns a child modal', async () => {
    const plugin = makeBasePlugin();
    const app = makeBaseApp(plugin);
    const note = target();
    app.workspace.getActiveFile.mockReturnValue(note as never);
    app.workspace.iterateAllLeaves.mockImplementation((callback: (leaf: unknown) => void) => {
      callback({ view: { file: note } });
    });
    const modal = new InlineRunnerModal(app as any, plugin as any, 'Protocols/test.rp.json', note);
    await modal.open();
    const container = (modal as any).containerEl as MockEl;

    hostInstances[0]!.childOpen = true;
    app.workspace.getActiveFile.mockReturnValue(target('notes/other.md') as never);
    app._emitWorkspace('active-leaf-change');
    expect(container.hasClass('is-hidden')).toBe(false);
  });

  it('focus reattaches and unhides the floating container', async () => {
    const body = document.body as unknown as MockEl & { appendChild: ReturnType<typeof vi.fn> };
    const plugin = makeBasePlugin();
    const app = makeBaseApp(plugin);
    const note = target();
    app.workspace.getActiveFile.mockReturnValue(note as never);
    app.workspace.iterateAllLeaves.mockImplementation((callback: (leaf: unknown) => void) => {
      callback({ view: { file: note } });
    });
    const modal = new InlineRunnerModal(app as any, plugin as any, 'Protocols/test.rp.json', note);
    await modal.open();
    const container = (modal as any).containerEl as MockEl;
    container.addClass('is-hidden');

    modal.focus();
    expect(body.appendChild).toHaveBeenCalledWith(container);
    expect(container.hasClass('is-hidden')).toBe(false);
  });
});
