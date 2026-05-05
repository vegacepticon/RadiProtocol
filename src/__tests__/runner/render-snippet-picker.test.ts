// Phase 75 Plan 04 (DEDUP-01) — focused unit tests for the snippet
// picker renderer used by InlineRunnerModal: host-class wrapper, mode/rootPath, stale-result guard,
// optional DOM guard, copy locale dispatch, and back-button wiring.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Snippet } from '../../snippets/snippet-model';

// ── SnippetTreePicker mock (hoisted via vi.mock) ──────────────────────────

const pickerCtorSpy = vi.fn();
const pickerMountSpy = vi.fn();
const pickerUnmountSpy = vi.fn();

interface CapturedPicker {
  options: Record<string, unknown>;
}
const pickerInstances: CapturedPicker[] = [];

vi.mock('../../views/snippet-tree-picker', () => {
  class SnippetTreePicker {
    constructor(options: Record<string, unknown>) {
      pickerCtorSpy(options);
      pickerInstances.push({ options });
      (this as unknown as { mount: () => Promise<void> }).mount = async () => {
        pickerMountSpy();
      };
      (this as unknown as { unmount: () => void }).unmount = () => {
        pickerUnmountSpy();
      };
    }
  }
  return { SnippetTreePicker };
});

// Import AFTER the mock is registered so the renderer picks up the fake.
import { renderSnippetPicker } from '../../runner/render/render-snippet-picker';

// ── Fake DOM ──────────────────────────────────────────────────────────────

interface FakeNode {
  tag: string;
  cls?: string;
  text?: string;
  children: FakeNode[];
  attrs: Map<string, string>;
  disabled: boolean;
  title: string;
  clickHandler: ((ev: MouseEvent) => void) | null;
  createDiv: (opts?: { cls?: string }) => FakeNode;
  createEl: (tag: string, opts?: { cls?: string; text?: string }) => FakeNode;
  empty: () => void;
  setAttribute: (name: string, value: string) => void;
}

function makeFakeNode(tag = 'div', cls?: string, text?: string): FakeNode {
  const node: FakeNode = {
    tag,
    cls,
    text,
    children: [],
    attrs: new Map(),
    disabled: false,
    title: '',
    clickHandler: null,
    createDiv(opts?: { cls?: string }): FakeNode {
      const child = makeFakeNode('div', opts?.cls);
      node.children.push(child);
      return child;
    },
    createEl(t: string, opts?: { cls?: string; text?: string }): FakeNode {
      const child = makeFakeNode(t, opts?.cls, opts?.text);
      node.children.push(child);
      return child;
    },
    empty(): void {
      node.children.length = 0;
    },
    setAttribute(name: string, value: string): void {
      node.attrs.set(name, value);
    },
  };
  return node;
}

function findByClass(root: FakeNode, cls: string): FakeNode[] {
  const out: FakeNode[] = [];
  const visit = (n: FakeNode): void => {
    if (n.cls === cls) out.push(n);
    for (const c of n.children) visit(c);
  };
  visit(root);
  return out;
}

function findByText(root: FakeNode, text: string): FakeNode[] {
  const out: FakeNode[] = [];
  const visit = (n: FakeNode): void => {
    if (n.text !== undefined && n.text.includes(text)) out.push(n);
    for (const c of n.children) visit(c);
  };
  visit(root);
  return out;
}

const RU_COPY = {
  notFound: (rel: string) => `Сниппет не найден: ${rel}`,
  validationError: (p: string, m: string) => `Сниппет «${p}» не может быть использован. ${m}`,
};
const EN_COPY = {
  notFound: (rel: string) => `Snippet not found: ${rel}`,
  validationError: (p: string, m: string) => `Snippet "${p}" cannot be used. ${m}`,
};

const STATE = {
  status: 'awaiting-snippet-pick' as const,
  nodeId: 'n1',
  subfolderPath: 'abdomen' as string | undefined,
  accumulatedText: '',
  canStepBack: true,
};

beforeEach(() => {
  pickerCtorSpy.mockClear();
  pickerMountSpy.mockClear();
  pickerUnmountSpy.mockClear();
  pickerInstances.length = 0;
});

describe('renderSnippetPicker (Phase 75 Plan 04)', () => {
  it('mounts SnippetTreePicker file-only at rootPath + subfolderPath under host wrapper class', () => {
    const zone = makeFakeNode();
    const load = vi.fn<(p: string) => Promise<Snippet | null>>();

    renderSnippetPicker(zone as unknown as HTMLElement, STATE, {
      app: {} as never,
      snippetService: { load, listFolder: vi.fn(), listFolderDescendants: vi.fn() } as never,
      rootPath: '.radiprotocol/snippets',
      hostClass: 'rp-stp-inline-host',
      copy: RU_COPY,
      bindClick: (el, handler) => { (el as unknown as FakeNode).clickHandler = handler; },
      getCurrentNodeId: () => 'n1',
      onSnippetReady: vi.fn(),
      onBack: vi.fn(),
    });

    expect(pickerCtorSpy).toHaveBeenCalledTimes(1);
    expect(pickerMountSpy).toHaveBeenCalledTimes(1);
    const opts = pickerInstances[0]!.options as Record<string, unknown>;
    expect(opts.mode).toBe('file-only');
    expect(opts.rootPath).toBe('.radiprotocol/snippets/abdomen');

    const hostDivs = findByClass(zone, 'rp-stp-inline-host');
    expect(hostDivs.length).toBe(1);

    // Footer back button rendered when canStepBack === true.
    expect(findByClass(zone, 'rp-step-back-btn').length).toBe(1);
  });

  it('passes inline host class through and roots at plain rootPath when subfolderPath is undefined', () => {
    const zone = makeFakeNode();
    renderSnippetPicker(zone as unknown as HTMLElement,
      { ...STATE, subfolderPath: undefined },
      {
        app: {} as never,
        snippetService: { load: vi.fn(), listFolder: vi.fn(), listFolderDescendants: vi.fn() } as never,
        rootPath: '.radiprotocol/snippets',
        hostClass: 'rp-stp-inline-host',
        copy: EN_COPY,
        bindClick: (el, handler) => { (el as unknown as FakeNode).clickHandler = handler; },
        getCurrentNodeId: () => 'n1',
        onSnippetReady: vi.fn(),
        onBack: vi.fn(),
      },
    );

    const opts = pickerInstances[0]!.options as Record<string, unknown>;
    expect(opts.rootPath).toBe('.radiprotocol/snippets');
    expect(findByClass(zone, 'rp-stp-inline-host').length).toBe(1);
  });

  it('dispatches onSnippetReady with loaded snippet when guards pass', async () => {
    const zone = makeFakeNode();
    const fakeSnippet: Snippet = {
      kind: 'md',
      path: '.radiprotocol/snippets/abdomen/ct.md',
      name: 'ct',
      content: 'hello',
    };
    const load = vi.fn<(p: string) => Promise<Snippet | null>>().mockResolvedValue(fakeSnippet);
    const onSnippetReady = vi.fn();

    renderSnippetPicker(zone as unknown as HTMLElement, STATE, {
      app: {} as never,
      snippetService: { load, listFolder: vi.fn(), listFolderDescendants: vi.fn() } as never,
      rootPath: '.radiprotocol/snippets',
      hostClass: 'rp-stp-inline-host',
      copy: RU_COPY,
      bindClick: (el, handler) => { (el as unknown as FakeNode).clickHandler = handler; },
      getCurrentNodeId: () => 'n1',
      onSnippetReady,
      onBack: vi.fn(),
    });

    const opts = pickerInstances[0]!.options as Record<string, unknown>;
    const onSelect = opts.onSelect as (r: { kind: string; relativePath: string }) => void;
    onSelect({ kind: 'file', relativePath: 'ct.md' });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(load).toHaveBeenCalledWith('.radiprotocol/snippets/abdomen/ct.md');
    expect(onSnippetReady).toHaveBeenCalledWith(fakeSnippet);
  });

  it('renders not-found copy via default in-zone presenter when load returns null', async () => {
    const zone = makeFakeNode();
    const load = vi.fn<(p: string) => Promise<Snippet | null>>().mockResolvedValue(null);
    const onSnippetReady = vi.fn();

    renderSnippetPicker(zone as unknown as HTMLElement, STATE, {
      app: {} as never,
      snippetService: { load, listFolder: vi.fn(), listFolderDescendants: vi.fn() } as never,
      rootPath: '.radiprotocol/snippets',
      hostClass: 'rp-stp-inline-host',
      copy: RU_COPY,
      bindClick: (el, handler) => { (el as unknown as FakeNode).clickHandler = handler; },
      getCurrentNodeId: () => 'n1',
      onSnippetReady,
      onBack: vi.fn(),
    });

    const opts = pickerInstances[0]!.options as Record<string, unknown>;
    const onSelect = opts.onSelect as (r: { kind: string; relativePath: string }) => void;
    onSelect({ kind: 'file', relativePath: 'missing.md' });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(onSnippetReady).not.toHaveBeenCalled();
    const errs = findByText(zone, 'Сниппет не найден');
    expect(errs.length).toBeGreaterThanOrEqual(1);
    expect(errs[0]!.text).toContain('missing.md');
  });

  it('routes validation errors through host copy and presenter', async () => {
    const zone = makeFakeNode();
    const broken: Snippet = {
      kind: 'json',
      id: 'broken',
      name: 'broken',
      path: '.radiprotocol/snippets/abdomen/broken.json',
      template: 't',
      placeholders: [],
      validationError: 'Bad placeholder definition',
    } as Snippet;
    const load = vi.fn<(p: string) => Promise<Snippet | null>>().mockResolvedValue(broken);
    const presentAsyncError = vi.fn();
    const onSnippetReady = vi.fn();

    renderSnippetPicker(zone as unknown as HTMLElement, STATE, {
      app: {} as never,
      snippetService: { load, listFolder: vi.fn(), listFolderDescendants: vi.fn() } as never,
      rootPath: '.radiprotocol/snippets',
      hostClass: 'rp-stp-inline-host',
      copy: EN_COPY,
      bindClick: (el, handler) => { (el as unknown as FakeNode).clickHandler = handler; },
      getCurrentNodeId: () => 'n1',
      isStillMounted: () => true,
      presentAsyncError,
      onSnippetReady,
      onBack: vi.fn(),
    });

    const opts = pickerInstances[0]!.options as Record<string, unknown>;
    const onSelect = opts.onSelect as (r: { kind: string; relativePath: string }) => void;
    onSelect({ kind: 'file', relativePath: 'broken.json' });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(onSnippetReady).not.toHaveBeenCalled();
    expect(presentAsyncError).toHaveBeenCalledWith(
      'Snippet ".radiprotocol/snippets/abdomen/broken.json" cannot be used. Bad placeholder definition',
    );
  });

  it('suppresses dispatch when stale-state guard returns a different nodeId', async () => {
    const zone = makeFakeNode();
    const fakeSnippet: Snippet = {
      kind: 'md', path: '.radiprotocol/snippets/abdomen/ct.md', name: 'ct', content: 'hi',
    };
    const load = vi.fn<(p: string) => Promise<Snippet | null>>().mockResolvedValue(fakeSnippet);
    const onSnippetReady = vi.fn();
    const presentAsyncError = vi.fn();
    let currentNodeId: string | null = 'n1';

    renderSnippetPicker(zone as unknown as HTMLElement, STATE, {
      app: {} as never,
      snippetService: { load, listFolder: vi.fn(), listFolderDescendants: vi.fn() } as never,
      rootPath: '.radiprotocol/snippets',
      hostClass: 'rp-stp-inline-host',
      copy: RU_COPY,
      bindClick: (el, handler) => { (el as unknown as FakeNode).clickHandler = handler; },
      getCurrentNodeId: () => currentNodeId,
      presentAsyncError,
      onSnippetReady,
      onBack: vi.fn(),
    });

    const opts = pickerInstances[0]!.options as Record<string, unknown>;
    const onSelect = opts.onSelect as (r: { kind: string; relativePath: string }) => void;
    currentNodeId = 'different';  // simulate state advance during await
    onSelect({ kind: 'file', relativePath: 'ct.md' });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(onSnippetReady).not.toHaveBeenCalled();
    expect(presentAsyncError).not.toHaveBeenCalled();
  });

  it('suppresses dispatch when isStillMounted returns false', async () => {
    const zone = makeFakeNode();
    const fakeSnippet: Snippet = {
      kind: 'md', path: '.radiprotocol/snippets/abdomen/ct.md', name: 'ct', content: 'hi',
    };
    const load = vi.fn<(p: string) => Promise<Snippet | null>>().mockResolvedValue(fakeSnippet);
    const onSnippetReady = vi.fn();
    const presentAsyncError = vi.fn();

    renderSnippetPicker(zone as unknown as HTMLElement, STATE, {
      app: {} as never,
      snippetService: { load, listFolder: vi.fn(), listFolderDescendants: vi.fn() } as never,
      rootPath: '.radiprotocol/snippets',
      hostClass: 'rp-stp-inline-host',
      copy: EN_COPY,
      bindClick: (el, handler) => { (el as unknown as FakeNode).clickHandler = handler; },
      getCurrentNodeId: () => 'n1',
      isStillMounted: () => false,
      presentAsyncError,
      onSnippetReady,
      onBack: vi.fn(),
    });

    const opts = pickerInstances[0]!.options as Record<string, unknown>;
    const onSelect = opts.onSelect as (r: { kind: string; relativePath: string }) => void;
    onSelect({ kind: 'file', relativePath: 'ct.md' });
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    expect(onSnippetReady).not.toHaveBeenCalled();
    expect(presentAsyncError).not.toHaveBeenCalled();
  });

  it('wires footer Back button to host onBack', () => {
    const zone = makeFakeNode();
    const onBack = vi.fn();
    renderSnippetPicker(zone as unknown as HTMLElement, STATE, {
      app: {} as never,
      snippetService: { load: vi.fn(), listFolder: vi.fn(), listFolderDescendants: vi.fn() } as never,
      rootPath: '.radiprotocol/snippets',
      hostClass: 'rp-stp-inline-host',
      copy: RU_COPY,
      bindClick: (el, handler) => { (el as unknown as FakeNode).clickHandler = handler; },
      getCurrentNodeId: () => 'n1',
      onSnippetReady: vi.fn(),
      onBack,
    });
    const back = findByClass(zone, 'rp-step-back-btn')[0]!;
    back.clickHandler?.({} as MouseEvent);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('omits Back button when canStepBack is false', () => {
    const zone = makeFakeNode();
    renderSnippetPicker(zone as unknown as HTMLElement,
      { ...STATE, canStepBack: false },
      {
        app: {} as never,
        snippetService: { load: vi.fn(), listFolder: vi.fn(), listFolderDescendants: vi.fn() } as never,
        rootPath: '.radiprotocol/snippets',
        hostClass: 'rp-stp-inline-host',
        copy: RU_COPY,
        bindClick: (el, handler) => { (el as unknown as FakeNode).clickHandler = handler; },
        getCurrentNodeId: () => 'n1',
        onSnippetReady: vi.fn(),
        onBack: vi.fn(),
      },
    );
    expect(findByClass(zone, 'rp-step-back-btn').length).toBe(0);
  });
});
