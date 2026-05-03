// Phase 67: layout clamp + ResizeObserver lifecycle tests
// Reuses scaffolding patterns from src/__tests__/views/inline-runner-position.test.ts.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TFile } from 'obsidian';
import type RadiProtocolPlugin from '../main';
import { clampInlineRunnerLayout, InlineRunnerModal } from '../views/inline-runner-modal';
import type { InlineRunnerLayout } from '../settings';
import { I18nService } from '../i18n';

vi.mock('obsidian');

vi.mock('../views/snippet-tree-picker', () => ({
  SnippetTreePicker: class {
    async mount(): Promise<void> {}
    unmount(): void {}
  },
}));

describe('clampInlineRunnerLayout (Phase 67 D-10)', () => {
  const viewport = { width: 1024, height: 768 };

  it('clamps oversized width and height to viewport - 32px margin', () => {
    const result = clampInlineRunnerLayout({ left: 0, top: 0, width: 9999, height: 9999 }, viewport);
    expect(result).toEqual({ left: 0, top: 0, width: 1024 - 32, height: 768 - 32 });
  });

  it('falls back to INLINE_RUNNER_DEFAULT_WIDTH/HEIGHT when width/height are missing (D-06)', () => {
    const result = clampInlineRunnerLayout({ left: 0, top: 0 }, viewport);
    expect(result).toEqual({ left: 0, top: 0, width: 420, height: 320 });
  });

  it('preserves width/height already within bounds', () => {
    const result = clampInlineRunnerLayout({ left: 0, top: 0, width: 400, height: 200 }, viewport);
    expect(result).toEqual({ left: 0, top: 0, width: 400, height: 200 });
  });

  it('falls back to defaults for non-finite width/height (NaN, negative, zero)', () => {
    const r1 = clampInlineRunnerLayout({ left: 0, top: 0, width: NaN, height: -5 }, viewport);
    expect(r1).toEqual({ left: 0, top: 0, width: 420, height: 320 });
    const r2 = clampInlineRunnerLayout({ left: 0, top: 0, width: 0, height: 0 }, viewport);
    expect(r2).toEqual({ left: 0, top: 0, width: 420, height: 320 });
  });

  it('returns null when layout is null (no recovery)', () => {
    expect(clampInlineRunnerLayout(null, viewport)).toBeNull();
  });
});

// ── ResizeObserver lifecycle tests ──────────────────────────────────────────

type Handler = (event: PointerEvent) => void;

class FakeClassList {
  private readonly classes = new Set<string>();
  constructor(initial?: string) {
    for (const cls of initial?.split(/\s+/).filter(Boolean) ?? []) this.classes.add(cls);
  }
  add(cls: string): void { this.classes.add(cls); }
  remove(cls: string): void { this.classes.delete(cls); }
  contains(cls: string): boolean { return this.classes.has(cls); }
}

class FakeElement {
  children: FakeElement[] = [];
  parentElement: FakeElement | null = null;
  style: Record<string, string> = {};
  classList: FakeClassList;
  listeners = new Map<string, Handler[]>();
  text = '';
  disabled = false;
  value = '';
  checked = false;

  constructor(public tag = 'div', cls?: string, private rect = { width: 360, height: 240 }) {
    this.classList = new FakeClassList(cls);
  }

  createDiv(opts?: { cls?: string; text?: string }): FakeElement {
    return this.createEl('div', opts);
  }

  createEl(tag: string, opts?: { cls?: string; text?: string; attr?: Record<string, string> }): FakeElement {
    const child = new FakeElement(tag, opts?.cls);
    child.parentElement = this;
    child.text = opts?.text ?? '';
    this.children.push(child);
    return child;
  }

  empty(): void { this.children = []; }
  setText(text: string): void { this.text = text; }
  appendText(text: string): void { this.text += text; }
  setAttribute(_name: string, _value: string): void {}
  addClass(cls: string): void { this.classList.add(cls); }
  removeClass(cls: string): void { this.classList.remove(cls); }
  hasClass(cls: string): boolean { return this.classList.contains(cls); }
  toggleClass(cls: string, add: boolean): void { if (add) this.classList.add(cls); else this.classList.remove(cls); }
  remove(): void {
    if (this.parentElement !== null) {
      this.parentElement.children = this.parentElement.children.filter(child => child !== this);
    }
  }
  querySelector(selector: string): FakeElement | null {
    const cls = selector.startsWith('.') ? selector.slice(1) : selector;
    return this.findByClass(cls);
  }
  private findByClass(cls: string): FakeElement | null {
    if (this.classList.contains(cls)) return this;
    for (const child of this.children) {
      const found = child.findByClass(cls);
      if (found !== null) return found;
    }
    return null;
  }
  addEventListener(type: string, handler: Handler): void {
    const handlers = this.listeners.get(type) ?? [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }
  setRect(rect: { width: number; height: number }): void {
    this.rect = rect;
  }
  getBoundingClientRect(): { width: number; height: number } {
    return this.rect;
  }
}

class FakeDocument {
  body = new FakeElement('body', undefined, { width: 1024, height: 768 });
  documentElement = { clientWidth: 1024, clientHeight: 768 };
  listeners = new Map<string, Handler[]>();
  querySelectorAll(): FakeElement[] { return []; }
  addEventListener(type: string, handler: Handler): void {
    const handlers = this.listeners.get(type) ?? [];
    handlers.push(handler);
    this.listeners.set(type, handlers);
  }
  removeEventListener(type: string, handler: Handler): void {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter(h => h !== handler));
  }
}

class ControllableResizeObserver {
  static lastInstance: ControllableResizeObserver | null = null;
  private callback: ResizeObserverCallback;
  constructor(cb: ResizeObserverCallback) {
    this.callback = cb;
    ControllableResizeObserver.lastInstance = this;
  }
  observe(_target: Element): void {}
  disconnect(): void {}
  trigger(): void {
    this.callback([] as unknown as ResizeObserverEntry[], this as unknown as ResizeObserver);
  }
}

interface ModalInternals {
  buildContainer: () => void;
  restoreOrDefaultPosition: () => void;
  reclampCurrentPosition: (persist: boolean) => Promise<void>;
  handleResizeTick: () => void;
  close: () => void;
  containerEl: FakeElement | null;
  headerEl: FakeElement | null;
  resizeObserver: ControllableResizeObserver | null;
}

function makePlugin(saved: InlineRunnerLayout | null = null): RadiProtocolPlugin & {
  saved: InlineRunnerLayout | null;
  saveSpy: ReturnType<typeof vi.fn>;
} {
  const plugin = {
    saved,
    saveSpy: vi.fn(async (layout: InlineRunnerLayout | null) => {
      plugin.saved = layout;
    }),
    settings: { textSeparator: 'newline', snippetFolderPath: '.radiprotocol/snippets', locale: 'ru' },
    getInlineRunnerPosition: () => plugin.saved,
    saveInlineRunnerPosition: (layout: InlineRunnerLayout | null) => plugin.saveSpy(layout),
    canvasLiveEditor: { getCanvasJSON: () => null },
    canvasParser: { parse: vi.fn() },
    snippetService: { load: vi.fn() },
    saveOutputToNote: vi.fn(),
    insertIntoCurrentNote: vi.fn(),
    // Phase 84 I18N-02: real I18nService so InlineRunnerModal constructor's
    // `this.plugin.i18n.t.bind(this.plugin.i18n)` does not throw.
    i18n: new I18nService('ru'),
  };
  return plugin as unknown as RadiProtocolPlugin & { saved: InlineRunnerLayout | null; saveSpy: ReturnType<typeof vi.fn> };
}

function fakeTFile(path: string): TFile {
  return Object.assign(new TFile(), {
    path,
    name: path.split('/').pop() ?? path,
    extension: path.split('.').pop() ?? '',
    basename: path.replace(/\.md$/, ''),
  });
}

interface FakeWindow {
  innerWidth: number;
  innerHeight: number;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  setTimeout: typeof globalThis.setTimeout;
  clearTimeout: typeof globalThis.clearTimeout;
}

function mount(saved: InlineRunnerLayout | null = null): {
  modal: ModalInternals;
  plugin: ReturnType<typeof makePlugin>;
  doc: FakeDocument;
  win: FakeWindow;
} {
  const doc = new FakeDocument();
  vi.stubGlobal('document', doc);
  const win: FakeWindow = {
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
  };
  vi.stubGlobal('window', win);
  vi.stubGlobal('ResizeObserver', ControllableResizeObserver);

  const plugin = makePlugin(saved);
  const app = {
    vault: { getAbstractFileByPath: vi.fn(), read: vi.fn(), modify: vi.fn(), on: vi.fn() },
    workspace: {
      on: vi.fn(),
      offref: vi.fn(),
      getActiveFile: vi.fn(() => fakeTFile('note.md')),
      iterateAllLeaves: vi.fn(),
    },
  };
  const modal = new InlineRunnerModal(
    app as never,
    plugin,
    'protocol.canvas',
    fakeTFile('note.md'),
  ) as unknown as ModalInternals;
  modal.buildContainer();
  // Wire ResizeObserver as in open() — keeps the harness aligned with production wiring.
  if (modal.containerEl !== null) {
    modal.resizeObserver = new ControllableResizeObserver(() => modal.handleResizeTick());
    modal.resizeObserver.observe(modal.containerEl as unknown as Element);
  }
  return { modal, plugin, doc, win };
}

describe('Phase 67 ResizeObserver lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    ControllableResizeObserver.lastInstance = null;
  });

  it('debounces 5 ticks within 400ms into a single saveInlineRunnerPosition call', () => {
    const { modal, plugin } = mount(null);
    modal.restoreOrDefaultPosition();
    plugin.saveSpy.mockClear();

    expect(modal.resizeObserver).not.toBeNull();
    // Five ticks within the debounce window — only the LAST should produce a save.
    for (let i = 0; i < 5; i++) {
      modal.resizeObserver?.trigger();
      vi.advanceTimersByTime(50);
    }
    // We've advanced 250ms; debounce is 400ms — no save yet.
    expect(plugin.saveSpy).not.toHaveBeenCalled();
    // Advance past the final 400ms-from-last-tick boundary.
    vi.advanceTimersByTime(400);
    expect(plugin.saveSpy).toHaveBeenCalledTimes(1);
  });

  it('adds .is-resizing on first tick and removes it after debounce expires', () => {
    const { modal } = mount(null);
    modal.restoreOrDefaultPosition();

    expect(modal.containerEl?.classList.contains('is-resizing')).toBe(false);
    modal.resizeObserver?.trigger();
    expect(modal.containerEl?.classList.contains('is-resizing')).toBe(true);

    vi.advanceTimersByTime(400);
    expect(modal.containerEl?.classList.contains('is-resizing')).toBe(false);
  });

  it('legacy on-disk position-only payload restores with default width/height (D-06 fallback)', () => {
    const { modal } = mount({ left: 100, top: 50 });
    modal.restoreOrDefaultPosition();

    expect(modal.containerEl?.style.left).toBe('100px');
    expect(modal.containerEl?.style.top).toBe('50px');
    expect(modal.containerEl?.style.width).toBe('420px');
    expect(modal.containerEl?.style.height).toBe('320px');
  });

  it('window-resize re-clamp on a shrunk viewport applies clamped layout and persists once', async () => {
    const { modal, plugin, win } = mount({ left: 100, top: 50, width: 800, height: 600 });
    modal.restoreOrDefaultPosition();
    plugin.saveSpy.mockClear();

    // Simulate a container whose actual size is larger than the new viewport.
    // (User had resized to 800x600; viewport now shrinks to 400x300 — classic
    // monitor/resolution-change scenario.)
    modal.containerEl?.setRect({ width: 800, height: 600 });

    // Shrink the viewport BELOW the saved size.
    win.innerWidth = 400;
    win.innerHeight = 300;

    await modal.reclampCurrentPosition(true);

    expect(plugin.saveSpy).toHaveBeenCalledTimes(1);
    const callArg = plugin.saveSpy.mock.calls[0]?.[0];
    expect(callArg).toBeDefined();
    expect(callArg.width).toBeLessThanOrEqual(400 - 32);
    expect(callArg.height).toBeLessThanOrEqual(300 - 32);
  });

  it('close() clears pending debounce timer and removes .is-resizing defensively', () => {
    const { modal, plugin } = mount(null);
    modal.restoreOrDefaultPosition();
    plugin.saveSpy.mockClear();

    modal.resizeObserver?.trigger();
    expect(modal.containerEl?.classList.contains('is-resizing')).toBe(true);

    // Capture container BEFORE close() (close() detaches it).
    const container = modal.containerEl;
    modal.close();

    // Container detached from DOM.
    expect(modal.containerEl).toBeNull();
    // .is-resizing was cleared on the captured node.
    expect(container?.classList.contains('is-resizing')).toBe(false);

    // Pending timer was cleared — advancing timers MUST NOT invoke save.
    vi.advanceTimersByTime(1000);
    expect(plugin.saveSpy).not.toHaveBeenCalled();
  });

  it('does NOT fallback to defaults or call save when container is hidden (display:none)', async () => {
    const { modal, plugin } = mount({ left: 100, top: 50, width: 500, height: 400 });
    modal.restoreOrDefaultPosition();
    plugin.saveSpy.mockClear();

    // Simulate hidden state (as when tab switch hides the modal via is-hidden)
    modal.containerEl?.addClass('is-hidden');

    await modal.reclampCurrentPosition(true);

    // saveSpy must NOT have been called because reclamp bailed early.
    expect(plugin.saveSpy).not.toHaveBeenCalled();
    // Style must remain unchanged — no default fallback injected.
    expect(modal.containerEl?.style.width).toBe('500px');
    expect(modal.containerEl?.style.height).toBe('400px');
  });
});
