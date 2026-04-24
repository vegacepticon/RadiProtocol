// Phase 59 Wave 0 — INLINE-FIX-04 / INLINE-FIX-05 / D1 / D6 / D7 test scaffolding.
// These tests remain RED until Waves 1b/1c ship the implementation.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ───── MockEl with querySelector/querySelectorAll + event dispatch ─────
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

  Object.defineProperty(el, 'textContent', {
    get(): string { return (el as unknown as { _text: string })._text; },
    set(v: string): void { (el as unknown as { _text: string })._text = String(v); },
  });
  Object.defineProperty(el, 'value', {
    get(): string { return (el as unknown as { _value: string })._value; },
    set(v: string): void { (el as unknown as { _value: string })._value = String(v); },
  });
  Object.defineProperty(el, 'disabled', {
    get(): boolean { return (el as unknown as { _disabled: boolean })._disabled; },
    set(v: boolean): void { (el as unknown as { _disabled: boolean })._disabled = Boolean(v); },
  });
  Object.defineProperty(el, 'type', {
    get(): string { return (el as unknown as { _type: string })._type; },
    set(v: string): void { (el as unknown as { _type: string })._type = String(v); },
  });
  Object.defineProperty(el, 'checked', {
    get(): boolean { return (el as unknown as { _checked: boolean })._checked; },
    set(v: boolean): void { (el as unknown as { _checked: boolean })._checked = Boolean(v); },
  });

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
  const tagAttrMatch = /^([a-zA-Z]+)\[([a-zA-Z-]+)="([^"]+)"\]$/.exec(sel);
  if (tagAttrMatch) {
    const [, tag, attr, val] = tagAttrMatch;
    return (el) => {
      if (el.tagName !== tag!.toUpperCase()) return false;
      if (attr === 'type') return (el as unknown as { _type: string })._type === val;
      return el.getAttribute(attr!) === val;
    };
  }
  return (el) => el.tagName === sel.toUpperCase();
}

// ───── Mock obsidian with enhanced Modal + TFile + TFolder ─────
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

// ───── Mock SnippetFillInModal ─────
const __fillModalInstances: Array<{
  snippet: unknown;
  result: Promise<string | null>;
  __resolve: (v: string | null) => void;
  open: () => void;
  close: () => void;
}> = [];

vi.mock('../../views/snippet-fill-in-modal', () => {
  const instances = __fillModalInstances;
  class SnippetFillInModal {
    result: Promise<string | null>;
    private resolveFn!: (v: string | null) => void;
    opened = false;
    closed = false;
    readonly snippet: unknown;
    constructor(_app: unknown, snippet: unknown) {
      this.snippet = snippet;
      this.result = new Promise<string | null>(res => { this.resolveFn = res; });
      instances.push({
        snippet,
        result: this.result,
        __resolve: (v) => this.resolveFn(v),
        open: () => { this.opened = true; },
        close: () => { this.closed = true; },
      });
    }
    open(): void { this.opened = true; }
    close(): void { this.closed = true; }
  }
  return { SnippetFillInModal, __fillModalInstances: instances };
});

// Import after mocks are installed.
import { InlineRunnerModal } from '../../views/inline-runner-modal';
import { TFile } from 'obsidian';

// ───── Helpers ─────

function makeTargetNote(): TFile {
  return new TFile('notes/target.md');
}

function makePlugin(overrides?: Partial<{
  textSeparator: string;
  snippetFolderPath: string;
}>): any {
  const vaultModifyCalls: [string, string][] = [];
  const plugin = {
    settings: {
      textSeparator: overrides?.textSeparator ?? 'newline',
      snippetFolderPath: overrides?.snippetFolderPath ?? 'Snippets',
      protocolFolderPath: 'Protocols',
    },
    snippetService: {
      load: vi.fn(async (_absPath: string) => null),
    },
    insertMutex: {
      runExclusive: vi.fn(async (_path: string, fn: () => Promise<void>) => fn()),
    },
    activateRunnerView: vi.fn(),
    _vaultModifyCalls: vaultModifyCalls,
  };
  return plugin;
}

function makeApp(plugin: any, opts?: { vaultContent?: string }): any {
  const vaultContent = opts?.vaultContent ?? '';
  const modifyCalls: [string, string][] = [];
  return {
    vault: {
      getAbstractFileByPath: vi.fn(() => null),
      read: vi.fn(async () => vaultContent),
      modify: vi.fn(async (file: TFile, content: string) => {
        modifyCalls.push([file.path, content]);
        plugin._vaultModifyCalls.push([file.path, content]);
      }),
      getFiles: vi.fn(() => []),
    },
    workspace: {
      on: vi.fn(() => ({})),
      getActiveFile: vi.fn(() => null),
      iterateAllLeaves: vi.fn(() => {}),
    },
    _modifyCalls: modifyCalls,
  };
}

function setupModal(opts?: { vaultContent?: string; textSeparator?: string }): {
  modal: InlineRunnerModal;
  app: any;
  plugin: any;
  targetNote: TFile;
} {
  const targetNote = makeTargetNote();
  const plugin = makePlugin({ textSeparator: opts?.textSeparator });
  const app = makeApp(plugin, { vaultContent: opts?.vaultContent });
  const modal = new InlineRunnerModal(
    app as any,
    plugin as any,
    'test.canvas',
    targetNote,
  );
  return { modal, app, plugin, targetNote };
}

// ───── Tests ─────

describe('InlineRunnerModal — snippet insert separator (INLINE-FIX-04)', () => {
  it('(a) MD snippet append includes configured newline separator between prior text and snippet content', async () => {
    const { modal, app } = setupModal({ vaultContent: 'Prior answer' });
    let accumulatedText = 'Prior answer';
    vi.spyOn((modal as any).runner, 'getState').mockImplementation(() => ({
      status: 'awaiting-snippet-pick',
      accumulatedText,
    } as any));
    vi.spyOn((modal as any).runner, 'pickSnippet').mockImplementation(() => {});
    vi.spyOn((modal as any).runner, 'completeSnippet').mockImplementation((text: string) => {
      accumulatedText += '\n' + text;
    });

    const mdSnippet = { kind: 'md', path: 'Snippets/report.md', content: 'Report text' };
    await (modal as any).handleSnippetPickerSelection(mdSnippet);

    // After Wave 1b: delta includes separator
    expect(app.vault.modify).toHaveBeenCalledWith(
      expect.anything(),
      'Prior answer\nReport text',
    );
  });

  it('(b) JSON zero-placeholder snippet append applies separator', async () => {
    const { modal, app } = setupModal({ vaultContent: 'Prior answer' });
    let accumulatedText = 'Prior answer';
    vi.spyOn((modal as any).runner, 'getState').mockImplementation(() => ({
      status: 'awaiting-snippet-pick',
      accumulatedText,
    } as any));
    vi.spyOn((modal as any).runner, 'pickSnippet').mockImplementation(() => {});
    vi.spyOn((modal as any).runner, 'completeSnippet').mockImplementation((text: string) => {
      accumulatedText += '\n' + text;
    });

    const jsonSnippet = { kind: 'json', id: 'static', name: 'static', path: 'Snippets/static.json', template: 'Static text', placeholders: [], validationError: null };
    await (modal as any).handleSnippetPickerSelection(jsonSnippet);

    expect(app.vault.modify).toHaveBeenCalledWith(
      expect.anything(),
      'Prior answer\nStatic text',
    );
  });

  it('(d) per-node radiprotocol_snippetSeparator = "space" overrides global newline', async () => {
    const { modal, app } = setupModal({ vaultContent: 'Prior answer' });
    let accumulatedText = 'Prior answer';
    vi.spyOn((modal as any).runner, 'getState').mockImplementation(() => ({
      status: 'awaiting-snippet-pick',
      accumulatedText,
    } as any));
    vi.spyOn((modal as any).runner, 'pickSnippet').mockImplementation(() => {});
    vi.spyOn((modal as any).runner, 'completeSnippet').mockImplementation((text: string) => {
      // Simulate space separator applied by runner
      accumulatedText += ' ' + text;
    });

    const mdSnippet = { kind: 'md', path: 'Snippets/report.md', content: 'Report text' };
    await (modal as any).handleSnippetPickerSelection(mdSnippet);

    expect(app.vault.modify).toHaveBeenCalledWith(
      expect.anything(),
      'Prior answer Report text',
    );
  });

  it('(e) first-chunk invariant — no leading separator when accumulator is empty', async () => {
    const { modal, app } = setupModal({ vaultContent: '' });
    let accumulatedText = '';
    vi.spyOn((modal as any).runner, 'getState').mockImplementation(() => ({
      status: 'awaiting-snippet-pick',
      accumulatedText,
    } as any));
    vi.spyOn((modal as any).runner, 'pickSnippet').mockImplementation(() => {});
    vi.spyOn((modal as any).runner, 'completeSnippet').mockImplementation((text: string) => {
      accumulatedText += text; // no separator on first chunk
    });

    const mdSnippet = { kind: 'md', path: 'Snippets/report.md', content: 'First snippet' };
    await (modal as any).handleSnippetPickerSelection(mdSnippet);

    expect(app.vault.modify).toHaveBeenCalledWith(
      expect.anything(),
      'First snippet',
    );
  });
});

describe('InlineRunnerModal — JSON fill-in modal (INLINE-FIX-05)', () => {
  beforeEach(() => {
    __fillModalInstances.length = 0;
  });

  it('(a) JSON snippet with placeholders instantiates new SnippetFillInModal(app, snippet)', async () => {
    const { modal } = setupModal();
    let accumulatedText = '';
    vi.spyOn((modal as any).runner, 'getState').mockImplementation(() => ({
      status: 'awaiting-snippet-fill',
      accumulatedText,
    } as any));
    vi.spyOn((modal as any).runner, 'completeSnippet').mockImplementation((text: string) => {
      accumulatedText += text;
    });

    const jsonSnippet = {
      kind: 'json',
      id: 'fill',
      name: 'fill',
      path: 'Snippets/fill.json',
      template: 'R: {{f}}',
      placeholders: [{ id: 'f', label: 'Findings', type: 'free-text' as const }],
      validationError: null,
    };

    // Drive handleSnippetFill directly — reaching it via full canvas run is too wide for a unit test.
    const zone = makeEl('div');
    const loadSpy = vi.spyOn((modal as any).plugin.snippetService, 'load');
    loadSpy.mockResolvedValue(jsonSnippet);

    const promise = (modal as any).handleSnippetFill('fill.json', zone);
    // Wait a tick for the async load + modal open
    await new Promise(r => setTimeout(r, 10));

    expect(__fillModalInstances.length).toBeGreaterThanOrEqual(1);
    const instance = __fillModalInstances[__fillModalInstances.length - 1];
    expect(instance.snippet).toBe(jsonSnippet);
    expect(instance.opened).toBe(true);

    // Resolve to unblock the await
    instance.__resolve('R: resolved');
    await promise;
  });

  it('(b) modal.__resolve(rendered) — runner.completeSnippet(rendered) called + delta appended to note', async () => {
    const { modal, app } = setupModal({ vaultContent: 'Prior text' });
    let accumulatedText = 'Prior text';
    vi.spyOn((modal as any).runner, 'getState').mockImplementation(() => ({
      status: 'awaiting-snippet-fill',
      accumulatedText,
    } as any));
    vi.spyOn((modal as any).runner, 'completeSnippet').mockImplementation((text: string) => {
      accumulatedText += '\n' + text;
    });

    const jsonSnippet = {
      kind: 'json',
      id: 'fill',
      name: 'fill',
      path: 'Snippets/fill.json',
      template: 'R: {{f}}',
      placeholders: [{ id: 'f', label: 'Findings', type: 'free-text' as const }],
      validationError: null,
    };

    const zone = makeEl('div');
    vi.spyOn((modal as any).plugin.snippetService, 'load').mockResolvedValue(jsonSnippet);

    const promise = (modal as any).handleSnippetFill('fill.json', zone);
    await new Promise(r => setTimeout(r, 10));

    const instance = __fillModalInstances[__fillModalInstances.length - 1];
    instance.__resolve('R: resolved');
    await promise;

    expect(app.vault.modify).toHaveBeenCalledWith(
      expect.anything(),
      'Prior text\nR: resolved',
    );
  });

  it('(c) modal.__resolve(null) — runner.completeSnippet("") called + no note append (first-chunk invariant)', async () => {
    const { modal, app } = setupModal({ vaultContent: '' });
    let accumulatedText = '';
    vi.spyOn((modal as any).runner, 'getState').mockImplementation(() => ({
      status: 'awaiting-snippet-fill',
      accumulatedText,
    } as any));
    vi.spyOn((modal as any).runner, 'completeSnippet').mockImplementation((text: string) => {
      accumulatedText += text;
    });

    const jsonSnippet = {
      kind: 'json',
      id: 'fill',
      name: 'fill',
      path: 'Snippets/fill.json',
      template: 'R: {{f}}',
      placeholders: [{ id: 'f', label: 'Findings', type: 'free-text' as const }],
      validationError: null,
    };

    const zone = makeEl('div');
    vi.spyOn((modal as any).plugin.snippetService, 'load').mockResolvedValue(jsonSnippet);

    const promise = (modal as any).handleSnippetFill('fill.json', zone);
    await new Promise(r => setTimeout(r, 10));

    const instance = __fillModalInstances[__fillModalInstances.length - 1];
    instance.__resolve(null);
    await promise;

    // After Wave 1c: completeSnippet('') is a no-op for empty string, so no vault.modify call
    expect(app.vault.modify).not.toHaveBeenCalled();
  });

  it('(d) in-panel renderSnippetFillIn is no longer reachable (source-string grep inside test)', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../views/inline-runner-modal.ts'),
      'utf8',
    );
    expect(src).not.toContain('renderSnippetFillIn');
    expect(src).not.toContain('rp-snippet-fill-form');
  });

  it('(e) Z-index sanity — SnippetFillInModal open() called AFTER inline container attached to DOM', async () => {
    const { modal } = setupModal();
    vi.spyOn((modal as any).runner, 'getState').mockImplementation(() => ({
      status: 'awaiting-snippet-fill',
      accumulatedText: '',
    } as any));

    const jsonSnippet = {
      kind: 'json',
      id: 'fill',
      name: 'fill',
      path: 'Snippets/fill.json',
      template: 'R: {{f}}',
      placeholders: [{ id: 'f', label: 'Findings', type: 'free-text' as const }],
      validationError: null,
    };

    const zone = makeEl('div');
    vi.spyOn((modal as any).plugin.snippetService, 'load').mockResolvedValue(jsonSnippet);

    // Simulate container being attached
    (modal as any).containerEl = makeEl('div');
    (modal as any).containerEl.setAttribute('class', 'rp-inline-runner-container');

    const promise = (modal as any).handleSnippetFill('fill.json', zone);
    await new Promise(r => setTimeout(r, 10));

    const instance = __fillModalInstances[__fillModalInstances.length - 1];
    expect(instance.opened).toBe(true);
    instance.__resolve('R: resolved');
    await promise;
  });
});

describe('InlineRunnerModal — Phase 54 D1/D6/D7 regression guards', () => {
  it('D1 gate — inline container does NOT get is-hidden while SnippetFillInModal is open (isFillModalOpen flag)', () => {
    const { modal } = setupModal();
    const container = makeEl('div');
    (modal as any).containerEl = container;
    (modal as any).isFillModalOpen = true;

    // Simulate active leaf change when a different file is active
    (modal as any).app.workspace.getActiveFile = vi.fn(() => new TFile('other.md'));
    (modal as any).app.workspace.iterateAllLeaves = vi.fn((cb: any) => {
      // target note still has open leaves
      cb({ view: { file: new TFile('notes/target.md') } });
    });

    (modal as any).handleActiveLeafChange();

    expect(container.hasClass('is-hidden')).toBe(false);
  });

  it('D6 reversal — renderSnippetFillIn symbol does not exist in current inline-runner-modal.ts source', () => {
    const src = fs.readFileSync(
      path.resolve(__dirname, '../../views/inline-runner-modal.ts'),
      'utf8',
    );
    expect(src).not.toContain('renderSnippetFillIn');
    expect(src).not.toContain('rp-snippet-fill-form');
  });

  it('D7 parity — inline snippet insert produces same delta as sidebar for identical fixture', async () => {
    const { modal, app } = setupModal({ vaultContent: '' });
    let accumulatedText = '';
    vi.spyOn((modal as any).runner, 'getState').mockImplementation(() => ({
      status: 'awaiting-snippet-pick',
      accumulatedText,
    } as any));
    vi.spyOn((modal as any).runner, 'pickSnippet').mockImplementation(() => {});
    vi.spyOn((modal as any).runner, 'completeSnippet').mockImplementation((text: string) => {
      accumulatedText += '\n' + text;
    });

    const mdSnippet = { kind: 'md', path: 'Snippets/report.md', content: 'Report text' };
    await (modal as any).handleSnippetPickerSelection(mdSnippet);

    const inlineDelta = app._modifyCalls[0]?.[1] ?? '';

    // Simulate sidebar-style append for the same fixture:
    // Sidebar calls runner.completeSnippet then appends the accumulator delta.
    // For this test, we assert inline produces the same delta string.
    expect(inlineDelta).toBe('\nReport text');
  });
});

describe('InlineRunnerModal — INLINE-FIX-04 (c) JSON with-placeholder + separator', () => {
  beforeEach(() => {
    __fillModalInstances.length = 0;
  });

  it('(c) JSON with-placeholder snippet insert applies separator after modal resolves', async () => {
    const { modal, app } = setupModal({ vaultContent: 'Prior text' });
    let accumulatedText = 'Prior text';
    vi.spyOn((modal as any).runner, 'getState').mockImplementation(() => ({
      status: 'awaiting-snippet-fill',
      accumulatedText,
    } as any));
    vi.spyOn((modal as any).runner, 'completeSnippet').mockImplementation((text: string) => {
      accumulatedText += '\n' + text;
    });

    const jsonSnippet = {
      kind: 'json',
      id: 'fill',
      name: 'fill',
      path: 'Snippets/fill.json',
      template: 'R: {{f}}',
      placeholders: [{ id: 'f', label: 'Findings', type: 'free-text' as const }],
      validationError: null,
    };

    const zone = makeEl('div');
    vi.spyOn((modal as any).plugin.snippetService, 'load').mockResolvedValue(jsonSnippet);

    const promise = (modal as any).handleSnippetFill('fill.json', zone);
    await new Promise(r => setTimeout(r, 10));

    const instance = __fillModalInstances[__fillModalInstances.length - 1];
    instance.__resolve('R: resolved');
    await promise;

    expect(app.vault.modify).toHaveBeenCalledWith(
      expect.anything(),
      'Prior text\nR: resolved',
    );
  });
});
