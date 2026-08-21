import { beforeEach, describe, expect, it, vi } from 'vitest';

const floatingInstances = vi.hoisted(() => [] as Array<{
  args: unknown[];
  open: ReturnType<typeof vi.fn>;
  focus: ReturnType<typeof vi.fn>;
  isOpen: ReturnType<typeof vi.fn>;
}>);

vi.mock('../../views/inline-runner-modal', () => ({
  inlineRunnerRegistryKey: (
    protocolPath: string,
    notePath: string,
    startNodeId?: string,
  ) => `${protocolPath}#${notePath}${startNodeId === undefined ? '' : `#start=${startNodeId}`}`,
  InlineRunnerModal: class {
    private readonly instance: (typeof floatingInstances)[number];

    constructor(...args: unknown[]) {
      this.instance = {
        args,
        open: vi.fn(async () => {}),
        focus: vi.fn(),
        isOpen: vi.fn(() => true),
      };
      floatingInstances.push(this.instance);
    }

    async open(): Promise<void> {
      await Reflect.apply(
        this.instance.open as unknown as (...args: unknown[]) => Promise<void>,
        undefined,
        [],
      );
    }
    focus(): void {
      Reflect.apply(
        this.instance.focus as unknown as (...args: unknown[]) => unknown,
        undefined,
        [],
      );
    }
    isOpen(): boolean {
      return Reflect.apply(
        this.instance.isOpen as unknown as (...args: unknown[]) => boolean,
        undefined,
        [],
      );
    }
    close(): void {}
  },
}));

const sidebarInstances = vi.hoisted(() => [] as Array<{
  order: string[];
  initialize: ReturnType<typeof vi.fn>;
}>);

vi.mock('../../views/sidebar-runner-view', () => {
  const marker = 'radiprotocol-sidebar-runner-launch';
  class SidebarRunnerView {
    order: string[] = [];
    initialize = vi.fn(async (_context: unknown) => {
      this.order.push('initialize');
      return true;
    });

    constructor() {
      sidebarInstances.push(this);
    }
  }
  return {
    SidebarRunnerView,
    SIDEBAR_RUNNER_VIEW_TYPE: 'radiprotocol-sidebar-runner',
    SIDEBAR_RUNNER_LAUNCH_MARKER: marker,
    createSidebarRunnerEphemeralState: () => ({ [marker]: true }),
  };
});

import { TFile } from 'obsidian';
import RadiProtocolPlugin from '../../main';
import {
  SIDEBAR_RUNNER_LAUNCH_MARKER,
  SIDEBAR_RUNNER_VIEW_TYPE,
  SidebarRunnerView,
} from '../../views/sidebar-runner-view';

interface SidebarLeafHarness {
  leaf: any;
  order: string[];
  viewState: Record<string, unknown> | null;
  eState: Record<string, unknown> | null;
  ephemeralState: Record<string, unknown>;
}

function makeSidebarLeaf(deferred = false): SidebarLeafHarness {
  const order: string[] = [];
  const harness: SidebarLeafHarness = {
    order,
    viewState: null,
    eState: null,
    ephemeralState: {},
    leaf: null,
  };
  const leaf: any = {
    view: {},
    isDeferred: deferred,
    detached: false,
    detachCalls: 0,
    setEphemeralState: vi.fn((state: Record<string, unknown>) => {
      harness.ephemeralState = { ...state };
    }),
    getEphemeralState: vi.fn(() => harness.ephemeralState),
    setViewState: vi.fn(async (
      state: Record<string, unknown>,
      eState: Record<string, unknown>,
    ) => {
      order.push('setViewState');
      harness.viewState = state;
      harness.eState = eState;
      const view = new SidebarRunnerView({} as never, {} as never) as any;
      view.order = order;
      leaf.view = view;
    }),
    loadIfDeferred: vi.fn(async () => {
      order.push('loadIfDeferred');
      leaf.isDeferred = false;
    }),
    detach: vi.fn(() => {
      leaf.detachCalls += 1;
      leaf.detached = true;
    }),
  };
  harness.leaf = leaf;
  return harness;
}

function makePlugin(
  settings: Record<string, unknown>,
  sidebarLeaves: SidebarLeafHarness[] = [],
) {
  const rightLeafQueue = [...sidebarLeaves];
  const workspace = {
    getRightLeaf: vi.fn(() => rightLeafQueue.shift()?.leaf ?? null),
    getLeavesOfType: vi.fn(() => []),
    revealLeaf: vi.fn(async (leaf: any) => {
      const harness = sidebarLeaves.find(candidate => candidate.leaf === leaf);
      harness?.order.push('revealLeaf');
    }),
    detachLeavesOfType: vi.fn(),
  };
  const plugin = Object.create(RadiProtocolPlugin.prototype) as any;
  plugin.app = { workspace };
  plugin.settings = settings;
  plugin.inlineRunners = new Map();
  plugin.pickerModal = null;
  return { plugin, workspace };
}

function launch(startNodeId?: string) {
  return {
    protocolPath: 'Protocols/chest.rp.json',
    targetNote: new (TFile as any)('notes/report.md'),
    ...(startNodeId === undefined ? {} : { startNodeId }),
  };
}

beforeEach(() => {
  floatingInstances.length = 0;
  sidebarInstances.length = 0;
});

describe('floating runner presentation routing', () => {
  it.each([
    ['absent', {}],
    ['false', { useSidebarRunner: false }],
  ])('keeps floating dedup when the setting is %s', async (_name, settings) => {
    const { plugin, workspace } = makePlugin(settings);
    const context = launch('question-2');

    await plugin.openRunnerSession(context);
    await plugin.openRunnerSession(context);

    expect(workspace.getRightLeaf).not.toHaveBeenCalled();
    expect(floatingInstances).toHaveLength(1);
    expect(floatingInstances[0]!.args.slice(2)).toEqual([
      context.protocolPath,
      context.targetNote,
      'question-2',
    ]);
    expect(floatingInstances[0]!.open).toHaveBeenCalledTimes(1);
    expect(floatingInstances[0]!.focus).toHaveBeenCalledTimes(1);
    expect(plugin.getOpenInlineRunners()).toHaveLength(1);
  });

  it('keeps floating sessions with different explicit start nodes distinct', async () => {
    const { plugin } = makePlugin({ useSidebarRunner: false });
    const first = launch('question-1');
    const second = launch('question-2');

    await plugin.openRunnerSession(first);
    await plugin.openRunnerSession(second);
    await plugin.openRunnerSession(first);

    expect(floatingInstances).toHaveLength(2);
    expect(floatingInstances[0]!.args.slice(2)).toEqual([
      first.protocolPath,
      first.targetNote,
      'question-1',
    ]);
    expect(floatingInstances[1]!.args.slice(2)).toEqual([
      second.protocolPath,
      second.targetNote,
      'question-2',
    ]);
    expect(floatingInstances[0]!.focus).toHaveBeenCalledTimes(1);
    expect(floatingInstances[1]!.focus).not.toHaveBeenCalled();
  });
});

describe('sidebar runner presentation routing', () => {
  it('creates independent fresh right leaves for identical launches without singleton lookup', async () => {
    const first = makeSidebarLeaf();
    const second = makeSidebarLeaf();
    const { plugin, workspace } = makePlugin(
      { useSidebarRunner: true },
      [first, second],
    );
    const context = launch();

    await plugin.openRunnerSession(context);
    await plugin.openRunnerSession(context);

    expect(workspace.getRightLeaf).toHaveBeenNthCalledWith(1, false);
    expect(workspace.getRightLeaf).toHaveBeenNthCalledWith(2, false);
    expect(workspace.getLeavesOfType).not.toHaveBeenCalled();
    expect(floatingInstances).toHaveLength(0);
    expect(sidebarInstances).toHaveLength(2);
    expect(first.leaf).not.toBe(second.leaf);
    expect((first.leaf.view as SidebarRunnerView).initialize).toHaveBeenCalledWith(context);
    expect((second.leaf.view as SidebarRunnerView).initialize).toHaveBeenCalledWith(context);
  });

  it('passes an empty durable state and one-shot marker through leaf state and eState', async () => {
    const leaf = makeSidebarLeaf();
    const { plugin } = makePlugin({ useSidebarRunner: true }, [leaf]);

    await plugin.openRunnerSession(launch());

    expect(leaf.viewState).toEqual({
      type: SIDEBAR_RUNNER_VIEW_TYPE,
      active: true,
      state: {},
    });
    expect(leaf.eState).toEqual({ [SIDEBAR_RUNNER_LAUNCH_MARKER]: true });
    expect(leaf.leaf.setEphemeralState).toHaveBeenCalledWith(
      { [SIDEBAR_RUNNER_LAUNCH_MARKER]: true },
    );
  });

  it('awaits set, deferred load, reveal, concrete verification, and initialization in order', async () => {
    const leaf = makeSidebarLeaf(true);
    const { plugin } = makePlugin({ useSidebarRunner: true }, [leaf]);

    await plugin.openRunnerSession(launch('start-here'));

    expect(leaf.order).toEqual([
      'setViewState',
      'loadIfDeferred',
      'revealLeaf',
      'initialize',
    ]);
    expect(leaf.leaf.loadIfDeferred).toHaveBeenCalledTimes(1);
    expect((leaf.leaf.view as SidebarRunnerView).initialize).toHaveBeenCalledWith(
      launch('start-here'),
    );
  });

  it('skips deferred loading when the concrete view is already loaded', async () => {
    const leaf = makeSidebarLeaf(false);
    const { plugin } = makePlugin({ useSidebarRunner: true }, [leaf]);

    await plugin.openRunnerSession(launch());

    expect(leaf.order).toEqual(['setViewState', 'revealLeaf', 'initialize']);
    expect(leaf.leaf.loadIfDeferred).not.toHaveBeenCalled();
  });

  it('detaches the handoff leaf when setViewState does not produce the registered view', async () => {
    const leaf = makeSidebarLeaf();
    leaf.leaf.setViewState.mockImplementationOnce(async () => {
      leaf.order.push('setViewState');
      leaf.leaf.view = {};
    });
    const { plugin } = makePlugin({ useSidebarRunner: true }, [leaf]);

    await plugin.openRunnerSession(launch());

    expect(leaf.leaf.detach).toHaveBeenCalledTimes(1);
  });
});

describe('runner presentation unload wiring', () => {
  it('closes floating sessions and detaches every transient sidebar leaf', async () => {
    const { plugin, workspace } = makePlugin({ useSidebarRunner: true });
    const firstClose = vi.fn();
    const secondClose = vi.fn();
    plugin.inlineRunners.set('one', { close: firstClose });
    plugin.inlineRunners.set('two', { close: secondClose });

    await plugin.onunload();

    expect(firstClose).toHaveBeenCalledTimes(1);
    expect(secondClose).toHaveBeenCalledTimes(1);
    expect(plugin.inlineRunners.size).toBe(0);
    expect(workspace.detachLeavesOfType).toHaveBeenCalledWith(
      SIDEBAR_RUNNER_VIEW_TYPE,
    );
  });
});
