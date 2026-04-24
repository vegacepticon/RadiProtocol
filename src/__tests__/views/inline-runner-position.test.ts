import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TFile } from 'obsidian';
import type RadiProtocolPlugin from '../../main';
import { clampInlineRunnerPosition, InlineRunnerModal } from '../../views/inline-runner-modal';
import type { InlineRunnerPosition } from '../../settings';

vi.mock('obsidian');

vi.mock('../../views/snippet-tree-picker', () => ({
  SnippetTreePicker: class {
    async mount(): Promise<void> {}
    unmount(): void {}
  },
}));

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
  dispatch(type: string, event: Partial<PointerEvent>): void {
    for (const handler of this.listeners.get(type) ?? []) handler(event as PointerEvent);
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
  dispatch(type: string, event: Partial<PointerEvent>): void {
    for (const handler of this.listeners.get(type) ?? []) handler(event as PointerEvent);
  }
}

interface ModalInternals {
  buildContainer: () => void;
  restoreOrDefaultPosition: () => void;
  reclampCurrentPosition: (persist: boolean) => Promise<void>;
  close: () => void;
  containerEl: FakeElement | null;
  headerEl: FakeElement | null;
}

function makePlugin(saved: InlineRunnerPosition | null = null): RadiProtocolPlugin & {
  saved: InlineRunnerPosition | null;
  saveSpy: ReturnType<typeof vi.fn>;
} {
  const plugin = {
    saved,
    saveSpy: vi.fn(async (position: InlineRunnerPosition | null) => {
      plugin.saved = position;
    }),
    settings: { textSeparator: 'newline', snippetFolderPath: '.radiprotocol/snippets' },
    getInlineRunnerPosition: () => plugin.saved,
    saveInlineRunnerPosition: (position: InlineRunnerPosition | null) => plugin.saveSpy(position),
    canvasLiveEditor: { getCanvasJSON: () => null },
    canvasParser: { parse: vi.fn() },
    snippetService: { load: vi.fn() },
    saveOutputToNote: vi.fn(),
    insertIntoCurrentNote: vi.fn(),
  };
  return plugin as unknown as RadiProtocolPlugin & { saved: InlineRunnerPosition | null; saveSpy: ReturnType<typeof vi.fn> };
}

function fakeTFile(path: string): TFile {
  return Object.assign(new TFile(), { path, name: path.split('/').pop() ?? path, extension: path.split('.').pop() ?? '', basename: path.replace(/\.md$/, '') });
}

function mount(saved: InlineRunnerPosition | null = null): { modal: ModalInternals; plugin: ReturnType<typeof makePlugin>; doc: FakeDocument } {
  const doc = new FakeDocument();
  vi.stubGlobal('document', doc);
  vi.stubGlobal('window', {
    innerWidth: 1024,
    innerHeight: 768,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal('ResizeObserver', class { observe(): void {} disconnect(): void {} });

  const plugin = makePlugin(saved);
  const app = { vault: { getAbstractFileByPath: vi.fn(), read: vi.fn(), modify: vi.fn(), on: vi.fn() }, workspace: { on: vi.fn(), offref: vi.fn(), getActiveFile: vi.fn(() => fakeTFile('note.md')), iterateAllLeaves: vi.fn() } };
  const modal = new InlineRunnerModal(app as never, plugin, 'protocol.canvas', fakeTFile('note.md')) as unknown as ModalInternals;
  modal.buildContainer();
  return { modal, plugin, doc };
}

describe('Phase 60 D-01/D-02 inline runner position persistence', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('opens without saved state at a compact default in the viewport', () => {
    const { modal } = mount(null);
    modal.restoreOrDefaultPosition();

    expect(modal.containerEl?.style.left).toBe('648px');
    expect(modal.containerEl?.style.top).toBe('512px');
    expect(modal.containerEl?.style.right).toBe('');
    expect(modal.containerEl?.style.bottom).toBe('');
    expect(modal.containerEl?.style.transform).toBe('');
  });

  it('dragging the header updates left/top, clears bottom/right, and saves coordinates', () => {
    const { modal, plugin, doc } = mount(null);
    modal.restoreOrDefaultPosition();

    modal.headerEl?.dispatch('pointerdown', { clientX: 100, clientY: 100 });
    doc.dispatch('pointermove', { clientX: 140, clientY: 125 });
    doc.dispatch('pointerup', { clientX: 140, clientY: 125 });

    expect(modal.containerEl?.style.left).toBe('688px');
    expect(modal.containerEl?.style.top).toBe('537px');
    expect(modal.containerEl?.style.right).toBe('');
    expect(modal.containerEl?.style.bottom).toBe('');
    expect(plugin.saveSpy).toHaveBeenCalledWith({ left: 688, top: 537 });
    expect(doc.listeners.get('pointermove')).toHaveLength(0);
  });

  it('reopening after saved coordinates restores them', () => {
    const { modal } = mount({ left: 220, top: 180 });
    modal.restoreOrDefaultPosition();

    expect(modal.containerEl?.style.left).toBe('220px');
    expect(modal.containerEl?.style.top).toBe('180px');
  });

  it('saved coordinates outside the viewport are clamped to visible bounds', () => {
    const clamped = clampInlineRunnerPosition({ left: 5000, top: -200 }, { width: 1024, height: 768 }, { width: 360, height: 240 });
    expect(clamped).toEqual({ left: 864, top: 0 });

    const { modal } = mount({ left: 5000, top: -200 });
    modal.restoreOrDefaultPosition();
    expect(modal.containerEl?.style.left).toBe('864px');
    expect(modal.containerEl?.style.top).toBe('0px');
  });

  it('layout-change re-clamps the visible modal without erasing an in-bounds saved user position', async () => {
    const { modal, plugin } = mount({ left: 920, top: 740 });
    modal.restoreOrDefaultPosition();
    if (modal.containerEl !== null) {
      modal.containerEl.style.left = '920px';
      modal.containerEl.style.top = '740px';
    }

    await modal.reclampCurrentPosition(true);

    expect(modal.containerEl?.style.left).toBe('864px');
    expect(modal.containerEl?.style.top).toBe('728px');
    expect(plugin.saveSpy).toHaveBeenCalledWith({ left: 864, top: 728 });
  });
});
