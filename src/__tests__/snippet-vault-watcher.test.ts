// Phase 33 Plan 04 — SnippetManagerView vault watcher tests (SYNC-01..03).
// Verifies create/delete/rename subscriptions via registerEvent, the D-18
// prefix filter, and the 120ms debounced redraw.
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Stub window for scheduleRedraw's window.setTimeout / clearTimeout calls.
(globalThis as any).window = globalThis;
(globalThis as any).document = { createElement: (_t: string) => makeEl(_t) };

// --- Shared MockEl (minimal subset) --------------------------------------
interface MockEl {
  tagName: string;
  children: MockEl[];
  _text: string;
  classList: Set<string>;
  _attrs: Record<string, string>;
  _listeners: Map<string, Array<(ev: unknown) => void>>;
  style: Record<string, string>;
  createEl: (t: string, opts?: any) => MockEl;
  createDiv: (opts?: any) => MockEl;
  createSpan: (opts?: any) => MockEl;
  empty: () => void;
  setText: (t: string) => void;
  appendChild: (c: MockEl) => MockEl;
  addClass: (c: string) => void;
  removeClass: (c: string) => void;
  setAttribute: (k: string, v: string) => void;
  getAttribute: (k: string) => string | null;
  addEventListener: (t: string, h: (e: unknown) => void) => void;
  dispatchEvent: (e: { type: string }) => void;
  closest: (s: string) => MockEl | null;
  querySelector: (s: string) => MockEl | null;
  querySelectorAll: (s: string) => MockEl[];
  focus: () => void;
}

function makeEl(tag = 'div'): MockEl {
  const listeners = new Map<string, Array<(ev: unknown) => void>>();
  const style: Record<string, string> = {};
  const attrs: Record<string, string> = {};
  const classSet = new Set<string>();
  const children: MockEl[] = [];
  const el: MockEl = {
    tagName: tag.toUpperCase(),
    children,
    _text: '',
    classList: classSet,
    _attrs: attrs,
    _listeners: listeners,
    style,
    createEl(t: string, opts?: any): MockEl {
      const child = makeEl(t);
      if (opts?.text) child._text = opts.text;
      if (opts?.cls) for (const c of String(opts.cls).split(/\s+/)) child.classList.add(c);
      if (opts?.attr) for (const [k, v] of Object.entries(opts.attr)) child._attrs[k] = String(v);
      children.push(child);
      return child;
    },
    createDiv(opts?: any): MockEl { return this.createEl('div', opts); },
    createSpan(opts?: any): MockEl { return this.createEl('span', opts); },
    empty(): void { children.length = 0; },
    setText(t: string): void { el._text = t; },
    appendChild(c: MockEl): MockEl { children.push(c); return c; },
    addClass(c: string): void { classSet.add(c); },
    removeClass(c: string): void { classSet.delete(c); },
    setAttribute(k: string, v: string): void { attrs[k] = v; },
    getAttribute(k: string): string | null { return attrs[k] ?? null; },
    addEventListener(t: string, h: (e: unknown) => void): void {
      const a = listeners.get(t) ?? [];
      a.push(h);
      listeners.set(t, a);
    },
    dispatchEvent(e: { type: string }): void {
      const a = listeners.get(e.type) ?? [];
      for (const h of a) h(e);
    },
    closest(): MockEl | null { return null; },
    querySelector(): MockEl | null { return null; },
    querySelectorAll(): MockEl[] { return []; },
    focus(): void {},
  };
  return el;
}

// --- vi.mock('obsidian') — captures vault.on handlers --------------------
type VaultHandler = (file: { path: string }, oldPath?: string) => void;
const capturedHandlers: Record<string, VaultHandler> = {};

vi.mock('obsidian', () => {
  class ItemView {
    leaf: unknown;
    contentEl: MockEl;
    app: {
      vault: {
        on: (ev: string, cb: VaultHandler) => { ref: string };
      };
    };
    _registeredEvents: Array<unknown> = [];
    _registeredDomEvents: Array<unknown> = [];
    constructor(leaf: unknown) {
      this.leaf = leaf;
      this.contentEl = makeEl('div');
      this.app = {
        vault: {
          on: (ev: string, cb: VaultHandler) => {
            capturedHandlers[ev] = cb;
            return { ref: ev };
          },
        },
      };
    }
    registerEvent(ref: unknown): void { this._registeredEvents.push(ref); }
    registerDomEvent(el: MockEl, type: string, handler: (ev: unknown) => void): void {
      this._registeredDomEvents.push({ el, type, handler });
      el.addEventListener(type, handler);
    }
    getViewType(): string { return ''; }
    getDisplayText(): string { return ''; }
    getIcon(): string { return ''; }
  }
  class WorkspaceLeaf {}
  class Notice { constructor(_m: string) {} }
  const setIcon = (_el: unknown, _icon: string): void => {};
  class Menu {
    addItem(_cb: any): this { return this; }
    addSeparator(): this { return this; }
    showAtMouseEvent(_e: unknown): void {}
  }
  // Phase 34: SuggestModal stub — folder-picker-modal.ts imports it transitively
  class SuggestModal<T> {
    app: unknown;
    constructor(app: unknown) { this.app = app; }
    setPlaceholder(_p: string): void {}
    getSuggestions(_q: string): T[] | Promise<T[]> { return []; }
    renderSuggestion(_v: T, _el: unknown): void {}
    onChooseSuggestion(_v: T, _ev: unknown): void {}
    open(): void {}
    close(): void {}
  }
  // Phase 86: Modal / requestUrl stubs — library-browser-modal.ts imports them
  class Modal {
    app: unknown;
    contentEl: MockEl;
    titleEl: MockEl;
    constructor(app: unknown) {
      this.app = app;
      this.contentEl = makeEl('div');
      this.titleEl = makeEl('div');
    }
    open(): void {}
    close(): void {}
    onOpen(): void {}
    onClose(): void {}
  }
  const requestUrl = vi.fn();
  return { ItemView, WorkspaceLeaf, Notice, setIcon, Menu, SuggestModal, Modal, requestUrl };
});

// Mock downstream modals (never actually opened in these tests)
vi.mock('../views/snippet-editor-modal', () => ({
  SnippetEditorModal: class {
    readonly result = Promise.resolve({ saved: false });
    constructor(_a: unknown, _p: unknown, _o: unknown) {}
    open(): void {}
    close(): void {}
  },
}));
vi.mock('../views/confirm-modal', () => ({
  ConfirmModal: class {
    readonly result = Promise.resolve('cancel' as const);
    constructor(_a: unknown, _o: unknown) {}
    open(): void {}
    close(): void {}
  },
}));

// --- Module under test ---------------------------------------------------
import { SnippetManagerView } from '../views/snippet-manager-view';
// Phase 84 (I18N-02): plugin.i18n required by SnippetManagerView at render time.
import { I18nService } from '../i18n';

// --- Helpers --------------------------------------------------------------
function makePlugin(): any {
  return {
    app: {
      vault: {
        on: (ev: string, cb: VaultHandler) => {
          capturedHandlers[ev] = cb;
          return { ref: ev };
        },
      },
    },
    settings: {
      snippetFolderPath: '.radiprotocol/snippets',
      snippetTreeExpandedPaths: [],
    },
    snippetService: {
      listFolder: vi.fn().mockResolvedValue({ folders: [], snippets: [] }),
    },
    saveSettings: vi.fn().mockResolvedValue(undefined),
    i18n: new I18nService('en'),
  };
}

function makeView(plugin: any): SnippetManagerView {
  const leaf = {} as any;
  const view = new SnippetManagerView(leaf, plugin);
  // Route the mocked ItemView's app → plugin.app so captured handlers come
  // from the plugin's shared map.
  (view as any).app = plugin.app;
  return view;
}

// ============================================================================
// SYNC-01..03
// ============================================================================
describe('SnippetManagerView — vault watcher', () => {
  beforeEach(() => {
    vi.useRealTimers();
    for (const k of Object.keys(capturedHandlers)) delete capturedHandlers[k];
  });

  it('SYNC-01: subscribes to create/delete/rename via registerEvent and debounces redraw at 120ms', async () => {
    vi.useFakeTimers();
    const plugin = makePlugin();
    const view = makeView(plugin);
    await view.onOpen();

    expect(capturedHandlers['create']).toBeDefined();
    expect(capturedHandlers['delete']).toBeDefined();
    expect(capturedHandlers['rename']).toBeDefined();
    // Three registerEvent calls were recorded
    expect((view as any)._registeredEvents.length).toBeGreaterThanOrEqual(3);

    // Clear the first rebuild call from onOpen()
    plugin.snippetService.listFolder.mockClear();

    // Fire create for a file inside the root
    capturedHandlers['create']!({ path: '.radiprotocol/snippets/new.json' });
    // Before 120ms: no new listFolder call
    vi.advanceTimersByTime(119);
    expect(plugin.snippetService.listFolder).not.toHaveBeenCalled();
    // At 120ms: rebuild fires
    vi.advanceTimersByTime(1);
    // Allow the microtask queue (rebuildTreeModel is async)
    await vi.runAllTimersAsync();
    expect(plugin.snippetService.listFolder).toHaveBeenCalled();
  });

  it('SYNC-02: ignores events outside snippetFolderPath prefix', async () => {
    vi.useFakeTimers();
    const plugin = makePlugin();
    const view = makeView(plugin);
    await view.onOpen();
    plugin.snippetService.listFolder.mockClear();

    // Fire create for a file outside the root
    capturedHandlers['create']!({ path: 'some/other/path.json' });
    vi.advanceTimersByTime(200);
    await vi.runAllTimersAsync();
    expect(plugin.snippetService.listFolder).not.toHaveBeenCalled();

    // Also: a path that shares a prefix but is not under the root
    capturedHandlers['create']!({ path: '.radiprotocol/snippets-shadow/x.json' });
    vi.advanceTimersByTime(200);
    await vi.runAllTimersAsync();
    expect(plugin.snippetService.listFolder).not.toHaveBeenCalled();
  });

  it('SYNC-03: uses registerEvent (not raw vault.offref) and clears pending timeout on close', async () => {
    vi.useFakeTimers();
    const plugin = makePlugin();
    const view = makeView(plugin);
    await view.onOpen();
    // registerEvent count ≥ 3
    expect((view as any)._registeredEvents.length).toBeGreaterThanOrEqual(3);

    // Schedule a redraw then close before the timer fires
    plugin.snippetService.listFolder.mockClear();
    capturedHandlers['rename']!({ path: '.radiprotocol/snippets/a.json' }, '.radiprotocol/snippets/b.json');
    // Close before 120ms elapses
    await view.onClose();
    vi.advanceTimersByTime(500);
    await vi.runAllTimersAsync();
    // The pending debounce was cleared → no rebuild after close
    expect(plugin.snippetService.listFolder).not.toHaveBeenCalled();
    // Source-level guarantee: we use registerEvent, not vault.offref
    // (the view source does not reference offref anywhere).
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require('path');
    const src = fs.readFileSync(
      path.join(__dirname, '..', 'views', 'snippet-manager-view.ts'),
      'utf8',
    );
    expect(src).not.toContain('offref');
    expect(src).toContain('registerEvent');
  });
});
