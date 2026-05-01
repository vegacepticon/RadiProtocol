// src/__tests__/views/inline-runner-modal-output-toolbar.test.ts
// Phase 69 INLINE-CLEAN-01 (D-01, D-08) — Inline Runner regression for output-toolbar
// absence across all 6 inline states (idle / at-node / awaiting-snippet-pick /
// awaiting-loop-pick / awaiting-snippet-fill / complete). Asserts that
// .rp-copy-btn, .rp-save-btn, .rp-insert-btn, and the .rp-output-toolbar container
// are absent from .rp-inline-runner-content's DOM in every state.
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ───── MockEl harness mirrors inline-runner-modal.test.ts ─────
interface MockEl {
  tagName: string;
  children: MockEl[];
  parent: MockEl | null;
  _text: string;
  classList: Set<string>;
  _attrs: Record<string, string>;
  _style: Record<string, string>;
  _value: string;
  _disabled: boolean;
  _type: string;
  _checked: boolean;
  _listeners: Map<string, Array<(ev: unknown) => void>>;
  name: string;
  inputMode: string;
  readOnly: boolean;
  dataset: Record<string, string>;
  createEl: (tag: string, opts?: { text?: string; cls?: string; type?: string }) => MockEl;
  createDiv: (opts?: { cls?: string; text?: string }) => MockEl;
  createSpan: (opts?: { cls?: string; text?: string }) => MockEl;
  empty: () => void;
  setText: (t: string) => void;
  addClass: (c: string) => void;
  removeClass: (c: string) => void;
  toggleClass: (c: string, on?: boolean) => void;
  hasClass: (c: string) => boolean;
  setAttribute: (k: string, v: string) => void;
  getAttribute: (k: string) => string | null;
  addEventListener: (type: string, handler: (ev: unknown) => void) => void;
  removeEventListener: (type: string, handler: (ev: unknown) => void) => void;
  dispatchEvent: (event: { type: string; target?: MockEl }) => void;
  querySelector: (sel: string) => MockEl | null;
  querySelectorAll: (sel: string) => MockEl[];
  prepend: (el: MockEl) => void;
}

function makeEl(tag = 'div'): MockEl {
  const listeners = new Map<string, Array<(ev: unknown) => void>>();
  const children: MockEl[] = [];
  const attrs: Record<string, string> = {};
  const style: Record<string, string> = {};
  const classSet = new Set<string>();
  const dataset: Record<string, string> = {};

  const el = {
    tagName: tag.toUpperCase(),
    children,
    parent: null as MockEl | null,
    _text: '',
    classList: classSet,
    _attrs: attrs,
    _style: style,
    _value: '',
    _disabled: false,
    _type: '',
    _checked: false,
    _listeners: listeners,
    name: '',
    inputMode: '',
    readOnly: false,
    dataset,
    createEl(subtag: string, opts?: { text?: string; cls?: string; type?: string }): MockEl {
      const child = makeEl(subtag);
      child.parent = el as unknown as MockEl;
      if (opts?.text !== undefined) (child as unknown as { _text: string })._text = opts.text;
      if (opts?.cls) child.classList.add(opts.cls);
      if (opts?.type) (child as unknown as { _type: string })._type = opts.type;
      children.push(child);
      return child;
    },
    createDiv(opts?: { cls?: string; text?: string }): MockEl {
      return (this as unknown as MockEl).createEl('div', opts);
    },
    createSpan(opts?: { cls?: string; text?: string }): MockEl {
      return (this as unknown as MockEl).createEl('span', opts);
    },
    empty(): void {
      children.length = 0;
    },
    setText(text: string): void {
      (el as unknown as { _text: string })._text = text;
    },
    addClass(cls: string): void { classSet.add(cls); },
    removeClass(cls: string): void { classSet.delete(cls); },
    toggleClass(cls: string, on?: boolean): void {
      const want = on ?? !classSet.has(cls);
      if (want) classSet.add(cls);
      else classSet.delete(cls);
    },
    hasClass(cls: string): boolean { return classSet.has(cls); },
    setAttribute(k: string, v: string): void { attrs[k] = v; },
    getAttribute(k: string): string | null { return attrs[k] ?? null; },
    addEventListener(type: string, handler: (ev: unknown) => void): void {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type)!.push(handler);
    },
    removeEventListener(type: string, handler: (ev: unknown) => void): void {
      const arr = listeners.get(type);
      if (!arr) return;
      const i = arr.indexOf(handler);
      if (i >= 0) arr.splice(i, 1);
    },
    dispatchEvent(event: { type: string; target?: MockEl }): void {
      const arr = listeners.get(event.type);
      if (!arr) return;
      const evt = { ...event, target: event.target ?? (el as unknown as MockEl) };
      for (const h of arr.slice()) h(evt);
    },
    querySelector(sel: string): MockEl | null {
      const all = walk(el as unknown as MockEl, sel);
      return all[0] ?? null;
    },
    querySelectorAll(sel: string): MockEl[] {
      return walk(el as unknown as MockEl, sel);
    },
    prepend(child: MockEl): void {
      children.unshift(child);
      child.parent = el as unknown as MockEl;
    },
    style,
  } as unknown as MockEl;

  return el;
}

function walk(root: MockEl, sel: string): MockEl[] {
  const out: MockEl[] = [];
  const match = buildMatcher(sel);
  const stack: MockEl[] = [...root.children];
  while (stack.length > 0) {
    const cur = stack.shift()!;
    if (match(cur)) out.push(cur);
    for (const c of cur.children) stack.push(c);
  }
  return out;
}

function buildMatcher(sel: string): (el: MockEl) => boolean {
  if (sel.startsWith('.')) {
    const cls = sel.slice(1);
    return (el) => el.classList.has(cls);
  }
  return (el) => el.tagName === sel.toUpperCase();
}

function findByClass(root: MockEl, cls: string): MockEl[] {
  return walk(root, '.' + cls);
}

// ───── Mock obsidian ─────
vi.mock('obsidian', () => {
  class Modal {
    app: unknown;
    contentEl: MockEl;
    titleEl: MockEl;
    modalEl: { style: Record<string, string> };
    constructor(app: unknown) {
      this.app = app;
      this.contentEl = makeEl('div');
      this.titleEl = makeEl('div');
      this.modalEl = { style: {} };
    }
    open(): void { this.onOpen(); }
    close(): void { this.onClose(); }
    onOpen(): void {}
    onClose(): void {}
  }
  class Notice { constructor(_m: string) {} }
  class Plugin {}
  class ItemView {}
  class WorkspaceLeaf {}
  class PluginSettingTab {}
  class SuggestModal<T> {
    app: unknown;
    constructor(app: unknown) { this.app = app; }
    getSuggestions(_q: string): T[] { return []; }
    renderSuggestion(): void {}
    onChooseSuggestion(): void {}
    setPlaceholder(): void {}
    open(): void {}
    close(): void {}
  }
  class Setting {
    constructor(_e: unknown) {}
    setName(): this { return this; }
    setDesc(): this { return this; }
    setHeading(): this { return this; }
    addText(): this { return this; }
    addTextArea(): this { return this; }
    addDropdown(): this { return this; }
    addSlider(): this { return this; }
    addButton(): this { return this; }
  }
  class TFile {
    path: string;
    extension: string;
    basename: string;
    constructor(p = '') {
      this.path = p;
      const parts = p.split('/');
      const leaf = parts[parts.length - 1] ?? '';
      const dot = leaf.lastIndexOf('.');
      this.extension = dot >= 0 ? leaf.slice(dot + 1) : '';
      this.basename = dot >= 0 ? leaf.slice(0, dot) : leaf;
    }
  }
  class TFolder {
    path: string;
    name: string;
    children: Array<TFile | TFolder>;
    constructor(p = '', children: Array<TFile | TFolder> = []) {
      this.path = p;
      this.name = p.split('/').pop() ?? '';
      this.children = children;
    }
  }
  return { Modal, Notice, Plugin, ItemView, WorkspaceLeaf, PluginSettingTab, SuggestModal, Setting, TFile, TFolder };
});

// Mock SnippetTreePicker
const snippetTreePickerMountSpy = vi.fn();
vi.mock('../../views/snippet-tree-picker', () => {
  class SnippetTreePicker {
    constructor(_options: unknown) {}
    async mount(): Promise<void> {
      snippetTreePickerMountSpy();
    }
    unmount(): void {}
  }
  return { SnippetTreePicker };
});

// Mock SnippetFillInModal
vi.mock('../../views/snippet-fill-in-modal', () => {
  const instances: Array<{
    snippet: unknown;
    result: Promise<string | null>;
    __resolve: (v: string | null) => void;
    open: () => void;
    close: () => void;
    opened: boolean;
  }> = [];
  class SnippetFillInModal {
    result: Promise<string | null>;
    private resolveFn!: (v: string | null) => void;
    opened = false;
    closed = false;
    readonly snippet: unknown;
    constructor(_app: unknown, snippet: unknown) {
      this.snippet = snippet;
      this.result = new Promise<string | null>(res => { this.resolveFn = res; });
      instances.push(this as unknown as (typeof instances)[number]);
    }
    __resolve(v: string | null): void { this.resolveFn(v); }
    open(): void { this.opened = true; }
    close(): void { this.closed = true; }
  }
  return { SnippetFillInModal, __fillModalInstances: instances };
});

// Import after mocks are installed.
import { InlineRunnerModal } from '../../views/inline-runner-modal';
import { TFile } from 'obsidian';

// ── Helpers ───────────────────────────────────────────────────────────────

function makeTargetNote(): TFile {
  return new (TFile as any)('notes/target.md');
}

function makePlugin(): any {
  return {
    settings: {
      textSeparator: 'newline',
      snippetFolderPath: 'Snippets',
      protocolFolderPath: 'Protocols',
    },
    snippetService: {
      load: vi.fn(async (_absPath: string) => null),
    },
    insertMutex: {
      runExclusive: vi.fn(async (_path: string, fn: () => Promise<void>) => fn()),
    },
    activateRunnerView: vi.fn(),
    canvasLiveEditor: { getCanvasJSON: () => null },
    _vaultModifyCalls: [] as Array<[string, string]>,
  };
}

function makeApp(plugin: any): any {
  return {
    vault: {
      getAbstractFileByPath: vi.fn(() => null),
      read: vi.fn(async () => ''),
      modify: vi.fn(async (file: TFile, content: string) => {
        plugin._vaultModifyCalls.push([file.path, content]);
      }),
      getFiles: vi.fn(() => []),
    },
    workspace: {
      on: vi.fn(() => ({})),
      getActiveFile: vi.fn(() => null),
      iterateAllLeaves: vi.fn(() => {}),
    },
  };
}

interface FakeQuestionNode { id: string; kind: 'question'; questionText: string; }
interface FakeLoopNode { id: string; kind: 'loop'; headerText: string; }

function makeFakeGraph(includeQuestion: boolean, includeLoop: boolean): {
  nodes: Map<string, FakeQuestionNode | FakeLoopNode>;
  adjacency: Map<string, string[]>;
  edges: Array<{ fromNodeId: string; toNodeId: string; label: string }>;
} {
  const nodes = new Map<string, FakeQuestionNode | FakeLoopNode>();
  if (includeQuestion) {
    nodes.set('Q1', { id: 'Q1', kind: 'question', questionText: 'sample?' });
  }
  if (includeLoop) {
    nodes.set('L1', { id: 'L1', kind: 'loop', headerText: '' });
  }
  return { nodes, adjacency: new Map(), edges: [] };
}

function setupModalAndRender(
  status: string,
  extras: Record<string, unknown> = {},
  opts: { graph?: ReturnType<typeof makeFakeGraph> } = {},
): MockEl {
  const targetNote = makeTargetNote();
  const plugin = makePlugin();
  const app = makeApp(plugin);
  const modal = new InlineRunnerModal(app as any, plugin as any, 'test.canvas', targetNote);
  // Wire a clean MockEl as the content host. The render() method never touches
  // any other DOM ref; this is the only sink we need.
  (modal as any).contentEl = makeEl('div');
  if (opts.graph !== undefined) {
    (modal as any).graph = opts.graph;
  }
  vi.spyOn((modal as any).runner, 'getState').mockImplementation(() => ({
    status,
    canStepBack: false,
    accumulatedText: 'sample',
    finalText: 'sample',
    ...extras,
  } as any));
  (modal as any).render();
  return (modal as any).contentEl as MockEl;
}

describe('Phase 69 INLINE-CLEAN-01 — Inline output toolbar absent in all 6 states', () => {
  it('status=idle: rp-copy-btn / rp-save-btn / rp-insert-btn / rp-output-toolbar all absent', () => {
    const root = setupModalAndRender('idle');
    expect(root.querySelectorAll('.rp-copy-btn')).toHaveLength(0);
    expect(root.querySelectorAll('.rp-save-btn')).toHaveLength(0);
    expect(root.querySelectorAll('.rp-insert-btn')).toHaveLength(0);
    expect(root.querySelectorAll('.rp-output-toolbar')).toHaveLength(0);
  });

  it('status=at-node: all 4 selectors absent', () => {
    const graph = makeFakeGraph(true, false);
    const root = setupModalAndRender(
      'at-node',
      { currentNodeId: 'Q1' },
      { graph },
    );
    expect(root.querySelectorAll('.rp-copy-btn')).toHaveLength(0);
    expect(root.querySelectorAll('.rp-save-btn')).toHaveLength(0);
    expect(root.querySelectorAll('.rp-insert-btn')).toHaveLength(0);
    expect(root.querySelectorAll('.rp-output-toolbar')).toHaveLength(0);
  });

  it('status=awaiting-snippet-pick: all 4 selectors absent', () => {
    const root = setupModalAndRender('awaiting-snippet-pick', {
      nodeId: 'Q1',
      subfolderPath: undefined,
    });
    expect(root.querySelectorAll('.rp-copy-btn')).toHaveLength(0);
    expect(root.querySelectorAll('.rp-save-btn')).toHaveLength(0);
    expect(root.querySelectorAll('.rp-insert-btn')).toHaveLength(0);
    expect(root.querySelectorAll('.rp-output-toolbar')).toHaveLength(0);
  });

  it('status=awaiting-loop-pick: all 4 selectors absent', () => {
    const graph = makeFakeGraph(false, true);
    const root = setupModalAndRender(
      'awaiting-loop-pick',
      { nodeId: 'L1' },
      { graph },
    );
    expect(root.querySelectorAll('.rp-copy-btn')).toHaveLength(0);
    expect(root.querySelectorAll('.rp-save-btn')).toHaveLength(0);
    expect(root.querySelectorAll('.rp-insert-btn')).toHaveLength(0);
    expect(root.querySelectorAll('.rp-output-toolbar')).toHaveLength(0);
  });

  it('status=awaiting-snippet-fill: all 4 selectors absent', () => {
    const root = setupModalAndRender('awaiting-snippet-fill', {
      snippetId: 'S1',
    });
    expect(root.querySelectorAll('.rp-copy-btn')).toHaveLength(0);
    expect(root.querySelectorAll('.rp-save-btn')).toHaveLength(0);
    expect(root.querySelectorAll('.rp-insert-btn')).toHaveLength(0);
    expect(root.querySelectorAll('.rp-output-toolbar')).toHaveLength(0);
  });

  it('status=complete: all 4 selectors absent', () => {
    const root = setupModalAndRender('complete');
    expect(root.querySelectorAll('.rp-copy-btn')).toHaveLength(0);
    expect(root.querySelectorAll('.rp-save-btn')).toHaveLength(0);
    expect(root.querySelectorAll('.rp-insert-btn')).toHaveLength(0);
    expect(root.querySelectorAll('.rp-output-toolbar')).toHaveLength(0);
  });
});
